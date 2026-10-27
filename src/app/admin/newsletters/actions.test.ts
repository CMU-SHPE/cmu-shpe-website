// @vitest-environment node
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    calls: [] as string[],
    statements: [] as string[],
    updateMatches: true,
    deleted: [{ id: 4 }] as { id: number }[],
    newsletter: null as Record<string, unknown> | null,
    existingTopics: 1,
    audience: 3,
  }
  return {
    Redirect,
    state,
    loadSendSnapshot: vi.fn(),
    startNewsletterSend: vi.fn(),
    processNewsletterSend: vi.fn(),
    sendNewsletterTest: vi.fn(),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.state.calls.push(`redirect ${url}`)
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn(async () => {
    mocks.state.calls.push('requireAdmin')
    return { user: { id: '2', email: 'ada@example.com', name: 'Session Name' } }
  }),
}))
vi.mock('@/db', () => {
  const dialect = new PgDialect()
  const render = (statement: SQL) => dialect.sqlToQuery(statement).sql.replace(/\s+/g, ' ').trim()
  const record = (text: string) => {
    mocks.state.statements.push(text)
    mocks.state.calls.push('db')
  }
  return {
    getDb: () => ({
      insert: () => ({
        values: () => ({
          returning: async () => {
            record('insert newsletters')
            return [{ id: 9 }]
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: (condition: SQL) => ({
            returning: () => ({ kind: 'update', text: `update newsletters where ${render(condition)}` }),
          }),
        }),
      }),
      delete: () => ({
        where: (condition: SQL) => ({
          returning: async () => {
            record(`delete newsletters where ${render(condition)}`)
            return mocks.state.deleted
          },
        }),
      }),
      execute: (statement: SQL) => {
        const text = render(statement)
        const rows = text.startsWith('with created as') ? [{ id: 9 }] : []
        return {
          kind: 'execute',
          text,
          then: (resolve: (value: unknown) => void) => {
            record(text)
            resolve({ rows })
          },
        }
      },
      batch: async (items: { kind: string; text: string }[]) =>
        items.map((item) => {
          record(item.text)
          return item.kind === 'update' ? (mocks.state.updateMatches ? [{ id: 4 }] : []) : { rows: [] }
        }),
    }),
  }
})
vi.mock('@/lib/newsletter-topics', () => ({
  countExistingTopics: async (ids: number[]) => Math.min(ids.length, mocks.state.existingTopics),
}))
vi.mock('@/lib/newsletter-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/newsletter-admin')>()),
  getNewsletter: async () => mocks.state.newsletter,
  countNewsletterAudience: async () => mocks.state.audience,
  getAdminName: async () => 'Ada Lovelace',
}))
vi.mock('@/lib/newsletter-send', () => ({
  loadSendSnapshot: mocks.loadSendSnapshot,
  startNewsletterSend: mocks.startNewsletterSend,
  processNewsletterSend: mocks.processNewsletterSend,
  sendNewsletterTest: mocks.sendNewsletterTest,
}))

import {
  continueSending,
  deleteNewsletterDraft,
  reviewNewsletter,
  saveNewsletter,
  sendNewsletter,
  sendTestNewsletter,
} from './actions'

const REVIEWED_AT = '2026-10-20T22:00:00.123Z'
const SNAPSHOT = { mailingAddress: 'Addr', replyTo: null, siteUrl: 'https://shpe.example', fromAddress: 'from' }

function form(values: Record<string, string | string[]>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item)
  }
  return data
}

const complete = () => form({ subject: 'Spring update', body: 'Hello', topicIds: ['1'] })

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

beforeEach(() => {
  mocks.state.calls.length = 0
  mocks.state.statements.length = 0
  mocks.state.updateMatches = true
  mocks.state.deleted = [{ id: 4 }]
  mocks.state.existingTopics = 1
  mocks.state.audience = 3
  mocks.state.newsletter = {
    id: 4,
    status: 'draft',
    subject: 'Spring update',
    body: 'Hello',
    topicIds: [1],
    currentTopicNames: ['Events'],
    updatedAt: new Date(REVIEWED_AT),
  }
  mocks.loadSendSnapshot.mockReset().mockResolvedValue({ ok: true, snapshot: SNAPSHOT })
  mocks.startNewsletterSend.mockReset().mockResolvedValue({ started: true, recipients: 3 })
  mocks.processNewsletterSend.mockReset().mockResolvedValue({ status: 'sent' })
  mocks.sendNewsletterTest.mockReset().mockResolvedValue({ ok: true })
})

