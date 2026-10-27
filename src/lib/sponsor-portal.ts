import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq, getTableColumns } from 'drizzle-orm'
import { getDb } from '@/db'
import { type Sponsor, members, sponsors } from '@/db/schema'
import { type MemberSession, currentMember } from '@/lib/member'

export type SponsorAccess = { member: MemberSession; listing: Sponsor }

/** A sponsor whose listing is gone, or who was demoted, gets null and is treated as a supporter. */
export const currentSponsor = cache(async (): Promise<SponsorAccess | null> => {
  const member = await currentMember()
  if (!member) return null

  const [listing] = await getDb()
    .select(getTableColumns(sponsors))
    .from(members)
    .innerJoin(sponsors, eq(sponsors.id, members.sponsorId))
    .where(and(eq(members.id, Number(member.user.id)), eq(members.role, 'sponsor')))
    .limit(1)
  return listing ? { member, listing } : null
})

export async function requireSponsor() {
  if (!(await currentMember())) redirect('/login')
  const sponsor = await currentSponsor()
  if (!sponsor) redirect('/account')
  return sponsor
}
