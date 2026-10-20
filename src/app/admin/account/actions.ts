'use server'

import { headers } from 'next/headers'
import { redirect, unstable_rethrow } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { signIn } from '@/auth'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { parsePasswordChange } from '@/lib/admin-account'
import { clearLoginAttempts, recordLoginAttempt } from '@/lib/authorize'
import { clientIp } from '@/lib/login-throttle'

export async function changePassword(formData: FormData) {
  const session = await requireAdmin()

  const parsed = parsePasswordChange({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) redirect(`/admin/account?error=${parsed.code}`)

  const db = getDb()
  const [admin] = await db
    .select({ id: admins.id, email: admins.email, passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.id, Number(session.user.id)))
    .limit(1)
  if (!admin) redirect('/login')

  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordLoginAttempt(admin.email, ip)
  if (throttled) redirect('/admin/account?error=throttled')

  const currentMatches = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash)
  if (!currentMatches) redirect('/admin/account?error=current')

  await db
    .update(admins)
    .set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), passwordChangedAt: new Date() })
    .where(eq(admins.id, admin.id))
  await clearLoginAttempts(admin.email)

  try {
    await signIn('credentials', {
      email: admin.email,
      password: parsed.data.newPassword,
      redirectTo: '/admin/account?saved=1',
    })
  } catch (error) {
    unstable_rethrow(error)
    redirect('/login?changed=1')
  }
}
