import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { type Sponsor, type SponsorTier, admins, members, sponsorEdits, sponsors } from '@/db/schema'
import { type MemberSession, currentMember } from '@/lib/member'
import { findOwnListing } from '@/lib/sponsor-portal-listing'
import type { LogoColumns, SponsorListingFields } from '@/lib/sponsor-schema'
import { qualified } from '@/lib/qualified-column'

export type SponsorAccess = { member: MemberSession; listing: Sponsor }

/** A sponsor whose listing is gone, or who was demoted, gets null and is treated as a supporter. */
export const currentSponsor = cache(async (): Promise<SponsorAccess | null> => {
  const member = await currentMember()
  if (!member) return null

  const listing = await findOwnListing(Number(member.user.id))
  return listing ? { member, listing } : null
})

export async function requireSponsor() {
  if (!(await currentMember())) redirect('/login')
  const sponsor = await currentSponsor()
  if (!sponsor) redirect('/account')
  return sponsor
}

export type ListingValues = SponsorListingFields & LogoColumns

export const LISTING_FIELDS = ['name', 'website', 'description', 'logo', 'bgColor'] as const

export type ListingField = (typeof LISTING_FIELDS)[number]

export function changedListingFields(current: ListingValues, next: ListingValues): ListingField[] {
  const changed: Record<ListingField, boolean> = {
    name: current.name !== next.name,
    website: current.website !== next.website,
    description: current.description !== next.description,
    logo:
      current.logoUrl !== next.logoUrl ||
      current.logoOriginalUrl !== next.logoOriginalUrl ||
      current.logoCrop !== next.logoCrop,
    bgColor: current.bgColor.toLowerCase() !== next.bgColor.toLowerCase(),
  }
  return LISTING_FIELDS.filter((field) => changed[field])
}

export type OfficerListingValues = ListingValues & { tier: SponsorTier }

export type OfficerListingField = ListingField | 'tier'

export function changedOfficerFields(current: OfficerListingValues, next: OfficerListingValues): OfficerListingField[] {
  const fields: OfficerListingField[] = changedListingFields(current, next)
  return current.tier === next.tier ? fields : [...fields, 'tier']
}

function textArray(fields: readonly string[]) {
  return sql`array[${sql.join(
    fields.map((field) => sql`${field}`),
    sql`, `,
  )}]::text[]`
}

function columnList(columns: { name: string }[]) {
  return sql.join(
    columns.map((column) => sql.identifier(column.name)),
    sql`, `,
  )
}

/**
 * The listing is never taken from the request: both writes find it through the
 * member's own row, which the first statement locks so an admin can't relink or
 * demote them between the update and the audit insert. `listingId` is the listing
 * the caller read and diffed against; if the member has since been moved to another
 * listing, nothing is written rather than applying that diff to the wrong row.
 */
export function listingEdit(
  db: Db,
  memberId: number,
  listingId: number,
  values: ListingValues,
  fields: readonly ListingField[],
) {
  const isSponsor = and(eq(members.id, memberId), eq(members.role, 'sponsor'))
  const ownListing = db.select({ id: members.sponsorId }).from(members).where(isSponsor)
  const changedFields = textArray(fields)
  const auditColumns = columnList([sponsorEdits.sponsorId, sponsorEdits.memberId, sponsorEdits.editorName, sponsorEdits.fields])

  return [
    db.select({ id: members.id }).from(members).where(isSponsor).for('update'),
    db
      .update(sponsors)
      .set(values)
      .where(and(eq(sponsors.id, sql`(${ownListing})`), eq(sponsors.id, listingId)))
      .returning({ id: sponsors.id }),
    db.execute(sql`insert into ${sponsorEdits} (${auditColumns})
      select ${members.sponsorId}, ${members.id}, ${members.name}, ${changedFields}
      from ${members}
      where ${and(isSponsor, eq(members.sponsorId, listingId))}`),
  ] as const
}

/**
 * The officer's name is read from the admins row inside the batch, not from the session. A listing
 * deleted since the caller read it matches no row, so the update and the log both write nothing.
 */
export function officerListingEdit(
  db: Db,
  adminId: number,
  listingId: number,
  values: Partial<typeof sponsors.$inferInsert>,
  fields: readonly OfficerListingField[],
) {
  const update = db.update(sponsors).set(values).where(eq(sponsors.id, listingId)).returning({ id: sponsors.id })
  if (fields.length === 0) return [update] as const

  const auditColumns = columnList([
    sponsorEdits.sponsorId,
    sponsorEdits.editorKind,
    sponsorEdits.adminId,
    sponsorEdits.editorName,
    sponsorEdits.fields,
  ])
  return [
    update,
    db.execute(sql`insert into ${sponsorEdits} (${auditColumns})
      select ${qualified(sponsors.id)}, 'officer', ${qualified(admins.id)}, ${qualified(admins.name)}, ${textArray(fields)}
      from ${sponsors}, ${admins}
      where ${qualified(sponsors.id)} = ${listingId} and ${qualified(admins.id)} = ${adminId}`),
  ] as const
}
