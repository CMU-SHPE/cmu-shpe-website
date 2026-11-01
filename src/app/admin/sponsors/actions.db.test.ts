import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { members, sponsorEdits, sponsorReceipts, sponsors } from '@/db/schema'
import { createMember, createSponsor, resetDb } from '@/test/db'

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
vi.mock('@/lib/blob-cleanup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/blob-cleanup')>()),
  cleanupBlobs: mocks.cleanupBlobs,
}))

import { deleteSponsor } from './actions'

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
  await db.insert(sponsorEdits).values({ sponsorId, memberId, memberName: 'Someone', fields: ['name'] })
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
