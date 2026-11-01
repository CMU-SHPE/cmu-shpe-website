import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, hasTestDatabase, query, seed, type SeedMember } from '@/db/pg-test-support'
import type { NewsletterBatchResult, NewsletterEmail } from '@/lib/email'

const mail = vi.hoisted(() => ({
  send: vi.fn<(emails: NewsletterEmail[], options: { idempotencyKey?: string }) => Promise<NewsletterBatchResult>>(),
  plain: vi.fn(async () => {}),
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendNewsletterBatch: mail.send,
  sendEmail: mail.plain,
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => ({ user: { id: '1', email: 'ada@example.org', name: 'Ada' } }),
}))

import { saveNewsletter } from '@/app/admin/newsletters/actions'
import { deleteTopic } from '@/app/admin/topics/actions'
import { resetMemberPassword } from '@/app/reset-password/actions'
import { hashToken } from '@/lib/member-tokens'
import { listMembers } from '@/lib/member-admin'
import {
  countNewsletterAudience,
  getNewsletter,
  getNewsletterRecipients,
  getTopicsWithConfirmedSubscriberCounts,
  listNewsletters,
} from '@/lib/newsletter-admin'
import {
  claimChunkStatement,
  claimNextChunk,
  loadSendSnapshot,
  lockNewsletterStatement,
  processNewsletterSend,
  startNewsletterSend,
} from '@/lib/newsletter-send'
import { getDb } from '@/db'
import { getNewsletterTopicsWithSubscriberCounts } from '@/lib/newsletter-topics'
import { resolveUnsubscribeToken, unsubscribe } from '@/lib/newsletter-unsubscribe'
import { unsubscribeTokenFor } from '@/lib/newsletter-unsubscribe-token'

const MEMBERS: SeedMember[] = [
  { email: 'ana@example.com', topics: [1, 2] },
  { email: 'delivered+bo@resend.dev', topics: [1] },
  { email: 'cy@example.com', confirmed: false, topics: [1] },
  { email: 'delivered+di@resend.dev', topics: [2, 3] },
  { email: 'Eve@Resend.Dev', topics: [1] },
]

const SNAPSHOT = {
  mailingAddress: '5000 Forbes Ave',
  replyTo: 'shpe@example.org',
  siteUrl: 'https://shpe.example',
  fromAddress: '"SHPE @ CMU" <news@example.org>',
}

const ENVIRONMENTS = [
  { env: 'production', audience: [1, 2, 4, 5], counts: { Events: 3, Jobs: 2, Other: 1 } },
  { env: 'preview', audience: [2, 4, 5], counts: { Events: 2, Jobs: 1, Other: 1 } },
] as const

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  return error instanceof Error ? error.message.replace(/^REDIRECT /, '') : String(error)
}

function form(values: Record<string, string | string[]>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item)
  }
  return data
}

function okBatch(emails: NewsletterEmail[]): NewsletterBatchResult {
  return { ok: true, outcomes: emails.map((_, index) => ({ id: `re_${index}` })) }
}

