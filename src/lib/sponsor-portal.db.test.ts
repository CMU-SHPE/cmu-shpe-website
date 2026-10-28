import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { type Member, members, sponsors } from '@/db/schema'
import { createAdmin, createMember, createSponsor, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { currentSponsor, requireSponsor } from './sponsor-portal'

function signedInAs(member: Pick<Member, 'id' | 'email' | 'name'>, kind: 'member' | 'admin' = 'member') {
  mocks.auth.mockResolvedValue({
    user: { id: String(member.id), email: member.email, name: member.name, kind },
    authTime: Date.now(),
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  })
}

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset().mockResolvedValue(null)
})

describe('currentSponsor and requireSponsor', () => {
  it('return the member and their own listing for a linked sponsor', async () => {
    const [listing] = await Promise.all([createSponsor({ name: 'Acme' }), createSponsor({ name: 'Other' })])
    const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
    signedInAs(member)

    const access = await requireSponsor()
    expect(access.listing).toMatchObject({ id: listing.id, name: 'Acme' })
    expect(access.member.user).toMatchObject({ id: String(member.id), role: 'sponsor' })
  })

  it('send a signed-out visitor to /login', async () => {
    await expect(currentSponsor()).resolves.toBeNull()
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /login')
  })

  it('send an admin session to /login, since it is not a member', async () => {
    const admin = await createAdmin()
    signedInAs(admin, 'admin')
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /login')
  })

  it('send a supporter to /account even when a listing id is set on the row', async () => {
    const listing = await createSponsor()
    const member = await createMember({ role: 'supporter', sponsorId: listing.id })
    signedInAs(member)
    await expect(currentSponsor()).resolves.toBeNull()
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /account')
  })

  it('send a sponsor with no listing to /account', async () => {
    const member = await createMember({ role: 'sponsor', sponsorId: null })
    signedInAs(member)
    await expect(currentSponsor()).resolves.toBeNull()
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /account')
  })

  it('treat a sponsor whose listing was deleted as a supporter', async () => {
    const listing = await createSponsor()
    const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
    await getDb().delete(sponsors).where(eq(sponsors.id, listing.id))
    signedInAs(member)
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /account')
  })

  it('refuse a sponsor who was demoted after signing in', async () => {
    const listing = await createSponsor()
    const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
    signedInAs(member)
    await getDb().update(members).set({ role: 'supporter' }).where(eq(members.id, member.id))
    await expect(requireSponsor()).rejects.toThrow('REDIRECT /account')
  })
})
