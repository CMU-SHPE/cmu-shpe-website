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

/** Unknown emails are checked against this so they take as long as a wrong password. */
const UNKNOWN_EMAIL_HASH = '$2b$12$zmxgyTFMPHMuQfXgqQ4z/.te.HtdD2kHyLthiKMDYsIYpN4nn1hZ2'

export type AuthorizedAdmin = { id: string; email: string; name: string; role: AdminRole }

export async function authorizeAdmin(
  credentials: unknown,
  forwardedFor: string | null,
): Promise<AuthorizedAdmin | null> {
  const parsed = credentialsSchema.safeParse(credentials)
  if (!parsed.success) return null

  const db = getDb()
  const email = parsed.data.email.toLowerCase()
  const ip = clientIp(forwardedFor)
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  await db.insert(loginAttempts).values({ email, ip })
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, windowStart))
  const [[{ emailAttempts }], [{ ipAttempts }]] = await Promise.all([
    db
      .select({ emailAttempts: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.email, email), gte(loginAttempts.createdAt, windowStart))),
    ip
      ? db
          .select({ ipAttempts: count() })
          .from(loginAttempts)
          .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.createdAt, windowStart)))
      : Promise.resolve([{ ipAttempts: 0 }]),
  ])
  if (isThrottled(emailAttempts, ipAttempts)) {
    console.warn(`LOGIN THROTTLED: ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      passwordHash: admins.passwordHash,
    })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1)
  const valid = await bcrypt.compare(parsed.data.password, admin?.passwordHash ?? UNKNOWN_EMAIL_HASH)
  if (!admin || !valid) {
    const reason = admin ? 'bad password' : 'unknown email'
    console.warn(`LOGIN FAILED (${reason}): ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.email, email))
  return { id: String(admin.id), email: admin.email, name: admin.name, role: admin.role }
}
