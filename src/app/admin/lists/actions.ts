'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { homePillars, homeStats, nationalStats, sponsorBenefits } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import {
  type ListName,
  listName,
  parseBenefitForm,
  parseHomePillarForm,
  parseHomeStatForm,
  parseNationalStatForm,
} from '@/lib/list-schemas'
import { moveRow, nextSortOrder } from '@/lib/sort-order'

const SAVED = '/admin/lists?saved=1'
const INVALID = '/admin/lists?error=invalid'
const MISSING = '/admin/lists?error=missing'

const tables = {
  homeStats,
  homePillars,
  nationalStats,
  sponsorBenefits,
}

function parseId(id: unknown) {
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect(INVALID)
  return parsed.data
}

function requireUpdated(rows: unknown[]) {
  if (rows.length === 0) redirect(MISSING)
}

export async function createHomeStat(formData: FormData) {
  await requireAdmin()
  const parsed = parseHomeStatForm(formData)
  if (!parsed.success) redirect(INVALID)

  await getDb()
    .insert(homeStats)
    .values({ ...parsed.data, sortOrder: await nextSortOrder(homeStats) })
  redirect(SAVED)
}

export async function updateHomeStat(id: number, formData: FormData) {
  await requireAdmin()
  const itemId = parseId(id)
  const parsed = parseHomeStatForm(formData)
  if (!parsed.success) redirect(INVALID)

  requireUpdated(
    await getDb()
      .update(homeStats)
      .set(parsed.data)
      .where(eq(homeStats.id, itemId))
      .returning({ id: homeStats.id }),
  )
  redirect(SAVED)
}

export async function createHomePillar(formData: FormData) {
  await requireAdmin()
  const parsed = parseHomePillarForm(formData)
  if (!parsed.success) redirect(INVALID)

  await getDb()
    .insert(homePillars)
    .values({ ...parsed.data, sortOrder: await nextSortOrder(homePillars) })
  redirect(SAVED)
}

export async function updateHomePillar(id: number, formData: FormData) {
  await requireAdmin()
  const itemId = parseId(id)
  const parsed = parseHomePillarForm(formData)
  if (!parsed.success) redirect(INVALID)

  requireUpdated(
    await getDb()
      .update(homePillars)
      .set(parsed.data)
      .where(eq(homePillars.id, itemId))
      .returning({ id: homePillars.id }),
  )
  redirect(SAVED)
}

export async function createNationalStat(formData: FormData) {
  await requireAdmin()
  const parsed = parseNationalStatForm(formData)
  if (!parsed.success) redirect(INVALID)

  await getDb()
    .insert(nationalStats)
    .values({ ...parsed.data, sortOrder: await nextSortOrder(nationalStats) })
  redirect(SAVED)
}

export async function updateNationalStat(id: number, formData: FormData) {
  await requireAdmin()
  const itemId = parseId(id)
  const parsed = parseNationalStatForm(formData)
  if (!parsed.success) redirect(INVALID)

  requireUpdated(
    await getDb()
      .update(nationalStats)
      .set(parsed.data)
      .where(eq(nationalStats.id, itemId))
      .returning({ id: nationalStats.id }),
  )
  redirect(SAVED)
}

export async function createSponsorBenefit(formData: FormData) {
  await requireAdmin()
  const parsed = parseBenefitForm(formData)
  if (!parsed.success) redirect(INVALID)

  await getDb()
    .insert(sponsorBenefits)
    .values({ ...parsed.data, sortOrder: await nextSortOrder(sponsorBenefits) })
  redirect(SAVED)
}

export async function updateSponsorBenefit(id: number, formData: FormData) {
  await requireAdmin()
  const itemId = parseId(id)
  const parsed = parseBenefitForm(formData)
  if (!parsed.success) redirect(INVALID)

  requireUpdated(
    await getDb()
      .update(sponsorBenefits)
      .set(parsed.data)
      .where(eq(sponsorBenefits.id, itemId))
      .returning({ id: sponsorBenefits.id }),
  )
  redirect(SAVED)
}

export async function deleteListItem(list: ListName, id: number) {
  await requireAdmin()
  const parsedList = listName.safeParse(list)
  if (!parsedList.success) redirect(INVALID)
  const itemId = parseId(id)

  const table = tables[parsedList.data]
  await getDb().delete(table).where(eq(table.id, itemId))
  redirect(SAVED)
}

export async function moveListItem(list: ListName, id: number, direction: MoveDirection) {
  await requireAdmin()
  const parsedList = listName.safeParse(list)
  const parsedMove = moveRequest.safeParse({ id, direction })
  if (!parsedList.success || !parsedMove.success) redirect(INVALID)

  await moveRow(tables[parsedList.data], parsedMove.data.id, parsedMove.data.direction)
  redirect(SAVED)
}
