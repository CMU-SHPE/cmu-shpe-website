import { type SQL, asc, eq, max } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  advisors,
  homePillars,
  homeStats,
  nationalStats,
  newsletterTopics,
  officers,
  sponsorBenefits,
  sponsors,
} from '@/db/schema'
import type { MoveDirection } from '@/lib/form-fields'
import { moveId } from '@/lib/reorder'

export type OrderedTable =
  | typeof sponsors
  | typeof officers
  | typeof advisors
  | typeof homeStats
  | typeof homePillars
  | typeof nationalStats
  | typeof sponsorBenefits
  | typeof newsletterTopics

export async function nextSortOrder(table: OrderedTable, where?: SQL) {
  const [row] = await getDb()
    .select({ value: max(table.sortOrder) })
    .from(table)
    .where(where)
  return (row?.value ?? -1) + 1
}

export async function saveSortOrder(table: OrderedTable, orderedIds: readonly number[]) {
  const db = getDb()
  const [first, ...rest] = orderedIds.map((id, sortOrder) =>
    db.update(table).set({ sortOrder }).where(eq(table.id, id)),
  )
  if (!first) return
  await db.batch([first, ...rest])
}

export async function moveRow(table: OrderedTable, id: number, direction: MoveDirection, scope?: SQL) {
  const siblings = await getDb()
    .select({ id: table.id })
    .from(table)
    .where(scope)
    .orderBy(asc(table.sortOrder), asc(table.id))
  const order = moveId(siblings.map((row) => row.id), id, direction)
  if (order) await saveSortOrder(table, order)
}