describe('saveNewsletter', () => {
  it('requires an admin first, then creates a draft with its topics', async () => {
    expect(await redirectOf(saveNewsletter(null, complete()))).toBe('/admin/newsletters/9?saved=1')
    expect(mocks.state.calls[0]).toBe('requireAdmin')
    expect(mocks.state.statements).toHaveLength(1)
    expect(mocks.state.statements[0]).toMatch(/^with created as \( insert into newsletters \(subject, body, created_by\)/)
    expect(mocks.state.statements[0]).toContain(
      'insert into newsletter_topic_selections (newsletter_id, topic_id) select created.id, t.id from created, newsletter_topics t where t.id in ($4)',
    )
  })

  it('creates a draft with no topics in the same single statement', async () => {
    expect(await redirectOf(saveNewsletter(null, form({ subject: 'S', body: '' })))).toBe('/admin/newsletters/9?saved=1')
    expect(mocks.state.statements).toHaveLength(1)
    expect(mocks.state.statements[0]).toContain('from created, newsletter_topics t where false')
  })

  it('allows an incomplete draft to be saved', async () => {
    expect(await redirectOf(saveNewsletter(4, form({ subject: '', body: '' })))).toBe('/admin/newsletters/4?saved=1')
  })

  it('gates the update and both topic statements on the newsletter still being a draft', async () => {
    await redirectOf(saveNewsletter(4, complete()))
    const [update, remove, insert] = mocks.state.statements
    expect(update).toMatch(/"status" = \$\d/)
    expect(remove).toContain('delete from newsletter_topic_selections')
    expect(remove).toContain(`"newsletters"."status" = 'draft'`)
    expect(insert).toContain('insert into newsletter_topic_selections')
    expect(insert).toContain(`"newsletters"."status" = 'draft'`)
  })

  it('reports a newsletter that is no longer a draft', async () => {
    mocks.state.updateMatches = false
    expect(await redirectOf(saveNewsletter(4, complete()))).toBe('/admin/newsletters/4?error=not_draft')
  })

  it('rejects an over-long subject and topics that no longer exist', async () => {
    expect(await redirectOf(saveNewsletter(4, form({ subject: 'x'.repeat(201), body: '' })))).toBe(
      '/admin/newsletters/4?error=invalid',
    )
    mocks.state.existingTopics = 0
    expect(await redirectOf(saveNewsletter(4, complete()))).toBe('/admin/newsletters/4?error=topics')
    expect(mocks.state.statements).toEqual([])
  })

  it('rejects a bad id before touching the database', async () => {
    expect(await redirectOf(saveNewsletter(-1, complete()))).toBe('/admin/newsletters?error=invalid')
    expect(mocks.state.statements).toEqual([])
  })
})

describe('sendTestNewsletter', () => {
  it('saves, then sends a test to the signed-in admin', async () => {
    expect(await redirectOf(sendTestNewsletter(4, complete()))).toBe('/admin/newsletters/4?tested=1')
    expect(mocks.sendNewsletterTest).toHaveBeenCalledWith(
      { subject: 'Spring update', body: 'Hello', topicNames: ['Events'] },
      'ada@example.com',
    )
  })

  it('refuses an incomplete newsletter', async () => {
    expect(await redirectOf(sendTestNewsletter(4, form({ subject: 'S', body: 'B' })))).toBe(
      '/admin/newsletters/4?error=incomplete',
    )
    expect(mocks.sendNewsletterTest).not.toHaveBeenCalled()
  })

  it('passes on a missing mailing address and a failed send', async () => {
    mocks.sendNewsletterTest.mockResolvedValueOnce({ ok: false, blocker: 'no_mailing_address' })
    expect(await redirectOf(sendTestNewsletter(4, complete()))).toBe('/admin/newsletters/4?error=no_mailing_address')
    mocks.sendNewsletterTest.mockResolvedValueOnce({ ok: false, reason: 'rate_limit_exceeded' })
    expect(await redirectOf(sendTestNewsletter(4, complete()))).toBe('/admin/newsletters/4?error=test_failed')
  })
})

describe('reviewNewsletter', () => {
  it('saves and moves to the confirm step', async () => {
    expect(await redirectOf(reviewNewsletter(4, complete()))).toBe('/admin/newsletters/4/send')
  })

  it('stays on the draft when sending is blocked', async () => {
    mocks.loadSendSnapshot.mockResolvedValue({ ok: false, blocker: 'no_mailing_address' })
    expect(await redirectOf(reviewNewsletter(4, complete()))).toBe('/admin/newsletters/4?error=no_mailing_address')
  })
})

describe('sendNewsletter', () => {
  const confirmed = (count = '3', reviewedAt = REVIEWED_AT) => form({ expectedCount: count, reviewedAt })

  it('starts the send with the admin name from the database and processes it', async () => {
    expect(await redirectOf(sendNewsletter(4, confirmed()))).toBe('/admin/newsletters/4?sent=1')
    expect(mocks.state.calls[0]).toBe('requireAdmin')
    expect(mocks.startNewsletterSend).toHaveBeenCalledWith(4, { id: 2, name: 'Ada Lovelace' }, SNAPSHOT, new Date(REVIEWED_AT))
    expect(mocks.processNewsletterSend).toHaveBeenCalledWith(4)
  })

  it('reports a send that has to be continued', async () => {
    mocks.processNewsletterSend.mockResolvedValue({ status: 'sending', reason: 'time_budget' })
    expect(await redirectOf(sendNewsletter(4, confirmed()))).toBe('/admin/newsletters/4?progress=time_budget')
  })

  it.each([
    ['a missing confirmation', () => {}, form({}), '/admin/newsletters/4/send?error=invalid'],
    [
      'a newsletter already sending',
      () => (mocks.state.newsletter = { ...mocks.state.newsletter, status: 'sending' }),
      undefined,
      '/admin/newsletters/4?error=not_draft',
    ],
    [
      'an incomplete newsletter',
      () => (mocks.state.newsletter = { ...mocks.state.newsletter, body: '  ' }),
      undefined,
      '/admin/newsletters/4?error=incomplete',
    ],
    ['a deleted topic', () => (mocks.state.existingTopics = 0), undefined, '/admin/newsletters/4?error=topics'],
    [
      'a missing mailing address',
      () => mocks.loadSendSnapshot.mockResolvedValue({ ok: false, blocker: 'no_mailing_address' }),
      undefined,
      '/admin/newsletters/4/send?error=no_mailing_address',
    ],
    ['no recipients', () => (mocks.state.audience = 0), undefined, '/admin/newsletters/4/send?error=no_recipients'],
    ['a changed recipient count', () => (mocks.state.audience = 5), undefined, '/admin/newsletters/4/send?error=count_changed'],
    [
      'a draft claimed by someone else',
      () =>
        mocks.startNewsletterSend.mockImplementation(async () => {
          mocks.state.newsletter = { ...mocks.state.newsletter, status: 'sending' }
          return { started: false }
        }),
      undefined,
      '/admin/newsletters/4?error=not_draft',
    ],
  ])('refuses %s', async (_, arrange, data, url) => {
    arrange()
    expect(await redirectOf(sendNewsletter(4, data ?? confirmed()))).toBe(url)
    expect(mocks.processNewsletterSend).not.toHaveBeenCalled()
  })

  it('refuses a send when the draft was saved again after it was reviewed', async () => {
    expect(await redirectOf(sendNewsletter(4, confirmed('3', '2026-10-20T21:59:59.000Z')))).toBe(
      '/admin/newsletters/4/send?error=changed',
    )
    expect(mocks.startNewsletterSend).not.toHaveBeenCalled()
  })

  it('reports an edit that lands between the checks and the claim as a change, not as already sent', async () => {
    mocks.startNewsletterSend.mockResolvedValue({ started: false })
    expect(await redirectOf(sendNewsletter(4, confirmed()))).toBe('/admin/newsletters/4/send?error=changed')
    expect(mocks.processNewsletterSend).not.toHaveBeenCalled()
  })

  it('reports a missing newsletter', async () => {
    mocks.state.newsletter = null
    expect(await redirectOf(sendNewsletter(4, confirmed()))).toBe('/admin/newsletters?error=missing')
  })
})

describe('continueSending', () => {
  it('requires an admin and processes more chunks', async () => {
    mocks.processNewsletterSend.mockResolvedValue({ status: 'sending', reason: 'retry_later' })
    expect(await redirectOf(continueSending(4))).toBe('/admin/newsletters/4?progress=retry_later')
    expect(mocks.state.calls[0]).toBe('requireAdmin')
  })

  it('reports finished, draft and missing newsletters', async () => {
    expect(await redirectOf(continueSending(4))).toBe('/admin/newsletters/4?sent=1')
    mocks.processNewsletterSend.mockResolvedValue({ status: 'draft' })
    expect(await redirectOf(continueSending(4))).toBe('/admin/newsletters/4?error=not_sending')
    mocks.processNewsletterSend.mockResolvedValue({ status: 'missing' })
    expect(await redirectOf(continueSending(4))).toBe('/admin/newsletters?error=missing')
  })
})

describe('deleteNewsletterDraft', () => {
  it('deletes only drafts', async () => {
    expect(await redirectOf(deleteNewsletterDraft(4))).toBe('/admin/newsletters?deleted=1')
    expect(mocks.state.statements[0]).toMatch(/"status" = \$\d/)
    mocks.state.deleted = []
    expect(await redirectOf(deleteNewsletterDraft(4))).toBe('/admin/newsletters?error=not_draft')
  })
})
