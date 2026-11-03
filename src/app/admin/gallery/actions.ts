'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { galleryPhotos } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { cleanupBlobs } from '@/lib/blob-cleanup'
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import {
  GALLERY_IMAGE_FIELD_NAMES,
  type GalleryImage,
  galleryImage,
  galleryImageColumns,
  parseGalleryPhotoForm,
} from '@/lib/gallery-schema'
import { resolveRequiredImageField, saveImageChange } from '@/lib/image-field'
import { moveRow, nextSortOrder } from '@/lib/sort-order'

const PAGE = '/admin/gallery'
const SAVED = '/admin/gallery?saved=1'
const INVALID = '/admin/gallery?error=invalid'
const MISSING = '/admin/gallery?error=missing'

const imageFields = {
  imageUrl: galleryPhotos.imageUrl,
  imageOriginalUrl: galleryPhotos.imageOriginalUrl,
  imageCrop: galleryPhotos.imageCrop,
}

function resolveImage(formData: FormData, imagePath: string | null, existing: GalleryImage | null) {
  return resolveRequiredImageField({
    formData,
    names: GALLERY_IMAGE_FIELD_NAMES,
    folder: 'gallery',
    existing,
    typedUrl: imagePath,
    page: PAGE,
  })
}

export async function createGalleryPhoto(formData: FormData) {
  await requireAdmin()

  const parsed = parseGalleryPhotoForm(formData)
  if (!parsed.success) redirect(INVALID)

  const { imageUrl, ...fields } = parsed.data
  const image = await resolveImage(formData, imageUrl, null)
  await saveImageChange(image, null, async () =>
    getDb()
      .insert(galleryPhotos)
      .values({ ...fields, ...galleryImageColumns(image.image), sortOrder: await nextSortOrder(galleryPhotos) })
      .returning({ id: galleryPhotos.id }),
  )

  redirect(SAVED)
}

export async function updateGalleryPhoto(id: number, formData: FormData) {
  await requireAdmin()

  const photoId = recordId.safeParse(id)
  const parsed = parseGalleryPhotoForm(formData)
  if (!photoId.success || !parsed.success) redirect(INVALID)

  const db = getDb()
  const [row] = await db.select(imageFields).from(galleryPhotos).where(eq(galleryPhotos.id, photoId.data)).limit(1)
  if (!row) redirect(MISSING)

  const existing = galleryImage(row)
  const { imageUrl, ...fields } = parsed.data
  const image = await resolveImage(formData, imageUrl, existing)
  const saved = await saveImageChange(image, existing, () =>
    db
      .update(galleryPhotos)
      .set({ ...fields, ...galleryImageColumns(image.image) })
      .where(eq(galleryPhotos.id, photoId.data))
      .returning({ id: galleryPhotos.id }),
  )
  if (!saved) redirect(MISSING)

  redirect(SAVED)
}

export async function deleteGalleryPhoto(id: number) {
  await requireAdmin()

  const photoId = recordId.safeParse(id)
  if (!photoId.success) redirect(INVALID)

  const [row] = await getDb()
    .delete(galleryPhotos)
    .where(eq(galleryPhotos.id, photoId.data))
    .returning(imageFields)
  if (row) await cleanupBlobs(row.imageUrl, row.imageOriginalUrl)

  redirect(SAVED)
}

export async function moveGalleryPhoto(id: number, direction: MoveDirection) {
  await requireAdmin()

  const parsed = moveRequest.safeParse({ id, direction })
  if (!parsed.success) redirect(INVALID)

  await moveRow(galleryPhotos, parsed.data.id, parsed.data.direction)
  redirect(SAVED)
}
