import { z } from 'zod'
import { INLINE_CONTENT_KEYS, type InlineContentKey, contentKeyDefinition } from './content-keys'
import { normalizeNewlines } from './text'

export const MAX_CONTENT_LENGTH = 2000

const contentKey = z.enum(INLINE_CONTENT_KEYS as [InlineContentKey, ...InlineContentKey[]])

export function normalizeContentValue(key: InlineContentKey, value: string): string {
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
