import { redirect } from 'next/navigation'
import { cleanupBlobs, writeOrDiscardUploads } from './blob-cleanup'
import { type CroppedImage, type StoredImage, orphanedBlobs } from './crop'
import {
  type CropFieldNames,
  NO_UPLOAD,
  UPLOAD_FAILED,
  UPLOAD_UNAVAILABLE,
  UPLOAD_UNSAFE_SVG,
  newlyUploaded,
  resolveCroppedUpload,
} from './crop-upload'
import type { UploadFolder } from './uploads'

/** The image a save will store, and the blobs this request uploaded for it. */
export type ImageChange<Image extends CroppedImage = CroppedImage> = { image: Image; uploads: string[] }

type ImageFieldRequest<Existing extends CroppedImage = CroppedImage> = {
  formData: FormData
  names: CropFieldNames
  folder: UploadFolder
  existing: Existing | null
  /** The page the form posts from; upload failures send the user back to it with `?error=`. */
  page: string
}

/** Null when the form carried no file. */
export async function uploadedImage({
  page,
  ...upload
}: ImageFieldRequest): Promise<ImageChange<StoredImage> | null> {
  const uploaded = await resolveCroppedUpload(upload)
  if (uploaded === UPLOAD_FAILED) redirect(`${page}?error=upload`)
  if (uploaded === UPLOAD_UNAVAILABLE) redirect(`${page}?error=storage`)
  if (uploaded === UPLOAD_UNSAFE_SVG) redirect(`${page}?error=svg`)
  if (uploaded === NO_UPLOAD) return null
  return { image: uploaded, uploads: newlyUploaded(uploaded, upload.existing) }
}

/** An unchanged URL keeps the existing crop and original; any other URL, or none, replaces the image. */
export function typedImage(typedUrl: string | null, existing: CroppedImage | null): ImageChange {
  if (existing?.imageUrl && typedUrl === existing.imageUrl) return { image: existing, uploads: [] }
  return { image: { imageUrl: typedUrl, originalUrl: null, crop: null }, uploads: [] }
}

export async function resolveImageField(
  request: ImageFieldRequest & { typedUrl: string | null },
): Promise<ImageChange> {
  return (await uploadedImage(request)) ?? typedImage(request.typedUrl, request.existing)
}

/** For an image that can't be removed: a blank URL keeps the existing one, and with none to keep is refused with `?error=image`. */
export async function resolveRequiredImageField(
  request: ImageFieldRequest<StoredImage> & { typedUrl: string | null },
): Promise<ImageChange<StoredImage>> {
  const uploaded = await uploadedImage(request)
  if (uploaded) return uploaded

  const { typedUrl, existing } = request
  if (existing && (typedUrl === null || typedUrl === existing.imageUrl)) return { image: existing, uploads: [] }
  if (typedUrl === null) redirect(`${request.page}?error=image`)
  return { image: { imageUrl: typedUrl, originalUrl: null, crop: null }, uploads: [] }
}

/**
 * Runs the write through writeOrDiscardUploads, then cleans up the blobs only `existing` used.
 * False when the write matched no row, so the caller can report the row as missing or changed.
 */
export async function saveImageChange(
  change: ImageChange,
  existing: CroppedImage | null,
  write: () => Promise<readonly unknown[]>,
): Promise<boolean> {
  const saved = await writeOrDiscardUploads(change.uploads, write)
  if (saved && existing) await cleanupBlobs(...orphanedBlobs(existing, change.image))
  return saved
}
