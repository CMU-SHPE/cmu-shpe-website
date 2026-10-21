import { deleteUploadedBlob } from '@/lib/uploads'

// Preview deployments run on a Neon branch copied from production, so their rows
// point at production's images; deleting them there would break the live site.
export async function cleanupBlobs(...urls: (string | null | undefined)[]) {
  if (process.env.VERCEL_ENV === 'preview') return
  for (const url of urls) {
    await deleteUploadedBlob(url)
  }
}
