import { inArray } from 'drizzle-orm'
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

export async function findReferencedImageUrls(urls: readonly string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set()
  const db = getDb()
  const [first, second, ...rest] = IMAGE_URL_COLUMNS.map((column) =>
    db.select({ url: column }).from(column.table).where(inArray(column, [...urls])),
  )
  const rows = await unionAll(first, second, ...rest)
  return new Set(rows.flatMap(({ url }) => (url ? [url] : [])))
}
