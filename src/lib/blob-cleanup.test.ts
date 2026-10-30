import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  del: vi.fn(async () => {}),
  findReferencedImageUrls: vi.fn(async (): Promise<Set<string>> => new Set()),
}))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: vi.fn() }))
vi.mock('@/lib/image-references', () => ({ findReferencedImageUrls: mocks.findReferencedImageUrls }))

import { cleanupBlobs, writeOrDiscardUploads } from './blob-cleanup'

const photo = 'https://abc123.public.blob.vercel-storage.com/officers/jeff.jpg'
const original = 'https://abc123.public.blob.vercel-storage.com/officers/jeff-original.jpg'
const shared = 'https://abc123.public.blob.vercel-storage.com/sponsors/shared.png'

beforeEach(() => {
  mocks.del.mockClear()
  mocks.findReferencedImageUrls.mockReset().mockResolvedValue(new Set())
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('cleanupBlobs', () => {
  it('deletes every unreferenced Blob image in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await cleanupBlobs(photo, null, original, undefined)
    expect(mocks.findReferencedImageUrls).toHaveBeenCalledWith([photo, original])
    expect(mocks.del.mock.calls).toEqual([[photo], [original]])
  })

  it('keeps an image another row still references', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    mocks.findReferencedImageUrls.mockResolvedValue(new Set([shared]))
    await cleanupBlobs(photo, shared)
    expect(mocks.del.mock.calls).toEqual([[photo]])
  })

  it('ignores duplicates and URLs outside the Blob store without querying for them', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await cleanupBlobs(photo, photo, '/images/officers/jeff.jpg', 'https://example.com/logo.png')
    expect(mocks.findReferencedImageUrls).toHaveBeenCalledWith([photo])
    expect(mocks.del.mock.calls).toEqual([[photo]])

    mocks.findReferencedImageUrls.mockClear()
    await cleanupBlobs(null, '/images/logo.png')
    expect(mocks.findReferencedImageUrls).not.toHaveBeenCalled()
  })

  it.each([['preview'], ['development'], [undefined], ['']])(
    'never deletes or queries when VERCEL_ENV is %j, since those runs can share the production store',
    async (vercelEnv) => {
      vi.stubEnv('VERCEL_ENV', vercelEnv)
      await cleanupBlobs(photo, original)
      expect(mocks.findReferencedImageUrls).not.toHaveBeenCalled()
      expect(mocks.del).not.toHaveBeenCalled()
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('only deleted in production'))
    },
  )
})

describe('writeOrDiscardUploads', () => {
  it('keeps the uploads when the write stores a row', async () => {
    await expect(writeOrDiscardUploads([photo], async () => [{ id: 1 }])).resolves.toBe(true)
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it.each([['production'], ['preview'], [undefined]])(
    'deletes the fresh uploads when the write matches no row (VERCEL_ENV %j)',
    async (vercelEnv) => {
      vi.stubEnv('VERCEL_ENV', vercelEnv)
      await expect(writeOrDiscardUploads([photo, original], async () => [])).resolves.toBe(false)
      expect(mocks.del.mock.calls).toEqual([[photo], [original]])
      expect(mocks.findReferencedImageUrls).not.toHaveBeenCalled()
    },
  )

  it('deletes the fresh uploads and rethrows when the write fails', async () => {
    const failure = new Error('connection reset')
    await expect(
      writeOrDiscardUploads([photo], async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(mocks.del.mock.calls).toEqual([[photo]])
  })
})
