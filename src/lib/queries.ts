import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import { siteContent, siteSettings } from '@/db/schema'
import type { ContentKey } from '@/lib/content-keys'

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
