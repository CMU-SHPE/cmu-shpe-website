import { sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/db'
import type { UnsubscribeSource } from '@/db/schema'
import { hashToken, memberTokenParam } from '@/lib/member-tokens'

export type UnsubscribeScope = 'these' | 'all'

export type TopicRef = { id: number; name: string }

export type UnsubscribeTarget = {
  maskedEmail: string
  /** The topics this newsletter went to, as recorded when it was sent. */
  newsletterTopicNames: string[]
  /** This newsletter's topics the member is still subscribed to. */
  subscribedInScope: TopicRef[]
  otherSubscriptions: TopicRef[]
}

export type UnsubscribeResult =
  | { ok: true; removed: string[]; recordedAt: Date | null }
  | { ok: false }

type Rows<T> = { rows: T[] }

async function run<T>(query: SQL): Promise<T[]> {
  const result = (await getDb().execute(query)) as unknown as Rows<T>
  return result.rows
}

/** Enough to recognise your own address without showing it in full to whoever holds the link. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  return `${Array.from(local)[0]}***${email.slice(at)}`
}

function validHash(token: unknown): string | null {
  return memberTokenParam.safeParse(token).success ? hashToken(token as string) : null
}

type Recipient = { member_id: number; newsletter_id: number; email: string; topic_names: string | null }

async function findRecipient(tokenHash: string): Promise<Recipient | null> {
  const [row] = await run<Recipient>(sql`
    select r.member_id, r.newsletter_id, m.email, n.topic_names
    from newsletter_recipients r
    join members m on m.id = r.member_id
    join newsletters n on n.id = r.newsletter_id
    where r.unsubscribe_token_hash = ${tokenHash}
  `)
  return row ?? null
}

/**
 * Read-only: the unsubscribe page calls this on GET, which mail scanners fetch on their own.
 * Links never expire (CAN-SPAM wants them working for at least 30 days), and a deleted
 * account takes its recipient rows with it, so its links stop resolving.
 */
export async function resolveUnsubscribeToken(token: unknown): Promise<UnsubscribeTarget | null> {
  const tokenHash = validHash(token)
  if (!tokenHash) return null
  const recipient = await findRecipient(tokenHash)
  if (!recipient) return null

  const subscriptions = await run<{ id: number; name: string; in_scope: boolean }>(sql`
    select t.id, t.name, exists (
      select 1 from newsletter_topic_selections s
      where s.newsletter_id = ${recipient.newsletter_id} and s.topic_id = t.id
    ) as in_scope
    from member_topic_subscriptions mts
    join newsletter_topics t on t.id = mts.topic_id
    where mts.member_id = ${recipient.member_id}
    order by t.sort_order, t.id
  `)

  const topic = ({ id, name }: TopicRef) => ({ id, name })
  return {
    maskedEmail: maskEmail(recipient.email),
    newsletterTopicNames: (recipient.topic_names ?? '').split('\n').filter(Boolean),
    subscribedInScope: subscriptions.filter((row) => row.in_scope).map(topic),
    otherSubscriptions: subscriptions.filter((row) => !row.in_scope).map(topic),
  }
}

/**
 * The token is the only credential, so the member and newsletter are looked up from it inside
 * the same statement that deletes. Deleting and logging in one statement makes a repeat, or two
 * racing clicks, remove and log each subscription once.
 *
 * A one-click request whose newsletter has no topics left (an admin deleted them all) removes
 * every subscription instead: the mail provider has already told the member they are out, and
 * removing nothing would leave them on the list. The page shows what it will remove first, so
 * its "these" button never widens.
 */
export async function unsubscribe(
  token: unknown,
  scope: UnsubscribeScope,
  source: UnsubscribeSource,
): Promise<UnsubscribeResult> {
  const tokenHash = validHash(token)
  if (!tokenHash) return { ok: false }
  if (!(await findRecipient(tokenHash))) return { ok: false }

  const everything = scope === 'all'
  const everythingIfTopicsGone = source === 'one_click'
  const rows = await run<{ topic_name: string; created_at: Date | string }>(sql`
    with target as (
      select member_id, newsletter_id from newsletter_recipients where unsubscribe_token_hash = ${tokenHash}
    ),
    removed as (
      delete from member_topic_subscriptions mts
      using target, newsletter_topics t
      where mts.member_id = target.member_id
        and t.id = mts.topic_id
        and (
          ${everything}::boolean
          or (
            ${everythingIfTopicsGone}::boolean
            and not exists (select 1 from newsletter_topic_selections s where s.newsletter_id = target.newsletter_id)
          )
          or exists (
            select 1 from newsletter_topic_selections s
            where s.newsletter_id = target.newsletter_id and s.topic_id = mts.topic_id
          )
        )
      returning mts.topic_id, t.name, t.sort_order, target.member_id, target.newsletter_id
    )
    insert into newsletter_unsubscribes (member_id, topic_id, topic_name, newsletter_id, source)
    select member_id, topic_id, name, newsletter_id, ${source}::unsubscribe_source
    from removed
    order by sort_order, topic_id
    returning topic_name, created_at
  `)

  return {
    ok: true,
    removed: rows.map((row) => row.topic_name),
    recordedAt: rows.length > 0 ? new Date(rows[0].created_at) : null,
  }
}
