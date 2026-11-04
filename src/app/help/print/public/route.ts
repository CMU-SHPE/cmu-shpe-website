import { htmlResponse, printDocument } from '@/lib/guide-print'
import { loadGuide } from '@/lib/guides'

export async function GET() {
  const guides = await Promise.all([
    loadGuide('members', { idPrefix: 'members-' }),
    loadGuide('sponsors', { idPrefix: 'sponsors-' }),
  ])
  return htmlResponse(printDocument('SHPE @ CMU website guide', guides))
}
