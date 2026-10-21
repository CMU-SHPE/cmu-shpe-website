import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const uploads = vi.hoisted(() => ({ deleteUploadedBlob: vi.fn(async () => {}) }))
vi.mock('@/lib/uploads', () => uploads)

import { cleanupBlobs } from './blob-cleanup'

const photo = 'https://abc123.public.blob.vercel-storage.com/officers/jeff.jpg'
const original = 'https://abc123.public.blob.vercel-storage.com/officers/jeff-original.jpg'

beforeEach(() => uploads.deleteUploadedBlob.mockClear())
afterEach(() => vi.unstubAllEnvs())

describe('cleanupBlobs', () => {
  it('deletes every image in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await cleanupBlobs(photo, null, original)
    expect(uploads.deleteUploadedBlob.mock.calls).toEqual([[photo], [null], [original]])
  })

  it('deletes images when run outside Vercel', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    await cleanupBlobs(photo)
    expect(uploads.deleteUploadedBlob).toHaveBeenCalledWith(photo)
  })

  it('never deletes images from a preview deployment, whose rows point at production images', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await cleanupBlobs(photo, original)
    expect(uploads.deleteUploadedBlob).not.toHaveBeenCalled()
  })
})
