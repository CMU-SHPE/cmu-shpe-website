import { cache } from 'react'
import { redirect } from 'next/navigation'
import { and, eq, exists, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { type Sponsor, type SponsorTier, admins, members, sponsorEdits, sponsors } from '@/db/schema'
import { type MemberSession, currentMember } from '@/lib/member'
import { findOwnListing } from '@/lib/sponsor-portal-listing'
import {
  type ListingSaveRefusal,
  type LogoColumns,
  type SponsorListingFields,
  listingSnapshot,
} from '@/lib/sponsor-schema'
import { qualified } from '@/lib/qualified-column'
import { normalizeNewlines } from '@/lib/text'

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
    description: normalizeNewlines(current.description) !== normalizeNewlines(next.description),
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

const FIELD_COLUMNS = {
  name: ['name'],
  website: ['website'],
  description: ['description'],
  bgColor: ['bgColor'],
  logo: ['logoUrl', 'logoOriginalUrl', 'logoCrop'],
  tier: ['tier'],
} as const

function changedColumns(values: OfficerListingValues, fields: readonly OfficerListingField[]) {
  return Object.fromEntries(
    fields.flatMap((field) => FIELD_COLUMNS[field]).map((column) => [column, values[column]]),
  ) as Partial<OfficerListingValues>
}

/** Each column this save writes must still hold what the form was loaded with. */
function stillAsLoaded(loaded: OfficerListingValues, fields: readonly OfficerListingField[]) {
  return and(
    ...fields
      .flatMap((field) => FIELD_COLUMNS[field])
      .map((column) =>
        column === 'bgColor'
          ? sql`lower(${qualified(sponsors.bgColor)}) = lower(${loaded.bgColor})`
          : sql`${qualified(sponsors[column])} is not distinct from ${loaded[column]}`,
      ),
  )
}

const FIELD_LABELS: Record<OfficerListingField, string> = {
  name: 'Name',
  website: 'Website',
  description: 'Description',
  bgColor: 'Logo background color',
  logo: 'Logo',
  tier: 'Tier',
}

function refusal(
  current: OfficerListingValues,
  submitted: OfficerListingValues,
  own: readonly OfficerListingField[],
  contested: readonly OfficerListingField[],
): ListingSaveRefusal {
  const typed = own.filter((field) => field !== 'logo')
  const shown = { ...current, ...changedColumns(submitted, typed) }
  return {
    shown,
    loaded: listingSnapshot(current),
    conflicts: contested.map((field) => ({
      field: FIELD_LABELS[field],
      saved: field === 'logo' ? null : current[field],
    })),
    logoDropped: own.includes('logo'),
  }
}

/** A form with no snapshot can't show which edits are its own, so each difference counts as contested. */
export function refusalWithoutSnapshot(
  current: OfficerListingValues,
  submitted: OfficerListingValues,
  own: readonly OfficerListingField[],
) {
  return refusal(current, submitted, own, own)
}

/** Null when the columns this save wanted to write are unchanged: something else stopped it. */
export function refusalForMissedSave(
  current: OfficerListingValues,
  loaded: OfficerListingValues,
  submitted: OfficerListingValues,
  own: readonly OfficerListingField[],
): ListingSaveRefusal | null {
  const changedSinceLoad = changedOfficerFields(loaded, current)
  const contested = own.filter((field) => changedSinceLoad.includes(field))
  return contested.length === 0 ? null : refusal(current, submitted, own, contested)
}

/**
 * The listing is never taken from the request: both writes find it through the
 * member's own row, which the first statement locks so an admin can't relink or
 * demote them between the update and the audit insert. `listingId` is the listing
 * the caller read and diffed against; if the member has since been moved to another
 * listing, nothing is written rather than applying that diff to the wrong row. The
 * update and audit are one statement, so a save that matches no row logs nothing.
 */
export function listingEdit(
  db: Db,
  memberId: number,
  listingId: number,
  loaded: OfficerListingValues,
  values: OfficerListingValues,
  fields: readonly ListingField[],
) {
  const isSponsor = and(eq(members.id, memberId), eq(members.role, 'sponsor'))
  const ownListing = db.select({ id: members.sponsorId }).from(members).where(isSponsor)
  const auditColumns = columnList([sponsorEdits.sponsorId, sponsorEdits.memberId, sponsorEdits.editorName, sponsorEdits.fields])
  const update = db
    .update(sponsors)
    .set(changedColumns(values, fields))
    .where(and(eq(sponsors.id, sql`(${ownListing})`), eq(sponsors.id, listingId), stillAsLoaded(loaded, fields)))
    .returning({ id: sponsors.id })

  return [
    db.select({ id: members.id }).from(members).where(isSponsor).for('update'),
    db.execute(sql`with updated as (${update.getSQL()})
      insert into ${sponsorEdits} (${auditColumns})
      select updated.id, ${qualified(members.id)}, ${qualified(members.name)}, ${textArray(fields)}
      from updated, ${members}
      where ${qualified(members.id)} = ${memberId}
      returning ${sql.identifier(sponsorEdits.id.name)}`),
  ] as const
}

/**
 * The officer's name is read from the admins row inside the same statement, not from the session. If the
 * listing or the officer's account is gone, or a written column has changed, neither the update nor the
 * log row is written. `extraValues` holds columns that follow from the change and aren't versioned.
 */
export function officerListingEdit(
  db: Db,
  adminId: number,
  listingId: number,
  loaded: OfficerListingValues,
  values: OfficerListingValues,
  fields: readonly OfficerListingField[],
  extraValues: { sortOrder?: number } = {},
) {
  const officerExists = exists(db.select({ id: admins.id }).from(admins).where(eq(admins.id, adminId)))
  const update = db
    .update(sponsors)
    .set({ ...changedColumns(values, fields), ...extraValues })
    .where(and(eq(sponsors.id, listingId), officerExists, stillAsLoaded(loaded, fields)))
    .returning({ id: sponsors.id })
  const auditColumns = columnList([
    sponsorEdits.sponsorId,
    sponsorEdits.editorKind,
    sponsorEdits.adminId,
    sponsorEdits.editorName,
    sponsorEdits.fields,
  ])
  return [
    db.execute(sql`with updated as (${update.getSQL()})
      insert into ${sponsorEdits} (${auditColumns})
      select updated.id, 'officer', ${qualified(admins.id)}, ${qualified(admins.name)}, ${textArray(fields)}
      from updated, ${admins}
      where ${qualified(admins.id)} = ${adminId}
      returning ${sql.identifier(sponsorEdits.id.name)}`),
  ] as const
}
