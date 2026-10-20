import { type CroppedImage, cropSourceUrl, parseCrop } from '@/lib/crop'
import {
  type UploadFolder,
  type UploadResult,
  deleteUploadedBlob,
  isUploadedImage,
  uploadImage,
} from '@/lib/uploads'

export type CropFieldNames = {
  file: string
  original: string
  crop: string
}

export const NO_UPLOAD = 'none'
/** The file itself was rejected: not an allowed image type, or too large. */
export const UPLOAD_FAILED = 'failed'
/** Storage could not take the upload (Blob down or misconfigured); the file may be fine. */
export const UPLOAD_UNAVAILABLE = 'unavailable'

export type ResolvedUpload =
  | { imageUrl: string; originalUrl: string | null; crop: string | null }
  | typeof NO_UPLOAD
  | typeof UPLOAD_FAILED
  | typeof UPLOAD_UNAVAILABLE

function failure(result: Extract<UploadResult, { ok: false }>) {
  return result.reason === 'unavailable' ? UPLOAD_UNAVAILABLE : UPLOAD_FAILED
}

export async function resolveCroppedUpload({
  formData,
  names,
  folder,
  existing,
}: {
  formData: FormData
  names: CropFieldNames
  folder: UploadFolder
  existing: CroppedImage | null
}): Promise<ResolvedUpload> {
  const croppedFile = formData.get(names.file)
  const originalFile = formData.get(names.original)

  if (isUploadedImage(croppedFile)) {
    const cropped = await uploadImage(croppedFile, folder)
    if (!cropped.ok) return failure(cropped)

    let originalUrl: string | null
    if (isUploadedImage(originalFile)) {
      const original = await uploadImage(originalFile, folder)
      if (!original.ok) {
        await deleteUploadedBlob(cropped.url)
        return failure(original)
      }
      originalUrl = original.url
    } else {
      originalUrl = cropSourceUrl(existing)
    }

    const crop = parseCrop(formData.get(names.crop))
    return { imageUrl: cropped.url, originalUrl, crop: crop ? JSON.stringify(crop) : null }
  }

  if (isUploadedImage(originalFile)) {
    const original = await uploadImage(originalFile, folder)
    if (!original.ok) return failure(original)
    return { imageUrl: original.url, originalUrl: null, crop: null }
  }

  return NO_UPLOAD
}
