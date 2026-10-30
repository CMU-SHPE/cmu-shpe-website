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

function storeIdFromToken(token: string | undefined): string | null {
  const match = /^vercel_blob_rw_([a-z0-9]+)_/i.exec(token?.trim() ?? '')
  return match ? match[1].toLowerCase() : null
}

/**
 * Previews get production's Blob store unless a separate store is connected to the Preview
 * environment, so they may write only once the token is shown to belong to a different store.
 */
export function blobWritesAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV !== 'preview') return true
  const productionStore = env.PRODUCTION_BLOB_STORE_ID?.trim().toLowerCase().replace(/^store_/, '')
  const currentStore = storeIdFromToken(env.BLOB_READ_WRITE_TOKEN)
  return Boolean(productionStore && currentStore && productionStore !== currentStore)
}

const PREVIEW_BLOB_REFUSED =
  'Blob write refused: this preview could be using the production Blob store (see PRODUCTION_BLOB_STORE_ID)'

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rejected' | 'unavailable' }

export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  const type = file.type
  if (!isAllowedImageType(type) || validateImageFile(file)) return { ok: false, reason: 'rejected' }
  if (!blobWritesAllowed()) {
    console.error(PREVIEW_BLOB_REFUSED)
    return { ok: false, reason: 'unavailable' }
  }
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
  if (!blobWritesAllowed()) {
    console.error(PREVIEW_BLOB_REFUSED)
    return
  }
  await del(url).catch(() => {})
}
