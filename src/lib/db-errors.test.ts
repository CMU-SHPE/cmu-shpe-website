import { DrizzleQueryError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { isUniqueViolation, safeErrorMessage } from './db-errors'

const hash = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234'

function queryError(cause: Error) {
  return new DrizzleQueryError('update "admins" set "password_hash" = $1', [hash], cause)
}

function postgresError(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

describe('safeErrorMessage', () => {
  it("reports a failed query's cause without its parameters", () => {
    const message = safeErrorMessage(queryError(new Error('fetch failed')))
    expect(message).toBe('fetch failed')
    expect(message).not.toContain(hash)
  })

  it('passes other errors through', () => {
    expect(safeErrorMessage(new Error('No master account exists.'))).toBe('No master account exists.')
    expect(safeErrorMessage('plain text')).toBe('plain text')
  })
})

describe('isUniqueViolation', () => {
  it('recognises a unique constraint violation wrapped by Drizzle', () => {
    const duplicate = postgresError('duplicate key value violates unique constraint "admins_email_unique"', '23505')
    expect(isUniqueViolation(queryError(duplicate))).toBe(true)
  })

  it('ignores other failures', () => {
    expect(isUniqueViolation(queryError(postgresError('deadlock detected', '40P01')))).toBe(false)
    expect(isUniqueViolation(new Error('fetch failed'))).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
  })
})
