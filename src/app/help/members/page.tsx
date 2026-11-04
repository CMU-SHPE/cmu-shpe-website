import type { Metadata } from 'next'
import PublicGuidePage from '@/components/help/public-guide-page'
import { loadGuide } from '@/lib/guides'

export const metadata: Metadata = { title: 'Member guide | SHPE @ Colorado Mesa University' }

export default async function MemberGuidePage() {
  return <PublicGuidePage guide={await loadGuide('members')} />
}
