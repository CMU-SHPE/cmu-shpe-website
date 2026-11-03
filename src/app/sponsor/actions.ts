'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/db'
import { saveImageChange, uploadedImage } from '@/lib/image-field'
import {
  changedListingFields,
  listingEdit,
  logoFileChosen,
  outdatedRefusal,
  refusalForMissedSave,
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
    return outdatedRefusal(listing, submitted, changedListingFields(listing, submitted), logoFileChosen(formData))
  }

  const existing = logoImage(loaded)
  const logo = (await uploadedImage({
    formData,
    names: LOGO_FIELD_NAMES,
    folder: 'sponsors',
    existing,
    page: '/sponsor',
  })) ?? { image: existing, uploads: [] }

  const values = { ...loaded, ...parsed.data, ...logoColumns(logo.image) }
  const fields = changedListingFields(loaded, values)
  if (fields.length === 0) redirect('/sponsor?saved=unchanged')

  const db = getDb()
  const saved = await saveImageChange(logo, existing, async () => {
    const [, edit] = await db.batch(listingEdit(db, Number(member.user.id), listing.id, loaded, values, fields))
    return edit.rows
  })
  if (!saved) {
    const current = await findOwnListing(Number(member.user.id))
    if (current?.id !== listing.id) redirect('/sponsor?error=missing')
    return refusalForMissedSave(current, loaded, values, fields) ?? outdatedRefusal(current, values, fields)
  }

  redirect('/sponsor?saved=listing')
}