describe.skipIf(!hasTestDatabase).each(ENVIRONMENTS)('newsletter queries on real Postgres, VERCEL_ENV=$env', ({ env, audience, counts }) => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL_ENV', env)
    vi.stubEnv('AUTH_SECRET', 'pg-test-secret')
    mail.send.mockReset().mockImplementation(async (emails) => okBatch(emails))
    await seed(MEMBERS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('counts each topic’s confirmed audience for the composer', async () => {
    const topics = await getTopicsWithConfirmedSubscriberCounts()
    expect(Object.fromEntries(topics.map((topic) => [topic.name, topic.subscriberCount]))).toEqual(counts)
  })

  it('counts every subscriber of each topic on the stage 1 topics page, whatever the environment', async () => {
    const topics = await getNewsletterTopicsWithSubscriberCounts()
    expect(Object.fromEntries(topics.map((topic) => [topic.name, topic.subscriberCount]))).toEqual({
      Events: 4,
      Jobs: 2,
      Other: 1,
    })
  })

  it('counts each member’s own topics on the members page', async () => {
    const { rows } = await listMembers({ q: '', page: 1 })
    expect(Object.fromEntries(rows.map((row) => [row.email, row.topicCount]))).toEqual({
      'ana@example.com': 2,
      'delivered+bo@resend.dev': 1,
      'cy@example.com': 1,
      'delivered+di@resend.dev': 2,
      'Eve@Resend.Dev': 1,
    })
  })

  it('counts each audience member once across topics', async () => {
    expect(await countNewsletterAudience([1, 2])).toBe(audience.length)
    expect(await countNewsletterAudience([])).toBe(0)
  })

  it('saves a new draft with its topics in one statement, then edits it', async () => {
    const created = await redirectOf(saveNewsletter(null, form({ subject: 'Hi', body: 'B', topicIds: ['1', '3'] })))
    expect(created).toBe('/admin/newsletters/1?saved=1')
    expect(await getNewsletter(1)).toMatchObject({ subject: 'Hi', body: 'B', status: 'draft', topicIds: [1, 3], createdBy: 1 })

    const empty = await redirectOf(saveNewsletter(null, form({ subject: '', body: '' })))
    expect(empty).toBe('/admin/newsletters/2?saved=1')
    expect((await getNewsletter(2))?.topicIds).toEqual([])

    expect(await redirectOf(saveNewsletter(1, form({ subject: 'Hi again', body: 'B2', topicIds: ['2'] })))).toBe(
      '/admin/newsletters/1?saved=1',
    )
    expect(await getNewsletter(1)).toMatchObject({ subject: 'Hi again', body: 'B2', topicIds: [2], currentTopicNames: ['Jobs'] })
  })

  it('refuses to edit a newsletter that is no longer a draft and leaves its topics alone', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    expect(await redirectOf(saveNewsletter(id, form({ subject: 'X', body: 'Y', topicIds: ['3'] })))).toBe(
      `/admin/newsletters/${id}?error=not_draft`,
    )
    expect(await getNewsletter(id)).toMatchObject({ subject: 'Spring update', topicIds: [1] })
  })

  it('snapshots, sends and reports a newsletter end to end', async () => {
    const id = await draft([1, 2])
    expect(await listNewsletters()).toMatchObject([{ id, status: 'draft', draftTopicNames: 'Events, Jobs' }])

    const updatedAt = (await getNewsletter(id))!.updatedAt
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT, new Date(updatedAt.getTime() - 1))).toEqual({
      started: false,
      reason: 'changed',
    })
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT, updatedAt)).toEqual({
      started: true,
      recipients: audience.length,
    })
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)).toEqual({ started: false, reason: 'not_draft' })

    mail.send.mockImplementationOnce(async (emails) => ({
      ok: true,
      outcomes: emails.map((_, index) => (index === 0 ? { error: 'rejected' } : { id: `re_${index}` })),
    }))
    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })

    const [batch] = mail.send.mock.calls
    expect(batch[0].map((email) => email.to)).toEqual(
      (await query<{ email: string }>(`select email from members where id in (${audience.join(', ')}) order by id`)).map(
        (row) => row.email,
      ),
    )
    expect(batch[1].idempotencyKey).toMatch(new RegExp(`^newsletter-${id}-\\d{13}/chunk-0$`))

    const recipients = await getNewsletterRecipients(id)
    expect(recipients[0]).toMatchObject({ status: 'failed', errorCode: 'rejected' })
    expect(recipients.filter((row) => row.status === 'sent')).toHaveLength(audience.length - 1)

    const [row] = await listNewsletters()
    expect(row).toMatchObject({
      id,
      status: 'sent',
      topicNames: 'Events\nJobs',
      sentByName: 'Ada',
      recipientCount: audience.length,
      sentCount: audience.length - 1,
      failedCount: 1,
      unknownCount: 0,
      skippedCount: 0,
      remainingCount: 0,
    })
    expect(row.sentAt).toBeInstanceOf(Date)
    expect((await getNewsletter(id))?.status).toBe('sent')
  })

  it('claims a chunk, skips members who left, releases on a refusal and expires old claims', async () => {
    const id = await draft([1, 2])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await query('delete from member_topic_subscriptions where member_id = 5')

    const claimed = await claimNextChunk(id)
    expect(claimed).toMatchObject({ chunk: 0, firstClaim: true })
    expect(claimed!.recipientIds).toHaveLength(audience.length - 1)
    expect(await query('select status, error_code from newsletter_recipients where member_id = 5')).toEqual([
      { status: 'skipped', error_code: 'unsubscribed' },
    ])
    expect(await claimNextChunk(id)).toBeNull()
    await query("update newsletter_recipients set status = 'pending' where status = 'sending'")

    mail.send.mockResolvedValueOnce({ ok: false, reason: 'rate_limit_exceeded', retryable: true })
    expect(await processNewsletterSend(id)).toEqual({ status: 'sending', reason: 'outcome_unconfirmed' })
    expect(await query("select count(*)::int as n from newsletter_recipients where status = 'pending' and claimed_at is not null")).toEqual([
      { n: audience.length - 1 },
    ])

    await query("update newsletter_recipients set claimed_at = claimed_at - interval '24 hours' where status = 'pending'")
    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })
    expect(await query("select status, error_code, count(*)::int as n from newsletter_recipients group by 1, 2 order by 1, 2")).toEqual([
      { status: 'failed', error_code: 'unknown_outcome', n: audience.length - 1 },
      { status: 'skipped', error_code: 'unsubscribed', n: 1 },
    ])
  })

  it('skips a member whose only chosen topic was deleted mid-send as topic_removed', async () => {
    const id = await draft([3])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await query('delete from newsletter_topics where id = 3')
    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })
    expect(mail.send).not.toHaveBeenCalled()
    expect(
      await query('select m.email, r.status, r.error_code from newsletter_recipients r join members m on m.id = r.member_id'),
    ).toEqual([{ email: 'delivered+di@resend.dev', status: 'skipped', error_code: 'topic_removed' }])
  })

  it('refuses to delete a topic while a newsletter using it is mid-send, so no queued recipient is skipped', async () => {
    const id = await draft([3])
    const otherDraft = await draft([3])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)

    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?error=in_use')
    expect(await getNewsletter(otherDraft)).toMatchObject({ topicIds: [3] })
    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })
    expect(await query('select status, error_code from newsletter_recipients')).toEqual([{ status: 'sent', error_code: null }])

    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?saved=1')
    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?error=missing')
  })

  it('keeps a newsletter whose audience emptied before the claim an editable draft, and says why', async () => {
    const id = await draft([3])
    await query('delete from member_topic_subscriptions where topic_id = 3')

    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)).toEqual({ started: false, reason: 'no_recipients' })
    expect(await getNewsletter(id)).toMatchObject({ status: 'draft', sendStartedAt: null, recipientCount: null })
    expect(await query('select count(*)::int as n from newsletter_recipients')).toEqual([{ n: 0 }])
    expect(await redirectOf(saveNewsletter(id, form({ subject: 'Later', body: 'B', topicIds: ['1'] })))).toBe(
      `/admin/newsletters/${id}?saved=1`,
    )
  })

  it('tells a claim refused because its topics were deleted apart from one refused because of an edit', async () => {
    const id = await draft([3])
    const updatedAt = (await getNewsletter(id))!.updatedAt
    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?saved=1')

    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT, updatedAt)).toEqual({ started: false, reason: 'topics' })
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT, new Date(updatedAt.getTime() - 1))).toEqual({
      started: false,
      reason: 'changed',
    })
    expect((await getNewsletter(id))?.status).toBe('draft')
  })

  it('makes a one-click unsubscribe from a newsletter whose topics are all gone remove the member’s other topics', async () => {
    const id = await draft([3])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(id)
    const [{ id: recipientId }] = await query<{ id: number }>('select id from newsletter_recipients')
    const token = unsubscribeTokenFor(recipientId)
    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?saved=1')

    expect(await unsubscribe(token, 'these', 'page')).toEqual({ ok: true, removed: [], recordedAt: null })
    expect(await unsubscribe(token, 'these', 'one_click')).toMatchObject({ ok: true, removed: ['Jobs'] })
    expect(await query('select topic_id from member_topic_subscriptions where member_id = 4')).toEqual([])
    expect(await unsubscribe(token, 'these', 'one_click')).toEqual({ ok: true, removed: [], recordedAt: null })
  })

  it('resolves and uses an unsubscribe link, removing and logging each subscription once', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(id)
    const [{ id: recipientId, member_id: memberId }] = await query<{ id: number; member_id: number }>(
      'select id, member_id from newsletter_recipients order by id limit 1',
    )
    const token = unsubscribeTokenFor(recipientId)

    const target = await resolveUnsubscribeToken(token)
    expect(target?.subscribedInScope.map((topic) => topic.name)).toEqual(['Events'])
    expect(await query('select count(*)::int as n from newsletter_unsubscribes')).toEqual([{ n: 0 }])

    const result = await unsubscribe(token, 'these', 'one_click')
    expect(result).toMatchObject({ ok: true, removed: ['Events'] })
    expect(result.ok && result.recordedAt).toBeInstanceOf(Date)
    expect(await unsubscribe(token, 'these', 'one_click')).toEqual({ ok: true, removed: [], recordedAt: null })
    expect(await query('select member_id, topic_name, newsletter_id, source from newsletter_unsubscribes')).toEqual([
      { member_id: memberId, topic_name: 'Events', newsletter_id: id, source: 'one_click' },
    ])
    expect(await resolveUnsubscribeToken(unsubscribeTokenFor(9999))).toBeNull()
  })

  it('reads the send settings from the database', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_EMAIL_DOMAIN', 'example.org')
    vi.stubEnv('SITE_URL', 'https://shpe.example')
    expect(await loadSendSnapshot()).toEqual({ ok: true, snapshot: SNAPSHOT })
  })
})

