export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

export function privateStatusResponse(status: 401 | 404): Response {
  return new Response(status === 401 ? 'Unauthorized' : 'Not found', { status, headers: PRIVATE_HEADERS })
}
