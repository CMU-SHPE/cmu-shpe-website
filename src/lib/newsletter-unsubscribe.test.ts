// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashToken } from './member-tokens'
import { unsubscribeTokenFor } from './newsletter-unsubscribe-token'
import {
  createFakeUnsubscribeDb,
  SEEDED_RECIPIENT_ID,
  seedUnsubscribeDb,
} from './newsletter-unsubscribe.test-support'

const fake = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/db', () => ({ getDb: () => fake.current }))

import { maskEmail, resolveUnsubscribeToken, unsubscribe } from './newsletter-unsubscribe'

let db: ReturnType<typeof createFakeUnsubscribeDb>
let token: string

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  token = unsubscribeTokenFor(SEEDED_RECIPIENT_ID)
  db = createFakeUnsubscribeDb()
  seedUnsubscribeDb(db, hashToken(token))
  fake.current = db.db
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('mia.lopez@example.com')).toBe('m***@example.com')
    expect(maskEmail('a@b.co')).toBe('a***@b.co')
    expect(maskEmail('not-an-email')).toBe('***')
  })
})

describe('resolveUnsubscribeToken', () => {
  it('finds the newsletter topics the member still has and their other subscriptions, without writing', async () => {
    await expect(resolveUnsubscribeToken(token)).resolves.toEqual({
      maskedEmail: 'm***@example.com',
      newsletterTopicNames: ['Events', 'Jobs'],
      subscribedInScope: [
        { id: 1, name: 'Events' },
        { id: 2, name: 'Jobs' },
      ],
      otherSubscriptions: [{ id: 3, name: 'Other' }],
    })
    expect(db.state.writes).toBe(0)
    expect(db.state.statements[0]).toContain('where r.unsubscribe_token_hash = $1')
  })

  it('looks up by hash only, never by the raw token', async () => {
    await resolveUnsubscribeToken(token)
    expect(db.state.statements.join(' ')).not.toContain(token)
  })

  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['bad characters', `${'a'.repeat(42)}!`],
  ])('refuses a %s token without touching the database', async (_, value) => {
    await expect(resolveUnsubscribeToken(value)).resolves.toBeNull()
    expect(db.state.statements).toEqual([])
  })

  it('refuses an unknown or tampered token', async () => {
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
    await expect(resolveUnsubscribeToken(tampered)).resolves.toBeNull()
    await expect(resolveUnsubscribeToken(unsubscribeTokenFor(999))).resolves.toBeNull()
  })
})

describe('unsubscribe', () => {
  it('removes only this newsletter’s topics and logs one row per removed subscription', async () => {
    await expect(unsubscribe(token, 'these', 'page')).resolves.toEqual({
      ok: true,
      removed: ['Events', 'Jobs'],
      recordedAt: new Date('2026-10-26T18:30:00Z'),
    })
    expect(db.state.subscriptions).toEqual([{ memberId: 7, topicId: 3 }])
    expect(db.state.log).toEqual([
      { memberId: 7, topicId: 1, topicName: 'Events', newsletterId: 4, source: 'page' },
      { memberId: 7, topicId: 2, topicName: 'Jobs', newsletterId: 4, source: 'page' },
    ])
  })

  it('removes every subscription for all', async () => {
    const result = await unsubscribe(token, 'all', 'page')
    expect(result.ok && result.removed).toEqual(['Events', 'Jobs', 'Other'])
    expect(db.state.subscriptions).toEqual([])
  })

  it('is idempotent: a repeat succeeds, removes nothing and logs nothing more', async () => {
    await unsubscribe(token, 'these', 'one_click')
    await expect(unsubscribe(token, 'these', 'one_click')).resolves.toEqual({ ok: true, removed: [], recordedAt: null })
    expect(db.state.log).toHaveLength(2)
  })

  it('deletes and logs in one statement keyed by the token hash', async () => {
    await unsubscribe(token, 'these', 'page')
    const write = db.state.statements.find((text) => text.includes('delete from member_topic_subscriptions'))!
    expect(write).toMatch(/^with target as \( select member_id, newsletter_id from newsletter_recipients where unsubscribe_token_hash = \$1 \)/)
    expect(write).toContain('insert into newsletter_unsubscribes (member_id, topic_id, topic_name, newsletter_id, source)')
  })

  it('refuses invalid, unknown and deleted-member tokens without removing anything', async () => {
    await expect(unsubscribe('nope', 'all', 'page')).resolves.toEqual({ ok: false })
    await expect(unsubscribe(unsubscribeTokenFor(999), 'all', 'page')).resolves.toEqual({ ok: false })
    db.state.members.clear()
    await expect(unsubscribe(token, 'all', 'page')).resolves.toEqual({ ok: false })
    expect(db.state.writes).toBe(0)
    expect(db.state.log).toEqual([])
  })
})

describe('one member’s token never reaches another member', () => {
  let otherToken: string

  beforeEach(() => {
    otherToken = unsubscribeTokenFor(12)
    db.state.members.set(8, 'luis@example.com')
    db.state.recipients.push({ hash: hashToken(otherToken), memberId: 8, newsletterId: 4 })
    db.state.subscriptions.push({ memberId: 8, topicId: 1 }, { memberId: 8, topicId: 2 }, { memberId: 8, topicId: 3 })
  })

  it.each([['these'], ['all']] as const)('unsubscribing with member 7’s token (%s) leaves member 8 untouched', async (scope) => {
    await unsubscribe(token, scope, 'page')
    expect(db.state.subscriptions.filter((s) => s.memberId === 8)).toHaveLength(3)
    expect(db.state.log.every((row) => row.memberId === 7)).toBe(true)
  })

  it('resolves each token to its own masked address and passes only the token hash to the database', async () => {
    expect((await resolveUnsubscribeToken(token))?.maskedEmail).toBe('m***@example.com')
    expect((await resolveUnsubscribeToken(otherToken))?.maskedEmail).toBe('l***@example.com')
    const write = await unsubscribe(otherToken, 'all', 'page').then(() =>
      db.state.statements.find((text) => text.includes('delete from member_topic_subscriptions')),
    )
    expect(write).not.toMatch(/member_id = \$\d/)
    expect(write).toContain('where mts.member_id = target.member_id')
    expect(db.state.subscriptions).toEqual([
      { memberId: 7, topicId: 1 },
      { memberId: 7, topicId: 2 },
      { memberId: 7, topicId: 3 },
    ])
  })

  it('never writes while resolving, for either member', async () => {
    await resolveUnsubscribeToken(token)
    await resolveUnsubscribeToken(otherToken)
    expect(db.state.writes).toBe(0)
    expect(db.state.statements.every((text) => text.startsWith('select'))).toBe(true)
  })
})

// The fake database decides member and newsletter scoping on its own, so these pins are what
// fail if the statement itself stops scoping the delete.
describe('unsubscribe statement scoping', () => {
  async function writeFor(scope: 'these' | 'all') {
    await unsubscribe(token, scope, 'page')
    return db.state.statements.find((text) => text.includes('delete from member_topic_subscriptions'))!
  }

  it('deletes only the token holder’s rows', async () => {
    expect(await writeFor('all')).toContain('where mts.member_id = target.member_id and t.id = mts.topic_id')
  })

  it('limits "these" to the topics of the newsletter the token was sent with', async () => {
    expect(await writeFor('these')).toContain(
      'select 1 from newsletter_topic_selections s where s.newsletter_id = target.newsletter_id and s.topic_id = mts.topic_id',
    )
  })
})