describe.skipIf(!hasTestDatabase)('a send continued outside production on real Postgres', () => {
  beforeEach(async () => {
    vi.stubEnv('AUTH_SECRET', 'pg-test-secret')
    vi.stubEnv('VERCEL_ENV', 'production')
    mail.send.mockReset().mockImplementation(async (emails) => okBatch(emails))
    await seed(MEMBERS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['refused outright, so the rows start over', 'daily_quota_exceeded'],
    ['unconfirmed, so the rows keep their claim', 'timeout'],
  ])('skips real members when a preview continues a production send %s', async (_, reason) => {
    const id = await draft([1, 2])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    mail.send.mockResolvedValueOnce({ ok: false, reason, retryable: true })
    await processNewsletterSend(id)
    mail.send.mockClear()

    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })

    const sentTo = mail.send.mock.calls.flatMap(([emails]) => emails.map((email) => email.to))
    expect(sentTo).toEqual(['delivered+bo@resend.dev', 'delivered+di@resend.dev', 'Eve@Resend.Dev'])
    expect(
      await query('select m.email, r.status, r.error_code from newsletter_recipients r join members m on m.id = r.member_id where r.error_code = $1', [
        'not_test_audience',
      ]),
    ).toEqual([{ email: 'ana@example.com', status: 'skipped', error_code: 'not_test_audience' }])
  })
})

