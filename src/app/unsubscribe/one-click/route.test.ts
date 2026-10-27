// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashToken } from '@/lib/member-tokens'
import { unsubscribeTokenFor } from '@/lib/newsletter-unsubscribe-token'
import {
  createFakeUnsubscribeDb,
  SEEDED_RECIPIENT_ID,
  seedUnsubscribeDb,
} from '@/lib/newsletter-unsubscribe.test-support'

const fake = vi.hoisted(() => ({ current: null as unknown, getDbCalls: 0 }))
vi.mock('@/db', () => ({
  getDb: () => {
    fake.getDbCalls += 1
    return fake.current
  },
}))

import { GET, POST } from './route'

let db: ReturnType<typeof createFakeUnsubscribeDb>
let token: string

function oneClick(tokenValue: string | null, method = 'POST') {
  const url = new URL('https://shpe.example/unsubscribe/one-click')
  if (tokenValue !== null) url.searchParams.set('token', tokenValue)
  return new Request(url, {
    method,
    ...(method === 'POST'
      ? { body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } }
      : {}),
  })
}

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  token = unsubscribeTokenFor(SEEDED_RECIPIENT_ID)
  db = createFakeUnsubscribeDb()
  seedUnsubscribeDb(db, hashToken(token))
  fake.current = db.db
  fake.getDbCalls = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /unsubscribe/one-click', () => {
  it('unsubscribes from this newsletter’s topics with no cookie or CSRF token and logs one_click rows', async () => {
    const response = await POST(oneClick(token))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe('Unsubscribed.\n')
    expect(db.state.subscriptions).toEqual([{ memberId: 7, topicId: 3 }])
    expect(db.state.log.map((row) => [row.topicName, row.source])).toEqual([
      ['Events', 'one_click'],
      ['Jobs', 'one_click'],
    ])
  })

  it('answers 200 again for an already-unsubscribed member, removing and logging nothing more', async () => {
    await POST(oneClick(token))
    const response = await POST(oneClick(token))
    expect(response.status).toBe(200)
    expect(db.state.log).toHaveLength(2)
    expect(db.state.subscriptions).toEqual([{ memberId: 7, topicId: 3 }])
  })

  it.each([
    ['missing', null],
    ['too short', 'abc'],
    ['too long', 'a'.repeat(44)],
    ['non-base64url', `${'a'.repeat(42)}=`],
  ])('refuses a %s token with 400 without touching the database', async (_, value) => {
    const response = await POST(oneClick(value))
    expect(response.status).toBe(400)
    expect(fake.getDbCalls).toBe(0)
    expect(db.state.statements).toEqual([])
  })

  it('refuses a well-formed unknown token and a tampered one with 404, removing nothing', async () => {
    const tampered = `${token.slice(0, 10)}${token[10] === 'A' ? 'B' : 'A'}${token.slice(11)}`
    for (const value of [tampered, unsubscribeTokenFor(999), 'e2eUnknownToken_0123456789abcdefghijklmnopq']) {
      const response = await POST(oneClick(value))
      expect(response.status).toBe(404)
    }
    expect(db.state.writes).toBe(0)
    expect(db.state.subscriptions).toHaveLength(3)
    expect(db.state.log).toEqual([])
  })

  it('refuses the token of a member whose account was deleted', async () => {
    db.state.members.clear()
    expect((await POST(oneClick(token))).status).toBe(404)
    expect(db.state.writes).toBe(0)
  })

  it('never expires a link: the lookup has no time condition, so an old recipient row still works', async () => {
    const response = await POST(oneClick(token))
    expect(response.status).toBe(200)
    for (const statement of db.state.statements) {
      expect(statement).not.toMatch(/now\(\)|interval|expires|claimed_at|created_at </)
    }
  })
})

describe('GET /unsubscribe/one-click', () => {
  it('redirects with 303 to the unsubscribe page and never mutates', async () => {
    const response = await GET(oneClick(token, 'GET'))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`/unsubscribe?token=${encodeURIComponent(token)}`)
    expect(fake.getDbCalls).toBe(0)
    expect(db.state.subscriptions).toHaveLength(3)
  })

  it('carries a hostile token only as an encoded query value', async () => {
    const response = await GET(oneClick('x"><script>&next=//evil', 'GET'))
    expect(response.headers.get('location')).toBe(`/unsubscribe?token=${encodeURIComponent('x"><script>&next=//evil')}`)
  })
})

describe('one-click with two members', () => {
  beforeEach(() => {
    db.state.members.set(8, 'luis@example.com')
    db.state.recipients.push({ hash: hashToken(unsubscribeTokenFor(12)), memberId: 8, newsletterId: 4 })
    db.state.subscriptions.push({ memberId: 8, topicId: 1 }, { memberId: 8, topicId: 2 })
  })

  it('removes only the token holder’s subscriptions', async () => {
    expect((await POST(oneClick(token))).status).toBe(200)
    expect(db.state.subscriptions.filter((s) => s.memberId === 8)).toEqual([
      { memberId: 8, topicId: 1 },
      { memberId: 8, topicId: 2 },
    ])
    expect(db.state.log.map((row) => row.memberId)).toEqual([7, 7])
  })

  it('uses the first token when the query repeats it, so an appended token cannot redirect the unsubscribe', async () => {
    const url = new URL('https://shpe.example/unsubscribe/one-click')
    url.searchParams.append('token', token)
    url.searchParams.append('token', unsubscribeTokenFor(12))
    expect((await POST(new Request(url, { method: 'POST', body: 'List-Unsubscribe=One-Click' }))).status).toBe(200)
    expect(db.state.log.map((row) => row.memberId)).toEqual([7, 7])
    expect(db.state.subscriptions.filter((s) => s.memberId === 8)).toHaveLength(2)
  })

  it('ignores a token in the POST body: only the link’s own token counts', async () => {
    const url = new URL('https://shpe.example/unsubscribe/one-click')
    const response = await POST(
      new Request(url, { method: 'POST', body: `token=${unsubscribeTokenFor(12)}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } }),
    )
    expect(response.status).toBe(400)
    expect(db.state.writes).toBe(0)
  })

  it.each([['HEAD'], ['GET']])('never touches the database on %s', async (method) => {
    const response = await GET(oneClick(token, method))
    expect(response.status).toBe(303)
    expect(fake.getDbCalls).toBe(0)
    expect(db.state.statements).toEqual([])
  })
})
