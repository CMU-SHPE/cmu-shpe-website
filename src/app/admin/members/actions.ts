'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/db'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { memberDeletion } from '@/lib/member-admin'

export async function deleteMember(id: number) {
  await requireAdmin()
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect('/admin/members?error=invalid')

  const db = getDb()
  const [, , deleted] = await db.batch(memberDeletion(db, parsed.data))
  if (deleted.length === 0) redirect('/admin/members?error=missing')

  redirect('/admin/members?saved=deleted')
}
