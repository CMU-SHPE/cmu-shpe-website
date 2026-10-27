import { and, eq, getTableColumns } from 'drizzle-orm'
import { getDb } from '@/db'
import { type Sponsor, members, sponsors } from '@/db/schema'

export async function findOwnListing(memberId: number): Promise<Sponsor | null> {
  const [listing] = await getDb()
    .select(getTableColumns(sponsors))
    .from(members)
    .innerJoin(sponsors, eq(sponsors.id, members.sponsorId))
    .where(and(eq(members.id, memberId), eq(members.role, 'sponsor')))
    .limit(1)
  return listing ?? null
}
