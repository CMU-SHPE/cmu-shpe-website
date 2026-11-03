import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { galleryPhotos, officers } from '@/db/schema'
import { createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    requireAdmin: vi.fn(),
    del: vi.fn<(url: string) => Promise<void>>(async () => {}),
    put: vi.fn(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}` })),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: mocks.put }))

import { createGalleryPhoto, deleteGalleryPhoto, moveGalleryPhoto, updateGalleryPhoto } from './actions'

const SAVED = '/admin/gallery?saved=1'
const blobUrl = (name: string) => `https://store.public.blob.vercel-storage.com/${name}`
const OWN = blobUrl('gallery/own.jpg')
const OWN_ORIGINAL = blobUrl('gallery/own-original.jpg')
const SHARED = blobUrl('gallery/shared.jpg')

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function photoForm(fields: Record<string, string | File> = {}) {
  const form = new FormData()
  const values = { imageUrl: '', altText: 'Members at the national convention', caption: '', ...fields }
  for (const [name, value] of Object.entries(values)) form.set(name, value)
  return form
}

async function insertPhoto(values: Partial<typeof galleryPhotos.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(galleryPhotos)
    .values({ imageUrl: OWN, altText: 'Existing photo', ...values })
    .returning()
  return row
}

const photoRows = () =>
  getDb().select().from(galleryPhotos).orderBy(asc(galleryPhotos.sortOrder), asc(galleryPhotos.id))

const jpeg = (name = 'convention.jpg') => new File([new Uint8Array(10)], name, { type: 'image/jpeg' })

beforeEach(async () => {
  await resetDb()
  vi.stubEnv('VERCEL_ENV', 'production')
  mocks.del.mockClear()
  mocks.put.mockClear()
  mocks.requireAdmin.mockReset()
  mocks.requireAdmin.mockResolvedValue({ user: { id: '1', kind: 'admin' } })
})
afterEach(() => vi.unstubAllEnvs())

describe('someone who is not an admin', () => {
  it('is refused by every action before anything is stored, written or deleted', async () => {
    const first = await insertPhoto()
    await insertPhoto({ imageUrl: SHARED, altText: 'Second', sortOrder: 1 })
    const before = await photoRows()

    const attempts = {
      createGalleryPhoto: () => createGalleryPhoto(photoForm({ imageOriginalFile: jpeg() })),
      updateGalleryPhoto: () => updateGalleryPhoto(first.id, photoForm({ imageUrl: '/gallery/other.jpg' })),
      deleteGalleryPhoto: () => deleteGalleryPhoto(first.id),
      moveGalleryPhoto: () => moveGalleryPhoto(first.id, 'down'),
    }
    for (const [name, attempt] of Object.entries(attempts)) {
      mocks.requireAdmin.mockRejectedValueOnce(new mocks.Redirect('/login'))
      expect(await redirectOf(attempt()), name).toBe('/login')
      expect(mocks.requireAdmin, name).toHaveBeenCalledTimes(1)
      mocks.requireAdmin.mockClear()
    }

    expect(await photoRows()).toEqual(before)
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.del).not.toHaveBeenCalled()
  })
})

