import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { admins, members, sponsorEdits, sponsorReceipts, sponsors, type Sponsor } from '@/db/schema'
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
    cleanupBlobs: vi.fn<(...urls: (string | null | undefined)[]) => Promise<void>>(async () => {}),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: mocks.adminId, kind: 'admin' } })) }))
vi.mock('@/lib/blob-cleanup', () => ({ cleanupBlobs: mocks.cleanupBlobs }))

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
    expect(await redirectOf(updateSponsor(listing.id, form))).toBe('/admin/sponsors?saved=1')

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

    expect(await redirectOf(updateSponsor(listing.id, sponsorForm(listing)))).toBe('/admin/sponsors?saved=1')
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
    await redirectOf(updateSponsor(listing.id, form))
    expect((await editLog()).map((edit) => edit.fields)).toEqual([
      ['name', 'website', 'description', 'logo', 'bgColor', 'tier'],
    ])
  })

  it('keeps the officer’s name after their admin account is deleted', async () => {
    const [officer, listing] = await Promise.all([createAdmin({ name: 'Former Officer' }), createSponsor()])
    mocks.adminId = String(officer.id)

    await redirectOf(updateSponsor(listing.id, sponsorForm(listing, { name: 'New name' })))
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

    expect(await redirectOf(updateSponsor(listing.id, sponsorForm(listing, { name: 'Ghost' })))).toBe(
      '/admin/sponsors?error=missing',
    )
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
