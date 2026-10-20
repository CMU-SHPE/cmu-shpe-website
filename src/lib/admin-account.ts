import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_BYTES = 72
export const MAX_ADMIN_ID = 2_147_483_647

export const adminPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
    message: `Passwords can be at most ${MAX_PASSWORD_BYTES} bytes; bcrypt ignores anything longer.`,
  })

const adminAccountSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email().max(320)),
  password: adminPassword,
})

export const adminId = z.number().int().positive().max(MAX_ADMIN_ID)

export type AdminAccountInput = z.infer<typeof adminAccountSchema>

export function parseAdminAccount(
  input: Record<string, unknown>,
): { success: true; data: AdminAccountInput } | { success: false; code: 'password' | 'invalid' } {
  const parsed = adminAccountSchema.safeParse(input)
  if (parsed.success) return { success: true, data: { ...parsed.data, email: parsed.data.email.toLowerCase() } }
  const passwordFailed = parsed.error.issues.some((issue) => issue.path[0] === 'password')
  return { success: false, code: passwordFailed ? 'password' : 'invalid' }
}

/**
 * A session signed in before the account's password last changed must not be
 * honoured. Sessions without an authTime predate the claim and are treated the
 * same way once a change has happened.
 */
export function sessionPredatesPasswordChange(
  authTime: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false
  return typeof authTime !== 'number' || authTime < passwordChangedAt.getTime()
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: adminPassword,
  confirmPassword: z.string().max(200),
})

export type PasswordChangeError = 'invalid' | 'password' | 'mismatch' | 'same'

export function parsePasswordChange(
  input: Record<string, unknown>,
):
  | { success: true; data: { currentPassword: string; newPassword: string } }
  | { success: false; code: PasswordChangeError } {
  const parsed = passwordChangeSchema.safeParse(input)
  if (!parsed.success) {
    const failed = (field: string) => parsed.error.issues.some((issue) => issue.path[0] === field)
    if (failed('newPassword')) return { success: false, code: 'password' }
    if (failed('currentPassword')) return { success: false, code: 'invalid' }
    return { success: false, code: 'mismatch' }
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data
  if (newPassword !== confirmPassword) return { success: false, code: 'mismatch' }
  if (newPassword === currentPassword) return { success: false, code: 'same' }
  return { success: true, data: { currentPassword, newPassword } }
}

const passwordResetSchema = z.object({
  id: adminId,
  newPassword: adminPassword,
  confirmPassword: z.string().max(200),
})

export type PasswordResetError = 'missing' | 'password' | 'mismatch'

export function parsePasswordReset(
  input: Record<string, unknown>,
): { success: true; data: { id: number; newPassword: string } } | { success: false; code: PasswordResetError } {
  const parsed = passwordResetSchema.safeParse(input)
  if (!parsed.success) {
    const failed = (field: string) => parsed.error.issues.some((issue) => issue.path[0] === field)
    if (failed('id')) return { success: false, code: 'missing' }
    return { success: false, code: failed('newPassword') ? 'password' : 'mismatch' }
  }
  const { id, newPassword, confirmPassword } = parsed.data
  if (newPassword !== confirmPassword) return { success: false, code: 'mismatch' }
  return { success: true, data: { id, newPassword } }
}
