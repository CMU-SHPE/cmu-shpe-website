import { del, put } from '@vercel/blob'
import { MAX_IMAGE_BYTES } from './image-files'

export { MAX_IMAGE_BYTES }

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
])

export function isUploadedImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'unsupported type'
  if (file.size > MAX_IMAGE_BYTES) return 'too large'
  return null
}

export type UploadFolder = 'sponsors' | 'officers' | 'advisors'

export async function uploadImage(file: File, folder: UploadFolder): Promise<string | null> {
  if (validateImageFile(file)) return null
  const blob = await put(`${folder}/${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
  })
  return blob.url
}

export function isBlobUrl(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { protocol, hostname } = new URL(url)
  return protocol === 'https:' && hostname.endsWith('.blob.vercel-storage.com')
}

export async function deleteUploadedBlob(url: string | null | undefined) {
  if (!url || !isBlobUrl(url)) return
  await del(url).catch(() => {})
}
