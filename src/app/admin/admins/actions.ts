'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import { requireMaster } from '@/lib/admin'

const adminSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email().max(320)),
  password: z.string().min(12).max(200),
})

export async function createAdmin(formData: FormData) {
  await requireMaster()

  const parsed = adminSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) redirect('/admin/admins?error=invalid')

  const email = parsed.data.email.toLowerCase()
  const db = getDb()
  const [existing] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1)
  if (existing) redirect('/admin/admins?error=duplicate')

  const inserted = await db
    .insert(admins)
    .values({
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: 'admin',
    })
    .onConflictDoNothing({ target: admins.email })
    .returning({ id: admins.id })
  if (inserted.length === 0) redirect('/admin/admins?error=duplicate')

  redirect('/admin/admins?saved=1')
}

export async function deleteAdmin(id: number) {
  const session = await requireMaster()
  if (!Number.isInteger(id)) redirect('/admin/admins')
  if (Number(session.user.id) === id) redirect('/admin/admins?error=self')

  const db = getDb()
  const [target] = await db
    .select({ role: admins.role })
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1)
  if (!target) redirect('/admin/admins')
  if (target.role === 'master') redirect('/admin/admins?error=master')

  await db.delete(admins).where(eq(admins.id, id))
  redirect('/admin/admins?saved=1')
}
