import type { SponsorTier } from '@/db/schema'

export const SPONSOR_TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze'] as const satisfies readonly SponsorTier[]

export type Tier = (typeof SPONSOR_TIERS)[number]

type Sortable = { id: number; tier: Tier; sortOrder: number }

export function compareSponsors(a: Sortable, b: Sortable): number {
  return (
    SPONSOR_TIERS.indexOf(a.tier) - SPONSOR_TIERS.indexOf(b.tier) ||
    a.sortOrder - b.sortOrder ||
    a.id - b.id
  )
}
