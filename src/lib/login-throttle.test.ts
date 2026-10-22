import { describe, expect, it } from 'vitest'
import {
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  clientIp,
  isThrottled,
} from './login-throttle'

describe('isThrottled', () => {
  it('allows attempts up to both limits, counting the current attempt', () => {
    expect(isThrottled(1, 1)).toBe(false)
    expect(isThrottled(MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP)).toBe(false)
  })

  it('throttles once the per-email limit is passed', () => {
    expect(isThrottled(MAX_FAILURES_PER_EMAIL + 1, 1)).toBe(true)
  })

  it('throttles once the per-ip limit is passed even for fresh emails', () => {
    expect(isThrottled(1, MAX_FAILURES_PER_IP + 1)).toBe(true)
  })
})

describe('clientIp', () => {
  it('takes the first hop from x-forwarded-for', () => {
    expect(clientIp('203.0.113.7, 10.0.0.1')).toBe('203.0.113.7')
    expect(clientIp('203.0.113.7')).toBe('203.0.113.7')
  })

  it('returns null for missing or empty headers', () => {
    expect(clientIp(null)).toBeNull()
    expect(clientIp('')).toBeNull()
    expect(clientIp('  ,10.0.0.1')).toBeNull()
  })
})
