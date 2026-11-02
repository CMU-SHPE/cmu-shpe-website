'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { members, sponsors } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { cleanupBlobs, writeOrDiscardUploads } from '@/lib/blob-cleanup'
import { type CroppedImage, orphanedBlobs } from '@/lib/crop'
import {
  NO_UPLOAD,
  UPLOAD_FAILED,
  UPLOAD_UNAVAILABLE,
  UPLOAD_UNSAFE_SVG,
  newlyUploaded,
  resolveCroppedUpload,
} from '@/lib/crop-upload'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import { moveRow, nextSortOrder } from '@/lib/sort-order'
import {
  changedOfficerFields,
  officerListingEdit,
  refusalForMissedSave,
  refusalWithoutSnapshot,
} from '@/lib/sponsor-portal'
import {
  LOGO_FIELD_NAMES,
  type ListingSaveState,
  logoColumns,
  logoImage,
  parseLoadedListing,
  parseSponsorForm,
} from '@/lib/sponsor-schema'

const logoFields = {
  logoUrl: sponsors.logoUrl,
  logoOriginalUrl: sponsors.logoOriginalUrl,
  logoCrop: sponsors.logoCrop,
}

const editableFields = {
  name: sponsors.name,
  tier: sponsors.tier,
  website: sponsors.website,
  description: sponsors.description,
  bgColor: sponsors.bgColor,
  ...logoFields,
}

async function readEditableFields(id: number) {
  const [row] = await getDb().select(editableFields).from(sponsors).where(eq(sponsors.id, id)).limit(1)
  return row
}

async function resolveLogo(
  formData: FormData,
  logoPath: string | null,
  existing: CroppedImage | null,
): Promise<{ logo: CroppedImage; uploads: string[] }> {
  const uploaded = await resolveCroppedUpload({
    formData,
    names: LOGO_FIELD_NAMES,
    folder: 'sponsors',
    existing,
  })
  if (uploaded === UPLOAD_FAILED) redirect('/admin/sponsors?error=upload')
  if (uploaded === UPLOAD_UNAVAILABLE) redirect('/admin/sponsors?error=storage')
  if (uploaded === UPLOAD_UNSAFE_SVG) redirect('/admin/sponsors?error=svg')
  if (uploaded !== NO_UPLOAD) return { logo: uploaded, uploads: newlyUploaded(uploaded, existing) }

  if (existing?.imageUrl && logoPath === existing.imageUrl) return { logo: existing, uploads: [] }
  return { logo: { imageUrl: logoPath, originalUrl: null, crop: null }, uploads: [] }
}

export async function createSponsor(formData: FormData) {
  await requireAdmin()

  const parsed = parseSponsorForm(formData)
  if (!parsed.success) redirect('/admin/sponsors?error=invalid')

  const { logoUrl, ...fields } = parsed.data
  const { logo, uploads } = await resolveLogo(formData, logoUrl, null)
  await writeOrDiscardUploads(uploads, async () =>
    getDb()
      .insert(sponsors)
      .values({
        ...fields,
        ...logoColumns(logo),
        sortOrder: await nextSortOrder(sponsors, eq(sponsors.tier, fields.tier)),
      })
      .returning({ id: sponsors.id }),
  )

  redirect('/admin/sponsors?saved=1')
}

// Bound to the sponsor id and used with useActionState, so the previous state comes before the form.
export async function updateSponsor(
  id: number,
  _previous: ListingSaveState,
  formData: FormData,
): Promise<ListingSaveState> {
  const session = await requireAdmin()

  const sponsorId = recordId.safeParse(id)
  const parsed = parseSponsorForm(formData)
  if (!sponsorId.success || !parsed.success) redirect('/admin/sponsors?error=invalid')

  const row = await readEditableFields(sponsorId.data)
  if (!row) redirect('/admin/sponsors?error=missing')

  const { logoUrl, ...fields } = parsed.data
  const loaded = parseLoadedListing(formData)
  if (!loaded) {
    const { logo } = await resolveLogo(new FormData(), logoUrl, logoImage(row))
    const submitted = { ...fields, ...logoColumns(logo) }
    const own = changedOfficerFields(row, submitted)
    if (own.length === 0) redirect('/admin/sponsors?saved=1')
    return refusalWithoutSnapshot(row, submitted, own)
  }

  const existing = logoImage(loaded)
  const { logo, uploads } = await resolveLogo(formData, logoUrl, existing)
  const values = { ...fields, ...logoColumns(logo) }
  const changed = changedOfficerFields(loaded, values)
  if (changed.length === 0) redirect('/admin/sponsors?saved=1')

  const db = getDb()
  const saved = await writeOrDiscardUploads(uploads, async () => {
    const tierChange = changed.includes('tier')
      ? { sortOrder: await nextSortOrder(sponsors, eq(sponsors.tier, fields.tier)) }
      : {}
    const [edit] = await db.batch(
      officerListingEdit(db, Number(session.user.id), sponsorId.data, loaded, values, changed, tierChange),
    )
    return edit.rows
  })
  if (!saved) {
    const current = await readEditableFields(sponsorId.data)
    const refused = current ? refusalForMissedSave(current, loaded, values, changed) : null
    if (refused) return refused
    redirect('/admin/sponsors?error=not-saved')
  }
  await cleanupBlobs(...orphanedBlobs(existing, logo))

  redirect('/admin/sponsors?saved=1')
}

export async function deleteSponsor(id: number) {
  await requireAdmin()

  const sponsorId = recordId.safeParse(id)
  if (!sponsorId.success) redirect('/admin/sponsors?error=invalid')

  // ON DELETE SET NULL alone would leave linked members with the sponsor role and no listing.
  const db = getDb()
  const [, [row]] = await db.batch([
    db
      .update(members)
      .set({ role: 'supporter', sponsorId: null })
      .where(eq(members.sponsorId, sponsorId.data)),
    db.delete(sponsors).where(eq(sponsors.id, sponsorId.data)).returning(logoFields),
  ])
  if (row) await cleanupBlobs(row.logoUrl, row.logoOriginalUrl)

  redirect('/admin/sponsors?saved=1')
}

export async function moveSponsor(id: number, direction: MoveDirection) {
  await requireAdmin()

  const parsed = moveRequest.safeParse({ id, direction })
  if (!parsed.success) redirect('/admin/sponsors?error=invalid')

  const [row] = await getDb()
    .select({ tier: sponsors.tier })
    .from(sponsors)
    .where(eq(sponsors.id, parsed.data.id))
    .limit(1)
  if (!row) redirect('/admin/sponsors?error=missing')

  await moveRow(sponsors, parsed.data.id, parsed.data.direction, eq(sponsors.tier, row.tier))
  redirect('/admin/sponsors?saved=1')
}
