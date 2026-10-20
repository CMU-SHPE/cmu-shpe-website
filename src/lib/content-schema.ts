import { z } from 'zod'
import { CONTENT_KEYS, type ContentKey, contentKeyDefinition } from './content-keys'
import { normalizeNewlines } from './text'

export const MAX_CONTENT_LENGTH = 2000

const contentKey = z.enum(CONTENT_KEYS.map((entry) => entry.key) as [ContentKey, ...ContentKey[]])

export function normalizeContentValue(key: ContentKey, value: string): string {
  const text = normalizeNewlines(value).trim()
  return contentKeyDefinition(key).multiline ? text : text.replace(/\s+/g, ' ')
}

export const contentTextSchema = z
  .object({
    key: contentKey,
    value: z.string().max(MAX_CONTENT_LENGTH * 2),
  })
  .transform(({ key, value }) => ({ key, value: normalizeContentValue(key, value) }))
  .refine(({ value }) => value.length <= MAX_CONTENT_LENGTH)