describe.skipIf(!hasTestDatabase)('statements otherwise covered only by mocks, on real Postgres', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'pg-test-secret')
    vi.stubEnv('SITE_URL', 'https://shpe.example')
    mail.send.mockReset().mockImplementation(async (emails) => okBatch(emails))
    mail.plain.mockClear()
    await seed([{ email: 'ana@example.com', topics: [1, 2, 3] }])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resets a password in one statement: uses the link, revokes other reset links and clears login attempts', async () => {
    const [used, other] = ['a'.repeat(43), 'b'.repeat(43)]
    await query(
      "insert into member_tokens (member_id, purpose, token_hash, expires_at) values (1, 'reset_password', $1, now() + interval '1 hour'), (1, 'reset_password', $2, now() + interval '1 hour'), (1, 'confirm_email', 'kept', now() + interval '1 hour')",
      [hashToken(used), hashToken(other)],
    )
    await query("insert into login_attempts (email, ip) values ('ana@example.com', '203.0.113.9')")
    const reset = form({ token: used, password: 'a new long password 123', confirmPassword: 'a new long password 123' })

    expect(await redirectOf(resetMemberPassword({}, reset))).toBe('/login?reset=1')
    const [member] = await query<{ password_hash: string; password_changed_at: string | null }>(
      'select password_hash, password_changed_at from members',
    )
    expect(member.password_hash).not.toBe('h')
    expect(member.password_changed_at).not.toBeNull()
    expect(await query('select purpose, token_hash from member_tokens')).toEqual([{ purpose: 'confirm_email', token_hash: 'kept' }])
    expect(await query('select count(*)::int as n from login_attempts')).toEqual([{ n: 0 }])
    expect(mail.plain).toHaveBeenCalledTimes(1)

    expect(await resetMemberPassword({}, reset)).toMatchObject({ formError: expect.any(String) })
    expect(mail.plain).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes from all newsletters, logging each removed topic once', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(id)
    const [{ id: recipientId }] = await query<{ id: number }>('select id from newsletter_recipients')
    const token = unsubscribeTokenFor(recipientId)

    expect(await unsubscribe(token, 'all', 'page')).toMatchObject({ ok: true, removed: ['Events', 'Jobs', 'Other'] })
    expect(await unsubscribe(token, 'all', 'page')).toEqual({ ok: true, removed: [], recordedAt: null })
    expect(await query('select count(*)::int as n from member_topic_subscriptions')).toEqual([{ n: 0 }])
    expect(await query('select topic_name, newsletter_id, source from newsletter_unsubscribes order by id')).toEqual([
      { topic_name: 'Events', newsletter_id: id, source: 'page' },
      { topic_name: 'Jobs', newsletter_id: id, source: 'page' },
      { topic_name: 'Other', newsletter_id: id, source: 'page' },
    ])
  })

  it('forgets the claim and link of a first batch Resend refused outright, then sends it', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    mail.send.mockResolvedValueOnce({ ok: false, reason: 'daily_quota_exceeded', retryable: true })
    expect(await processNewsletterSend(id)).toEqual({ status: 'sending', reason: 'retry_later' })
    expect(await query('select status, claimed_at, unsubscribe_token_hash from newsletter_recipients')).toEqual([
      { status: 'pending', claimed_at: null, unsubscribe_token_hash: null },
    ])

    expect(await processNewsletterSend(id)).toEqual({ status: 'sent' })
    const [row] = await query<{ status: string; unsubscribe_token_hash: string | null }>(
      'select status, unsubscribe_token_hash from newsletter_recipients',
    )
    expect(row.status).toBe('sent')
    expect(row.unsubscribe_token_hash).toHaveLength(64)
  })
})

