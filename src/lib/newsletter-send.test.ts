// @vitest-environment node
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewsletterBatchResult, NewsletterEmail } from '@/lib/email'

type Query = { sql: string; params: unknown[] }
type Responder = (query: Query) => unknown[]

const fake = vi.hoisted(() => ({
  queries: [] as Query[],
  batches: [] as Query[][],
  respond: (() => []) as (query: { sql: string; params: unknown[] }) => unknown[],
  sendBatch: vi.fn(),
  fromAddress: vi.fn<() => string | undefined>(),
  settings: vi.fn<() => Promise<{ mailingAddress: string; contactEmail: string } | null>>(),
  siteUrl: vi.fn<() => string>(),
}))

vi.mock('@/db', () => {
  const dialect = new PgDialect()
  const execute = (statement: SQL) => {
    const query = dialect.sqlToQuery(statement)
    const run = async () => {
      fake.queries.push(query)
      return { rows: fake.respond(query) }
    }
    return { query, run, then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject) }
  }
  return {
    getDb: () => ({
      execute,
      batch: async (items: ReturnType<typeof execute>[]) => {
        fake.batches.push(items.map((item) => item.query))
        return Promise.all(items.map((item) => item.run()))
      },
    }),
  }
})
vi.mock('@/lib/email', () => ({ sendNewsletterBatch: fake.sendBatch, newsletterFromAddress: fake.fromAddress }))
vi.mock('@/lib/queries', () => ({ getSiteSettings: fake.settings }))
vi.mock('@/lib/site-url', () => ({ siteUrl: fake.siteUrl }))

import {
  chunkIdempotencyKey,
  loadSendSnapshot,
  processNewsletterSend,
  sendNewsletterTest,
  startNewsletterSend,
} from './newsletter-send'

const FROZEN = {
  status: 'sending',
  subject: 'Spring update',
  body: 'Hello https://shpe.example/events',
  topic_names: 'Events\nJobs',
  mailing_address: '5000 Forbes Ave',
  reply_to: 'shpe@cmu.edu',
  site_url: 'https://shpe.example',
  from_address: '"SHPE @ CMU" <news@news.example>',
}

