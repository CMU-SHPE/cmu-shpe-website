import { DrizzleQueryError } from 'drizzle-orm'

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

function rootCause(error: unknown): unknown {
  return error instanceof DrizzleQueryError ? error.cause : error
}

export function isUniqueViolation(error: unknown): boolean {
  return (rootCause(error) as { code?: unknown } | undefined)?.code === UNIQUE_VIOLATION
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (rootCause(error) as { code?: unknown } | undefined)?.code === FOREIGN_KEY_VIOLATION
}

/** DrizzleQueryError's own message lists the statement's parameters, which can include password hashes. */
export function safeErrorMessage(error: unknown): string {
  const cause = rootCause(error)
  return cause instanceof Error ? cause.message : String(cause)
}
