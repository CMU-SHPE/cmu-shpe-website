import { type CroppedImage, cropSourceUrl, parseCrop } from '@/lib/crop'
import { type UploadFolder, deleteUploadedBlob, isUploadedImage, uploadImage } from '@/lib/uploads'

export type CropFieldNames = {
  file: string
  original: string
  crop: string
}

export const NO_UPLOAD = 'none'
export const UPLOAD_FAILED = 'failed'

export type ResolvedUpload =
  | { imageUrl: string; originalUrl: string | null; crop: string | null }
  | typeof NO_UPLOAD
  | typeof UPLOAD_FAILED

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
    const imageUrl = await uploadImage(croppedFile, folder)
    if (!imageUrl) return UPLOAD_FAILED

    let originalUrl: string | null
    if (isUploadedImage(originalFile)) {
      originalUrl = await uploadImage(originalFile, folder)
      if (!originalUrl) {
        await deleteUploadedBlob(imageUrl)
        return UPLOAD_FAILED
      }
    } else {
      originalUrl = cropSourceUrl(existing)
    }

    const crop = parseCrop(formData.get(names.crop))
    return { imageUrl, originalUrl, crop: crop ? JSON.stringify(crop) : null }
  }

  if (isUploadedImage(originalFile)) {
    const imageUrl = await uploadImage(originalFile, folder)
    if (!imageUrl) return UPLOAD_FAILED
    return { imageUrl, originalUrl: null, crop: null }
  }

  return NO_UPLOAD
}
