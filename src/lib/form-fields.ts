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

export const recordId = z.coerce.number().int().positive()

export const MOVE_DIRECTIONS = ['up', 'down'] as const

export const moveDirection = z.enum(MOVE_DIRECTIONS)

export type MoveDirection = z.infer<typeof moveDirection>

export const moveRequest = z.object({ id: recordId, direction: moveDirection })
