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
