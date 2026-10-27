import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { members, sponsorEdits } from '@/db/schema'
import { createMember, createSponsor, resetDb } from '@/test/db'
import { getLinkedMembers, getSponsorEdits, getSponsorListing } from './sponsor-portal-admin'

beforeEach(async () => {
  await resetDb()
})

describe('getSponsorListing', () => {
  it('returns the listing, or null when it does not exist', async () => {
    const listing = await createSponsor({ name: 'Acme', description: 'Hello' })
    expect(await getSponsorListing(listing.id)).toEqual(listing)
    expect(await getSponsorListing(999_999)).toBeNull()
  })
})

describe('getLinkedMembers', () => {
  it('lists only sponsors linked to this listing, by name', async () => {
    const [listing, other] = await Promise.all([createSponsor(), createSponsor()])
    const [zed, amy] = await Promise.all([
      createMember({ name: 'Zed', role: 'sponsor', sponsorId: listing.id }),
      createMember({ name: 'Amy', role: 'sponsor', sponsorId: listing.id }),
      createMember({ name: 'Stale supporter', role: 'supporter', sponsorId: listing.id }),
      createMember({ name: 'Elsewhere', role: 'sponsor', sponsorId: other.id }),
      createMember({ name: 'Plain' }),
    ])
    expect(await getLinkedMembers(listing.id)).toEqual([
      { id: amy.id, name: 'Amy', email: amy.email },
      { id: zed.id, name: 'Zed', email: zed.email },
    ])
  })
})

describe('getSponsorEdits', () => {
  it('returns this listing’s edits newest first, keeping the name after the editor is deleted', async () => {
    const [listing, other] = await Promise.all([createSponsor(), createSponsor()])
    const editor = await createMember({ name: 'Sam', role: 'sponsor', sponsorId: listing.id })
    const byEditor = { sponsorId: listing.id, memberId: editor.id, memberName: 'Sam' }
    const db = getDb()
    await db.insert(sponsorEdits).values([
      { ...byEditor, fields: ['name'], createdAt: new Date('2026-10-01T15:00:00Z') },
      { ...byEditor, fields: ['logo', 'bgColor'], createdAt: new Date('2026-10-02T15:00:00Z') },
      { sponsorId: other.id, memberId: null, memberName: 'Other', fields: ['name'] },
    ])
    await db.delete(members).where(eq(members.id, editor.id))

    const edits = await getSponsorEdits(listing.id)
    const summary = edits.map(({ memberId, memberName, fields, createdAt }) => ({ memberId, memberName, fields, createdAt }))
    expect(summary).toEqual([
      { memberId: null, memberName: 'Sam', fields: ['logo', 'bgColor'], createdAt: new Date('2026-10-02T15:00:00Z') },
      { memberId: null, memberName: 'Sam', fields: ['name'], createdAt: new Date('2026-10-01T15:00:00Z') },
    ])
  })
})
