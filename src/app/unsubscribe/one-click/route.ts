import { memberTokenParam } from '@/lib/member-tokens'
import { unsubscribe } from '@/lib/newsletter-unsubscribe'

const HEADERS = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }

function reply(status: number, body: string) {
  return new Response(body, { status, headers: HEADERS })
}

/**
 * RFC 8058 one-click unsubscribe: mail providers POST here with no cookies, so the token in the
 * URL is the whole credential and there is no CSRF check to pass.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!memberTokenParam.safeParse(token).success) return reply(400, 'Invalid unsubscribe link.\n')

  const result = await unsubscribe(token, 'these', 'one_click')
  if (!result.ok) return reply(404, 'Unknown unsubscribe link.\n')
  return reply(200, result.removed.length > 0 ? 'Unsubscribed.\n' : 'No subscriptions were removed; this link’s topics are not on your list.\n')
}

// Link scanners and people opening the URL send GET, which must never unsubscribe anyone.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  return new Response(null, {
    status: 303,
    headers: { location: `/unsubscribe?token=${encodeURIComponent(token)}`, 'cache-control': 'no-store' },
  })
}
