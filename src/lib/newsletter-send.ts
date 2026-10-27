import { sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/db'
import { newsletterFromAddress, sendNewsletterBatch, type NewsletterEmail } from '@/lib/email'
import { audienceEmailCondition } from '@/lib/newsletter-audience'
import { hashToken } from '@/lib/member-tokens'
import { renderNewsletter } from '@/lib/newsletter-render'
import { getSiteSettings } from '@/lib/queries'
import { siteUrl } from '@/lib/site-url'
import { unsubscribeTokenFor, unsubscribeUrls } from '@/lib/newsletter-unsubscribe-token'

export const CHUNK_SIZE = 100
/** Stops starting new chunks here, leaving room for one more batch inside Vercel's 300s limit. */
export const SEND_TIME_BUDGET_MS = 240_000
const STALE_CLAIM = sql.raw(`interval '10 minutes'`)
// Resend forgets idempotency keys after 24 hours; past this a retry could send twice.
const KEY_LIFETIME = sql.raw(`interval '23 hours'`)

export type SendSnapshot = {
  mailingAddress: string
  replyTo: string | null
  siteUrl: string
  fromAddress: string
}

export type StartResult = { started: true; recipients: number } | { started: false }

export type ProcessResult =
  | { status: 'sent' }
  | { status: 'sending'; reason: 'time_budget' | 'busy' | 'retry_later' | 'outcome_unconfirmed' }
  | { status: 'draft' | 'missing' }

export type SendBlocker = 'no_mailing_address' | 'email_not_configured' | 'site_url_invalid' | 'auth_secret_missing'

type Rows<T> = { rows: T[] }

async function run<T>(query: SQL): Promise<T[]> {
  const result = (await getDb().execute(query)) as unknown as Rows<T>
  return result.rows
}

/**
 * Everything a send freezes, checked before any send or test send: CAN-SPAM requires the postal
 * address, and a send that started without a sender or link base could never finish.
 */
export async function loadSendSnapshot(): Promise<{ ok: true; snapshot: SendSnapshot } | { ok: false; blocker: SendBlocker }> {
  const settings = await getSiteSettings()
  const mailingAddress = settings?.mailingAddress.trim() ?? ''
  if (!mailingAddress) return { ok: false, blocker: 'no_mailing_address' }

  const fromAddress = newsletterFromAddress()
  if (!fromAddress) return { ok: false, blocker: 'email_not_configured' }
  if (!process.env.AUTH_SECRET?.trim()) return { ok: false, blocker: 'auth_secret_missing' }

  let base: string
  try {
    base = siteUrl()
  } catch {
    return { ok: false, blocker: 'site_url_invalid' }
  }

  return {
    ok: true,
    snapshot: { mailingAddress, replyTo: settings?.contactEmail || null, siteUrl: base, fromAddress },
  }
}

/** A test carries a labelled sample instead of a working unsubscribe link and no List-Unsubscribe header. */
export async function sendNewsletterTest(
  draft: { subject: string; body: string; topicNames: string[] },
  to: string,
): Promise<{ ok: true } | { ok: false; blocker: SendBlocker } | { ok: false; reason: string }> {
  const ready = await loadSendSnapshot()
  if (!ready.ok) return ready

  const { snapshot } = ready
  const rendered = renderNewsletter({
    subject: draft.subject,
    body: draft.body,
    topicNames: draft.topicNames,
    mailingAddress: snapshot.mailingAddress,
    siteUrl: snapshot.siteUrl,
    unsubscribe: { sample: true },
  })
  const result = await sendNewsletterBatch([{ to, ...rendered, subject: `[Test] ${rendered.subject}` }], {
    from: snapshot.fromAddress,
    replyTo: snapshot.replyTo,
  })
  if (!result.ok) return { ok: false, reason: result.reason }
  return 'id' in result.outcomes[0] ? { ok: true } : { ok: false, reason: result.outcomes[0].error }
}

/**
 * Claims the draft and snapshots its recipients in one statement, so two admins pressing Send
 * can't both start it, and the list can't drift between counting and inserting. With
 * reviewedAt, an edit saved after the admin reviewed the draft makes the claim fail, so the
 * version sent is always the one confirmed.
 */
export async function startNewsletterSend(
  newsletterId: number,
  admin: { id: number; name: string },
  snapshot: SendSnapshot,
  reviewedAt?: Date,
): Promise<StartResult> {
  const reviewedVersion = reviewedAt ? sql`and date_trunc('milliseconds', updated_at) = ${reviewedAt.toISOString()}::timestamptz` : sql``
  const audienceEmail = audienceEmailCondition(sql`m.email`)
  const [row] = await run<{ claimed: number; recipients: number }>(sql`
    with claimed as (
      update newsletters set
        status = 'sending',
        send_started_at = now(),
        updated_at = now(),
        sent_by = ${admin.id},
        sent_by_name = ${admin.name},
        mailing_address = ${snapshot.mailingAddress},
        reply_to = ${snapshot.replyTo},
        site_url = ${snapshot.siteUrl},
        from_address = ${snapshot.fromAddress},
        topic_names = (
          select string_agg(t.name, chr(10) order by t.sort_order, t.id)
          from newsletter_topic_selections s join newsletter_topics t on t.id = s.topic_id
          where s.newsletter_id = ${newsletterId}
        ),
        recipient_count = (
          select count(distinct m.id)::int
          from newsletter_topic_selections s
          join member_topic_subscriptions mts on mts.topic_id = s.topic_id
          join members m on m.id = mts.member_id and m.email_confirmed_at is not null
          where s.newsletter_id = ${newsletterId} and ${audienceEmail}
        )
      where id = ${newsletterId}
        and status = 'draft'
        and btrim(subject) <> ''
        and btrim(body) <> ''
        and exists (select 1 from newsletter_topic_selections where newsletter_id = ${newsletterId})
        ${reviewedVersion}
      returning id
    ),
    audience as (
      select distinct m.id as member_id
      from claimed
      join newsletter_topic_selections s on s.newsletter_id = claimed.id
      join member_topic_subscriptions mts on mts.topic_id = s.topic_id
      join members m on m.id = mts.member_id and m.email_confirmed_at is not null
      where ${audienceEmail}
    ),
    inserted as (
      insert into newsletter_recipients (newsletter_id, member_id, chunk)
      select ${newsletterId}::int, member_id, ((row_number() over (order by member_id) - 1) / ${CHUNK_SIZE}::int)::int
      from audience
      returning 1
    )
    select (select count(*) from claimed)::int as claimed, (select count(*) from inserted)::int as recipients
  `)
  return row && row.claimed > 0 ? { started: true, recipients: row.recipients } : { started: false }
}

type FrozenNewsletter = {
  status: 'draft' | 'sending' | 'sent'
  subject: string
  body: string
  topic_names: string | null
  mailing_address: string | null
  reply_to: string | null
  site_url: string | null
  from_address: string | null
  send_started_ms: string | null
}

async function frozenNewsletter(newsletterId: number) {
  const [row] = await run<FrozenNewsletter>(sql`
    select status, subject, body, topic_names, mailing_address, reply_to, site_url, from_address,
      floor(extract(epoch from send_started_at) * 1000)::bigint::text as send_started_ms
    from newsletters where id = ${newsletterId}
  `)
  return row
}

function expireUnrepeatableClaims(newsletterId: number) {
  return run(sql`
    update newsletter_recipients set status = 'failed', error_code = 'unknown_outcome', updated_at = now()
    where newsletter_id = ${newsletterId}
      and status in ('pending', 'sending')
      and claimed_at < now() - ${KEY_LIFETIME}
  `)
}

/** firstClaim: every row was claimed for the first time now, so no earlier attempt can have sent it. */
export type ClaimedChunk = { chunk: number; recipientIds: number[]; firstClaim: boolean }

/**
 * Claims every claimable row of the lowest open chunk and, in the same transaction, skips the
 * rows claimed for the first time (claimed_at is the transaction's now()) whose member has since
 * unsubscribed or lost confirmation. A re-claim skips nothing, so its batch matches the first try.
 *
 * Every claimed row (updated_at is the transaction's now()) is also checked against the test
 * audience: a preview database copied mid-send holds production's pending rows, and pressing
 * Continue there must not reach real members. In production the check renders `true`.
 *
 * Claims for one newsletter take turns on its row lock. SKIP LOCKED alone let two concurrent
 * claimers pick the same chunk and each take part of it, sending two different payloads under
 * one idempotency key. A row lock rather than an advisory lock needs no key space shared with
 * other code, and waiting is short since the lock lasts only for this transaction.
 */
export async function claimNextChunk(newsletterId: number): Promise<ClaimedChunk | null> {
  const db = getDb()
  const claimable = sql`(r.status = 'pending' or (r.status = 'sending' and r.updated_at < now() - ${STALE_CLAIM}))`
  const inAudience = audienceEmailCondition(sql`m.email`)
  const [, claimed, skipped] = (await db.batch([
    db.execute(sql`select id from newsletters where id = ${newsletterId} for update`),
    db.execute(sql`
      with target as (
        select r.chunk from newsletter_recipients r
        where r.newsletter_id = ${newsletterId} and ${claimable}
        order by r.chunk limit 1
      ),
      locked as (
        select r.id from newsletter_recipients r join target on r.chunk = target.chunk
        where r.newsletter_id = ${newsletterId} and ${claimable}
        for update of r skip locked
      )
      update newsletter_recipients r set
        status = 'sending',
        claimed_at = coalesce(r.claimed_at, now()),
        updated_at = now()
      from locked where r.id = locked.id
      returning r.id, r.chunk, r.claimed_at = now() as first_claim
    `),
    db.execute(sql`
      update newsletter_recipients r set
        status = 'skipped',
        error_code = case
          when not (${inAudience}) then 'not_test_audience'
          when m.email_confirmed_at is null then 'unconfirmed'
          else 'unsubscribed'
        end,
        updated_at = now()
      from members m
      where r.newsletter_id = ${newsletterId}
        and r.status = 'sending'
        and r.updated_at = now()
        and m.id = r.member_id
        and (
          not (${inAudience})
          or (
            r.claimed_at = now()
            and (
              m.email_confirmed_at is null
              or not exists (
                select 1 from member_topic_subscriptions mts
                join newsletter_topic_selections s on s.topic_id = mts.topic_id
                where mts.member_id = r.member_id and s.newsletter_id = ${newsletterId}
              )
            )
          )
        )
      returning r.id
    `),
  ])) as unknown as [unknown, Rows<{ id: number; chunk: number; first_claim: boolean }>, Rows<{ id: number }>]

  if (claimed.rows.length === 0) return null
  const skippedIds = new Set(skipped.rows.map((row) => row.id))
  return {
    chunk: claimed.rows[0].chunk,
    firstClaim: claimed.rows.every((row) => row.first_claim),
    recipientIds: claimed.rows
      .map((row) => row.id)
      .filter((id) => !skippedIds.has(id))
      .sort((a, b) => a - b),
  }
}

function valuesList(rows: SQL[]): SQL {
  return sql.join(rows, sql`, `)
}

type PreparedRecipient = { id: number; email: string; link_matches: boolean }

/**
 * Stores each link's hash before the email goes out, so no recipient ever gets a link that
 * doesn't resolve. A hash already stored is kept, never replaced: an earlier attempt may have
 * delivered that link, and it must keep working even if AUTH_SECRET has been rotated since.
 */
async function prepareRecipients(recipientIds: number[]): Promise<PreparedRecipient[]> {
  const values = valuesList(recipientIds.map((id) => sql`(${id}::int, ${hashToken(unsubscribeTokenFor(id))})`))
  const rows = await run<PreparedRecipient>(sql`
    update newsletter_recipients r
    set unsubscribe_token_hash = coalesce(r.unsubscribe_token_hash, v.hash), updated_at = now()
    from (values ${values}) as v(id, hash), members m
    where r.id = v.id and m.id = r.member_id and r.status = 'sending'
    returning r.id, m.email, r.unsubscribe_token_hash = v.hash as link_matches
  `)
  return rows.sort((a, b) => a.id - b.id)
}

/**
 * Ids alone repeat across deployments and database restores, and Resend would then answer a new
 * newsletter's chunk from another one's cached result. The send start time is set once when the
 * send is claimed, so every retry of a chunk still gets the same key.
 */
export function chunkIdempotencyKey(newsletterId: number, sendStartedMs: string, chunk: number): string {
  return `newsletter-${newsletterId}-${sendStartedMs}/chunk-${chunk}`
}

export function buildChunkEmails(newsletter: FrozenNewsletter, recipients: { id: number; email: string }[]): NewsletterEmail[] {
  const base = newsletter.site_url ?? ''
  const topicNames = (newsletter.topic_names ?? '').split('\n').filter(Boolean)
  return recipients.map((recipient) => {
    const urls = unsubscribeUrls(base, unsubscribeTokenFor(recipient.id))
    const rendered = renderNewsletter({
      subject: newsletter.subject,
      body: newsletter.body,
      topicNames,
      mailingAddress: newsletter.mailing_address ?? '',
      siteUrl: base,
      unsubscribe: { url: urls.page },
    })
    return { to: recipient.email, ...rendered, oneClickUnsubscribeUrl: urls.oneClick }
  })
}

type Outcome = { id: number; status: 'sent' | 'failed'; resendId: string | null; errorCode: string | null }

function recordOutcomes(outcomes: Outcome[]) {
  const values = valuesList(
    outcomes.map(
      (o) => sql`(${o.id}::int, ${o.status}::newsletter_recipient_status, ${o.resendId}::text, ${o.errorCode}::text)`,
    ),
  )
  return run(sql`
    update newsletter_recipients r set
      status = v.status, resend_id = v.resend_id, error_code = v.error_code, updated_at = now()
    from (values ${values}) as v(id, status, resend_id, error_code)
    where r.id = v.id and r.status = 'sending'
  `)
}

// Resend turns these down before accepting the batch, so nothing was sent and its idempotency
// key was not used: the rows can start over as never claimed, with a fresh 24-hour window.
const REFUSED_BEFORE_ACCEPTING = new Set(['rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded', 'missing_config'])

/**
 * A batch that may have gone out keeps its first claim time, so a retry after Resend has forgotten
 * the key is recorded as unknown instead of sent again.
 */
function releaseForRetry(recipientIds: number[], { neverSent }: { neverSent: boolean }) {
  const forgetClaim = neverSent ? sql`claimed_at = null, unsubscribe_token_hash = null, ` : sql``
  return run(sql`
    update newsletter_recipients set status = 'pending', ${forgetClaim}updated_at = now()
    where id in (${sql.join(recipientIds.map((id) => sql`${id}`), sql`, `)}) and status = 'sending'
  `)
}

// A conflicting payload under a used key means an earlier attempt already went through with
// different data, so whether these recipients got it is unknown, not failed.
function permanentErrorCode(reason: string): string {
  return reason === 'invalid_idempotent_request' ? 'unknown_outcome' : reason
}

type ChunkOutcome = 'done' | 'retry_later' | 'outcome_unconfirmed'

/**
 * Anything that throws after the claim (a database error, a missing secret) releases the rows
 * at once rather than leaving them looking in flight for 10 minutes. They keep their claim time,
 * since the batch may already have reached Resend.
 */
async function sendChunk(newsletterId: number, newsletter: FrozenNewsletter, claimed: ClaimedChunk): Promise<ChunkOutcome> {
  if (claimed.recipientIds.length === 0) return 'done'
  try {
    return await sendClaimedChunk(newsletterId, newsletter, claimed)
  } catch (error) {
    await releaseForRetry(claimed.recipientIds, { neverSent: false }).catch(() => {})
    throw error
  }
}

async function sendClaimedChunk(
  newsletterId: number,
  newsletter: FrozenNewsletter,
  claimed: ClaimedChunk,
): Promise<ChunkOutcome> {
  const prepared = await prepareRecipients(claimed.recipientIds)
  // The secret changed after an earlier attempt that may have gone out: resending would carry
  // links that resolve to nothing, under a key whose first payload differed.
  const unrepeatable = prepared.filter((row) => !row.link_matches)
  if (unrepeatable.length > 0) {
    await recordOutcomes(
      unrepeatable.map((row) => ({ id: row.id, status: 'failed', resendId: null, errorCode: 'unknown_outcome' })),
    )
  }
  const recipients = prepared.filter((row) => row.link_matches)
  if (recipients.length === 0) return 'done'

  const result = await sendNewsletterBatch(buildChunkEmails(newsletter, recipients), {
    from: newsletter.from_address ?? '',
    replyTo: newsletter.reply_to,
    idempotencyKey: chunkIdempotencyKey(newsletterId, newsletter.send_started_ms ?? '0', claimed.chunk),
  })

  if (!result.ok && result.retryable) {
    // A refusal now says nothing about an earlier unconfirmed attempt, which keeps its claim time.
    const neverSent = REFUSED_BEFORE_ACCEPTING.has(result.reason) && claimed.firstClaim
    await releaseForRetry(
      recipients.map((r) => r.id),
      { neverSent },
    )
    return neverSent ? 'retry_later' : 'outcome_unconfirmed'
  }

  const outcomes: Outcome[] = recipients.map((recipient, index) => {
    if (!result.ok) {
      return { id: recipient.id, status: 'failed', resendId: null, errorCode: permanentErrorCode(result.reason) }
    }
    const outcome = result.outcomes[index]
    return 'id' in outcome
      ? { id: recipient.id, status: 'sent', resendId: outcome.id, errorCode: null }
      : { id: recipient.id, status: 'failed', resendId: null, errorCode: outcome.error }
  })
  await recordOutcomes(outcomes)
  return 'done'
}

async function finishIfDone(newsletterId: number): Promise<boolean> {
  const rows = await run<{ id: number }>(sql`
    update newsletters set status = 'sent', sent_at = now(), updated_at = now()
    where id = ${newsletterId}
      and status = 'sending'
      and not exists (
        select 1 from newsletter_recipients
        where newsletter_id = ${newsletterId} and status in ('pending', 'sending')
      )
    returning id
  `)
  return rows.length > 0
}

/**
 * Sends as many chunks as fit in the time budget. Safe to call again at any point, from any
 * number of requests: chunks are claimed with SKIP LOCKED and resent only under the same key.
 */
export async function processNewsletterSend(
  newsletterId: number,
  { now = Date.now, budgetMs = SEND_TIME_BUDGET_MS }: { now?: () => number; budgetMs?: number } = {},
): Promise<ProcessResult> {
  const startedAt = now()
  const newsletter = await frozenNewsletter(newsletterId)
  if (!newsletter) return { status: 'missing' }
  if (newsletter.status !== 'sending') return { status: newsletter.status }

  await expireUnrepeatableClaims(newsletterId)

  for (;;) {
    if (now() - startedAt >= budgetMs) return { status: 'sending', reason: 'time_budget' }
    const claimed = await claimNextChunk(newsletterId)
    if (!claimed) break
    const outcome = await sendChunk(newsletterId, newsletter, claimed)
    if (outcome !== 'done') return { status: 'sending', reason: outcome }
  }

  return (await finishIfDone(newsletterId)) ? { status: 'sent' } : { status: 'sending', reason: 'busy' }
}
