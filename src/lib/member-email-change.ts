import { randomBytes } from 'node:crypto'
import { lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import { memberEmailChanges } from '@/db/schema'
import { isUniqueViolation } from '@/lib/db-errors'
import { emailAddress } from '@/lib/form-fields'
import { hashToken, memberTokenParam } from '@/lib/member-tokens'

export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000

const emailChangeSchema = z.object({
  newEmail: emailAddress.transform((value) => value.toLowerCase()),
  currentPassword: z.string().min(1).max(200),
})

export type EmailChangeError = 'email-invalid' | 'email-password'

export function parseEmailChange(
  formData: FormData,
): { success: true; data: z.infer<typeof emailChangeSchema> } | { success: false; code: EmailChangeError } {
  const parsed = emailChangeSchema.safeParse({
    newEmail: formData.get('newEmail'),
    currentPassword: formData.get('currentPassword'),
  })
  if (parsed.success) return { success: true, data: parsed.data }
  const emailFailed = parsed.error.issues.some((issue) => issue.path[0] === 'newEmail')
  return { success: false, code: emailFailed ? 'email-invalid' : 'email-password' }
}

/** Only the hash is stored, like every other emailed link. */
export function newEmailChange(memberId: number, newEmail: string, now = Date.now()) {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    row: { memberId, newEmail, tokenHash: hashToken(token), expiresAt: new Date(now + EMAIL_CHANGE_TTL_MS) },
  }
}

/** One row per member, so a newer request replaces the pending one and the older link stops working. */
export function savePendingEmailChange(db: Db, row: ReturnType<typeof newEmailChange>['row']) {
  return db
    .insert(memberEmailChanges)
    .values(row)
    .onConflictDoUpdate({
      target: memberEmailChanges.memberId,
      set: { newEmail: row.newEmail, tokenHash: row.tokenHash, expiresAt: row.expiresAt, createdAt: sql`now()` },
    })
}

export function purgeExpiredEmailChanges(db: Db) {
  return db.delete(memberEmailChanges).where(lt(memberEmailChanges.expiresAt, sql`now()`))
}

/**
 * Taken in share mode for the rest of the transaction, so an admin created while the change
 * commits can't slip past the check below with the same address.
 */
const lockAdmins = sql`lock table admins in share mode`

/**
 * Whoever opens the link controls the new inbox, so an unconfirmed sign-up already holding that
 * address (theirs or a squatter's) gives way rather than blocking the change for 7 days.
 */
function releaseUnconfirmedHolder(tokenHash: string) {
  return sql`
    delete from members o using member_email_changes c
    where c.token_hash = ${tokenHash} and c.expires_at > now()
      and lower(o.email) = c.new_email and o.email_confirmed_at is null and o.id <> c.member_id
  `
}

/**
 * The link is used up whatever happens, and the address is re-checked against every admin and
 * every other member at this moment, in the same statement as the update. Reset links the
 * member had went to the old inbox, so they are revoked. The member id never changes, so
 * RSVPs, topic choices, the sponsor link and past unsubscribe links all stay attached.
 */
function applyEmailChange(tokenHash: string) {
  return sql`
    with consumed as (
      delete from member_email_changes
      where token_hash = ${tokenHash} and expires_at > now()
      returning member_id, new_email
    ),
    previous as (
      select m.id, m.email as old_email, m.name
      from members m join consumed c on m.id = c.member_id
      where m.email_confirmed_at is not null
    ),
    updated as (
      update members m set email = c.new_email
      from consumed c join previous p on p.id = c.member_id
      where m.id = c.member_id
        and not exists (select 1 from admins a where lower(a.email) = c.new_email)
        and not exists (select 1 from members o where lower(o.email) = c.new_email and o.id <> m.id)
      returning m.id
    ),
    revoked as (
      delete from member_tokens t using updated
      where t.member_id = updated.id and t.purpose = 'reset_password'
    )
    select c.new_email, p.old_email, p.name, u.id is not null as changed
    from consumed c
    left join previous p on p.id = c.member_id
    left join updated u on u.id = c.member_id
  `
}

type AppliedRow = { new_email: string; old_email: string | null; name: string | null; changed: boolean }

export type EmailChangeResult =
  | { status: 'changed'; oldEmail: string; newEmail: string; name: string }
  | { status: 'in_use' }
  | { status: 'invalid' }

export async function confirmEmailChange(token: string): Promise<EmailChangeResult> {
  if (!memberTokenParam.safeParse(token).success) return { status: 'invalid' }
  const tokenHash = hashToken(token)
  const db = getDb()

  let rows: AppliedRow[]
  try {
    const [, , applied] = (await db.batch([
      db.execute(lockAdmins),
      db.execute(releaseUnconfirmedHolder(tokenHash)),
      db.execute(applyEmailChange(tokenHash)),
    ])) as unknown as [unknown, unknown, { rows: AppliedRow[] }]
    rows = applied.rows
  } catch (error) {
    // A sign-up for the same address committed after the check; the rollback leaves the link working.
    if (isUniqueViolation(error)) return { status: 'in_use' }
    throw error
  }

  const [row] = rows
  if (!row || row.old_email === null || row.name === null) return { status: 'invalid' }
  if (!row.changed) return { status: 'in_use' }
  return { status: 'changed', oldEmail: row.old_email, newEmail: row.new_email, name: row.name }
}