describe('adding a photo', () => {
  it('adds photos at the end of the list, trimming text and storing a blank caption as empty', async () => {
    expect(await redirectOf(createGalleryPhoto(photoForm({ imageUrl: '/gallery/banner.jpg', caption: '  Convention 2026  ' })))).toBe(SAVED)
    expect(await redirectOf(createGalleryPhoto(photoForm({ imageUrl: 'https://example.org/booth.jpg', altText: '  Our booth  ' })))).toBe(SAVED)

    expect(await photoRows()).toEqual([
      expect.objectContaining({
        imageUrl: '/gallery/banner.jpg',
        imageOriginalUrl: null,
        imageCrop: null,
        altText: 'Members at the national convention',
        caption: 'Convention 2026',
        sortOrder: 0,
      }),
      expect.objectContaining({ imageUrl: 'https://example.org/booth.jpg', altText: 'Our booth', caption: '', sortOrder: 1 }),
    ])
  })

  it('stores an upload in the gallery folder with its original and crop', async () => {
    const crop = JSON.stringify({ x: 0, y: 0, width: 400, height: 300, rotation: 0 })
    const form = photoForm({ imageFile: jpeg('cropped.jpg'), imageOriginalFile: jpeg('original.jpg'), imageCrop: crop })
    expect(await redirectOf(createGalleryPhoto(form))).toBe(SAVED)

    expect(mocks.put.mock.calls.map(([pathname]) => pathname)).toEqual(['gallery/cropped.jpg', 'gallery/original.jpg'])
    expect(await photoRows()).toEqual([
      expect.objectContaining({
        imageUrl: blobUrl('gallery/cropped.jpg'),
        imageOriginalUrl: blobUrl('gallery/original.jpg'),
        imageCrop: crop,
      }),
    ])
  })

  it('refuses a photo with no image', async () => {
    expect(await redirectOf(createGalleryPhoto(photoForm()))).toBe('/admin/gallery?error=image')
    expect(await photoRows()).toEqual([])
  })

  it('refuses a photo without alt text before uploading anything', async () => {
    expect(await redirectOf(createGalleryPhoto(photoForm({ altText: '   ', imageOriginalFile: jpeg() })))).toBe(
      '/admin/gallery?error=invalid',
    )
    expect(mocks.put).not.toHaveBeenCalled()
    expect(await photoRows()).toEqual([])
  })

  it('refuses an unsafe image path', async () => {
    expect(await redirectOf(createGalleryPhoto(photoForm({ imageUrl: 'javascript:alert(1)' })))).toBe(
      '/admin/gallery?error=invalid',
    )
    expect(await photoRows()).toEqual([])
  })

  it('refuses a file that is not an image', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(await redirectOf(createGalleryPhoto(photoForm({ imageOriginalFile: text })))).toBe('/admin/gallery?error=upload')
    expect(mocks.put).not.toHaveBeenCalled()
    expect(await photoRows()).toEqual([])
  })

  it('rejects an SVG with script before storing anything', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], 'x.svg', {
      type: 'image/svg+xml',
    })
    expect(await redirectOf(createGalleryPhoto(photoForm({ imageOriginalFile: svg })))).toBe('/admin/gallery?error=svg')
    expect(mocks.put).not.toHaveBeenCalled()
    expect(await photoRows()).toEqual([])
  })
})

