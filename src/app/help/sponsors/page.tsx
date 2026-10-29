import type { Metadata } from 'next'
import PublicGuidePage from '@/components/help/public-guide-page'
import { loadGuide } from '@/lib/guides'

export const metadata: Metadata = { title: 'Sponsor guide | SHPE @ Colorado Mesa University' }

export default async function SponsorGuidePage() {
  return <PublicGuidePage guide={await loadGuide('sponsors')} />
}
