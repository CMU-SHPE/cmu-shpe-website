import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  del: vi.fn(async () => {}),
  put: vi.fn(async (pathname: string) => ({
    url: `https://abc123.public.blob.vercel-storage.com/${pathname}`,
  })),
  findReferencedImageUrls: vi.fn(async (): Promise<Set<string>> => new Set()),
}))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: mocks.put }))
vi.mock('@/lib/image-references', () => ({ findReferencedImageUrls: mocks.findReferencedImageUrls }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))

import {
  resolveImageField,
  resolveRequiredImageField,
  saveImageChange,
  typedImage,
  uploadedImage,
} from './image-field'

const BLOB = 'https://abc123.public.blob.vercel-storage.com'
const names = { file: 'photoFile', original: 'photoOriginal', crop: 'photoCrop' }
const crop = JSON.stringify({ x: 0, y: 0, width: 100, height: 100, rotation: 0 })
const existing = { imageUrl: `${BLOB}/officers/old.jpg`, originalUrl: `${BLOB}/officers/old-full.jpg`, crop }

function form(entries: Record<string, File | string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const image = (name: string, type = 'image/jpeg') => new File([new Uint8Array(10)], name, { type })

function request(formData: FormData, current: typeof existing | null = existing) {
  return { formData, names, folder: 'officers' as const, existing: current, page: '/admin/officers' }
}

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  return error instanceof Error ? error.message.replace(/^REDIRECT /, '') : String(error)
}

beforeEach(() => {
  mocks.put.mockClear()
  mocks.del.mockClear()
  mocks.findReferencedImageUrls.mockReset().mockResolvedValue(new Set())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('uploadedImage', () => {
  it('returns the stored crop, listing only the blobs this request uploaded', async () => {
    const result = await uploadedImage(request(form({ photoFile: image('crop.jpg'), photoCrop: crop })))
    expect(result).toEqual({
      image: { imageUrl: `${BLOB}/officers/crop.jpg`, originalUrl: existing.originalUrl, crop },
      uploads: [`${BLOB}/officers/crop.jpg`],
    })
  })

  it('returns null when the form carried no file', async () => {
    expect(await uploadedImage(request(form()))).toBeNull()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it.each([
    ['a rejected file', () => mocks.put, image('notes.txt', 'text/plain'), '/admin/officers?error=upload'],
    ['unavailable storage', () => mocks.put.mockRejectedValueOnce(new Error('No token found')), image('a.jpg'), '/admin/officers?error=storage'],
    [
      'an SVG that can run script',
      () => mocks.put,
      new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'a.svg', { type: 'image/svg+xml' }),
      '/admin/officers?error=svg',
    ],
  ])('sends the user back to their page for %s', async (_case, arrange, file, target) => {
    arrange()
    expect(await redirectOf(uploadedImage(request(form({ photoOriginal: file }))))).toBe(target)
  })
})

describe('typedImage', () => {
  it('keeps the existing crop and original when the URL is unchanged', () => {
    expect(typedImage(existing.imageUrl, existing)).toEqual({ image: existing, uploads: [] })
  })

  it('replaces the image with a different URL, and clears it with none', () => {
    expect(typedImage('/images/new.jpg', existing)).toEqual({
      image: { imageUrl: '/images/new.jpg', originalUrl: null, crop: null },
      uploads: [],
    })
    expect(typedImage(null, existing)).toEqual({ image: { imageUrl: null, originalUrl: null, crop: null }, uploads: [] })
  })
})

describe('resolveImageField', () => {
  it('prefers an upload over the typed URL', async () => {
    const result = await resolveImageField({ ...request(form({ photoOriginal: image('new.jpg') })), typedUrl: existing.imageUrl })
    expect(result.image.imageUrl).toBe(`${BLOB}/officers/new.jpg`)
  })

  it('falls back to the typed URL, so a blank one clears an optional image', async () => {
    expect(await resolveImageField({ ...request(form()), typedUrl: null })).toEqual(typedImage(null, existing))
  })
})

describe('resolveRequiredImageField', () => {
  it('keeps the existing image when the URL is left blank', async () => {
    expect(await resolveRequiredImageField({ ...request(form()), typedUrl: null })).toEqual({ image: existing, uploads: [] })
  })

  it('refuses a blank URL when there is no image to keep', async () => {
    const result = redirectOf(resolveRequiredImageField({ ...request(form(), null), typedUrl: null }))
    expect(await result).toBe('/admin/officers?error=image')
  })

  it('replaces the image with a different typed URL', async () => {
    expect(await resolveRequiredImageField({ ...request(form()), typedUrl: '/images/new.jpg' })).toEqual({
      image: { imageUrl: '/images/new.jpg', originalUrl: null, crop: null },
      uploads: [],
    })
  })
})

describe('saveImageChange', () => {
  const upload = `${BLOB}/officers/new.jpg`
  const change = { image: { imageUrl: upload, originalUrl: null, crop: null }, uploads: [upload] }

  it('cleans up the blobs only the replaced image used once the row is saved', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(await saveImageChange(change, existing, async () => [{ id: 1 }])).toBe(true)
    expect(mocks.del.mock.calls).toEqual([[existing.imageUrl], [existing.originalUrl]])
  })

  it('deletes the new uploads and keeps the old image when no row matched', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(await saveImageChange(change, existing, async () => [])).toBe(false)
    expect(mocks.del.mock.calls).toEqual([[upload]])
  })

  it('has nothing to clean up for a new row', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(await saveImageChange(change, null, async () => [{ id: 1 }])).toBe(true)
    expect(mocks.del).not.toHaveBeenCalled()
  })
})
