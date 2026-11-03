import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { admins, loginAttempts, members, type AdminRole, type MemberRole } from '@/db/schema'
import { isKnownDevice } from '@/lib/known-device'
import { LOGIN_LIMITS, clientIp, throttleIp } from '@/lib/login-throttle'
import { storeIfAllowed } from '@/lib/throttle-store'

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
 * Records a password attempt and reports whether it is over a limit. Counting and storing happen
 * under one lock in one transaction, and a refused attempt is never stored, so one source can't
 * count for more than its own allowance towards the per-email ceiling.
 */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  { knownDevice = false }: { knownDevice?: boolean } = {},
): Promise<{ throttled: boolean }> {
  const source = throttleIp(ip)
  return storeIfAllowed({
    table: loginAttempts,
    flow: 'login',
    scope: undefined,
    columns: { email, ip: source },
    email,
    ip: source,
    limits: LOGIN_LIMITS,
    skipEmailCeiling: knownDevice,
  })
}

/** With an ip, clears only that source, so the owner signing in doesn't refund a stranger's guesses. */
export async function clearLoginAttempts(email: string, ip?: string | null) {
  if (ip === undefined) {
    await getDb().delete(loginAttempts).where(eq(loginAttempts.email, email))
    return
  }
  const source = throttleIp(ip)
  await getDb()
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.email, email), source ? eq(loginAttempts.ip, source) : isNull(loginAttempts.ip)))
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
        passwordChangedAt: admins.passwordChangedAt,
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
        passwordChangedAt: members.passwordChangedAt,
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
 * generic failure as a wrong password. The account is read before the attempt is
 * counted, so the browser's known-device cookie can be checked against it; that cookie only
 * counts for the account and password it was issued under.
 */
export async function authorizeCredentials(
  credentials: unknown,
  forwardedFor: string | null,
  knownDeviceCookie?: string,
): Promise<AuthorizedUser | null> {
  const parsed = credentialsSchema.safeParse(credentials)
  if (!parsed.success) return null

  const email = parsed.data.email.toLowerCase()
  const ip = clientIp(forwardedFor)

  const checkedAt = Date.now()
  const account = await findAccount(email)
  const knownDevice = isKnownDevice(knownDeviceCookie, account)
  const { throttled } = await recordLoginAttempt(email, ip, { knownDevice })
  if (throttled) {
    console.warn(`LOGIN THROTTLED: ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  const valid = await bcrypt.compare(parsed.data.password, account?.passwordHash ?? UNKNOWN_EMAIL_HASH)
  if (!account || !valid || !account.confirmed) {
    const reason = !account ? 'unknown email' : !valid ? 'bad password' : 'email not confirmed'
    console.warn(`LOGIN FAILED (${reason}): ${email} from ${ip ?? 'unknown ip'}`)
    return null
  }

  await clearLoginAttempts(email, ip)
  const signedIn = { id: String(account.id), email: account.email, name: account.name, authTime: checkedAt }
  return account.kind === 'admin'
    ? { ...signedIn, kind: 'admin', role: account.role }
    : { ...signedIn, kind: 'member', role: account.role }
}
