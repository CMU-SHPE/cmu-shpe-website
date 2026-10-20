import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import { advisors, officers, siteContent, siteSettings, sponsors } from '@/db/schema'
import type { ContentKey } from '@/lib/content-keys'
import { compareSponsors } from '@/lib/sponsor-tiers'

export async function getSiteSettings() {
  const [row] = await getDb().select().from(siteSettings).orderBy(asc(siteSettings.id)).limit(1)
  return row ?? null
}

export async function getSiteContent<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const rows =
    keys.length === 0
      ? []
      : await getDb()
          .select()
          .from(siteContent)
          .where(inArray(siteContent.key, [...keys]))
  const stored = new Map(rows.map((row) => [row.key, row.value]))
  return Object.fromEntries(keys.map((key) => [key, stored.get(key) ?? ''])) as Record<K, string>
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