describe('editing a photo', () => {
  it('changes the text and keeps the cropped image when the path field is left as it was', async () => {
    const photo = await insertPhoto({ imageOriginalUrl: OWN_ORIGINAL, imageCrop: '{"x":1}' })

    const form = photoForm({ imageUrl: OWN, altText: 'New alt', caption: 'New caption' })
    expect(await redirectOf(updateGalleryPhoto(photo.id, form))).toBe(SAVED)

    expect(await photoRows()).toEqual([
      expect.objectContaining({
        id: photo.id,
        imageUrl: OWN,
        imageOriginalUrl: OWN_ORIGINAL,
        imageCrop: '{"x":1}',
        altText: 'New alt',
        caption: 'New caption',
      }),
    ])
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('keeps the image when the path field is blanked', async () => {
    const photo = await insertPhoto({ imageOriginalUrl: OWN_ORIGINAL, imageCrop: '{"x":1}' })

    expect(await redirectOf(updateGalleryPhoto(photo.id, photoForm({ imageUrl: '' })))).toBe(SAVED)

    expect(await photoRows()).toEqual([
      expect.objectContaining({ imageUrl: OWN, imageOriginalUrl: OWN_ORIGINAL, imageCrop: '{"x":1}' }),
    ])
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('replaces the image with an upload and deletes both old files', async () => {
    const photo = await insertPhoto({ imageOriginalUrl: OWN_ORIGINAL })

    expect(await redirectOf(updateGalleryPhoto(photo.id, photoForm({ imageUrl: OWN, imageOriginalFile: jpeg('new.jpg') })))).toBe(SAVED)

    expect(await photoRows()).toEqual([
      expect.objectContaining({ imageUrl: blobUrl('gallery/new.jpg'), imageOriginalUrl: null, imageCrop: null }),
    ])
    expect(mocks.del.mock.calls).toEqual([[OWN], [OWN_ORIGINAL]])
  })

  it('keeps a replaced image that an officer still shows', async () => {
    const photo = await insertPhoto({ imageUrl: SHARED })
    await getDb().insert(officers).values({ name: 'Ana', role: 'President', major: 'ME', year: 'Senior', photoUrl: SHARED })

    expect(await redirectOf(updateGalleryPhoto(photo.id, photoForm({ imageUrl: '/gallery/typed.jpg' })))).toBe(SAVED)

    expect((await photoRows())[0].imageUrl).toBe('/gallery/typed.jpg')
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('reports a missing photo without creating one', async () => {
    expect(await redirectOf(updateGalleryPhoto(999, photoForm({ imageUrl: '/gallery/a.jpg' })))).toBe('/admin/gallery?error=missing')
    expect(await photoRows()).toEqual([])
  })

  it('reports a photo deleted mid-save as missing and removes the file it just uploaded', async () => {
    const photo = await insertPhoto()
    mocks.put.mockImplementationOnce(async (pathname) => {
      await getDb().delete(galleryPhotos).where(eq(galleryPhotos.id, photo.id))
      return { url: blobUrl(pathname) }
    })

    expect(await redirectOf(updateGalleryPhoto(photo.id, photoForm({ imageOriginalFile: jpeg('new.jpg') })))).toBe(
      '/admin/gallery?error=missing',
    )
    expect(mocks.del.mock.calls).toEqual([[blobUrl('gallery/new.jpg')]])
  })
})

describe('deleting a photo', () => {
  it('deletes only the chosen photo and its files', async () => {
    const photo = await insertPhoto({ imageOriginalUrl: OWN_ORIGINAL })
    const other = await insertPhoto({ imageUrl: SHARED, altText: 'Other', sortOrder: 1 })

    expect(await redirectOf(deleteGalleryPhoto(photo.id))).toBe(SAVED)

    expect((await photoRows()).map((row) => row.id)).toEqual([other.id])
    expect(mocks.del.mock.calls).toEqual([[OWN], [OWN_ORIGINAL]])
  })

  it('keeps a file that another gallery photo or a sponsor logo still shows', async () => {
    const photo = await insertPhoto({ imageUrl: SHARED, imageOriginalUrl: OWN_ORIGINAL })
    await insertPhoto({ imageUrl: SHARED, altText: 'Copy', sortOrder: 1 })
    await createSponsor({ logoOriginalUrl: OWN_ORIGINAL })

    expect(await redirectOf(deleteGalleryPhoto(photo.id))).toBe(SAVED)
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('deletes no files outside production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const photo = await insertPhoto()
    expect(await redirectOf(deleteGalleryPhoto(photo.id))).toBe(SAVED)
    expect(await photoRows()).toEqual([])
    expect(mocks.del).not.toHaveBeenCalled()
  })
})

describe('reordering photos', () => {
  it('moves a photo one place and leaves the ends where they are', async () => {
    const a = await insertPhoto({ altText: 'A', sortOrder: 0 })
    const b = await insertPhoto({ altText: 'B', sortOrder: 1 })
    const c = await insertPhoto({ altText: 'C', sortOrder: 2 })

    expect(await redirectOf(moveGalleryPhoto(c.id, 'up'))).toBe(SAVED)
    expect((await photoRows()).map((row) => row.id)).toEqual([a.id, c.id, b.id])

    expect(await redirectOf(moveGalleryPhoto(a.id, 'down'))).toBe(SAVED)
    expect((await photoRows()).map((row) => row.id)).toEqual([c.id, a.id, b.id])

    expect(await redirectOf(moveGalleryPhoto(c.id, 'up'))).toBe(SAVED)
    expect(await redirectOf(moveGalleryPhoto(b.id, 'down'))).toBe(SAVED)
    expect((await photoRows()).map((row) => row.id)).toEqual([c.id, a.id, b.id])
  })

  it('refuses a bad direction', async () => {
    const photo = await insertPhoto()
    expect(await redirectOf(moveGalleryPhoto(photo.id, 'sideways' as 'up'))).toBe('/admin/gallery?error=invalid')
  })
})
