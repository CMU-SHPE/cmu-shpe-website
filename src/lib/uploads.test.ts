import { beforeEach, describe, expect, it, vi } from 'vitest'

const del = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@vercel/blob', () => ({ del, put: vi.fn() }))

import { MAX_IMAGE_BYTES, deleteUploadedBlob, isUploadedImage, validateImageFile } from './uploads'

function makeFile(type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], 'photo.png', { type })
}

beforeEach(() => {
  del.mockClear()
})

describe('isUploadedImage', () => {
  it('rejects null and empty files', () => {
    expect(isUploadedImage(null)).toBe(false)
    expect(isUploadedImage('https://example.com/a.png')).toBe(false)
    expect(isUploadedImage(makeFile('image/png', 0))).toBe(false)
  })

  it('accepts a non-empty file', () => {
    expect(isUploadedImage(makeFile('image/png', 10))).toBe(true)
  })
})

describe('validateImageFile', () => {
  it('accepts common image types within the size cap', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']) {
      expect(validateImageFile(makeFile(type, 1024))).toBeNull()
    }
  })

  it('rejects non-image types', () => {
    expect(validateImageFile(makeFile('application/pdf', 1024))).not.toBeNull()
    expect(validateImageFile(makeFile('text/html', 1024))).not.toBeNull()
  })

  it('rejects files over the size cap', () => {
    expect(validateImageFile(makeFile('image/png', MAX_IMAGE_BYTES + 1))).not.toBeNull()
  })
})

describe('deleteUploadedBlob', () => {
  it('deletes Vercel Blob URLs', async () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/officers/jeff-x1y2.jpg'
    await deleteUploadedBlob(url)
    expect(del).toHaveBeenCalledWith(url)
  })

  it('ignores bundled public files and other hosts', async () => {
    await deleteUploadedBlob('/officers/jeff.jpg')
    await deleteUploadedBlob('/sponsors/jgms.png')
    await deleteUploadedBlob('https://example.com/x.blob.vercel-storage.com/logo.png')
    await deleteUploadedBlob(null)
    expect(del).not.toHaveBeenCalled()
  })

  it('swallows delete failures', async () => {
    del.mockRejectedValueOnce(new Error('network'))
    await expect(
      deleteUploadedBlob('https://abc123.public.blob.vercel-storage.com/sponsors/logo.png'),
    ).resolves.toBeUndefined()
  })
})
