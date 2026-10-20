'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { advisors, officers } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { cleanupBlobs } from '@/lib/blob-cleanup'
import { type CroppedImage, orphanedBlobs } from '@/lib/crop'
import { NO_UPLOAD, UPLOAD_FAILED, UPLOAD_UNAVAILABLE, resolveCroppedUpload } from '@/lib/crop-upload'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import { PHOTO_FIELD_NAMES, parseAdvisorForm, parseOfficerForm } from '@/lib/person-schema'
import { moveRow, nextSortOrder } from '@/lib/sort-order'

type PersonTable = typeof officers | typeof advisors

const SAVED = '/admin/officers?saved=1'
const INVALID = '/admin/officers?error=invalid'
const MISSING = '/admin/officers?error=missing'
const UPLOAD = '/admin/officers?error=upload'
const STORAGE = '/admin/officers?error=storage'

function photoColumns(table: PersonTable) {
  return {
    photoUrl: table.photoUrl,
    photoOriginalUrl: table.photoOriginalUrl,
    photoCrop: table.photoCrop,
  }
}

function toColumns(image: CroppedImage) {
  return { photoUrl: image.imageUrl, photoOriginalUrl: image.originalUrl, photoCrop: image.crop }
}

async function resolvePhoto(
  formData: FormData,
  photoPath: string | null,
  existing: CroppedImage | null,
  folder: 'officers' | 'advisors',
): Promise<CroppedImage> {
  const uploaded = await resolveCroppedUpload({ formData, names: PHOTO_FIELD_NAMES, folder, existing })
  if (uploaded === UPLOAD_FAILED) redirect(UPLOAD)
  if (uploaded === UPLOAD_UNAVAILABLE) redirect(STORAGE)
  if (uploaded !== NO_UPLOAD) return uploaded

  if (existing?.imageUrl && photoPath === existing.imageUrl) return existing
  return { imageUrl: photoPath, originalUrl: null, crop: null }
}

async function existingPhoto(table: PersonTable, id: number): Promise<CroppedImage> {
  const [row] = await getDb().select(photoColumns(table)).from(table).where(eq(table.id, id)).limit(1)
  if (!row) redirect(MISSING)
  return { imageUrl: row.photoUrl, originalUrl: row.photoOriginalUrl, crop: row.photoCrop }
}

async function removePerson(table: PersonTable, id: number) {
  const personId = recordId.safeParse(id)
  if (!personId.success) redirect(INVALID)

  const [row] = await getDb()
    .delete(table)
    .where(eq(table.id, personId.data))
    .returning(photoColumns(table))
  if (row) await cleanupBlobs(row.photoUrl, row.photoOriginalUrl)

  redirect(SAVED)
}

async function movePerson(table: PersonTable, id: number, direction: MoveDirection) {
  const parsed = moveRequest.safeParse({ id, direction })
  if (!parsed.success) redirect(INVALID)

  await moveRow(table, parsed.data.id, parsed.data.direction)
  redirect(SAVED)
}

export async function createOfficer(formData: FormData) {
  await requireAdmin()

  const parsed = parseOfficerForm(formData)
  if (!parsed.success) redirect(INVALID)

  const { photoUrl, ...fields } = parsed.data
  const photo = await resolvePhoto(formData, photoUrl, null, 'officers')
  await getDb()
    .insert(officers)
    .values({ ...fields, ...toColumns(photo), sortOrder: await nextSortOrder(officers) })

  redirect(SAVED)
}

export async function updateOfficer(id: number, formData: FormData) {
  await requireAdmin()

  const officerId = recordId.safeParse(id)
  const parsed = parseOfficerForm(formData)
  if (!officerId.success || !parsed.success) redirect(INVALID)

  const existing = await existingPhoto(officers, officerId.data)
  const { photoUrl, ...fields } = parsed.data
  const photo = await resolvePhoto(formData, photoUrl, existing, 'officers')
  await getDb()
    .update(officers)
    .set({ ...fields, ...toColumns(photo) })
    .where(eq(officers.id, officerId.data))
  await cleanupBlobs(...orphanedBlobs(existing, photo))

  redirect(SAVED)
}

export async function deleteOfficer(id: number) {
  await requireAdmin()
  await removePerson(officers, id)
}

export async function moveOfficer(id: number, direction: MoveDirection) {
  await requireAdmin()
  await movePerson(officers, id, direction)
}

export async function createAdvisor(formData: FormData) {
  await requireAdmin()

  const parsed = parseAdvisorForm(formData)
  if (!parsed.success) redirect(INVALID)

  const { photoUrl, ...fields } = parsed.data
  const photo = await resolvePhoto(formData, photoUrl, null, 'advisors')
  await getDb()
    .insert(advisors)
    .values({ ...fields, ...toColumns(photo), sortOrder: await nextSortOrder(advisors) })

  redirect(SAVED)
}

export async function updateAdvisor(id: number, formData: FormData) {
  await requireAdmin()

  const advisorId = recordId.safeParse(id)
  const parsed = parseAdvisorForm(formData)
  if (!advisorId.success || !parsed.success) redirect(INVALID)

  const existing = await existingPhoto(advisors, advisorId.data)
  const { photoUrl, ...fields } = parsed.data
  const photo = await resolvePhoto(formData, photoUrl, existing, 'advisors')
  await getDb()
    .update(advisors)
    .set({ ...fields, ...toColumns(photo) })
    .where(eq(advisors.id, advisorId.data))
  await cleanupBlobs(...orphanedBlobs(existing, photo))

  redirect(SAVED)
}

export async function deleteAdvisor(id: number) {
  await requireAdmin()
  await removePerson(advisors, id)
}

export async function moveAdvisor(id: number, direction: MoveDirection) {
  await requireAdmin()
  await movePerson(advisors, id, direction)
}
