import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const blob = vi.hoisted(() => ({
  del: vi.fn(async () => {}),
  put: vi.fn<(pathname: string, body: unknown, options: Record<string, unknown>) => Promise<{ url: string }>>(
    async (pathname) => ({ url: `https://abc123.public.blob.vercel-storage.com/${pathname}` }),
  ),
}))
const del = blob.del
vi.mock('@vercel/blob', () => blob)

import {
  MAX_IMAGE_BYTES,
  blobPathname,
  blobWritesAllowed,
  deleteUploadedBlob,
  isUploadedImage,
  uploadImage,
  validateImageFile,
} from './uploads'

function makeFile(type: string, bytes: number, name = 'photo.png') {
  return new File([new Uint8Array(bytes)], name, { type })
}

beforeEach(() => {
  blob.del.mockClear()
  blob.put.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('blobPathname', () => {
  it('takes the extension from the validated type, not the client name', () => {
    expect(blobPathname('officers', 'jeff.html', 'image/jpeg')).toBe('officers/jeff.jpg')
    expect(blobPathname('sponsors', 'logo.PNG', 'image/svg+xml')).toBe('sponsors/logo.svg')
  })

  it('reduces the client name to a safe slug', () => {
    expect(blobPathname('officers', '../../etc/Passwd Final (2).png', 'image/png')).toBe('officers/passwd-final-2.png')
    expect(blobPathname('advisors', 'C:\\Users\\me\\Café Photo.webp', 'image/webp')).toBe('advisors/cafe-photo.webp')
    expect(blobPathname('sponsors', '...', 'image/png')).toBe('sponsors/image.png')
    expect(blobPathname('sponsors', `${'a'.repeat(80)}.png`, 'image/png')).toBe(`sponsors/${'a'.repeat(60)}.png`)
  })
})

describe('uploadImage', () => {
  it('uploads under the sanitised path with the validated content type', async () => {
    await expect(uploadImage(makeFile('image/jpeg', 10, 'My Photo.jpeg'), 'officers')).resolves.toEqual({
      ok: true,
      url: 'https://abc123.public.blob.vercel-storage.com/officers/my-photo.jpg',
    })
    expect(blob.put.mock.calls[0][2]).toMatchObject({ access: 'public', addRandomSuffix: true, contentType: 'image/jpeg' })
  })

  it('rejects files outside the allowlist or over the size cap without calling Blob', async () => {
    await expect(uploadImage(makeFile('text/html', 10), 'officers')).resolves.toEqual({ ok: false, reason: 'rejected' })
    await expect(uploadImage(makeFile('image/png', MAX_IMAGE_BYTES + 1), 'officers')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    })
    expect(blob.put).not.toHaveBeenCalled()
  })

  it('reports storage as unavailable instead of throwing when Blob fails', async () => {
    blob.put.mockRejectedValueOnce(new Error('No token found'))
    await expect(uploadImage(makeFile('image/png', 10), 'sponsors')).resolves.toEqual({ ok: false, reason: 'unavailable' })
  })
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

describe('blobWritesAllowed', () => {
  const productionToken = 'vercel_blob_rw_ProdStore123_secretpart'
  const previewToken = 'vercel_blob_rw_PreviewStore456_secretpart'

  it.each([['production'], ['development'], [undefined]])('never restricts VERCEL_ENV %j', (vercelEnv) => {
    expect(blobWritesAllowed({ VERCEL_ENV: vercelEnv, BLOB_READ_WRITE_TOKEN: productionToken })).toBe(true)
  })

  it('allows a preview whose token belongs to a store other than production', () => {
    for (const productionId of ['ProdStore123', 'store_ProdStore123', ' prodstore123 ']) {
      expect(
        blobWritesAllowed({
          VERCEL_ENV: 'preview',
          BLOB_READ_WRITE_TOKEN: previewToken,
          PRODUCTION_BLOB_STORE_ID: productionId,
        }),
      ).toBe(true)
    }
  })

  it('refuses a preview using the production store, however the ID is written', () => {
    for (const productionId of ['ProdStore123', 'store_prodstore123', 'PRODSTORE123']) {
      expect(
        blobWritesAllowed({
          VERCEL_ENV: 'preview',
          BLOB_READ_WRITE_TOKEN: productionToken,
          PRODUCTION_BLOB_STORE_ID: productionId,
        }),
      ).toBe(false)
    }
  })

  it('fails closed on a preview without PRODUCTION_BLOB_STORE_ID or a readable token', () => {
    expect(blobWritesAllowed({ VERCEL_ENV: 'preview', BLOB_READ_WRITE_TOKEN: previewToken })).toBe(false)
    expect(blobWritesAllowed({ VERCEL_ENV: 'preview', PRODUCTION_BLOB_STORE_ID: 'ProdStore123' })).toBe(false)
    expect(
      blobWritesAllowed({ VERCEL_ENV: 'preview', BLOB_READ_WRITE_TOKEN: 'garbage', PRODUCTION_BLOB_STORE_ID: 'x' }),
    ).toBe(false)
  })
})

describe('a preview on the production Blob store', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_ProdStore123_secretpart')
    vi.stubEnv('PRODUCTION_BLOB_STORE_ID', 'ProdStore123')
  })

  it('reports uploads as unavailable without calling Blob', async () => {
    await expect(uploadImage(makeFile('image/png', 10), 'sponsors')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
    expect(blob.put).not.toHaveBeenCalled()
  })

  it('never deletes', async () => {
    await deleteUploadedBlob('https://prodstore123.public.blob.vercel-storage.com/sponsors/logo.png')
    expect(del).not.toHaveBeenCalled()
  })

  it('uploads once a separate preview store is connected', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_PreviewStore456_secretpart')
    await expect(uploadImage(makeFile('image/png', 10), 'sponsors')).resolves.toMatchObject({ ok: true })
  })
})
