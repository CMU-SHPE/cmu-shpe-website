import { asc, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { admins, members, sponsorEdits, sponsorReceipts, sponsors, type Sponsor } from '@/db/schema'
import { listingEdit, officerListingEdit } from '@/lib/sponsor-portal'
import { LOADED_LISTING_FIELD, type ListingSaveRefusal, listingSnapshot } from '@/lib/sponsor-schema'
import { createAdmin, createMember, createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    adminId: '1',
    del: vi.fn<(url: string) => Promise<void>>(async () => {}),
    put: vi.fn(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}` })),
    cleanupBlobs: vi.fn<(...urls: (string | null | undefined)[]) => Promise<void>>(async () => {}),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: mocks.put }))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: mocks.adminId, kind: 'admin' } })) }))
vi.mock('@/lib/blob-cleanup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/blob-cleanup')>()),
  cleanupBlobs: mocks.cleanupBlobs,
}))

import { deleteSponsor, updateSponsor } from './actions'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

async function memberRow(id: number) {
  const [row] = await getDb()
    .select({ role: members.role, sponsorId: members.sponsorId })
    .from(members)
    .where(eq(members.id, id))
  return row
}

async function addHistory(sponsorId: number, memberId: number) {
  const db = getDb()
  await db.insert(sponsorEdits).values({ sponsorId, memberId, editorName: 'Someone', fields: ['name'] })
  await db.insert(sponsorReceipts).values({
    sponsorId,
    title: 'Gold 2026',
    receiptDate: '2026-09-01',
    fileName: 'receipt.pdf',
    byteSize: 8,
    content: Buffer.from('%PDF-1.7'),
  })
}

beforeEach(async () => {
  await resetDb()
  mocks.cleanupBlobs.mockClear()
  mocks.adminId = '1'
  mocks.del.mockClear()
  mocks.put.mockClear()
})

describe('deleteSponsor', () => {
  it('demotes linked members and deletes the listing with its receipts and edit history in one batch', async () => {
    const [listing, other] = await Promise.all([
      createSponsor({ logoUrl: 'https://blob.example/logo.png', logoOriginalUrl: 'https://blob.example/original.png' }),
      createSponsor(),
    ])
    const [linked, alsoLinked, elsewhere, supporter] = await Promise.all([
      createMember({ role: 'sponsor', sponsorId: listing.id }),
      createMember({ role: 'sponsor', sponsorId: listing.id }),
      createMember({ role: 'sponsor', sponsorId: other.id }),
      createMember(),
    ])
    await addHistory(listing.id, linked.id)
    await addHistory(other.id, elsewhere.id)

    expect(await redirectOf(deleteSponsor(listing.id))).toBe('/admin/sponsors?saved=1')

    const db = getDb()
    expect(await memberRow(linked.id)).toEqual({ role: 'supporter', sponsorId: null })
    expect(await memberRow(alsoLinked.id)).toEqual({ role: 'supporter', sponsorId: null })
    expect(await memberRow(elsewhere.id)).toEqual({ role: 'sponsor', sponsorId: other.id })
    expect(await memberRow(supporter.id)).toEqual({ role: 'supporter', sponsorId: null })
    expect(await db.select({ id: sponsors.id }).from(sponsors)).toEqual([{ id: other.id }])
    expect(await db.select({ sponsorId: sponsorEdits.sponsorId }).from(sponsorEdits)).toEqual([{ sponsorId: other.id }])
    expect(await db.select({ sponsorId: sponsorReceipts.sponsorId }).from(sponsorReceipts)).toEqual([
      { sponsorId: other.id },
    ])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith('https://blob.example/logo.png', 'https://blob.example/original.png')
  })

  it('changes nothing when the listing is already gone', async () => {
    const listing = await createSponsor()
    const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
    expect(await redirectOf(deleteSponsor(999_999))).toBe('/admin/sponsors?saved=1')
    expect(await memberRow(member.id)).toEqual({ role: 'sponsor', sponsorId: listing.id })
    expect(mocks.cleanupBlobs).not.toHaveBeenCalled()
  })
})

const OLD_LOGO = 'https://store.public.blob.vercel-storage.com/sponsors/old.png'
const LOGO_SOURCE = 'https://store.public.blob.vercel-storage.com/sponsors/source.png'
const logoFile = () => new File([new Uint8Array(10)], 'new.png', { type: 'image/png' })

function sponsorForm(listing: Sponsor, overrides: Record<string, string> = {}) {
  const form = new FormData()
  const values = {
    name: listing.name,
    tier: listing.tier,
    website: listing.website ?? '',
    logoUrl: listing.logoUrl ?? '',
    bgColor: listing.bgColor,
    description: listing.description,
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) form.set(name, value)
  form.set(LOADED_LISTING_FIELD, listingSnapshot(listing))
  return form
}

async function editLog() {
  return getDb()
    .select({
      sponsorId: sponsorEdits.sponsorId,
      editorKind: sponsorEdits.editorKind,
      memberId: sponsorEdits.memberId,
      adminId: sponsorEdits.adminId,
      editorName: sponsorEdits.editorName,
      fields: sponsorEdits.fields,
    })
    .from(sponsorEdits)
    .orderBy(asc(sponsorEdits.id))
}

describe('updateSponsor', () => {
  it('logs an officer edit with the officer’s name and only the fields that changed', async () => {
    const [officer, listing, other] = await Promise.all([
      createAdmin({ name: 'Jayden' }),
      createSponsor({ name: 'Acme', description: 'Old words', logoUrl: '/images/acme.png', bgColor: '#ABCDEF' }),
      createSponsor(),
    ])
    mocks.adminId = String(officer.id)

    const form = sponsorForm(listing, { tier: 'Platinum', description: 'New words', bgColor: '#abcdef' })
    expect(await redirectOf(updateSponsor(listing.id, null, form))).toBe('/admin/sponsors?saved=1')

    const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
    expect(row).toMatchObject({ tier: 'Platinum', description: 'New words', logoUrl: '/images/acme.png' })
    expect(await editLog()).toEqual([
      {
        sponsorId: listing.id,
        editorKind: 'officer',
        memberId: null,
        adminId: officer.id,
        editorName: 'Jayden',
        fields: ['description', 'tier'],
      },
    ])
    expect((await editLog()).some((edit) => edit.sponsorId === other.id)).toBe(false)
  })

  it('logs nothing when an officer saves the form unchanged', async () => {
    const [officer, listing] = await Promise.all([createAdmin(), createSponsor({ logoUrl: '/images/acme.png' })])
    mocks.adminId = String(officer.id)

    expect(await redirectOf(updateSponsor(listing.id, null, sponsorForm(listing)))).toBe('/admin/sponsors?saved=1')
    expect(await editLog()).toEqual([])
  })

  it('logs every listing field an officer can change', async () => {
    const [officer, listing] = await Promise.all([createAdmin(), createSponsor({ logoUrl: '/images/old.png' })])
    mocks.adminId = String(officer.id)

    const form = sponsorForm(listing, {
      name: 'Renamed',
      tier: 'Bronze',
      website: '',
      logoUrl: '/images/new.png',
      bgColor: '#000000',
      description: 'Changed',
    })
    await redirectOf(updateSponsor(listing.id, null, form))
    expect((await editLog()).map((edit) => edit.fields)).toEqual([
      ['name', 'website', 'description', 'logo', 'bgColor', 'tier'],
    ])
  })

  it('keeps the officer’s name after their admin account is deleted', async () => {
    const [officer, listing] = await Promise.all([createAdmin({ name: 'Former Officer' }), createSponsor()])
    mocks.adminId = String(officer.id)

    await redirectOf(updateSponsor(listing.id, null, sponsorForm(listing, { name: 'New name' })))
    await getDb().delete(admins).where(eq(admins.id, officer.id))

    expect(await editLog()).toEqual([
      {
        sponsorId: listing.id,
        editorKind: 'officer',
        memberId: null,
        adminId: null,
        editorName: 'Former Officer',
        fields: ['name'],
      },
    ])
  })

  it('writes neither the update nor a log row when the listing is gone', async () => {
    const officer = await createAdmin()
    mocks.adminId = String(officer.id)
    const listing = await createSponsor()
    await getDb().delete(sponsors).where(eq(sponsors.id, listing.id))

    expect(await redirectOf(updateSponsor(listing.id, null, sponsorForm(listing, { name: 'Ghost' })))).toBe(
      '/admin/sponsors?error=missing',
    )
    expect(await editLog()).toEqual([])
  })

  it('saves nothing and discards the fresh upload when the officer’s account is deleted mid-request', async () => {
    const [officer, listing] = await Promise.all([createAdmin(), createSponsor({ name: 'Acme', logoUrl: OLD_LOGO })])
    mocks.adminId = String(officer.id)
    await getDb().delete(admins).where(eq(admins.id, officer.id))

    const form = sponsorForm(listing, { name: 'Renamed' })
    form.set('logoFile', logoFile())
    expect(await redirectOf(updateSponsor(listing.id, null, form))).toBe('/admin/sponsors?error=not-saved')

    const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
    expect(row).toEqual(listing)
    expect(await editLog()).toEqual([])
    expect(mocks.put).toHaveBeenCalledTimes(1)
    expect(mocks.del.mock.calls).toEqual([[(await mocks.put.mock.results[0].value).url]])
    expect(mocks.cleanupBlobs).not.toHaveBeenCalled()
  })

  it('keeps the fresh crop, cleans up the old one and logs it when the save succeeds', async () => {
    const [officer, listing] = await Promise.all([
      createAdmin({ name: 'Jayden' }),
      createSponsor({ logoUrl: OLD_LOGO, logoOriginalUrl: LOGO_SOURCE }),
    ])
    mocks.adminId = String(officer.id)

    const form = sponsorForm(listing)
    form.set('logoFile', logoFile())
    expect(await redirectOf(updateSponsor(listing.id, null, form))).toBe('/admin/sponsors?saved=1')

    const { url } = await mocks.put.mock.results[0].value
    const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
    expect(row).toMatchObject({ logoUrl: url, logoOriginalUrl: LOGO_SOURCE })
    expect((await editLog()).map((edit) => edit.fields)).toEqual([['logo']])
    expect(mocks.del).not.toHaveBeenCalled()
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith(OLD_LOGO)
  })

  describe('when someone else edited the listing after this form loaded', () => {
    async function linkedSetup(listingValues: Parameters<typeof createSponsor>[0]) {
      const [officer, listing] = await Promise.all([createAdmin({ name: 'Olive Officer' }), createSponsor(listingValues)])
      mocks.adminId = String(officer.id)
      const member = await createMember({ name: 'Sam Sponsor', role: 'sponsor', sponsorId: listing.id })
      return { listing, member }
    }

    function sponsorSaves(memberId: number, listing: Sponsor, changes: Partial<Sponsor>, fields: ('name' | 'description' | 'logo')[]) {
      const db = getDb()
      return db.batch(listingEdit(db, memberId, listing.id, listing, { ...listing, ...changes }, fields))
    }

    function logoSubmittedDuring(sponsorSave: () => Promise<unknown>) {
      mocks.put.mockImplementationOnce(async (pathname: string) => {
        await sponsorSave()
        return { url: `https://store.public.blob.vercel-storage.com/${pathname}` }
      })
    }

    it('keeps a sponsor’s edit made during the officer’s upload and logs each side’s own field', async () => {
      const { listing, member } = await linkedSetup({ description: 'Old words', logoUrl: OLD_LOGO })
      logoSubmittedDuring(() => sponsorSaves(member.id, listing, { description: 'Sponsor words' }, ['description']))
      const form = sponsorForm(listing)
      form.set('logoFile', logoFile())

      expect(await redirectOf(updateSponsor(listing.id, null, form))).toBe('/admin/sponsors?saved=1')

      const { url } = await mocks.put.mock.results[0].value
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
      expect(row).toMatchObject({ description: 'Sponsor words', logoUrl: url })
      expect((await editLog()).map(({ editorKind, fields }) => [editorKind, fields])).toEqual([
        ['sponsor', ['description']],
        ['officer', ['logo']],
      ])
      expect(mocks.del).not.toHaveBeenCalled()
    })

    it('refuses an upload when the sponsor replaced the logo first and discards the fresh file', async () => {
      const { listing, member } = await linkedSetup({ logoUrl: OLD_LOGO })
      const sponsorLogo = 'https://store.public.blob.vercel-storage.com/sponsors/sponsor.png'
      logoSubmittedDuring(() =>
        sponsorSaves(member.id, listing, { logoUrl: sponsorLogo, logoOriginalUrl: null, logoCrop: null }, ['logo']),
      )
      const form = sponsorForm(listing, { name: 'Officer name' })
      form.set('logoFile', logoFile())

      const refused = (await updateSponsor(listing.id, null, form)) as ListingSaveRefusal

      const { url } = await mocks.put.mock.results[0].value
      expect(refused.conflicts).toEqual([])
      expect(refused.logoDropped).toBe(true)
      expect(refused.shown).toMatchObject({ name: 'Officer name', logoUrl: sponsorLogo })
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
      expect(row).toMatchObject({ name: listing.name, logoUrl: sponsorLogo })
      expect((await editLog()).map(({ editorKind, fields }) => [editorKind, fields])).toEqual([['sponsor', ['logo']]])
      expect(mocks.del.mock.calls).toEqual([[url]])
      expect(mocks.cleanupBlobs).not.toHaveBeenCalled()
    })

    it('does not put the old logo back from a stale form’s logo path field', async () => {
      const { listing, member } = await linkedSetup({ logoUrl: OLD_LOGO })
      const sponsorLogo = 'https://store.public.blob.vercel-storage.com/sponsors/sponsor.png'
      await sponsorSaves(member.id, listing, { logoUrl: sponsorLogo, logoOriginalUrl: null, logoCrop: null }, ['logo'])

      const form = sponsorForm(listing, { description: 'Officer words' })
      expect(await redirectOf(updateSponsor(listing.id, null, form))).toBe('/admin/sponsors?saved=1')

      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
      expect(row).toMatchObject({ description: 'Officer words', logoUrl: sponsorLogo })
      expect((await editLog()).map((edit) => edit.fields)).toEqual([['logo'], ['description']])
    })

    it('refuses an edit to the field the sponsor just changed and keeps the typed text', async () => {
      const { listing, member } = await linkedSetup({ name: 'Acme' })
      await sponsorSaves(member.id, listing, { name: 'Sponsor name' }, ['name'])

      const refused = (await updateSponsor(listing.id, null, sponsorForm(listing, { name: 'Officer name' }))) as ListingSaveRefusal

      expect(refused.conflicts).toEqual([{ field: 'Name', saved: 'Sponsor name' }])
      expect(refused.shown.name).toBe('Officer name')
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
      expect(row.name).toBe('Sponsor name')
      expect((await editLog()).map(({ editorKind }) => editorKind)).toEqual(['sponsor'])
    })

    it('refuses a form with no loaded values', async () => {
      const { listing } = await linkedSetup({ name: 'Acme' })
      const form = sponsorForm(listing, { name: 'Officer name' })
      form.delete(LOADED_LISTING_FIELD)

      const refused = (await updateSponsor(listing.id, null, form)) as ListingSaveRefusal

      expect(refused.conflicts).toEqual([{ field: 'Name', saved: 'Acme' }])
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, listing.id))
      expect(row).toEqual(listing)
      expect(await editLog()).toEqual([])
    })
  })
})

