import { z } from 'zod'
import type { CroppedImage } from './crop'
import { optional, requiredText } from './form-fields'
import { imageSource } from './validation'

export const GALLERY_IMAGE_FIELD_NAMES = { file: 'imageFile', original: 'imageOriginalFile', crop: 'imageCrop' }

export const GALLERY_ASPECT = 4 / 3

export const MAX_ALT_TEXT_LENGTH = 300
export const MAX_CAPTION_LENGTH = 300

export const galleryPhotoSchema = z.object({
  imageUrl: optional(imageSource),
  altText: requiredText(MAX_ALT_TEXT_LENGTH),
  caption: z.string().trim().max(MAX_CAPTION_LENGTH),
})

export function parseGalleryPhotoForm(formData: FormData) {
  return galleryPhotoSchema.safeParse({
    imageUrl: formData.get('imageUrl'),
    altText: formData.get('altText'),
    caption: formData.get('caption') ?? '',
  })
}

export type GalleryImageColumns = {
  imageUrl: string
  imageOriginalUrl: string | null
  imageCrop: string | null
}

export type GalleryImage = CroppedImage & { imageUrl: string }

export function galleryImage(row: GalleryImageColumns): GalleryImage {
  return { imageUrl: row.imageUrl, originalUrl: row.imageOriginalUrl, crop: row.imageCrop }
}

export function galleryImageColumns(image: GalleryImage): GalleryImageColumns {
  return { imageUrl: image.imageUrl, imageOriginalUrl: image.originalUrl, imageCrop: image.crop }
}
