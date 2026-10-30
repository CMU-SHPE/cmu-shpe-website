import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { advisors, officers } from '@/db/schema'
import { resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect, cleanupBlobs: vi.fn<(...urls: (string | null | undefined)[]) => Promise<void>>(async () => {}) }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))
vi.mock('@/lib/blob-cleanup', () => ({ cleanupBlobs: mocks.cleanupBlobs }))

import {
  createAdvisor,
  createOfficer,
  deleteAdvisor,
  deleteOfficer,
  moveOfficer,
  updateAdvisor,
  updateOfficer,
} from './actions'

const SAVED = '/admin/officers?saved=1'
const PHOTO = 'https://blob.example/officers/ana.jpg'
const PHOTO_ORIGINAL = 'https://blob.example/officers/ana-original.jpg'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

function officerForm(overrides: Record<string, string> = {}) {
  return form({
    name: 'Ana Ruiz',
    role: 'President',
    major: 'Mechanical Engineering',
    year: 'Senior',
    bio: 'Leads the chapter.',
    email: '',
    linkedin: '',
    photoUrl: '',
    ...overrides,
  })
}

function advisorForm(overrides: Record<string, string> = {}) {
  return form({
    name: 'Dr. Lee',
    role: 'Faculty Advisor',
    department: 'Engineering',
    bio: '',
    email: 'lee@example.edu',
    linkedin: '',
    photoUrl: '',
    ...overrides,
  })
}

const officerRows = () => getDb().select().from(officers).orderBy(asc(officers.sortOrder), asc(officers.id))
const advisorRows = () => getDb().select().from(advisors).orderBy(asc(advisors.sortOrder), asc(advisors.id))

beforeEach(async () => {
  await resetDb()
  mocks.cleanupBlobs.mockClear()
})

