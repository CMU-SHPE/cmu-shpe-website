import { z } from 'zod'
import { HEX_COLOR } from './colors'

function blankToNull(value: unknown) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

export function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToNull, schema.nullable())
}

export function requiredText(max: number) {
  return z.string().trim().min(1).max(max)
}

export function optionalText(max: number) {
  return optional(z.string().trim().max(max))
}

export const httpUrl = z.string().trim().max(500).pipe(z.httpUrl())

export const optionalHttpUrl = optional(httpUrl)

export const emailAddress = z.string().trim().max(320).pipe(z.email())

export const optionalEmail = optional(emailAddress)

export const hexColor = z.string().trim().regex(HEX_COLOR)

export const MAX_RECORD_ID = 2147483647

export const recordId = z.coerce.number().int().positive().max(MAX_RECORD_ID)

export const MOVE_DIRECTIONS = ['up', 'down'] as const

export const moveDirection = z.enum(MOVE_DIRECTIONS)

export type MoveDirection = z.infer<typeof moveDirection>

export const moveRequest = z.object({ id: recordId, direction: moveDirection })

export const HTTP_URL_INPUT = {
  pattern: 'https?://.+',
  title: 'Use a full link that starts with http:// or https://',
} as const

export const IMAGE_SOURCE_INPUT = {
  pattern: String.raw`\/[^\/\s\\][^\s\\]*|https:\/\/[^\s\\]+`,
  title: 'Use a path on this site that starts with a single / (like /officers/jeff.jpg) or an https:// link',
} as const
