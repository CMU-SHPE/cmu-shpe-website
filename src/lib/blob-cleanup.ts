import { findReferencedImageUrls } from '@/lib/image-references'
import { deleteUploadedBlob, isBlobUrl } from '@/lib/uploads'

// Previews and local runs share production's Blob store and often a copy of its rows, so deleting
// from them could break the live site. Outside production a superseded image is simply left behind.
// Run this after the write that dropped the URLs, so the reference check sees the new rows.
export async function cleanupBlobs(...urls: (string | null | undefined)[]) {
  const candidates = [...new Set(urls)].filter((url): url is string => typeof url === 'string' && isBlobUrl(url))
  if (candidates.length === 0) return
  if (process.env.VERCEL_ENV !== 'production') {
    console.info(`Kept ${candidates.length} superseded image(s): blobs are only deleted in production`)
    return
  }
  const referenced = await findReferencedImageUrls(candidates)
  for (const url of candidates) {
    if (!referenced.has(url)) await deleteUploadedBlob(url)
  }
}

/**
 * Runs the write that stores freshly uploaded blobs. If it throws or matches no row, the uploads are
 * deleted again: they carry a random suffix, so nothing else can point at them, in any environment.
 */
export async function writeOrDiscardUploads(
  uploads: readonly string[],
  write: () => Promise<readonly unknown[]>,
): Promise<boolean> {
  let rows: readonly unknown[]
  try {
    rows = await write()
  } catch (error) {
    await discardUploads(uploads)
    throw error
  }
  if (rows.length > 0) return true
  await discardUploads(uploads)
  return false
}

async function discardUploads(uploads: readonly string[]) {
  for (const url of uploads) await deleteUploadedBlob(url)
}
