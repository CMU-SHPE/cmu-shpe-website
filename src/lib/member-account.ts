import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { memberTopicSubscriptions, members } from '@/db/schema'
import { recordId } from './form-fields'

export const MAX_MEMBER_NAME_LENGTH = 100
export const NAME_ERROR = `Enter your name, on one line and up to ${MAX_MEMBER_NAME_LENGTH} characters.`
const MAX_TOPIC_SELECTION = 200
export const DELETE_CONFIRMATION_WORD = 'DELETE'

// Names are shown to admins and put into emails, so line breaks (including the Unicode
// line and paragraph separators) and other control characters are refused rather than
// silently rewritten.
export const memberName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MEMBER_NAME_LENGTH)
  .refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value))

/**
 * Each submit gets a fresh n, so the same result twice is still a new URL: the page remounts
 * its message and moves focus there again instead of leaving the screen reader silent.
 */
export function accountResultPath(result: { error: string } | { saved: string }): string {
  return `/account?${new URLSearchParams({ ...result, n: randomBytes(4).toString('hex') })}`
}

export function parseNameForm(formData: FormData) {
  return memberName.safeParse(formData.get('name'))
}

const topicSelection = z
  .array(recordId)
  .max(MAX_TOPIC_SELECTION)
  .transform((ids) => [...new Set(ids)])

export function parseTopicSelection(formData: FormData) {
  return topicSelection.safeParse(formData.getAll('topics'))
}

export function diffTopics(current: readonly number[], selected: readonly number[]) {
  const currentSet = new Set(current)
  const selectedSet = new Set(selected)
  return {
    add: selected.filter((id) => !currentSet.has(id)),
    remove: current.filter((id) => !selectedSet.has(id)),
  }
}

const deleteConfirmation = z.object({
  password: z.string().min(1).max(200),
  confirm: z.string().trim(),
})

export function parseDeleteConfirmation(formData: FormData) {
  const parsed = deleteConfirmation.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) return { success: false as const, code: 'delete-invalid' as const }
  if (parsed.data.confirm !== DELETE_CONFIRMATION_WORD) return { success: false as const, code: 'delete-confirm' as const }
  return { success: true as const, password: parsed.data.password }
}

export async function findMemberForAction(id: number) {
  const [row] = await getDb()
    .select({ id: members.id, email: members.email, name: members.name, passwordHash: members.passwordHash })
    .from(members)
    .where(eq(members.id, id))
    .limit(1)
  return row ?? null
}

export async function getMemberTopicIds(memberId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ topicId: memberTopicSubscriptions.topicId })
    .from(memberTopicSubscriptions)
    .where(eq(memberTopicSubscriptions.memberId, memberId))
  return rows.map((row) => row.topicId)
}
