import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { advisors, officers } from '@/db/schema'
import { createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    del: vi.fn<(url: string) => Promise<void>>(async () => {}),
    put: vi.fn(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}` })),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: mocks.put }))

import { createOfficer, deleteAdvisor, deleteOfficer, updateAdvisor, updateOfficer } from './actions'

const blobUrl = (name: string) => `https://store.public.blob.vercel-storage.com/${name}`
const SHARED = blobUrl('officers/shared.jpg')
const OWN = blobUrl('officers/own.jpg')
const NEW_PHOTO = blobUrl('officers/new.jpg')

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

async function insertOfficer(values: Partial<typeof officers.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(officers)
    .values({ name: 'Ada', role: 'President', major: 'CS', year: 'Senior', ...values })
    .returning()
  return row
}

async function insertAdvisor(values: Partial<typeof advisors.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(advisors)
    .values({ name: 'Grace', role: 'Faculty advisor', department: 'Engineering', ...values })
    .returning()
  return row
}

function officerForm(fields: Record<string, string | File> = {}) {
  const form = new FormData()
  const values = { name: 'Ada', role: 'President', major: 'CS', year: 'Senior', bio: '', ...fields }
  for (const [name, value] of Object.entries(values)) form.set(name, value)
  return form
}

const photoFile = () => new File([new Uint8Array(10)], 'new.jpg', { type: 'image/jpeg' })

beforeEach(async () => {
  await resetDb()
  vi.stubEnv('VERCEL_ENV', 'production')
  mocks.del.mockClear()
  mocks.put.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('deleting a person', () => {
  it('keeps a photo that another officer, advisor or sponsor still shows, and deletes the rest', async () => {
    const officer = await insertOfficer({ photoUrl: SHARED, photoOriginalUrl: OWN })
    await insertOfficer({ name: 'Copy', photoUrl: SHARED })

    expect(await redirectOf(deleteOfficer(officer.id))).toBe('/admin/officers?saved=1')
    expect(mocks.del.mock.calls).toEqual([[OWN]])
  })

  it('checks advisors and sponsor logos too', async () => {
    const advisorPhoto = blobUrl('advisors/grace.jpg')
    const advisor = await insertAdvisor({ photoUrl: advisorPhoto, photoOriginalUrl: SHARED })
    await createSponsor({ logoOriginalUrl: SHARED })

    expect(await redirectOf(deleteAdvisor(advisor.id))).toBe('/admin/officers?saved=1')
    expect(mocks.del.mock.calls).toEqual([[advisorPhoto]])
  })

  it('deletes nothing outside production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const officer = await insertOfficer({ photoUrl: OWN })
    expect(await redirectOf(deleteOfficer(officer.id))).toBe('/admin/officers?saved=1')
    expect(mocks.del).not.toHaveBeenCalled()
  })
})

describe('updating a person', () => {
  it('keeps the replaced photo when another row still shows it', async () => {
    const officer = await insertOfficer({ photoUrl: SHARED })
    await createSponsor({ logoUrl: SHARED })

    const form = officerForm({ photoOriginalFile: photoFile() })
    expect(await redirectOf(updateOfficer(officer.id, form))).toBe('/admin/officers?saved=1')

    const [row] = await getDb().select().from(officers).where(eq(officers.id, officer.id))
    expect(row.photoUrl).toBe(NEW_PHOTO)
    expect(mocks.del).not.toHaveBeenCalled()
  })

  it('deletes the replaced photo when no other row uses it', async () => {
    const officer = await insertOfficer({ photoUrl: OWN })
    const form = officerForm({ photoOriginalFile: photoFile() })
    expect(await redirectOf(updateOfficer(officer.id, form))).toBe('/admin/officers?saved=1')
    expect(mocks.del.mock.calls).toEqual([[OWN]])
  })

  it.each([
    ['officer', updateOfficer, insertOfficer, officers],
    ['advisor', updateAdvisor, insertAdvisor, advisors],
  ] as const)(
    'reports a %s deleted mid-save as missing and removes the photo it just uploaded',
    async (_, update, insert, table) => {
      const person = await insert({ photoUrl: OWN })
      mocks.put.mockImplementationOnce(async (pathname) => {
        await getDb().delete(table).where(eq(table.id, person.id))
        return { url: blobUrl(pathname) }
      })

      const form = officerForm({ department: 'Engineering', photoOriginalFile: photoFile() })
      expect(await redirectOf(update(person.id, form))).toBe('/admin/officers?error=missing')
      expect(mocks.del.mock.calls).toEqual([[blobUrl(`${table === officers ? 'officers' : 'advisors'}/new.jpg`)]])
    },
  )

  it('rejects an SVG with script before storing anything', async () => {
    const officer = await insertOfficer({ photoUrl: OWN })
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], 'x.svg', {
      type: 'image/svg+xml',
    })
    expect(await redirectOf(updateOfficer(officer.id, officerForm({ photoOriginalFile: svg })))).toBe(
      '/admin/officers?error=svg',
    )
    expect(mocks.put).not.toHaveBeenCalled()
    const [row] = await getDb().select().from(officers).where(eq(officers.id, officer.id))
    expect(row.photoUrl).toBe(OWN)
  })
})

describe('creating a person', () => {
  it('removes the photo it just uploaded when the insert fails', async () => {
    await getDb().execute(sql`alter table officers add constraint officers_test_reject check (name <> 'Reject')`)
    try {
      const form = officerForm({ name: 'Reject', photoOriginalFile: photoFile() })
      await expect(createOfficer(form)).rejects.toThrow()
      expect(mocks.del.mock.calls).toEqual([[NEW_PHOTO]])
      expect(await getDb().select().from(officers)).toEqual([])
    } finally {
      await getDb().execute(sql`alter table officers drop constraint officers_test_reject`)
    }
  })
})
