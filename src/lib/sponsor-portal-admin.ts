import { and, asc, desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { members, sponsorEdits, sponsors } from '@/db/schema'

export const SPONSOR_EDITS_SHOWN = 100

export async function getSponsorListing(id: number) {
  const [listing] = await getDb().select().from(sponsors).where(eq(sponsors.id, id)).limit(1)
  return listing ?? null
}

export async function getLinkedMembers(sponsorId: number) {
  return getDb()
    .select({ id: members.id, name: members.name, email: members.email })
    .from(members)
    .where(and(eq(members.sponsorId, sponsorId), eq(members.role, 'sponsor')))
    .orderBy(asc(members.name), asc(members.id))
}

export async function getSponsorEdits(sponsorId: number) {
  return getDb()
    .select({
      id: sponsorEdits.id,
      memberId: sponsorEdits.memberId,
      memberName: sponsorEdits.memberName,
      fields: sponsorEdits.fields,
      createdAt: sponsorEdits.createdAt,
    })
    .from(sponsorEdits)
    .where(eq(sponsorEdits.sponsorId, sponsorId))
    .orderBy(desc(sponsorEdits.createdAt), desc(sponsorEdits.id))
    .limit(SPONSOR_EDITS_SHOWN)
}
