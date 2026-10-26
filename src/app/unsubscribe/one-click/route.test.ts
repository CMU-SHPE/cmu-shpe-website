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
