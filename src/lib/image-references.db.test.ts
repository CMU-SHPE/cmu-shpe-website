import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { advisors, galleryPhotos, officers } from '@/db/schema'
import { createSponsor, resetDb } from '@/test/db'
import { findReferencedImageUrls } from './image-references'

const url = (name: string) => `https://store.public.blob.vercel-storage.com/${name}`

beforeEach(resetDb)

describe('findReferencedImageUrls', () => {
  it('finds a URL in any image column of officers, advisors, sponsors and gallery photos', async () => {
    const db = getDb()
    await db.insert(officers).values([
      { name: 'A', role: 'R', major: 'M', year: 'Y', photoUrl: url('1'), photoOriginalUrl: url('2') },
    ])
    await db.insert(advisors).values([
      { name: 'B', role: 'R', department: 'D', photoUrl: url('3'), photoOriginalUrl: url('4') },
    ])
    await createSponsor({ logoUrl: url('5'), logoOriginalUrl: url('6') })
    await db.insert(galleryPhotos).values([{ imageUrl: url('7'), imageOriginalUrl: url('8'), altText: 'A' }])

    const all = ['1', '2', '3', '4', '5', '6', '7', '8'].map(url)
    expect(await findReferencedImageUrls([...all, url('unused')])).toEqual(new Set(all))
  })

  it('treats a copy with a query string or fragment as the same stored file', async () => {
    await createSponsor({ logoUrl: `${url('a.png')}?v=1` })
    await createSponsor({ logoOriginalUrl: `${url('b.png')}#top` })

    expect(await findReferencedImageUrls([url('a.png'), url('b.png'), url('c.png')])).toEqual(
      new Set([url('a.png'), url('b.png')]),
    )
    expect(await findReferencedImageUrls([`${url('a.png')}?v=2`])).toEqual(new Set([`${url('a.png')}?v=2`]))
  })

  it('returns nothing for unreferenced URLs or an empty list', async () => {
    await createSponsor({ logoUrl: url('logo') })
    expect(await findReferencedImageUrls([url('other')])).toEqual(new Set())
    expect(await findReferencedImageUrls([])).toEqual(new Set())
  })
})
