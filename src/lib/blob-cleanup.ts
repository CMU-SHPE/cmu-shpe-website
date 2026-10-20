import { deleteUploadedBlob } from '@/lib/uploads'

export async function cleanupBlobs(...urls: (string | null | undefined)[]) {
  for (const url of urls) {
    await deleteUploadedBlob(url)
  }
}
