'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import { requireMaster } from '@/lib/admin'
import { adminId, parseAdminAccount, parsePasswordReset } from '@/lib/admin-account'
import { clearLoginAttempts } from '@/lib/authorize'

export async function createAdmin(formData: FormData) {
  await requireMaster()

  const parsed = parseAdminAccount({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) redirect(`/admin/admins?error=${parsed.code}`)

  const { name, email, password } = parsed.data
  const db = getDb()
  const [existing] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1)
  if (existing) redirect('/admin/admins?error=duplicate')

  const inserted = await db
    .insert(admins)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' })
    .onConflictDoNothing({ target: admins.email })
    .returning({ id: admins.id })
  if (inserted.length === 0) redirect('/admin/admins?error=duplicate')

  redirect('/admin/admins?saved=1')
}

export async function deleteAdmin(id: number) {
  const session = await requireMaster()
  const target = adminId.safeParse(id)
  if (!target.success) redirect('/admin/admins')
  if (Number(session.user.id) === target.data) redirect('/admin/admins?error=self')

  const db = getDb()
  const deleted = await db
    .delete(admins)
    .where(and(eq(admins.id, target.data), eq(admins.role, 'admin')))
    .returning({ id: admins.id })
  if (deleted.length === 0) {
    const [kept] = await db
      .select({ role: admins.role })
      .from(admins)
      .where(eq(admins.id, target.data))
      .limit(1)
    redirect(kept?.role === 'master' ? '/admin/admins?error=master' : '/admin/admins')
  }

  redirect('/admin/admins?saved=1')
}

export async function resetAdminPassword(id: number, formData: FormData) {
  const session = await requireMaster()
  const parsed = parsePasswordReset({
    id,
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) redirect(`/admin/admins?error=${parsed.code}`)
  if (Number(session.user.id) === parsed.data.id) redirect('/admin/admins?error=self')

  const db = getDb()
  const [target] = await db
    .select({ role: admins.role })
    .from(admins)
    .where(eq(admins.id, parsed.data.id))
    .limit(1)
  if (!target) redirect('/admin/admins?error=missing')
  if (target.role === 'master') redirect('/admin/admins?error=master')

  const [updated] = await db
    .update(admins)
    .set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), passwordChangedAt: new Date() })
    .where(and(eq(admins.id, parsed.data.id), eq(admins.role, 'admin')))
    .returning({ email: admins.email })
  if (!updated) redirect('/admin/admins?error=missing')
  await clearLoginAttempts(updated.email)

  redirect('/admin/admins?saved=reset')
}
