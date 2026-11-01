import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { resetDb } from '@/test/db'
import { localTestDatabase } from '../../scripts/test-db-env'

/** Only for *.pg.test files, which run against a throwaway database (scripts/test-db.sh); throws anywhere else. */
export const hasTestDatabase = Boolean(localTestDatabase(process.env))

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const chunks = text.split(/\$(\d+)/)
  const parts = chunks.map((chunk, index) => (index % 2 === 0 ? sql.raw(chunk) : sql`${params[Number(chunk) - 1]}`))
  const result = (await getDb().execute(sql.join(parts, sql``))) as unknown as { rows: T[] }
  return result.rows
}

export type SeedMember = { email: string; confirmed?: boolean; topics?: number[]; name?: string }

/**
 * Admin 1 (Ada), topics 1 Events, 2 Jobs, 3 Other, a site_settings row with a mailing address,
 * and the given members with their subscriptions. Member ids follow the array order from 1.
 */
export async function seed(members: SeedMember[]) {
  await resetDb()
  await query("insert into admins (email, name, password_hash) values ('ada@example.org', 'Ada', 'h')")
  await query("insert into newsletter_topics (name, sort_order) values ('Events', 1), ('Jobs', 2), ('Other', 3)")
  await query(
    "insert into site_settings (contact_email, meeting_day, meeting_time, meeting_location, mailing_address) values ('shpe@example.org', 'Mon', '6pm', 'Room 1', '5000 Forbes Ave')",
  )
  for (const member of members) {
    const [{ id }] = await query<{ id: number }>(
      "insert into members (email, name, password_hash, email_confirmed_at, age_confirmed_at, privacy_policy_version, terms_accepted_at) values ($1, $2, 'h', $3, now(), '1', now()) returning id",
      [member.email, member.name ?? member.email.split('@')[0], member.confirmed === false ? null : new Date().toISOString()],
    )
    for (const topic of member.topics ?? []) {
      await query('insert into member_topic_subscriptions (member_id, topic_id) values ($1, $2)', [id, topic])
    }
  }
}

export async function draft(topics: number[], subject = 'Spring update', body = 'Hello https://shpe.example') {
  const [{ id }] = await query<{ id: number }>('insert into newsletters (subject, body, created_by) values ($1, $2, 1) returning id', [
    subject,
    body,
  ])
  for (const topic of topics) {
    await query('insert into newsletter_topic_selections (newsletter_id, topic_id) values ($1, $2)', [id, topic])
  }
  return id
}
