'use server'

import { getDb } from '@/db'
import { siteContent } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { isInlineContentKey } from '@/lib/content-keys'
import { MAX_CONTENT_LENGTH, contentTextSchema } from '@/lib/content-schema'

export async function saveContentText(
  key: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin()

  if (typeof key !== 'string' || !isInlineContentKey(key)) return { error: 'This text is not editable.' }

  const parsed = contentTextSchema.safeParse({ key, value })
  if (!parsed.success) {
    return { error: `This text can't be saved — keep it under ${MAX_CONTENT_LENGTH} characters.` }
  }

  await getDb()
    .insert(siteContent)
    .values(parsed.data)
    .onConflictDoUpdate({ target: siteContent.key, set: { value: parsed.data.value } })
  return { ok: true }
}
