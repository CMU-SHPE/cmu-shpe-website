import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { type Member, type Sponsor, members, sponsorEdits, sponsors } from '@/db/schema'
import { listingEdit } from '@/lib/sponsor-portal'
import { createMember, createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    auth: vi.fn(),
    cleanupBlobs: vi.fn<(...urls: (string | null | undefined)[]) => Promise<void>>(async () => {}),
    uploadImage: vi.fn(),
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/blob-cleanup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/blob-cleanup')>()),
  cleanupBlobs: mocks.cleanupBlobs,
}))
vi.mock('@/lib/uploads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/uploads')>()),
  uploadImage: mocks.uploadImage,
}))

import { updateListing } from './actions'

const OLD_LOGO = 'https://store.public.blob.vercel-storage.com/sponsors/old.png'
const NEW_LOGO = 'https://store.public.blob.vercel-storage.com/sponsors/new.png'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function signedInAs(member: Member) {
  mocks.auth.mockResolvedValue({
    user: { id: String(member.id), email: member.email, name: member.name, kind: 'member' },
    authTime: Date.now(),
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  })
}

function listingForm(listing: Sponsor, overrides: Record<string, string> = {}) {
  const form = new FormData()
  const values: Record<string, string> = {
    name: listing.name,
    website: listing.website ?? '',
    description: listing.description,
    bgColor: listing.bgColor,
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) form.set(name, value)
  return form
}

async function listingRow(id: number) {
  const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, id))
  return row
}

async function auditRows() {
  return getDb()
    .select({
      sponsorId: sponsorEdits.sponsorId,
      memberId: sponsorEdits.memberId,
      memberName: sponsorEdits.memberName,
      fields: sponsorEdits.fields,
    })
    .from(sponsorEdits)
    .orderBy(asc(sponsorEdits.id))
}

let listing: Sponsor
let other: Sponsor
let sponsor: Member

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset()
  mocks.cleanupBlobs.mockClear()
  mocks.uploadImage.mockReset()
  ;[listing, other] = await Promise.all([
    createSponsor({ name: 'Acme', logoUrl: OLD_LOGO, description: 'Old words' }),
    createSponsor({ name: 'Globex' }),
  ])
  sponsor = await createMember({ name: 'Sam Sponsor', role: 'sponsor', sponsorId: listing.id })
  signedInAs(sponsor)
})

describe('updateListing', () => {
  it('updates the sponsor’s own listing and writes one audit row naming the changed fields', async () => {
    const form = listingForm(listing, { name: 'Acme Corp', description: 'New words' })
    expect(await redirectOf(updateListing(form))).toBe('/sponsor?saved=listing')

    expect(await listingRow(listing.id)).toMatchObject({
      name: 'Acme Corp',
      description: 'New words',
      tier: listing.tier,
      logoUrl: OLD_LOGO,
      sortOrder: listing.sortOrder,
    })
    expect(await auditRows()).toEqual([
      { sponsorId: listing.id, memberId: sponsor.id, memberName: 'Sam Sponsor', fields: ['name', 'description'] },
    ])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith()
  })

  it('records a new logo and cleans up the one it replaced', async () => {
    mocks.uploadImage.mockResolvedValue({ ok: true, url: NEW_LOGO })
    const form = listingForm(listing)
    form.set('logoOriginalFile', new File(['png'], 'logo.png', { type: 'image/png' }))

    expect(await redirectOf(updateListing(form))).toBe('/sponsor?saved=listing')
    expect(await listingRow(listing.id)).toMatchObject({ logoUrl: NEW_LOGO, logoOriginalUrl: null, logoCrop: null })
    expect((await auditRows()).map((row) => row.fields)).toEqual([['logo']])
    expect(mocks.cleanupBlobs).toHaveBeenCalledWith(OLD_LOGO)
  })

  it('writes nothing when no field changed', async () => {
    expect(await redirectOf(updateListing(listingForm(listing)))).toBe('/sponsor?saved=unchanged')
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await auditRows()).toEqual([])
  })

  it('cannot be pointed at another listing by extra form fields', async () => {
    const form = listingForm(listing, { name: 'Hijacked' })
    for (const field of ['id', 'sponsorId', 'sponsor_id', 'listingId', 'memberId']) form.set(field, String(other.id))
    form.set('tier', 'Platinum')
    form.set('logoUrl', 'https://evil.example/x.png')

    expect(await redirectOf(updateListing(form))).toBe('/sponsor?saved=listing')
    expect(await listingRow(other.id)).toEqual(other)
    expect(await listingRow(listing.id)).toMatchObject({ name: 'Hijacked', tier: listing.tier, logoUrl: OLD_LOGO })
    expect((await auditRows()).map((row) => row.sponsorId)).toEqual([listing.id])
  })

  it('changes nothing for a member demoted before submitting', async () => {
    await getDb().update(members).set({ role: 'supporter' }).where(eq(members.id, sponsor.id))
    expect(await redirectOf(updateListing(listingForm(listing, { name: 'Too late' })))).toBe('/account')
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await auditRows()).toEqual([])
  })

  it('rejects invalid input without writing', async () => {
    expect(await redirectOf(updateListing(listingForm(listing, { website: 'javascript:alert(1)' })))).toBe(
      '/sponsor?error=invalid',
    )
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await auditRows()).toEqual([])
  })
})

describe('listingEdit', () => {
  const values = {
    name: 'Changed',
    website: null,
    description: '',
    bgColor: '#000000',
    logoUrl: null,
    logoOriginalUrl: null,
    logoCrop: null,
  }

  it('updates nothing and audits nothing once the member is no longer a sponsor', async () => {
    await getDb().update(members).set({ role: 'supporter' }).where(eq(members.id, sponsor.id))
    const db = getDb()
    const [locked, updated] = await db.batch(listingEdit(db, sponsor.id, listing.id, values, ['name']))
    expect(locked).toEqual([])
    expect(updated).toEqual([])
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await auditRows()).toEqual([])
  })

  it('updates nothing and audits nothing for a sponsor with no listing', async () => {
    await getDb().update(members).set({ sponsorId: null }).where(eq(members.id, sponsor.id))
    const db = getDb()
    const [, updated] = await db.batch(listingEdit(db, sponsor.id, listing.id, values, ['name']))
    expect(updated).toEqual([])
    expect(await auditRows()).toEqual([])
  })

  it('writes nothing when the member was moved to another listing after the caller read theirs', async () => {
    await getDb().update(members).set({ sponsorId: other.id }).where(eq(members.id, sponsor.id))
    const db = getDb()
    const [, updated] = await db.batch(listingEdit(db, sponsor.id, listing.id, values, ['name', 'website']))
    expect(updated).toEqual([])
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await listingRow(other.id)).toEqual(other)
    expect(await auditRows()).toEqual([])
  })

  it('cannot write to a listing the member is not linked to', async () => {
    const db = getDb()
    const [, updated] = await db.batch(listingEdit(db, sponsor.id, other.id, values, ['name']))
    expect(updated).toEqual([])
    expect(await listingRow(listing.id)).toEqual(listing)
    expect(await listingRow(other.id)).toEqual(other)
    expect(await auditRows()).toEqual([])
  })

  it('keeps the audit row with a null member after the editor deletes their account', async () => {
    const db = getDb()
    await db.batch(listingEdit(db, sponsor.id, listing.id, values, ['name']))
    await db.delete(members).where(eq(members.id, sponsor.id))
    expect(await auditRows()).toEqual([
      { sponsorId: listing.id, memberId: null, memberName: 'Sam Sponsor', fields: ['name'] },
    ])
  })
})
