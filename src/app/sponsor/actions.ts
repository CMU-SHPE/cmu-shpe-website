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
import { changedListingFields, listingEdit, requireSponsor } from '@/lib/sponsor-portal'
import { LOGO_FIELD_NAMES, logoColumns, logoImage, parseSponsorListingForm } from '@/lib/sponsor-schema'

export async function updateListing(formData: FormData) {
  const { member, listing } = await requireSponsor()

  const parsed = parseSponsorListingForm(formData)
  if (!parsed.success) redirect('/sponsor?error=invalid')

  const existing = logoImage(listing)
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

  const values = { ...parsed.data, ...logoColumns(logo) }
  const fields = changedListingFields(listing, values)
  if (fields.length === 0) redirect('/sponsor?saved=unchanged')

  const db = getDb()
  const saved = await writeOrDiscardUploads(uploads, async () => {
    const [, updated] = await db.batch(listingEdit(db, Number(member.user.id), listing.id, values, fields))
    return updated
  })
  if (!saved) redirect('/sponsor?error=missing')
  await cleanupBlobs(...orphanedBlobs(existing, logo))

  redirect('/sponsor?saved=listing')
}
