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

export type AuthorizedAdmin = {
  id: string
  email: string
  name: string
  role: AdminRole
  /** Taken before the row is read, so a reset committing during the check still ends this session. */
  authTime: number
}

/**
 * Records a password attempt and reports whether the email or IP is over its
 * limit. The row is written before counting so concurrent attempts see each
 * other; a correct password should be followed by clearLoginAttempts.
 */
export async function recordLoginAttempt(email: string, ip: string | null): Promise<{ throttled: boolean }> {
  const db = getDb()
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
  return { throttled: isThrottled(emailAttempts, ipAttempts) }
}

export async function clearLoginAttempts(email: string) {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.email, email))
}

export async function authorizeAdmin(
  credentials: unknown,
  forwardedFor: string | null,
): Promise<AuthorizedAdmin | null> {
  const parsed = credentialsSchema.safeParse(credentials)
  if (!parsed.success) return null

  const email = parsed.data.email.toLowerCase()
  const ip = clientIp(forwardedFor)

  const { throttled } = await recordLoginAttempt(email, ip)
  if (throttled) {
    console.warn(`LOGIN THROTTLED: ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  const checkedAt = Date.now()
  const [admin] = await getDb()
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

  await clearLoginAttempts(email)
  return { id: String(admin.id), email: admin.email, name: admin.name, role: admin.role, authTime: checkedAt }
}
