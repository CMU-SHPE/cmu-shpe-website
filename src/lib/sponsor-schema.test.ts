import { describe, expect, it } from 'vitest'
import { MAX_SPONSOR_DESCRIPTION_LENGTH, parseSponsorForm, parseSponsorListingForm } from './sponsor-schema'
import { compareSponsors } from './sponsor-tiers'

function sponsorForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  const values: Record<string, string> = {
    name: 'SGM',
    tier: 'Platinum',
    website: 'https://sgm-inc.com/',
    logoUrl: '/sponsors/sgm-inc-logo.svg',
    bgColor: '#555555',
    description: 'Builds bridges.',
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

describe('parseSponsorForm', () => {
  it('parses a valid sponsor', () => {
    const parsed = parseSponsorForm(sponsorForm())
    expect(parsed.data).toEqual({
      name: 'SGM',
      tier: 'Platinum',
      website: 'https://sgm-inc.com/',
      logoUrl: '/sponsors/sgm-inc-logo.svg',
      bgColor: '#555555',
      description: 'Builds bridges.',
    })
  })

  it('caps the description length', () => {
    const atLimit = 'x'.repeat(MAX_SPONSOR_DESCRIPTION_LENGTH)
    expect(parseSponsorForm(sponsorForm({ description: atLimit })).success).toBe(true)
    expect(parseSponsorForm(sponsorForm({ description: `${atLimit}x` })).success).toBe(false)
  })

  it('treats a blank website and logo path as none', () => {
    const parsed = parseSponsorForm(sponsorForm({ website: '', logoUrl: ' ' }))
    expect(parsed.data).toMatchObject({ website: null, logoUrl: null })
  })

  it('rejects a javascript: website', () => {
    expect(parseSponsorForm(sponsorForm({ website: 'javascript:alert(1)' })).success).toBe(false)
  })

  it('rejects a logo path that is neither root-relative nor http(s)', () => {
    expect(parseSponsorForm(sponsorForm({ logoUrl: 'javascript:alert(1)' })).success).toBe(false)
    expect(parseSponsorForm(sponsorForm({ logoUrl: '//evil.example/x.png' })).success).toBe(false)
  })

  it('rejects an unknown tier', () => {
    expect(parseSponsorForm(sponsorForm({ tier: 'Diamond' })).success).toBe(false)
  })

  it('rejects a background that is not a #rrggbb hex color', () => {
    expect(parseSponsorForm(sponsorForm({ bgColor: 'red' })).success).toBe(false)
    expect(parseSponsorForm(sponsorForm({ bgColor: '#fff;background:url(x)' })).success).toBe(false)
  })

  it('requires a name', () => {
    expect(parseSponsorForm(sponsorForm({ name: '  ' })).success).toBe(false)
  })
})

describe('parseSponsorListingForm', () => {
  it('keeps only the fields a sponsor may edit, ignoring tier, logo path and ids', () => {
    const form = sponsorForm({ description: '  Trimmed.  ' })
    form.set('id', '99')
    form.set('sponsorId', '99')
    form.set('sortOrder', '0')
    expect(parseSponsorListingForm(form).data).toEqual({
      name: 'SGM',
      website: 'https://sgm-inc.com/',
      bgColor: '#555555',
      description: 'Trimmed.',
    })
  })

  it('applies the admin field rules', () => {
    expect(parseSponsorListingForm(sponsorForm({ name: ' ' })).success).toBe(false)
    expect(parseSponsorListingForm(sponsorForm({ website: 'javascript:alert(1)' })).success).toBe(false)
    expect(parseSponsorListingForm(sponsorForm({ bgColor: 'red' })).success).toBe(false)
    expect(
      parseSponsorListingForm(sponsorForm({ description: 'x'.repeat(MAX_SPONSOR_DESCRIPTION_LENGTH + 1) })).success,
    ).toBe(false)
  })
})

describe('compareSponsors', () => {
  it('orders by tier, then sortOrder, then id', () => {
    const rows = [
      { id: 1, tier: 'Bronze' as const, sortOrder: 0 },
      { id: 5, tier: 'Platinum' as const, sortOrder: 1 },
      { id: 4, tier: 'Gold' as const, sortOrder: 0 },
      { id: 3, tier: 'Platinum' as const, sortOrder: 0 },
      { id: 2, tier: 'Platinum' as const, sortOrder: 0 },
    ]
    expect([...rows].sort(compareSponsors).map((row) => row.id)).toEqual([2, 3, 5, 4, 1])
  })
})
