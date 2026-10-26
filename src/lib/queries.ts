import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  advisors,
  events,
  homePillars,
  homeStats,
  nationalStats,
  officers,
  siteContent,
  siteSettings,
  sponsorBenefits,
  sponsors,
} from '@/db/schema'
import { contentDefaults } from '@/db/seed-data/content'
import type { ContentKey } from '@/lib/content-keys'
import { compareSponsors } from '@/lib/sponsor-tiers'

export async function getSiteSettings() {
  const [row] = await getDb().select().from(siteSettings).orderBy(asc(siteSettings.id)).limit(1)
  return row ?? null
}

async function getStoredContent(keys: readonly ContentKey[]): Promise<Map<string, string>> {
  const rows =
    keys.length === 0
      ? []
      : await getDb()
          .select()
          .from(siteContent)
          .where(inArray(siteContent.key, [...keys]))
  return new Map(rows.map((row) => [row.key, row.value]))
}

export async function getSiteContent<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const stored = await getStoredContent(keys)
  return Object.fromEntries(keys.map((key) => [key, stored.get(key) ?? ''])) as Record<K, string>
}

/**
 * Falls back to the seeded default only when a key has no row, so text an admin
 * deliberately blanked stays blank. Pages that must never render empty on a
 * database that hasn't been seeded (privacy, terms) use this.
 */
export async function getSiteContentWithDefaults<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const stored = await getStoredContent(keys)
  return Object.fromEntries(keys.map((key) => [key, stored.get(key) ?? contentDefaults[key]])) as Record<
    K,
    string
  >
}

// Consent records need a version even if an admin blanked the date on the page.
export async function getPrivacyPolicyVersion(): Promise<string> {
  const content = await getSiteContentWithDefaults(['privacy.updated'])
  return content['privacy.updated'].trim() || contentDefaults['privacy.updated']
}

export async function getSponsors() {
  const rows = await getDb().select().from(sponsors)
  return rows.sort(compareSponsors)
}

export async function getOfficers() {
  return getDb().select().from(officers).orderBy(asc(officers.sortOrder), asc(officers.id))
}

export async function getAdvisors() {
  return getDb().select().from(advisors).orderBy(asc(advisors.sortOrder), asc(advisors.id))
}

export async function getEvents() {
  return getDb().select().from(events).orderBy(asc(events.date), asc(events.id))
}

export async function getHomeStats() {
  return getDb().select().from(homeStats).orderBy(asc(homeStats.sortOrder), asc(homeStats.id))
}

export async function getHomePillars() {
  return getDb().select().from(homePillars).orderBy(asc(homePillars.sortOrder), asc(homePillars.id))
}

export async function getNationalStats() {
  return getDb().select().from(nationalStats).orderBy(asc(nationalStats.sortOrder), asc(nationalStats.id))
}

export async function getSponsorBenefits() {
  return getDb()
    .select()
    .from(sponsorBenefits)
    .orderBy(asc(sponsorBenefits.sortOrder), asc(sponsorBenefits.id))
}