describe.skipIf(!hasTestDatabase)('two claims sharing one now() on real Postgres', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(['production', 'preview'])('a later claim never skips rows an earlier claim took (VERCEL_ENV=%s)', async (env) => {
    vi.stubEnv('VERCEL_ENV', env)
    vi.stubEnv('AUTH_SECRET', 'pg-test-secret')
    await seed([])
    await query(
      "insert into members (email, name, password_hash, email_confirmed_at, age_confirmed_at, privacy_policy_version, terms_accepted_at) select 'delivered+m' || g || '@resend.dev', 'n', 'h', now(), now(), '1', now() from generate_series(1, 150) g",
    )
    await query('insert into member_topic_subscriptions (member_id, topic_id) select id, 1 from members')
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)

    // Inside one transaction both claims see the same now(), as two claims starting in the same
    // microsecond do when the second waits on the first's lock. Member 1 leaves in between.
    const db = getDb()
    const [, first, , second] = (await db.batch([
      db.execute(lockNewsletterStatement(id)),
      db.execute(claimChunkStatement(id)),
      db.execute(sql`delete from member_topic_subscriptions where member_id = 1`),
      db.execute(claimChunkStatement(id)),
    ])) as unknown as { rows: { id: number; chunk: number; skipped: boolean }[] }[]

    expect(first.rows.every((row) => row.chunk === 0 && !row.skipped)).toBe(true)
    expect(first.rows).toHaveLength(100)
    expect(second.rows.every((row) => row.chunk === 1)).toBe(true)
    expect(second.rows).toHaveLength(50)
    expect(await query("select chunk, status, count(*)::int as n from newsletter_recipients group by 1, 2 order by 1, 2")).toEqual([
      { chunk: 0, status: 'sending', n: 100 },
      { chunk: 1, status: 'sending', n: 50 },
    ])
  })
})
