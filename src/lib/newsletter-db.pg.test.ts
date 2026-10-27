import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, hasTestDatabase, query, seed, type SeedMember } from '@/db/pg-test-support'
import type { NewsletterBatchResult, NewsletterEmail } from '@/lib/email'

const mail = vi.hoisted(() => ({
  send: vi.fn<(emails: NewsletterEmail[], options: { idempotencyKey?: string }) => Promise<NewsletterBatchResult>>(),
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendNewsletterBatch: mail.send,
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
import { listMembers } from '@/lib/member-admin'
import {
  countNewsletterAudience,
  getNewsletter,
  getNewsletterRecipients,
  getTopicsWithConfirmedSubscriberCounts,
  listNewsletters,
} from '@/lib/newsletter-admin'
import { claimNextChunk, loadSendSnapshot, processNewsletterSend, startNewsletterSend } from '@/lib/newsletter-send'
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
    })
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT, updatedAt)).toEqual({
      started: true,
      recipients: audience.length,
    })
    expect(await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)).toEqual({ started: false })

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
