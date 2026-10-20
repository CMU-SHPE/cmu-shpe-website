'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { sponsors } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { cleanupBlobs } from '@/lib/blob-cleanup'
import { type CroppedImage, orphanedBlobs } from '@/lib/crop'
import { NO_UPLOAD, UPLOAD_FAILED, resolveCroppedUpload } from '@/lib/crop-upload'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import { moveRow, nextSortOrder } from '@/lib/sort-order'
import { LOGO_FIELD_NAMES, parseSponsorForm } from '@/lib/sponsor-schema'

const logoColumns = {
  logoUrl: sponsors.logoUrl,
  logoOriginalUrl: sponsors.logoOriginalUrl,
  logoCrop: sponsors.logoCrop,
}

function toImage(row: {
  logoUrl: string | null
  logoOriginalUrl: string | null
  logoCrop: string | null
}): CroppedImage {
  return { imageUrl: row.logoUrl, originalUrl: row.logoOriginalUrl, crop: row.logoCrop }
}

function toColumns(image: CroppedImage) {
  return { logoUrl: image.imageUrl, logoOriginalUrl: image.originalUrl, logoCrop: image.crop }
}

async function resolveLogo(
  formData: FormData,
  logoPath: string | null,
  existing: CroppedImage | null,
): Promise<CroppedImage> {
  const uploaded = await resolveCroppedUpload({
    formData,
    names: LOGO_FIELD_NAMES,
    folder: 'sponsors',
    existing,
  })
  if (uploaded === UPLOAD_FAILED) redirect('/admin/sponsors?error=upload')
  if (uploaded !== NO_UPLOAD) return uploaded

  if (existing?.imageUrl && logoPath === existing.imageUrl) return existing
  return { imageUrl: logoPath, originalUrl: null, crop: null }
}

export async function createSponsor(formData: FormData) {
  await requireAdmin()

  const parsed = parseSponsorForm(formData)
  if (!parsed.success) redirect('/admin/sponsors?error=invalid')

  const { logoUrl, ...fields } = parsed.data
  const logo = await resolveLogo(formData, logoUrl, null)
  await getDb()
    .insert(sponsors)
    .values({
      ...fields,
      ...toColumns(logo),
      sortOrder: await nextSortOrder(sponsors, eq(sponsors.tier, fields.tier)),
    })

  redirect('/admin/sponsors?saved=1')
}

export async function updateSponsor(id: number, formData: FormData) {
  await requireAdmin()

  const sponsorId = recordId.safeParse(id)
  const parsed = parseSponsorForm(formData)
  if (!sponsorId.success || !parsed.success) redirect('/admin/sponsors?error=invalid')

  const db = getDb()
  const [row] = await db
    .select({ tier: sponsors.tier, ...logoColumns })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId.data))
    .limit(1)
  if (!row) redirect('/admin/sponsors?error=missing')

  const existing = toImage(row)
  const { logoUrl, ...fields } = parsed.data
  const logo = await resolveLogo(formData, logoUrl, existing)
  const tierChange =
    fields.tier === row.tier
      ? {}
      : { sortOrder: await nextSortOrder(sponsors, eq(sponsors.tier, fields.tier)) }

  await db
    .update(sponsors)
    .set({ ...fields, ...toColumns(logo), ...tierChange })
    .where(eq(sponsors.id, sponsorId.data))
  await cleanupBlobs(...orphanedBlobs(existing, logo))

  redirect('/admin/sponsors?saved=1')
}

export async function deleteSponsor(id: number) {
  await requireAdmin()

  const sponsorId = recordId.safeParse(id)
  if (!sponsorId.success) redirect('/admin/sponsors?error=invalid')

  const [row] = await getDb()
    .delete(sponsors)
    .where(eq(sponsors.id, sponsorId.data))
    .returning(logoColumns)
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
