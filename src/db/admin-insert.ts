import { sql } from 'drizzle-orm'
import type { Db } from './index'
import type { AdminRole } from './schema'
import { lockAccountEmails } from '../lib/account-email-lock'

type NewAdmin = {
  name: string
  email: string
  passwordHash: string
  role: AdminRole
  canCreateAccounts?: boolean
  createdBy?: number | null
}

/** Returns null, inserting nothing, when an admin or a member already uses the address in any letter case. */
export async function insertAdmin(db: Db, admin: NewAdmin): Promise<number | null> {
  const [, inserted] = (await db.batch([
    db.execute(lockAccountEmails),
    db.execute(sql`
      insert into admins (name, email, password_hash, role, can_create_accounts, created_by)
      select ${admin.name}, ${admin.email}, ${admin.passwordHash}, ${admin.role}::admin_role,
        ${admin.canCreateAccounts ?? false}::boolean, ${admin.createdBy ?? null}::integer
      where not exists (select 1 from admins a where lower(a.email) = lower(${admin.email}))
        and not exists (select 1 from members m where lower(m.email) = lower(${admin.email}))
      returning id
    `),
  ])) as unknown as [unknown, { rows: { id: number }[] }]
  return inserted.rows[0]?.id ?? null
}