describe('officerListingEdit', () => {
  it('writes nothing for a listing id that does not exist', async () => {
    const [officer, other] = await Promise.all([createAdmin(), createSponsor({ name: 'Untouched' })])
    const db = getDb()

    const [updated] = await db.batch(officerListingEdit(db, officer.id, 999_999, other, { ...other, name: 'Ghost' }, ['name']))

    expect(updated.rows).toEqual([])
    expect(await editLog()).toEqual([])
    const [row] = await db.select().from(sponsors).where(eq(sponsors.id, other.id))
    expect(row.name).toBe('Untouched')
  })

  it('writes nothing when the officer does not exist', async () => {
    const listing = await createSponsor({ name: 'Acme' })
    const db = getDb()

    const [logged] = await db.batch(officerListingEdit(db, 999_999, listing.id, listing, { ...listing, name: 'Ghost' }, ['name']))

    expect(logged.rows).toEqual([])
    expect(await editLog()).toEqual([])
    const [row] = await db.select().from(sponsors).where(eq(sponsors.id, listing.id))
    expect(row.name).toBe('Acme')
  })

  it('rolls the update back when the log row cannot be written', async () => {
    const [officer, listing] = await Promise.all([createAdmin(), createSponsor({ name: 'Acme' })])
    const db = getDb()
    await db.execute(sql`alter table sponsor_edits add constraint test_reject_log check (false) not valid`)
    try {
      await expect(db.batch(officerListingEdit(db, officer.id, listing.id, listing, { ...listing, name: 'Renamed' }, ['name']))).rejects.toThrow()
    } finally {
      await db.execute(sql`alter table sponsor_edits drop constraint test_reject_log`)
    }

    const [row] = await db.select().from(sponsors).where(eq(sponsors.id, listing.id))
    expect(row.name).toBe('Acme')
    expect(await editLog()).toEqual([])
  })
})

describe('sponsor_edits', () => {
  it('reads a row inserted without an editor kind as a sponsor edit', async () => {
    const [listing, member] = await Promise.all([createSponsor(), createMember()])
    await getDb().insert(sponsorEdits).values({ sponsorId: listing.id, memberId: member.id, editorName: 'Old row', fields: ['name'] })
    expect(await editLog()).toEqual([
      { sponsorId: listing.id, editorKind: 'sponsor', memberId: member.id, adminId: null, editorName: 'Old row', fields: ['name'] },
    ])
  })

  it('refuses a row that names both a member and an admin, or an officer edit tied to a member', async () => {
    const [listing, member, officer] = await Promise.all([createSponsor(), createMember(), createAdmin()])
    const db = getDb()
    await expect(
      db.insert(sponsorEdits).values({ sponsorId: listing.id, memberId: member.id, adminId: officer.id, editorName: 'X', fields: ['name'] }),
    ).rejects.toThrow()
    await expect(
      db.insert(sponsorEdits).values({ sponsorId: listing.id, editorKind: 'officer', memberId: member.id, editorName: 'X', fields: ['name'] }),
    ).rejects.toThrow()
  })
})
