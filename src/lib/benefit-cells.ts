import type { Tier } from './sponsor-tiers'

export const BENEFIT_COLUMNS = {
  Platinum: 'platinum',
  Gold: 'gold',
  Silver: 'silver',
  Bronze: 'bronze',
} as const satisfies Record<Tier, string>

export type BenefitColumn = (typeof BENEFIT_COLUMNS)[Tier]

export const MAX_BENEFIT_TEXT_LENGTH = 3

export type BenefitCell = { kind: 'yes' } | { kind: 'no' } | { kind: 'text'; text: string }

export function parseBenefitCell(value: string): BenefitCell {
  const trimmed = value.trim()
  if (trimmed === 'yes') return { kind: 'yes' }
  if (trimmed === 'no' || trimmed === '') return { kind: 'no' }
  return { kind: 'text', text: trimmed }
}
