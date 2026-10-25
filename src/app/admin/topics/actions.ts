'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { newsletterTopics } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import { parseTopicForm } from '@/lib/newsletter-topics'
import { moveRow, nextSortOrder } from '@/lib/sort-order'

const SAVED = '/admin/topics?saved=1'
const INVALID = '/admin/topics?error=invalid'
const MISSING = '/admin/topics?error=missing'

function parseId(id: unknown) {
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect(INVALID)
  return parsed.data
}

export async function createTopic(formData: FormData) {
  await requireAdmin()
  const parsed = parseTopicForm(formData)
  if (!parsed.success) redirect(INVALID)

  await getDb()
    .insert(newsletterTopics)
    .values({ ...parsed.data, sortOrder: await nextSortOrder(newsletterTopics) })
  redirect(SAVED)
}

export async function updateTopic(id: number, formData: FormData) {
  await requireAdmin()
  const topicId = parseId(id)
  const parsed = parseTopicForm(formData)
  if (!parsed.success) redirect(INVALID)

  const updated = await getDb()
    .update(newsletterTopics)
    .set(parsed.data)
    .where(eq(newsletterTopics.id, topicId))
    .returning({ id: newsletterTopics.id })
  if (updated.length === 0) redirect(MISSING)
  redirect(SAVED)
}

export async function deleteTopic(id: number) {
  await requireAdmin()
  const topicId = parseId(id)

  const deleted = await getDb()
    .delete(newsletterTopics)
    .where(eq(newsletterTopics.id, topicId))
    .returning({ id: newsletterTopics.id })
  if (deleted.length === 0) redirect(MISSING)
  redirect(SAVED)
}

export async function moveTopic(id: number, direction: MoveDirection) {
  await requireAdmin()
  const parsed = moveRequest.safeParse({ id, direction })
  if (!parsed.success) redirect(INVALID)

  await moveRow(newsletterTopics, parsed.data.id, parsed.data.direction)
  redirect(SAVED)
}
