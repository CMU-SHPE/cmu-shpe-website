import { isNotNull } from 'drizzle-orm'
import { unionAll } from 'drizzle-orm/pg-core'
import { getDb } from '@/db'
import { advisors, officers, sponsors } from '@/db/schema'

/** Every column that can hold a public image URL; an admin can paste one row's URL into another. */
const IMAGE_URL_COLUMNS = [
  officers.photoUrl,
  officers.photoOriginalUrl,
  advisors.photoUrl,
  advisors.photoOriginalUrl,
  sponsors.logoUrl,
  sponsors.logoOriginalUrl,
] as const

// Deleting by URL removes the stored file, so a copy with a query string or fragment still counts.
function storedFile(url: string): string | null {
  if (!URL.canParse(url)) return null
  const { origin, pathname } = new URL(url)
  return origin + pathname
}

/** Returns the given URLs whose stored file some row still shows. */
export async function findReferencedImageUrls(urls: readonly string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set()
  const db = getDb()
  const [first, second, ...rest] = IMAGE_URL_COLUMNS.map((column) =>
    db.select({ url: column }).from(column.table).where(isNotNull(column)),
  )
  const rows = await unionAll(first, second, ...rest)
  const inUse = new Set(rows.map(({ url }) => url && storedFile(url)))
  return new Set(urls.filter((url) => inUse.has(storedFile(url))))
}
