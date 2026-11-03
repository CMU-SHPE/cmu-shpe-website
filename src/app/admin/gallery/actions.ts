'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { galleryPhotos } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
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
import { type MoveDirection, moveRequest, recordId } from '@/lib/form-fields'
import {
  GALLERY_IMAGE_FIELD_NAMES,
  type GalleryImage,
  galleryImage,
  galleryImageColumns,
  parseGalleryPhotoForm,
} from '@/lib/gallery-schema'
import { moveRow, nextSortOrder } from '@/lib/sort-order'

const SAVED = '/admin/gallery?saved=1'
const INVALID = '/admin/gallery?error=invalid'
const NO_IMAGE = '/admin/gallery?error=image'
const MISSING = '/admin/gallery?error=missing'
const UPLOAD = '/admin/gallery?error=upload'
const STORAGE = '/admin/gallery?error=storage'
const UNSAFE_SVG = '/admin/gallery?error=svg'

const imageFields = {
  imageUrl: galleryPhotos.imageUrl,
  imageOriginalUrl: galleryPhotos.imageOriginalUrl,
  imageCrop: galleryPhotos.imageCrop,
}

async function resolveImage(
  formData: FormData,
  imagePath: string | null,
  existing: GalleryImage | null,
): Promise<{ image: GalleryImage; uploads: string[] }> {
  const uploaded = await resolveCroppedUpload({
    formData,
    names: GALLERY_IMAGE_FIELD_NAMES,
    folder: 'gallery',
    existing,
  })
  if (uploaded === UPLOAD_FAILED) redirect(UPLOAD)
  if (uploaded === UPLOAD_UNAVAILABLE) redirect(STORAGE)
  if (uploaded === UPLOAD_UNSAFE_SVG) redirect(UNSAFE_SVG)
  if (uploaded !== NO_UPLOAD) return { image: uploaded, uploads: newlyUploaded(uploaded, existing) }

  if (existing && (imagePath === null || imagePath === existing.imageUrl)) return { image: existing, uploads: [] }
  if (imagePath === null) redirect(NO_IMAGE)
  return { image: { imageUrl: imagePath, originalUrl: null, crop: null }, uploads: [] }
}

export async function createGalleryPhoto(formData: FormData) {
  await requireAdmin()

  const parsed = parseGalleryPhotoForm(formData)
  if (!parsed.success) redirect(INVALID)

  const { imageUrl, ...fields } = parsed.data
  const { image, uploads } = await resolveImage(formData, imageUrl, null)
  await writeOrDiscardUploads(uploads, async () =>
    getDb()
      .insert(galleryPhotos)
      .values({ ...fields, ...galleryImageColumns(image), sortOrder: await nextSortOrder(galleryPhotos) })
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
  const { image, uploads } = await resolveImage(formData, imageUrl, existing)
  const saved = await writeOrDiscardUploads(uploads, () =>
    db
      .update(galleryPhotos)
      .set({ ...fields, ...galleryImageColumns(image) })
      .where(eq(galleryPhotos.id, photoId.data))
      .returning({ id: galleryPhotos.id }),
  )
  if (!saved) redirect(MISSING)
  await cleanupBlobs(...orphanedBlobs(existing, image))

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
