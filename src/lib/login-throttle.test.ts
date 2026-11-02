import { describe, expect, it } from 'vitest'
import { LOGIN_LIMITS, clientIp, isOverLimit, throttleIp } from './login-throttle'

const under = { perEmailAndIp: 1, perEmail: 1, perIp: 1 }

describe('isOverLimit', () => {
  it('allows attempts up to every limit, counting the current attempt', () => {
    expect(isOverLimit(under, LOGIN_LIMITS)).toBe(false)
    expect(isOverLimit(LOGIN_LIMITS, LOGIN_LIMITS)).toBe(false)
  })

  it.each(['perEmailAndIp', 'perEmail', 'perIp'] as const)('throttles once %s is passed', (key) => {
    expect(isOverLimit({ ...under, [key]: LOGIN_LIMITS[key] + 1 }, LOGIN_LIMITS)).toBe(true)
  })

  it('takes many sources to reach the per-email ceiling', () => {
    expect(LOGIN_LIMITS.perEmail / LOGIN_LIMITS.perEmailAndIp).toBeGreaterThanOrEqual(10)
  })
})

describe('throttleIp', () => {
  it('leaves IPv4 and an unknown source alone', () => {
    expect(throttleIp('203.0.113.7')).toBe('203.0.113.7')
    expect(throttleIp(null)).toBeNull()
  })

  it('counts an IPv4-mapped address as IPv4', () => {
    expect(throttleIp('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('groups every spelling of an IPv6 network under its /64', () => {
    const network = '2001:db8:1:2::/64'
    expect(throttleIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(network)
    expect(throttleIp('2001:0DB8:0001:0002::1')).toBe(network)
    expect(throttleIp('2001:db8::')).toBe('2001:db8:0:0::/64')
    expect(throttleIp('::1')).toBe('0:0:0:0::/64')
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
