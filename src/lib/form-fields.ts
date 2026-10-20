import { z } from 'zod'

function blankToNull(value: unknown) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

export function requiredText(max: number) {
  return z.string().trim().min(1).max(max)
}

export function optionalText(max: number) {
  return z.preprocess(blankToNull, z.string().trim().max(max).nullable())
}

export const httpUrl = z.string().trim().max(500).pipe(z.httpUrl())

export const optionalHttpUrl = z.preprocess(blankToNull, httpUrl.nullable())

export const emailAddress = z.string().trim().max(320).pipe(z.email())

export const optionalEmail = z.preprocess(blankToNull, emailAddress.nullable())

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const hexColor = z.string().trim().regex(HEX_COLOR)

export const recordId = z.coerce.number().int().positive()

export const MOVE_DIRECTIONS = ['up', 'down'] as const

export const moveDirection = z.enum(MOVE_DIRECTIONS)

export type MoveDirection = z.infer<typeof moveDirection>
