'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/db'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { memberDeletion, memberSponsorLink, memberSponsorRemoval } from '@/lib/member-admin'

export async function deleteMember(id: number) {
  await requireAdmin()
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect('/admin/members?error=invalid')

  const db = getDb()
  const [, , deleted] = await db.batch(memberDeletion(db, parsed.data))
  if (deleted.length === 0) redirect('/admin/members?error=missing')

  redirect('/admin/members?saved=deleted')
}

export async function linkMemberToSponsor(id: number, formData: FormData) {
  await requireAdmin()
  const memberId = recordId.safeParse(id)
  const sponsorId = recordId.safeParse(formData.get('sponsorId'))
  if (!memberId.success || !sponsorId.success) redirect('/admin/members?error=invalid')

  const linked = await memberSponsorLink(getDb(), memberId.data, sponsorId.data)
  if (linked.length === 0) redirect('/admin/members?error=link')

  redirect('/admin/members?saved=sponsor')
}

export async function removeSponsorAccess(id: number) {
  await requireAdmin()
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect('/admin/members?error=invalid')

  const removed = await memberSponsorRemoval(getDb(), parsed.data)
  if (removed.length === 0) redirect('/admin/members?error=missing')

  redirect('/admin/members?saved=supporter')
}
