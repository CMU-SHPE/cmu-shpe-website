export const WINDOW_MINUTES = 15
export const MAX_FAILURES_PER_EMAIL = 5
export const MAX_FAILURES_PER_IP = 20

export function isThrottled(emailFailures: number, ipFailures: number): boolean {
  return emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP
}

export function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim()
  return first || null
}
