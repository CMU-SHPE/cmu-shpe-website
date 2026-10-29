import { currentAdmin } from '@/lib/admin'
import { PRIVATE_HEADERS, htmlResponse, printDocument } from '@/lib/guide-print'
import { loadGuide } from '@/lib/guides'

// Route handlers sit outside the admin layout, so this checks the session itself and answers 401
// rather than redirecting, like the other admin route handlers.
export async function GET() {
  if (!(await currentAdmin())) return new Response('Unauthorized', { status: 401, headers: PRIVATE_HEADERS })
  return htmlResponse(printDocument('SHPE @ CMU officer handbook', [await loadGuide('officers')]), PRIVATE_HEADERS)
}
