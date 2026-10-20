import { del, put } from '@vercel/blob'
import { type AllowedImageType, IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, isAllowedImageType } from './image-files'

export { MAX_IMAGE_BYTES }

export function isUploadedImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0
}

export function validateImageFile(file: File): string | null {
  if (!isAllowedImageType(file.type)) return 'unsupported type'
  if (file.size > MAX_IMAGE_BYTES) return 'too large'
  return null
}

export type UploadFolder = 'sponsors' | 'officers' | 'advisors'

export function blobPathname(folder: UploadFolder, fileName: string, type: AllowedImageType): string {
  const base =
    (fileName.split(/[\\/]/).pop() ?? '')
      .replace(/\.[^.]*$/, '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || 'image'
  return `${folder}/${base}.${IMAGE_EXTENSIONS[type]}`
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rejected' | 'unavailable' }

export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  const type = file.type
  if (!isAllowedImageType(type) || validateImageFile(file)) return { ok: false, reason: 'rejected' }
  try {
    const blob = await put(blobPathname(folder, file.name, type), file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: type,
    })
    return { ok: true, url: blob.url }
  } catch (error) {
    console.error(`Blob upload to ${folder} failed`, error)
    return { ok: false, reason: 'unavailable' }
  }
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
