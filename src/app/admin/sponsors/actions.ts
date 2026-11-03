'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { members, sponsors } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { cleanupBlobs } from '@/lib/blob-cleanup'
import type { CroppedImage } from '@/lib/crop'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import { resolveImageField, saveImageChange, typedImage } from '@/lib/image-field'
import { moveRow, nextSortOrder } from '@/lib/sort-order'
import {
  changedOfficerFields,
  logoFileChosen,
  officerListingEdit,
  outdatedRefusal,
  refusalForMissedSave,
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

function resolveLogo(formData: FormData, logoPath: string | null, existing: CroppedImage | null) {
  return resolveImageField({
    formData,
    names: LOGO_FIELD_NAMES,
    folder: 'sponsors',
    existing,
    typedUrl: logoPath,
    page: '/admin/sponsors',
  })
}

export async function createSponsor(formData: FormData) {
  await requireAdmin()

  const parsed = parseSponsorForm(formData)
  if (!parsed.success) redirect('/admin/sponsors?error=invalid')

  const { logoUrl, ...fields } = parsed.data
  const logo = await resolveLogo(formData, logoUrl, null)
  await saveImageChange(logo, null, async () =>
    getDb()
      .insert(sponsors)
      .values({
        ...fields,
        ...logoColumns(logo.image),
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
    const submitted = { ...fields, ...logoColumns(typedImage(logoUrl, logoImage(row)).image) }
    return outdatedRefusal(row, submitted, changedOfficerFields(row, submitted), logoFileChosen(formData))
  }

  const existing = logoImage(loaded)
  const logo = await resolveLogo(formData, logoUrl, existing)
  const values = { ...fields, ...logoColumns(logo.image) }
  const changed = changedOfficerFields(loaded, values)
  if (changed.length === 0) redirect('/admin/sponsors?saved=1')

  const db = getDb()
  const saved = await saveImageChange(logo, existing, async () => {
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
