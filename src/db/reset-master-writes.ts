import { sql } from 'drizzle-orm'
import type { Db } from './index'
import { lockAccountEmails } from '../lib/account-email-lock'

export type MasterResetResult =
  | { status: 'no-master' }
  | { status: 'several-masters'; count: number }
  | { status: 'admin-taken' }
  | { status: 'member-taken' }
  | { status: 'reset'; previousEmail: string; sharedWithMember: boolean }

type ResetRow = {
  masters: number
  previous_email: string | null
  admin_taken: boolean
  member_taken: boolean
  shared_with_member: boolean
  moved: boolean
}

/**
 * Apart from reset-master.ts, which runs and exits on import, so tests can run it. Nothing is
 * written unless there is exactly one master and the address is free: another admin can't hold
 * it, and a member can't either unless the master already had it, so recovering a master never
 * fails over an address it already uses; sharedWithMember then reports the member it locks out.
 * passwordChangedAt comes from the database because the clock of the laptop running this script
 * is no closer to the server's that signs sessions, and clock_timestamp() rather than now()
 * dates it after the wait for the lock, so a session signed in during that wait is still ended.
 */
export async function resetMasterAccount(db: Db, email: string, passwordHash: string): Promise<MasterResetResult> {
  const [, result] = (await db.batch([
    db.execute(lockAccountEmails),
    db.execute(sql`
      with master as (
        select id, email from admins where role = 'master'
      ),
      clash as (
        select
          exists (
            select 1 from admins a where lower(a.email) = lower(${email}) and a.id not in (select id from master)
          ) as admin_taken,
          exists (
            select 1 from members m where lower(m.email) = lower(${email})
              and lower(${email}) not in (select lower(email) from master)
          ) as member_taken
      ),
      moved as (
        update admins a set email = ${email}, password_hash = ${passwordHash}, password_changed_at = clock_timestamp()
        from master, clash
        where a.id = master.id and (select count(*) from master) = 1
          and not clash.admin_taken and not clash.member_taken
        returning a.id
      ),
      cleared_attempts as (
        delete from login_attempts
        where (email in (select email from master) or email = ${email}) and exists (select 1 from moved)
      ),
      revoked as (
        delete from admin_tokens t using moved where t.admin_id = moved.id
      )
      select
        (select count(*) from master)::int as masters,
        (select email from master limit 1) as previous_email,
        clash.admin_taken,
        clash.member_taken,
        exists (select 1 from members m where lower(m.email) = lower(${email})) as shared_with_member,
        exists (select 1 from moved) as moved
      from clash
    `),
  ])) as unknown as [unknown, { rows: ResetRow[] }]

  const [row] = result.rows
  if (row.masters === 0) return { status: 'no-master' }
  if (row.masters > 1) return { status: 'several-masters', count: row.masters }
  if (row.admin_taken) return { status: 'admin-taken' }
  if (row.member_taken) return { status: 'member-taken' }
  if (!row.moved || row.previous_email === null) throw new Error('The master account was not updated; run the reset again.')
  return { status: 'reset', previousEmail: row.previous_email, sharedWithMember: row.shared_with_member }
}
