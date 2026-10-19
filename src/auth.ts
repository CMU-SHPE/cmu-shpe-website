import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { admins, loginAttempts, type AdminRole } from '@/db/schema'
import { WINDOW_MINUTES, clientIp, isThrottled } from '@/lib/login-throttle'

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

async function recordFailure(email: string, ip: string | null, windowStart: Date) {
  const db = getDb()
  await db.insert(loginAttempts).values({ email, ip })
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, windowStart))
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const db = getDb()
        const email = parsed.data.email.toLowerCase()
        const ip = clientIp(request.headers?.get('x-forwarded-for') ?? null)
        const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

        const [[{ emailFailures }], [{ ipFailures }]] = await Promise.all([
          db
            .select({ emailFailures: count() })
            .from(loginAttempts)
            .where(and(eq(loginAttempts.email, email), gte(loginAttempts.createdAt, windowStart))),
          ip
            ? db
                .select({ ipFailures: count() })
                .from(loginAttempts)
                .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.createdAt, windowStart)))
            : Promise.resolve([{ ipFailures: 0 }]),
        ])
        if (isThrottled(emailFailures, ipFailures)) {
          console.warn(`LOGIN THROTTLED: ${email} from ${ip ?? 'unknown ip'}`)
          return null
        }

        const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1)
        if (!admin) {
          console.warn(`LOGIN FAILED (unknown email): ${email} from ${ip ?? 'unknown ip'}`)
          await recordFailure(email, ip, windowStart)
          return null
        }

        const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash)
        if (!valid) {
          console.warn(`LOGIN FAILED (bad password): ${email} from ${ip ?? 'unknown ip'}`)
          await recordFailure(email, ip, windowStart)
          return null
        }

        await db.delete(loginAttempts).where(eq(loginAttempts.email, email))

        return {
          id: String(admin.id),
          email: admin.email,
          name: admin.name,
          role: admin.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub ?? ''
      session.user.role = token.role as AdminRole
      return session
    },
  },
})
