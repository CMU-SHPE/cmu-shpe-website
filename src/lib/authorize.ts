import bcrypt from 'bcryptjs'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { admins, loginAttempts, members, type AdminRole, type MemberRole } from '@/db/schema'
import { WINDOW_MINUTES, clientIp, isThrottled } from '@/lib/login-throttle'

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

/** Unknown emails are checked against this so they take as long as a wrong password. */
const UNKNOWN_EMAIL_HASH = '$2b$12$zmxgyTFMPHMuQfXgqQ4z/.te.HtdD2kHyLthiKMDYsIYpN4nn1hZ2'

type AuthorizedAccount = {
  id: string
  email: string
  name: string
  /** Taken before the row is read, so a reset committing during the check still ends this session. */
  authTime: number
}

export type AuthorizedUser =
  | (AuthorizedAccount & { kind: 'admin'; role: AdminRole })
  | (AuthorizedAccount & { kind: 'member'; role: MemberRole })

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

// Both tables are always queried, so the response time doesn't show whether an email is an admin's.
async function findAccount(email: string) {
  const db = getDb()
  const [[admin], [member]] = await Promise.all([
    db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        role: admins.role,
        passwordHash: admins.passwordHash,
      })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1),
    db
      .select({
        id: members.id,
        email: members.email,
        name: members.name,
        role: members.role,
        passwordHash: members.passwordHash,
        emailConfirmedAt: members.emailConfirmedAt,
      })
      .from(members)
      .where(eq(members.email, email))
      .limit(1),
  ])
  if (admin) return { ...admin, kind: 'admin' as const, confirmed: true }
  if (member) return { ...member, kind: 'member' as const, confirmed: member.emailConfirmedAt !== null }
  return null
}

/**
 * An admin row wins over a member row with the same email. Every
 * path runs exactly one bcrypt compare, and an unconfirmed member gets the same
 * generic failure as a wrong password.
 */
export async function authorizeCredentials(
  credentials: unknown,
  forwardedFor: string | null,
): Promise<AuthorizedUser | null> {
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
  const account = await findAccount(email)
  const valid = await bcrypt.compare(parsed.data.password, account?.passwordHash ?? UNKNOWN_EMAIL_HASH)
  if (!account || !valid || !account.confirmed) {
    const reason = !account ? 'unknown email' : !valid ? 'bad password' : 'email not confirmed'
    console.warn(`LOGIN FAILED (${reason}): ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  await clearLoginAttempts(email)
  const signedIn = { id: String(account.id), email: account.email, name: account.name, authTime: checkedAt }
  return account.kind === 'admin'
    ? { ...signedIn, kind: 'admin', role: account.role }
    : { ...signedIn, kind: 'member', role: account.role }
}
