import { describe, expect, it } from 'vitest'
import { LOGIN_LIMITS, clientIp, throttleIp } from './login-throttle'

describe('LOGIN_LIMITS', () => {
  it('takes many sources to reach the per-email ceiling', () => {
    expect(LOGIN_LIMITS.perEmail / LOGIN_LIMITS.perEmailAndIp).toBeGreaterThanOrEqual(10)
  })
})

describe('throttleIp', () => {
  it('leaves IPv4 alone', () => {
    expect(throttleIp('203.0.113.7')).toBe('203.0.113.7')
  })

  it.each(['::ffff:192.0.2.1', '::FFFF:192.0.2.1', '::ffff:c000:201', '::ffff:C000:0201', '0:0:0:0:0:ffff:192.0.2.1', '0000:0000:0000:0000:0000:ffff:c000:0201'])(
    'counts the IPv4-mapped %s as its IPv4 address',
    (ip) => {
      expect(throttleIp(ip)).toBe('192.0.2.1')
    },
  )

  it('groups every spelling of an IPv6 network under its /64', () => {
    const network = '2001:db8:1:2::/64'
    expect(throttleIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(network)
    expect(throttleIp('2001:0DB8:0001:0002::1')).toBe(network)
    expect(throttleIp('2001:db8:1:2::1%eth0')).toBe(network)
    expect(throttleIp('2001:db8::')).toBe('2001:db8:0:0::/64')
    expect(throttleIp('::1')).toBe('0:0:0:0::/64')
    expect(throttleIp('1:2:3:4:5:6:1.2.3.4')).toBe('1:2:3:4::/64')
  })

  it.each([null, '', 'unknown', '999.1.1.1', '203.0.113.7:443', '1:2:3', '<script>', '2001:db8::g'])(
    'counts %s as an unknown source',
    (ip) => {
      expect(throttleIp(ip)).toBeNull()
    },
  )
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
