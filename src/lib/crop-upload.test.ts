import { beforeEach, describe, expect, it, vi } from 'vitest'

const blob = vi.hoisted(() => ({
  del: vi.fn(async () => {}),
  put: vi.fn(async (pathname: string) => ({
    url: `https://abc123.public.blob.vercel-storage.com/${pathname}`,
  })),
}))
vi.mock('@vercel/blob', () => blob)

import {
  NO_UPLOAD,
  UPLOAD_FAILED,
  UPLOAD_UNAVAILABLE,
  UPLOAD_UNSAFE_SVG,
  newlyUploaded,
  resolveCroppedUpload,
} from './crop-upload'

const names = { file: 'photoFile', original: 'photoOriginal', crop: 'photoCrop' }
const crop = JSON.stringify({ x: 0, y: 0, width: 100, height: 100, rotation: 0 })

function form(entries: Record<string, File | string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const image = (name: string, type = 'image/jpeg') => new File([new Uint8Array(10)], name, { type })

beforeEach(() => {
  blob.put.mockClear()
  blob.del.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resolveCroppedUpload', () => {
  it('uploads the crop and the original together', async () => {
    const result = await resolveCroppedUpload({
      formData: form({ photoFile: image('crop.jpg'), photoOriginal: image('full.jpg'), photoCrop: crop }),
      names,
      folder: 'officers',
      existing: null,
    })
    expect(result).toEqual({
      imageUrl: 'https://abc123.public.blob.vercel-storage.com/officers/crop.jpg',
      originalUrl: 'https://abc123.public.blob.vercel-storage.com/officers/full.jpg',
      crop,
    })
  })

  it('reports storage as unavailable instead of throwing when Blob is misconfigured', async () => {
    blob.put.mockRejectedValueOnce(new Error('No token found'))
    const result = await resolveCroppedUpload({
      formData: form({ photoOriginal: image('full.jpg') }),
      names,
      folder: 'officers',
      existing: null,
    })
    expect(result).toBe(UPLOAD_UNAVAILABLE)
  })

  it('reports a rejected file separately from unavailable storage', async () => {
    const result = await resolveCroppedUpload({
      formData: form({ photoOriginal: image('notes.html', 'text/html') }),
      names,
      folder: 'officers',
      existing: null,
    })
    expect(result).toBe(UPLOAD_FAILED)
    expect(blob.put).not.toHaveBeenCalled()
  })

  it('deletes the uploaded crop and reports unavailable when storing the original fails', async () => {
    blob.put
      .mockResolvedValueOnce({ url: 'https://abc123.public.blob.vercel-storage.com/officers/crop.jpg' })
      .mockRejectedValueOnce(new Error('network'))
    const result = await resolveCroppedUpload({
      formData: form({ photoFile: image('crop.jpg'), photoOriginal: image('full.jpg'), photoCrop: crop }),
      names,
      folder: 'officers',
      existing: null,
    })
    expect(result).toBe(UPLOAD_UNAVAILABLE)
    expect(blob.del).toHaveBeenCalledWith('https://abc123.public.blob.vercel-storage.com/officers/crop.jpg')
  })

  it('deletes the uploaded crop and reports a rejected file when the original is not allowed', async () => {
    const result = await resolveCroppedUpload({
      formData: form({ photoFile: image('crop.jpg'), photoOriginal: image('full.tiff', 'image/tiff'), photoCrop: crop }),
      names,
      folder: 'officers',
      existing: null,
    })
    expect(result).toBe(UPLOAD_FAILED)
    expect(blob.del).toHaveBeenCalledWith('https://abc123.public.blob.vercel-storage.com/officers/crop.jpg')
  })

  it('deletes the uploaded crop and reports an unsafe SVG original separately', async () => {
    const original = new File(['<svg><script>alert(1)</script></svg>'], 'logo.svg', { type: 'image/svg+xml' })
    const result = await resolveCroppedUpload({
      formData: form({ photoFile: image('crop.png', 'image/png'), photoOriginal: original, photoCrop: crop }),
      names,
      folder: 'sponsors',
      existing: null,
    })
    expect(result).toBe(UPLOAD_UNSAFE_SVG)
    expect(blob.del).toHaveBeenCalledWith('https://abc123.public.blob.vercel-storage.com/sponsors/crop.png')
  })

  it('keeps the stored original when only the crop changes', async () => {
    const result = await resolveCroppedUpload({
      formData: form({ photoFile: image('crop.jpg'), photoCrop: crop }),
      names,
      folder: 'officers',
      existing: { imageUrl: '/officers/old-crop.jpg', originalUrl: '/officers/jeff.jpg', crop: null },
    })
    expect(result).toMatchObject({ originalUrl: '/officers/jeff.jpg' })
  })

  it('returns NO_UPLOAD when no file was chosen', async () => {
    await expect(
      resolveCroppedUpload({ formData: form({}), names, folder: 'sponsors', existing: null }),
    ).resolves.toBe(NO_UPLOAD)
  })
})

describe('newlyUploaded', () => {
  const existing = { imageUrl: '/officers/old-crop.jpg', originalUrl: '/officers/jeff.jpg', crop: null }

  it('lists the crop and original that were just stored', () => {
    expect(newlyUploaded({ imageUrl: '/new-crop.jpg', originalUrl: '/new-full.jpg', crop }, existing)).toEqual([
      '/new-crop.jpg',
      '/new-full.jpg',
    ])
  })

  it('leaves out the original carried over from the existing image', () => {
    expect(newlyUploaded({ imageUrl: '/new-crop.jpg', originalUrl: '/officers/jeff.jpg', crop }, existing)).toEqual([
      '/new-crop.jpg',
    ])
    expect(
      newlyUploaded(
        { imageUrl: '/new-crop.jpg', originalUrl: '/only.jpg', crop },
        { imageUrl: '/only.jpg', originalUrl: null, crop: null },
      ),
    ).toEqual(['/new-crop.jpg'])
  })
})
