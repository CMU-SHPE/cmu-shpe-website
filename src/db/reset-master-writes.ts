import { sql } from 'drizzle-orm'
import type { Db } from './index'
import { lockAccountEmails } from '../lib/account-email-lock'

export type MasterResetResult =
  | { status: 'no-master' }
  | { status: 'several-masters'; count: number }
  | { status: 'admin-taken' }
  | { status: 'member-taken' }
  | { status: 'reset'; previousEmail: string }

type ResetRow = {
  masters: number
  previous_email: string | null
  admin_taken: boolean
  member_taken: boolean
  moved: boolean
}

/**
 * Apart from reset-master.ts, which runs and exits on import, so tests can run it. Nothing is
 * written unless there is exactly one master and the address is free: another admin can't hold
 * it, and a member can't either unless the master already had it, so recovering a master never
 * fails over an address it already uses. Clock of record for passwordChangedAt is the database,
 * not the machine running this script.
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
        update admins a set email = ${email}, password_hash = ${passwordHash}, password_changed_at = now()
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
  return { status: 'reset', previousEmail: row.previous_email }
}