function squash(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function is(query: Query, fragment: string) {
  return squash(query.sql).includes(fragment)
}

type World = {
  newsletter: Record<string, unknown> | undefined
  chunks: { chunk: number; ids: number[]; skipped?: number[] }[]
  emails: Record<number, string>
  finished: boolean
}

function world(overrides: Partial<World> = {}): World {
  return {
    newsletter: FROZEN,
    chunks: [{ chunk: 0, ids: [11, 12, 13] }],
    emails: { 11: 'ana@example.com', 12: 'luis@example.com', 13: 'sofia@example.com' },
    finished: true,
    ...overrides,
  }
}

function respondWith(state: World): Responder {
  return (query) => {
    if (is(query, 'select status, subject, body')) return state.newsletter ? [state.newsletter] : []
    if (is(query, 'with target as')) {
      const next = state.chunks.shift()
      return next ? next.ids.map((id) => ({ id, chunk: next.chunk, skipped: next.skipped })) : []
    }
    if (is(query, "set status = 'skipped'")) return []
    if (is(query, 'set unsubscribe_token_hash')) {
      const ids = query.params.filter((_, index) => index % 2 === 0) as number[]
      return ids.filter((id) => state.emails[id]).map((id) => ({ id, email: state.emails[id] }))
    }
    if (is(query, "update newsletters set status = 'sent'")) return state.finished ? [{ id: 4 }] : []
    return []
  }
}

function sentBatches(): { emails: NewsletterEmail[]; options: Record<string, unknown> }[] {
  return fake.sendBatch.mock.calls.map(([emails, options]) => ({ emails, options }))
}

function okFor(count: number): NewsletterBatchResult {
  return { ok: true, outcomes: Array.from({ length: count }, (_, i) => ({ id: `re_${i}` })) }
}

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  fake.queries.length = 0
  fake.batches.length = 0
  fake.sendBatch.mockReset().mockImplementation(async (emails: NewsletterEmail[]) => okFor(emails.length))
  fake.fromAddress.mockReset().mockReturnValue('"SHPE @ CMU" <news@news.example>')
  fake.settings.mockReset().mockResolvedValue({ mailingAddress: ' 5000 Forbes Ave ', contactEmail: 'shpe@cmu.edu' })
  fake.siteUrl.mockReset().mockReturnValue('https://shpe.example')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('startNewsletterSend', () => {
  const snapshot = { mailingAddress: 'Addr', replyTo: 'shpe@cmu.edu', siteUrl: 'https://shpe.example', fromAddress: 'from' }

  it('claims the draft and snapshots distinct confirmed subscribers in one statement', async () => {
    fake.respond = () => [{ claimed: 1, recipients: 3 }]
    await expect(startNewsletterSend(4, { id: 2, name: 'Ada' }, snapshot)).resolves.toEqual({ started: true, recipients: 3 })
    expect(fake.queries).toHaveLength(1)
    const sql = squash(fake.queries[0].sql)
    expect(sql).toMatch(/^with claimed as \( update newsletters set status = 'sending'/)
    expect(sql).toContain("where id = $9 and status = 'draft'")
    expect(sql).toContain('select distinct m.id as member_id from claimed')
    expect(sql).toContain('m.email_confirmed_at is not null')
    expect(sql).toContain('insert into newsletter_recipients (newsletter_id, member_id, chunk)')
    expect(sql).toContain('((row_number() over (order by member_id) - 1) /')
    expect(fake.queries[0].params).toEqual(expect.arrayContaining([2, 'Ada', 'Addr', 'shpe@cmu.edu', 'https://shpe.example', 'from', 100]))
  })

  it('reports nothing started when the draft was already claimed', async () => {
    fake.respond = () => [{ claimed: 0, recipients: 0 }]
    await expect(startNewsletterSend(4, { id: 2, name: 'Ada' }, snapshot)).resolves.toEqual({ started: false })
  })
})

describe('processNewsletterSend', () => {
  it('claims a chunk, sends it under its idempotency key and records each result', async () => {
    fake.respond = respondWith(world())
    await expect(processNewsletterSend(4)).resolves.toEqual({ status: 'sent' })

    const [batch] = sentBatches()
    expect(batch.options).toEqual({
      from: FROZEN.from_address,
      replyTo: 'shpe@cmu.edu',
      idempotencyKey: chunkIdempotencyKey(4, 0),
    })
    expect(chunkIdempotencyKey(4, 0)).toBe('newsletter-4/chunk-0')
    expect(batch.emails.map((email) => email.to)).toEqual(['ana@example.com', 'luis@example.com', 'sofia@example.com'])
    expect(batch.emails[0].oneClickUnsubscribeUrl).toMatch(/^https:\/\/shpe\.example\/unsubscribe\/one-click\?token=[\w-]{43}$/)
    expect(batch.emails[0].text).toContain('https://shpe.example/unsubscribe?token=')
    expect(batch.emails[0].text).toContain('5000 Forbes Ave')

    const record = fake.queries.find((query) => is(query, 'set status = v.status'))!
    expect(record.params).toEqual([11, 'sent', 're_0', null, 12, 'sent', 're_1', null, 13, 'sent', 're_2', null])
  })

  it('claims and checks subscriptions in one transaction, skipping only rows claimed for the first time', async () => {
    fake.respond = respondWith(world())
    await processNewsletterSend(4)
    const [claim, skip] = fake.batches[0].map((query) => squash(query.sql))
    expect(claim).toContain('for update of r skip locked')
    expect(claim).toContain('claimed_at = coalesce(r.claimed_at, now())')
    expect(skip).toContain("set status = 'skipped'")
    expect(skip).toContain('r.claimed_at = now()')
    expect(skip).toContain('m.email_confirmed_at is null or not exists')
  })

  it('leaves skipped recipients out of the batch', async () => {
    const state = world()
    fake.respond = (query) => {
      if (is(query, "set status = 'skipped'")) return [{ id: 12 }]
      return respondWith(state)(query)
    }
    await processNewsletterSend(4)
    expect(sentBatches()[0].emails.map((email) => email.to)).toEqual(['ana@example.com', 'sofia@example.com'])
  })

  it('sends nothing when the claim returns no rows', async () => {
    fake.respond = respondWith(world({ chunks: [], finished: false }))
    await expect(processNewsletterSend(4)).resolves.toEqual({ status: 'sending', reason: 'busy' })
    expect(fake.sendBatch).not.toHaveBeenCalled()
  })

  it('does nothing for a newsletter that is not sending', async () => {
    fake.respond = respondWith(world({ newsletter: { ...FROZEN, status: 'draft' } }))
    await expect(processNewsletterSend(4)).resolves.toEqual({ status: 'draft' })
    expect(fake.batches).toHaveLength(0)
    expect(fake.sendBatch).not.toHaveBeenCalled()
  })

  it('expires claims too old to resend safely before claiming anything', async () => {
    fake.respond = respondWith(world())
    await processNewsletterSend(4)
    const expire = squash(fake.queries[1].sql)
    expect(expire).toContain("set status = 'failed', error_code = 'unknown_outcome'")
    expect(expire).toContain("claimed_at < now() - interval '23 hours'")
  })

  it('builds a byte-identical batch when the same chunk is retried', async () => {
    fake.sendBatch.mockResolvedValueOnce({ ok: false, reason: 'rate_limit_exceeded', retryable: true })
    fake.respond = respondWith(world({ chunks: [{ chunk: 0, ids: [11, 12, 13] }, { chunk: 0, ids: [11, 12, 13] }] }))

    await expect(processNewsletterSend(4)).resolves.toEqual({ status: 'sending', reason: 'retry_later' })
    expect(fake.queries.some((query) => is(query, "set status = 'pending'"))).toBe(true)
    await expect(processNewsletterSend(4)).resolves.toEqual({ status: 'sent' })

    const [first, retry] = sentBatches()
    expect(JSON.stringify(retry)).toBe(JSON.stringify(first))
  })

  it('records per-index rejections as failures and the rest as sent', async () => {
    fake.sendBatch.mockResolvedValue({
      ok: true,
      outcomes: [{ id: 're_0' }, { error: 'rejected' }, { error: 'unknown_outcome' }],
    })
    fake.respond = respondWith(world())
    await processNewsletterSend(4)
    const record = fake.queries.find((query) => is(query, 'set status = v.status'))!
    expect(record.params).toEqual([11, 'sent', 're_0', null, 12, 'failed', null, 'rejected', 13, 'failed', null, 'unknown_outcome'])
  })

  it('marks the whole chunk failed with a fixed code on a permanent error', async () => {
    fake.sendBatch.mockResolvedValue({ ok: false, reason: 'invalid_idempotent_request', retryable: false })
    fake.respond = respondWith(world())
    await processNewsletterSend(4)
    const record = fake.queries.find((query) => is(query, 'set status = v.status'))!
    expect(record.params.filter((_, index) => index % 4 === 3)).toEqual(['unknown_outcome', 'unknown_outcome', 'unknown_outcome'])
    expect(record.params.filter((_, index) => index % 4 === 1)).toEqual(['failed', 'failed', 'failed'])
  })

  it('stops starting chunks once the time budget is spent and leaves the newsletter sending', async () => {
    fake.respond = respondWith(
      world({
        chunks: [
          { chunk: 0, ids: [11] },
          { chunk: 1, ids: [12] },
          { chunk: 2, ids: [13] },
        ],
      }),
    )
    let clock = 0
    const result = await processNewsletterSend(4, { now: () => (clock += 100), budgetMs: 250 })
    expect(result).toEqual({ status: 'sending', reason: 'time_budget' })
    expect(sentBatches().map((batch) => batch.options.idempotencyKey)).toEqual(['newsletter-4/chunk-0', 'newsletter-4/chunk-1'])
    expect(fake.queries.some((query) => is(query, "update newsletters set status = 'sent'"))).toBe(false)
  })

  it('marks the newsletter sent only when no rows are left pending or sending', async () => {
    fake.respond = respondWith(world())
    await processNewsletterSend(4)
    const finish = squash(fake.queries.at(-1)!.sql)
    expect(finish).toContain("update newsletters set status = 'sent', sent_at = now()")
    expect(finish).toContain("and status = 'sending' and not exists")
    expect(finish).toContain("status in ('pending', 'sending')")
  })
})

describe('loadSendSnapshot', () => {
  it('freezes the mailing address, reply-to, site URL and sender', async () => {
    await expect(loadSendSnapshot()).resolves.toEqual({
      ok: true,
      snapshot: {
        mailingAddress: '5000 Forbes Ave',
        replyTo: 'shpe@cmu.edu',
        siteUrl: 'https://shpe.example',
        fromAddress: '"SHPE @ CMU" <news@news.example>',
      },
    })
  })

  it.each([
    ['no_mailing_address', () => fake.settings.mockResolvedValue({ mailingAddress: '  ', contactEmail: 'x@y.z' })],
    ['no_mailing_address', () => fake.settings.mockResolvedValue(null)],
    ['email_not_configured', () => fake.fromAddress.mockReturnValue(undefined)],
    ['auth_secret_missing', () => vi.stubEnv('AUTH_SECRET', '')],
    [
      'site_url_invalid',
      () =>
        fake.siteUrl.mockImplementation(() => {
          throw new Error('SITE_URL must use https in production')
        }),
    ],
  ])('refuses with %s', async (blocker, arrange) => {
    arrange()
    await expect(loadSendSnapshot()).resolves.toEqual({ ok: false, blocker })
  })
})

describe('sendNewsletterTest', () => {
  const draft = { subject: 'Spring update', body: 'Hello', topicNames: ['Events'] }

  it('sends one [Test] copy with a sample unsubscribe and no unsubscribe header or idempotency key', async () => {
    await expect(sendNewsletterTest(draft, 'ada@example.com')).resolves.toEqual({ ok: true })
    const [batch] = sentBatches()
    expect(batch.emails).toHaveLength(1)
    expect(batch.emails[0].to).toBe('ada@example.com')
    expect(batch.emails[0].subject).toBe('[Test] Spring update')
    expect(batch.emails[0].oneClickUnsubscribeUrl).toBeUndefined()
    expect(batch.emails[0].text).toContain('sample')
    expect(batch.emails[0].text).not.toContain('/unsubscribe')
    expect(batch.options).toEqual({ from: '"SHPE @ CMU" <news@news.example>', replyTo: 'shpe@cmu.edu' })
  })

  it('is refused without a mailing address', async () => {
    fake.settings.mockResolvedValue({ mailingAddress: '', contactEmail: 'x@y.z' })
    await expect(sendNewsletterTest(draft, 'ada@example.com')).resolves.toEqual({ ok: false, blocker: 'no_mailing_address' })
    expect(fake.sendBatch).not.toHaveBeenCalled()
  })

  it('reports a failed or rejected send as a failure', async () => {
    fake.sendBatch.mockResolvedValueOnce({ ok: false, reason: 'rate_limit_exceeded', retryable: true })
    await expect(sendNewsletterTest(draft, 'ada@example.com')).resolves.toEqual({ ok: false, reason: 'rate_limit_exceeded' })
    fake.sendBatch.mockResolvedValueOnce({ ok: true, outcomes: [{ error: 'rejected' }] })
    await expect(sendNewsletterTest(draft, 'ada@example.com')).resolves.toEqual({ ok: false, reason: 'rejected' })
  })
})
