import { isIPv6 } from 'node:net'

export const WINDOW_MINUTES = 15

export type ThrottleLimits = { perEmailAndIp: number; perEmail: number; perIp: number }

/**
 * perEmailAndIp is the limit one source meets. perEmail bounds guessing spread over many
 * addresses and is high enough that one network can't reach it. perIp stops one source trying
 * many accounts, and allows for a campus sharing one address.
 */
export const LOGIN_LIMITS: ThrottleLimits = { perEmailAndIp: 5, perEmail: 50, perIp: 50 }

/** Counts include the attempt being checked: it is recorded first, so concurrent requests see each other. */
export function isOverLimit(counts: ThrottleLimits, limits: ThrottleLimits): boolean {
  return counts.perEmailAndIp > limits.perEmailAndIp || counts.perEmail > limits.perEmail || counts.perIp > limits.perIp
}

/**
 * Vercel overwrites x-forwarded-for with the address it saw, so a client can't spoof the first
 * entry there. Behind another proxy this would be the wrong value to trust.
 */
export function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim()
  return first || null
}

/** One IPv6 host usually controls a whole /64, so counting single addresses would limit nothing. */
export function throttleIp(ip: string | null): string | null {
  if (!ip || !isIPv6(ip)) return ip
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return mapped[1]
  const [head, tail = ''] = ip.split('::')
  const groups = (part: string) => part.split(':').filter(Boolean)
  const padding = ip.includes('::') ? 8 - groups(head).length - groups(tail).length : 0
  const prefix = [...groups(head), ...Array<string>(padding).fill('0'), ...groups(tail)].slice(0, 4)
  return `${prefix.map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`
}
