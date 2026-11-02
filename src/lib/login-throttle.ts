import { isIPv4, isIPv6 } from 'node:net'

export const WINDOW_MINUTES = 15

export type ThrottleLimits = { perEmailAndIp: number; perEmail: number; perIp: number }

/**
 * Counts include the attempt being checked. perEmailAndIp is the limit one source meets.
 * perEmail bounds guessing spread over many sources; a browser the account has signed in on
 * skips it, so a stranger filling it can't keep the owner out. perIp stops one source trying
 * many accounts, and allows for a campus sharing one address.
 */
export const LOGIN_LIMITS: ThrottleLimits = { perEmailAndIp: 5, perEmail: 50, perIp: 50 }

/**
 * Vercel overwrites x-forwarded-for with the address it saw, so a client can't spoof the first
 * entry there. Behind another proxy this would be the wrong value to trust.
 */
export function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim()
  return first || null
}

function ipv6Groups(ip: string): number[] {
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  const hex = dotted
    ? `${ip.slice(0, dotted.index)}${((+dotted[1] << 8) | +dotted[2]).toString(16)}:${((+dotted[3] << 8) | +dotted[4]).toString(16)}`
    : ip
  const [head, tail] = hex.split('::')
  const parse = (part: string | undefined) => (part ? part.split(':').map((group) => parseInt(group, 16)) : [])
  const headGroups = parse(head)
  const tailGroups = parse(tail)
  const zeros = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length
  return [...headGroups, ...Array<number>(zeros).fill(0), ...tailGroups]
}

/**
 * The key a source is counted under. One IPv6 host usually controls a whole /64, so that is one
 * source; an IPv4-mapped address in any spelling is its IPv4 address; anything that isn't an IP
 * address counts as an unknown source.
 */
export function throttleIp(ip: string | null): string | null {
  if (!ip) return null
  if (isIPv4(ip)) return ip
  if (!isIPv6(ip)) return null
  const groups = ipv6Groups(ip.toLowerCase().split('%')[0])
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.')
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(':')}::/64`
}
