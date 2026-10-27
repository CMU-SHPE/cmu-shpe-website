// @vitest-environment node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_KEYS, contentKeyDefinition, type ContentKey } from '@/lib/content-keys'
import { emailAddress, httpUrl } from '@/lib/form-fields'
import { MAX_CONTENT_LENGTH } from '@/lib/content-schema'
import { imageSource } from '@/lib/validation'
import { contentDefaults } from './content'
import { homePillarRows, homeStatRows, nationalStatRows, sponsorBenefitRows } from './lists'
import { advisorRows, officerRows } from './officers'
import { settingsRow } from './settings'
import { sponsorRows } from './sponsors'

function publicFileExists(url: string) {
  return existsSync(path.join(process.cwd(), 'public', url))
}

function expectAscendingSortOrder(rows: { sortOrder?: number }[]) {
  expect(rows.map((row) => row.sortOrder)).toEqual(rows.map((_, index) => index))
}

describe('content defaults', () => {
  it('has exactly one default for every whitelisted content key', () => {
    const whitelisted = CONTENT_KEYS.map((entry) => entry.key).sort()
    expect(Object.keys(contentDefaults).sort()).toEqual(whitelisted)
  })

  it('stores rendered text, not JSX entities or source line wrapping', () => {
    for (const [key, value] of Object.entries(contentDefaults)) {
      expect(value, key).not.toMatch(/&[a-z]+;|&#\d+;/i)
      expect(value, key).toBe(value.trim())
      expect(value, key).not.toMatch(/ {2,}/)
      if (!contentKeyDefinition(key as ContentKey).multiline) expect(value, key).not.toContain('\n')
    }
  })

  it('keeps multiline values to trimmed, non-empty lines', () => {
    for (const entry of CONTENT_KEYS.filter((item) => item.multiline)) {
      for (const line of contentDefaults[entry.key].split('\n')) {
        expect(line, entry.key).toBe(line.trim())
        expect(line, entry.key).not.toBe('')
      }
    }
  })

  it('reproduces the characters the site renders today', () => {
    expect(contentDefaults['home.mission.paragraph2']).toContain("tomorrow's world")
    expect(contentDefaults['about.quote.text']).toMatch(/^“Changing lives .*development\.”$/)
    expect(contentDefaults['officers.board.heading']).toBe('Executive Board 2025–2026')
    expect(contentDefaults['footer.copyright']).toBe(
      '© 2026 SHPE @ Colorado Mesa University. All rights reserved.',
    )
    expect(contentDefaults['footer.tagline']).toBe(
      'Society of Hispanic Professional Engineers\nColorado Mesa University Chapter',
    )
  })

  it('fits every default within the inline editor limit', () => {
    for (const [key, value] of Object.entries(contentDefaults)) {
      expect(value.length, key).toBeLessThanOrEqual(MAX_CONTENT_LENGTH)
    }
  })

  it('covers every topic the privacy policy must disclose', () => {
    const privacy = Object.entries(contentDefaults)
      .filter(([key]) => key.startsWith('privacy.'))
      .map(([, value]) => value)
      .join('\n')
    for (const topic of [
      'name and email address',
      'hashed',
      'newsletter',
      'RSVP',
      'Vercel',
      'Neon',
      'Resend',
      'kept for 7 days',
      'used for 15 minutes',
      'Server logs',
      'spreadsheet (CSV)',
      'sponsor portal',
      'not in public file storage',
      'Only club officers and the accounts linked to a listing can view its receipts',
      'deleted together with the listing',
      'the event is deleted',
      'unsubscribe link that works without signing in',
      'unsubscribe button',
      'Click and open tracking are turned off',
      'only once you have confirmed your email address',
      'which newsletters were sent to you',
      'email confirmation, new confirmation link and password reset requests (your IP address)',
      'Delete my account',
      'strictly necessary',
      'analytics',
      'under 13',
    ]) {
      expect(privacy, topic).toContain(topic)
    }
  })

  it('leaves the tier amounts empty, as they are today', () => {
    for (const tier of ['platinum', 'gold', 'silver', 'bronze'] as const) {
      expect(contentDefaults[`sponsors.tier.${tier}.amount`]).toBe('')
    }
  })
})

describe('site settings', () => {
  it('has a valid contact email and only http(s) social links', () => {
    expect(emailAddress.safeParse(settingsRow.contactEmail).success).toBe(true)
    const links = [
      settingsRow.instagramUrl,
      settingsRow.linkedinUrl,
      settingsRow.xUrl,
      settingsRow.youtubeUrl,
      settingsRow.tiktokUrl,
      settingsRow.presenceUrl,
    ].filter((link): link is string => Boolean(link))
    expect(links).toHaveLength(4)
    for (const link of links) expect(httpUrl.safeParse(link).success, link).toBe(true)
  })

  it('hides X and YouTube, which are commented out today', () => {
    expect(settingsRow.xUrl).toBeNull()
    expect(settingsRow.youtubeUrl).toBeNull()
  })
})

describe('sponsors', () => {
  it('seeds JGMS then SGM, both Platinum', () => {
    expect(sponsorRows.map((row) => [row.name, row.tier])).toEqual([
      ['JGMS', 'Platinum'],
      ['SGM', 'Platinum'],
    ])
    expectAscendingSortOrder(sponsorRows)
  })

  it('keeps the logo backgrounds, including SGM gray', () => {
    expect(sponsorRows.map((row) => row.bgColor)).toEqual(['#ffffff', '#555555'])
  })

  it('points at logos that exist and http(s) websites', () => {
    for (const row of sponsorRows) {
      expect(imageSource.safeParse(row.logoUrl).success).toBe(true)
      expect(publicFileExists(row.logoUrl!), row.logoUrl!).toBe(true)
      expect(httpUrl.safeParse(row.website).success, row.website!).toBe(true)
    }
  })
})

describe('officers and advisors', () => {
  it('seeds the eight officers in source order, Co-Presidents first', () => {
    expect(officerRows.map((row) => row.name)).toEqual([
      'Jeff Torres Navarrete',
      'Magaly Luna',
      'Sergio Zazueta',
      'Jayden Alonzo-Estrada',
      'Jesus Lopez',
      'Daniel Hernandez',
      'Randy Martinez',
      'Adrian Valencia',
    ])
    expect(officerRows.slice(0, 2).map((row) => row.role)).toEqual(['Co-President', 'Co-President'])
    expectAscendingSortOrder(officerRows)
  })

  it('only gives photos to the officers who have one today', () => {
    const withPhotos = officerRows.filter((row) => row.photoUrl).map((row) => row.name)
    expect(withPhotos).toEqual([
      'Jeff Torres Navarrete',
      'Magaly Luna',
      'Sergio Zazueta',
      'Jayden Alonzo-Estrada',
    ])
  })

  it('leaves out LinkedIn where it is commented out today', () => {
    const withoutLinkedIn = officerRows.filter((row) => !row.linkedin).map((row) => row.name)
    expect(withoutLinkedIn).toEqual(['Randy Martinez', 'Adrian Valencia'])
  })

  it('seeds Ulises Techera as the only advisor', () => {
    expect(advisorRows).toHaveLength(1)
    expect(advisorRows[0]).toMatchObject({ name: 'Ulises Techera', photoUrl: '/officers/ulises.jpg' })
  })

  it('uses photo paths that exist, valid emails and http(s) LinkedIn links', () => {
    for (const row of [...officerRows, ...advisorRows]) {
      if (row.photoUrl) expect(publicFileExists(row.photoUrl), row.photoUrl).toBe(true)
      if (row.email) expect(emailAddress.safeParse(row.email).success, row.email).toBe(true)
      if (row.linkedin) expect(httpUrl.safeParse(row.linkedin).success, row.linkedin).toBe(true)
    }
  })
})

describe('page lists', () => {
  it('seeds the three visible home stats and four pillars', () => {
    expect(homeStatRows.map((row) => `${row.value} ${row.label}`)).toEqual([
      '25+ Members',
      '10+ Events Per Year',
      '5+ Years Active',
    ])
    expect(homePillarRows.map((row) => row.title)).toEqual([
      'Academic Excellence',
      'Career Development',
      'Networking',
      'Community Service',
    ])
    expectAscendingSortOrder(homeStatRows)
    expectAscendingSortOrder(homePillarRows)
  })

  it('seeds the three national stats', () => {
    expect(nationalStatRows.map((row) => row.value)).toEqual(['55,000+', '250+', 'Est. 1974'])
    expectAscendingSortOrder(nationalStatRows)
  })

  it('seeds the five visible benefits with the same cells', () => {
    expect(
      sponsorBenefitRows.map((row) => [row.label, row.platinum, row.gold, row.silver, row.bronze]),
    ).toEqual([
      ['Logo on website', 'yes', 'yes', 'yes', 'yes'],
      ['Social media features', 'yes', 'yes', '1', 'no'],
      ['Logo on event banners', 'yes', 'yes', 'no', 'no'],
      ['Newsletter spotlight', 'yes', 'yes', 'no', 'no'],
      ['Company presentation', 'yes', 'no', 'no', 'no'],
    ])
    expectAscendingSortOrder(sponsorBenefitRows)
  })
})
