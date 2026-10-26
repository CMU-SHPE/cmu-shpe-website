import { and, eq, gt, isNull, lt, notExists, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/db'
import { memberTokens, members } from '@/db/schema'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, adminPassword } from '@/lib/admin-account'
import { emailAddress } from '@/lib/form-fields'
import { NAME_ERROR, memberName } from '@/lib/member-account'
import { memberTokenParam } from '@/lib/member-tokens'

export const UNCONFIRMED_RETENTION_DAYS = 7

export const PASSWORD_REQUIREMENTS = `At least ${MIN_PASSWORD_LENGTH} characters, and no more than ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} plain letters, fewer with emoji or accents).`
export const PASSWORD_ERROR = `Choose a password with ${PASSWORD_REQUIREMENTS.charAt(0).toLowerCase()}${PASSWORD_REQUIREMENTS.slice(1)}`

export const SEND_FAILED_MESSAGE = "We couldn't send the email right now, try again later."

export type FormState = {
  errors?: Partial<Record<string, string>>
  formError?: string
  values?: Record<string, string>
}

const memberEmail = emailAddress.transform((value) => value.toLowerCase())

const checked = z.literal('on')

const signUpSchema = z
  .object({
    name: memberName,
    email: memberEmail,
    password: adminPassword,
    confirmPassword: z.string().max(200),
    ageConfirmed: checked,
    termsAccepted: checked,
  })
  .refine((input) => input.password === input.confirmPassword, { path: ['confirmPassword'] })

const emailRequestSchema = z.object({ email: memberEmail })

const passwordResetSchema = z
  .object({
    token: memberTokenParam,
    password: adminPassword,
    confirmPassword: z.string().max(200),
  })
  .refine((input) => input.password === input.confirmPassword, { path: ['confirmPassword'] })

const FIELD_MESSAGES: Record<string, string> = {
  name: NAME_ERROR,
  email: 'Enter a valid email address.',
  password: PASSWORD_ERROR,
  confirmPassword: "The two passwords don't match.",
  ageConfirmed: 'You must be 13 or older to create an account.',
  termsAccepted: 'You need to agree to the Terms of Use and Privacy Policy to create an account.',
  token: 'This reset link is not valid. Request a new one.',
}

type Parsed<T> = { success: true; data: T } | { success: false; errors: Partial<Record<string, string>> }

function parseWith<T>(schema: z.ZodType<T>, input: Record<string, unknown>): Parsed<T> {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { success: true, data: parsed.data }
  const errors: Partial<Record<string, string>> = {}
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form')
    errors[field] ??= FIELD_MESSAGES[field] ?? 'Check this field.'
  }
  return { success: false, errors }
}

function fields(formData: FormData, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, formData.get(name) ?? undefined]))
}

export function parseSignUp(formData: FormData) {
  return parseWith(
    signUpSchema,
    fields(formData, ['name', 'email', 'password', 'confirmPassword', 'ageConfirmed', 'termsAccepted']),
  )
}

export function parseEmailRequest(formData: FormData) {
  return parseWith(emailRequestSchema, fields(formData, ['email']))
}

export function parsePasswordReset(formData: FormData) {
  return parseWith(passwordResetSchema, fields(formData, ['token', 'password', 'confirmPassword']))
}

/** Echoed back after a failed submit so the visitor doesn't retype them; never passwords. */
export function safeValues(formData: FormData, names: string[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const name of names) {
    const value = formData.get(name)
    if (typeof value === 'string') values[name] = value.slice(0, 400)
  }
  return values
}

/**
 * Unconfirmed accounts are kept for 7 days. One holding an unexpired confirmation link is
 * kept until that link expires, so a link sent on day 6 still works.
 */
export function purgeStaleUnconfirmedMembers(db: Db) {
  return db
    .delete(members)
    .where(
      and(
        isNull(members.emailConfirmedAt),
        lt(members.createdAt, sql`now() - make_interval(days => ${UNCONFIRMED_RETENTION_DAYS})`),
        notExists(
          db
            .select({ id: memberTokens.id })
            .from(memberTokens)
            .where(
              and(
                eq(memberTokens.memberId, members.id),
                eq(memberTokens.purpose, 'confirm_email'),
                gt(memberTokens.expiresAt, sql`now()`),
              ),
            ),
        ),
      ),
    )
}
