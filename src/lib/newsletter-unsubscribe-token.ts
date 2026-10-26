import { createHmac } from 'node:crypto'

const TOKEN_CONTEXT = 'newsletter-unsubscribe:v1:'

/**
 * Derived from the recipient row rather than random, so a retried chunk carries the same links
 * and stays byte-identical for Resend's idempotency check. Only its hash is stored and lookups
 * go by hash, so rotating AUTH_SECRET later doesn't break links already sent.
 */
export function unsubscribeTokenFor(recipientId: number): string {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret) throw new Error('AUTH_SECRET is not set, so newsletter unsubscribe links cannot be made')
  return createHmac('sha256', secret).update(`${TOKEN_CONTEXT}${recipientId}`).digest('base64url')
}

export function unsubscribeUrls(base: string, token: string) {
  const query = `token=${encodeURIComponent(token)}`
  return {
    page: `${base}/unsubscribe?${query}`,
    oneClick: `${base}/unsubscribe/one-click?${query}`,
  }
}
