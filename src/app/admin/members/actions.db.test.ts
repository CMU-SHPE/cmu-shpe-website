import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { createMember, createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))

import { linkMemberToSponsor, removeSponsorAccess } from './actions'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function listingForm(sponsorId: number | string) {
  const form = new FormData()
  form.set('sponsorId', String(sponsorId))
  return form
}

async function memberRow(id: number) {
  const [row] = await getDb()
    .select({ role: members.role, sponsorId: members.sponsorId })
    .from(members)
    .where(eq(members.id, id))
  return row
}

beforeEach(async () => {
  await resetDb()
})

describe('linkMemberToSponsor', () => {
  it('makes a confirmed member a sponsor of the chosen listing', async () => {
    const [listing, member] = await Promise.all([createSponsor(), createMember()])
    expect(await redirectOf(linkMemberToSponsor(member.id, listingForm(listing.id)))).toBe('/admin/members?saved=sponsor')
    expect(await memberRow(member.id)).toEqual({ role: 'sponsor', sponsorId: listing.id })
  })

  it('moves an existing sponsor to another listing', async () => {
    const [first, second] = await Promise.all([createSponsor(), createSponsor()])
    const member = await createMember({ role: 'sponsor', sponsorId: first.id })
    expect(await redirectOf(linkMemberToSponsor(member.id, listingForm(second.id)))).toBe('/admin/members?saved=sponsor')
    expect(await memberRow(member.id)).toEqual({ role: 'sponsor', sponsorId: second.id })
  })

  it('refuses an unconfirmed member in SQL and leaves them a supporter', async () => {
    const [listing, member] = await Promise.all([createSponsor(), createMember({ confirmed: false })])
    expect(await redirectOf(linkMemberToSponsor(member.id, listingForm(listing.id)))).toBe('/admin/members?error=link')
    expect(await memberRow(member.id)).toEqual({ role: 'supporter', sponsorId: null })
  })

  it('refuses a listing that does not exist without a foreign-key error', async () => {
    const member = await createMember()
    expect(await redirectOf(linkMemberToSponsor(member.id, listingForm(999_999)))).toBe('/admin/members?error=link')
    expect(await memberRow(member.id)).toEqual({ role: 'supporter', sponsorId: null })
  })

  it('reports a member that no longer exists', async () => {
    const listing = await createSponsor()
    expect(await redirectOf(linkMemberToSponsor(999_999, listingForm(listing.id)))).toBe('/admin/members?error=link')
  })

  it.each([[''], ['0'], ['abc'], ['1; drop table members']])('rejects listing id %j', async (sponsorId) => {
    const member = await createMember()
    expect(await redirectOf(linkMemberToSponsor(member.id, listingForm(sponsorId)))).toBe('/admin/members?error=invalid')
    expect(await memberRow(member.id)).toEqual({ role: 'supporter', sponsorId: null })
  })
})

describe('removeSponsorAccess', () => {
  it('clears the role and the listing in one statement, touching no one else', async () => {
    const listing = await createSponsor()
    const [member, other] = await Promise.all([
      createMember({ role: 'sponsor', sponsorId: listing.id }),
      createMember({ role: 'sponsor', sponsorId: listing.id }),
    ])
    expect(await redirectOf(removeSponsorAccess(member.id))).toBe('/admin/members?saved=supporter')
    expect(await memberRow(member.id)).toEqual({ role: 'supporter', sponsorId: null })
    expect(await memberRow(other.id)).toEqual({ role: 'sponsor', sponsorId: listing.id })
  })

  it('reports a member that no longer exists', async () => {
    expect(await redirectOf(removeSponsorAccess(999_999))).toBe('/admin/members?error=missing')
  })
})
