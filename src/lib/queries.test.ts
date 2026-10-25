import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { rows: [] as { key: string; value: string }[] }
  const query = { from: () => query, where: async () => state.rows }
  return { state, db: { select: () => query } }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))

import { contentDefaults } from '@/db/seed-data/content'
import { getPrivacyPolicyVersion, getSiteContent, getSiteContentWithDefaults } from './queries'

beforeEach(() => {
  mocks.state.rows = []
})

describe('getSiteContentWithDefaults', () => {
  it('uses the seeded default for a key with no row', async () => {
    const content = await getSiteContentWithDefaults(['privacy.header.heading', 'privacy.intro'])
    expect(content).toEqual({
      'privacy.header.heading': contentDefaults['privacy.header.heading'],
      'privacy.intro': contentDefaults['privacy.intro'],
    })
  })

  it('keeps a stored value, including one an admin deliberately blanked', async () => {
    mocks.state.rows = [
      { key: 'privacy.header.heading', value: 'Our privacy promise' },
      { key: 'privacy.intro', value: '' },
    ]
    const content = await getSiteContentWithDefaults(['privacy.header.heading', 'privacy.intro'])
    expect(content).toEqual({ 'privacy.header.heading': 'Our privacy promise', 'privacy.intro': '' })
  })
})

describe('getSiteContent', () => {
  it('still renders a missing row as empty text', async () => {
    const content = await getSiteContent(['home.hero.intro'])
    expect(content).toEqual({ 'home.hero.intro': '' })
  })
})

describe('getPrivacyPolicyVersion', () => {
  it('returns the stored effective date', async () => {
    mocks.state.rows = [{ key: 'privacy.updated', value: 'January 5, 2027' }]
    await expect(getPrivacyPolicyVersion()).resolves.toBe('January 5, 2027')
  })

  it('falls back to the seeded date the page shows when there is no row', async () => {
    await expect(getPrivacyPolicyVersion()).resolves.toBe(contentDefaults['privacy.updated'])
  })
})