describe('officers', () => {
  it('creates officers at the end of the list, storing blank optional fields as null', async () => {
    expect(await redirectOf(createOfficer(officerForm()))).toBe(SAVED)
    expect(await redirectOf(createOfficer(officerForm({ name: 'Ben Ortiz', role: 'Treasurer', email: 'ben@example.org' })))).toBe(SAVED)

    expect(await officerRows()).toEqual([
      expect.objectContaining({
        name: 'Ana Ruiz',
        role: 'President',
        major: 'Mechanical Engineering',
        year: 'Senior',
        bio: 'Leads the chapter.',
        email: null,
        linkedin: null,
        photoUrl: null,
        photoOriginalUrl: null,
        photoCrop: null,
        sortOrder: 0,
      }),
      expect.objectContaining({ name: 'Ben Ortiz', role: 'Treasurer', email: 'ben@example.org', sortOrder: 1 }),
    ])
  })

  it('refuses an invalid form without writing anything', async () => {
    expect(await redirectOf(createOfficer(officerForm({ name: '' })))).toBe('/admin/officers?error=invalid')
    expect(await officerRows()).toEqual([])
  })

  it('updates the fields and keeps a cropped photo whose URL was left as it was', async () => {
    const [officer] = await getDb()
      .insert(officers)
      .values({ name: 'Ana', role: 'President', major: 'ME', year: 'Senior', photoUrl: PHOTO, photoOriginalUrl: PHOTO_ORIGINAL, photoCrop: '{"x":1}' })
      .returning()

    expect(await redirectOf(updateOfficer(officer.id, officerForm({ role: 'Vice President', photoUrl: PHOTO })))).toBe(SAVED)

    expect(await officerRows()).toEqual([
      expect.objectContaining({
        id: officer.id,
        name: 'Ana Ruiz',
        role: 'Vice President',
        photoUrl: PHOTO,
        photoOriginalUrl: PHOTO_ORIGINAL,
        photoCrop: '{"x":1}',
      }),
    ])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith()
  })

  it('replaces the photo with a typed URL and cleans up both old images', async () => {
    const [officer] = await getDb()
      .insert(officers)
      .values({ name: 'Ana', role: 'President', major: 'ME', year: 'Senior', photoUrl: PHOTO, photoOriginalUrl: PHOTO_ORIGINAL, photoCrop: '{"x":1}' })
      .returning()

    expect(await redirectOf(updateOfficer(officer.id, officerForm({ photoUrl: '/images/ana.png' })))).toBe(SAVED)

    expect(await officerRows()).toEqual([
      expect.objectContaining({ photoUrl: '/images/ana.png', photoOriginalUrl: null, photoCrop: null }),
    ])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith(PHOTO, PHOTO_ORIGINAL)
  })

  it('reports a missing officer on update without creating one', async () => {
    expect(await redirectOf(updateOfficer(999, officerForm()))).toBe('/admin/officers?error=missing')
    expect(await officerRows()).toEqual([])
  })

  it('deletes only the chosen officer and cleans up its images', async () => {
    const [ana, ben] = await getDb()
      .insert(officers)
      .values([
        { name: 'Ana', role: 'President', major: 'ME', year: 'Senior', photoUrl: PHOTO, photoOriginalUrl: PHOTO_ORIGINAL },
        { name: 'Ben', role: 'Treasurer', major: 'CS', year: 'Junior', sortOrder: 1 },
      ])
      .returning()

    expect(await redirectOf(deleteOfficer(ana.id))).toBe(SAVED)

    expect((await officerRows()).map((row) => row.id)).toEqual([ben.id])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith(PHOTO, PHOTO_ORIGINAL)
  })

  it('moves an officer up one place and leaves the first one where it is', async () => {
    const [ana, ben, cruz] = await getDb()
      .insert(officers)
      .values([
        { name: 'Ana', role: 'President', major: 'ME', year: 'Senior', sortOrder: 0 },
        { name: 'Ben', role: 'Treasurer', major: 'CS', year: 'Junior', sortOrder: 1 },
        { name: 'Cruz', role: 'Secretary', major: 'EE', year: 'Sophomore', sortOrder: 2 },
      ])
      .returning()

    expect(await redirectOf(moveOfficer(cruz.id, 'up'))).toBe(SAVED)
    expect((await officerRows()).map((row) => row.id)).toEqual([ana.id, cruz.id, ben.id])

    expect(await redirectOf(moveOfficer(ana.id, 'up'))).toBe(SAVED)
    expect((await officerRows()).map((row) => row.id)).toEqual([ana.id, cruz.id, ben.id])
  })
})

describe('advisors', () => {
  it('creates, updates and deletes an advisor', async () => {
    expect(await redirectOf(createAdvisor(advisorForm()))).toBe(SAVED)
    const [created] = await advisorRows()
    expect(created).toEqual(
      expect.objectContaining({ name: 'Dr. Lee', role: 'Faculty Advisor', department: 'Engineering', email: 'lee@example.edu', sortOrder: 0 }),
    )

    expect(await redirectOf(updateAdvisor(created.id, advisorForm({ department: 'Computer Science', email: '' })))).toBe(SAVED)
    expect(await advisorRows()).toEqual([expect.objectContaining({ id: created.id, department: 'Computer Science', email: null })])

    expect(await redirectOf(deleteAdvisor(created.id))).toBe(SAVED)
    expect(await advisorRows()).toEqual([])
  })

  it('leaves officers alone when an advisor with the same id is deleted', async () => {
    const [officer] = await getDb().insert(officers).values({ name: 'Ana', role: 'President', major: 'ME', year: 'Senior' }).returning()
    const [advisor] = await getDb().insert(advisors).values({ name: 'Dr. Lee', role: 'Advisor', department: 'Eng' }).returning()
    expect(advisor.id).toBe(officer.id)

    expect(await redirectOf(deleteAdvisor(advisor.id))).toBe(SAVED)
    expect((await officerRows()).map((row) => row.id)).toEqual([officer.id])
  })
})
