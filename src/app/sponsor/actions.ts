'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/db'
import { cleanupBlobs, writeOrDiscardUploads } from '@/lib/blob-cleanup'
import { orphanedBlobs } from '@/lib/crop'
import {
  NO_UPLOAD,
  UPLOAD_FAILED,
  UPLOAD_UNAVAILABLE,
  UPLOAD_UNSAFE_SVG,
  newlyUploaded,
  resolveCroppedUpload,
} from '@/lib/crop-upload'
import {
  changedListingFields,
  listingEdit,
  refusalForMissedSave,
  refusalWithoutSnapshot,
  requireSponsor,
} from '@/lib/sponsor-portal'
import { findOwnListing } from '@/lib/sponsor-portal-listing'
import {
  LOGO_FIELD_NAMES,
  type ListingSaveState,
  logoColumns,
  logoImage,
  parseLoadedListing,
  parseSponsorListingForm,
} from '@/lib/sponsor-schema'

// Used with useActionState, so the previous state comes before the form.
export async function updateListing(_previous: ListingSaveState, formData: FormData): Promise<ListingSaveState> {
  const { member, listing } = await requireSponsor()

  const parsed = parseSponsorListingForm(formData)
  if (!parsed.success) redirect('/sponsor?error=invalid')

  const loaded = parseLoadedListing(formData)
  if (!loaded) {
    const submitted = { ...listing, ...parsed.data }
    const own = changedListingFields(listing, submitted)
    if (own.length === 0) redirect('/sponsor?saved=unchanged')
    return refusalWithoutSnapshot(listing, submitted, own)
  }

  const existing = logoImage(loaded)
  const uploaded = await resolveCroppedUpload({
    formData,
    names: LOGO_FIELD_NAMES,
    folder: 'sponsors',
    existing,
  })
  if (uploaded === UPLOAD_FAILED) redirect('/sponsor?error=upload')
  if (uploaded === UPLOAD_UNAVAILABLE) redirect('/sponsor?error=storage')
  if (uploaded === UPLOAD_UNSAFE_SVG) redirect('/sponsor?error=svg')
  const logo = uploaded === NO_UPLOAD ? existing : uploaded
  const uploads = uploaded === NO_UPLOAD ? [] : newlyUploaded(uploaded, existing)

  const values = { ...loaded, ...parsed.data, ...logoColumns(logo) }
  const fields = changedListingFields(loaded, values)
  if (fields.length === 0) redirect('/sponsor?saved=unchanged')

  const db = getDb()
  const saved = await writeOrDiscardUploads(uploads, async () => {
    const [, edit] = await db.batch(listingEdit(db, Number(member.user.id), listing.id, loaded, values, fields))
    return edit.rows
  })
  if (!saved) {
    const current = await findOwnListing(Number(member.user.id))
    const refused = current?.id === listing.id ? refusalForMissedSave(current, loaded, values, fields) : null
    if (refused) return refused
    redirect('/sponsor?error=missing')
  }
  await cleanupBlobs(...orphanedBlobs(existing, logo))

  redirect('/sponsor?saved=listing')
}
