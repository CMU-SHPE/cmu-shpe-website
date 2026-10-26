import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashToken, memberTokenParam } from './member-tokens'
import { unsubscribeTokenFor, unsubscribeUrls } from './newsletter-unsubscribe-token'

vi.mock('@/db', () => ({ getDb: () => ({}) }))

describe('unsubscribeTokenFor', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is the base64url HMAC of the versioned recipient id', () => {
    const expected = createHmac('sha256', 'test-secret').update('newsletter-unsubscribe:v1:42').digest('base64url')
    expect(unsubscribeTokenFor(42)).toBe(expected)
  })

  it('is deterministic, 43 characters and a valid token parameter', () => {
    const token = unsubscribeTokenFor(7)
    expect(unsubscribeTokenFor(7)).toBe(token)
    expect(token).toHaveLength(43)
    expect(memberTokenParam.safeParse(token).success).toBe(true)
  })

  it('differs by recipient and by secret', () => {
    const first = unsubscribeTokenFor(1)
    expect(unsubscribeTokenFor(2)).not.toBe(first)
    vi.stubEnv('AUTH_SECRET', 'other-secret')
    expect(unsubscribeTokenFor(1)).not.toBe(first)
  })

  it('stores as the same sha256 hash used for member tokens', () => {
    const token = unsubscribeTokenFor(3)
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(token)).not.toBe(token)
  })

  it('throws a clear error at call time when AUTH_SECRET is missing', () => {
    vi.stubEnv('AUTH_SECRET', '')
    expect(() => unsubscribeTokenFor(1)).toThrow(/AUTH_SECRET is not set/)
  })
})

describe('unsubscribeUrls', () => {
  it('builds the page and one-click links', () => {
    const token = 'a'.repeat(43)
    expect(unsubscribeUrls('https://example.org', token)).toEqual({
      page: `https://example.org/unsubscribe?token=${token}`,
      oneClick: `https://example.org/unsubscribe/one-click?token=${token}`,
    })
  })
})
