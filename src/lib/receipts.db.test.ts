import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { members, sponsorReceipts, sponsors } from '@/db/schema'
import { createAdmin, createMember, createSponsor, resetDb } from '@/test/db'
import { MAX_RECEIPT_BYTES, type ReceiptUpload } from './receipt-files'
import {
  deleteReceipt,
  getReceiptForAdmin,
  getReceiptForMember,
  listReceiptsForMember,
  listReceiptsForSponsor,
  uploadReceipt,
} from './receipts'

beforeEach(resetDb)

function pdf(size = 256) {
  const bytes = randomBytes(size)
  bytes.write('%PDF-1.7\n', 0, 'ascii')
  return bytes
}

function upload(overrides: Partial<ReceiptUpload> = {}): ReceiptUpload {
  return { title: 'Gold 2026', receiptDate: '2026-09-01', fileName: 'gold.pdf', content: pdf(), ...overrides }
}

async function storedReceipt(sponsorId: number, overrides: Partial<ReceiptUpload> = {}) {
  const admin = await createAdmin()
  const result = await uploadReceipt(admin.id, sponsorId, upload(overrides))
  if (!result.ok) throw new Error('upload failed')
  return result.id
}

async function sponsorWithMember() {
  const listing = await createSponsor()
  const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
  return { listing, member }
}

describe('uploadReceipt', () => {
  it('stores a maximum-size PDF that downloads byte for byte', async () => {
    const { listing, member } = await sponsorWithMember()
    const admin = await createAdmin()
    const content = pdf(MAX_RECEIPT_BYTES)

    const result = await uploadReceipt(admin.id, listing.id, upload({ content }))
    expect(result).toEqual({ ok: true, id: expect.any(Number) })
    if (!result.ok) return

    const [row] = await getDb()
      .select({ byteSize: sponsorReceipts.byteSize, uploadedBy: sponsorReceipts.uploadedBy })
      .from(sponsorReceipts)
      .where(eq(sponsorReceipts.id, result.id))
    expect(row).toEqual({ byteSize: MAX_RECEIPT_BYTES, uploadedBy: admin.id })

    const forMember = await getReceiptForMember(member.id, result.id)
    expect(Buffer.compare(Buffer.from(forMember!.content), content)).toBe(0)
    const forAdmin = await getReceiptForAdmin(result.id, listing.id)
    expect(Buffer.compare(Buffer.from(forAdmin!.content), content)).toBe(0)
  }, 90_000)

  it('reports a listing that does not exist instead of throwing', async () => {
    const admin = await createAdmin()
    await expect(uploadReceipt(admin.id, 999, upload())).resolves.toEqual({ ok: false, reason: 'missing-listing' })
    expect(await getDb().select({ id: sponsorReceipts.id }).from(sponsorReceipts)).toEqual([])
  })
})

describe('receipt lists', () => {
  it('never include the file content', async () => {
    const { listing, member } = await sponsorWithMember()
    await storedReceipt(listing.id)

    const [forSponsor] = await listReceiptsForSponsor(listing.id)
    const [forMember] = await listReceiptsForMember(member.id)
    for (const row of [forSponsor, forMember]) {
      expect(row).toBeDefined()
      expect(row).not.toHaveProperty('content')
    }
    expect(forSponsor).toMatchObject({ title: 'Gold 2026', receiptDate: '2026-09-01', fileName: 'gold.pdf', byteSize: 256 })
    expect(forSponsor.uploadedBy).toMatch(/^Admin \d+$/)
  })

  it('list a listing’s receipts newest first and nothing from other listings', async () => {
    const [{ listing, member }, other] = await Promise.all([sponsorWithMember(), createSponsor()])
    const older = await storedReceipt(listing.id, { receiptDate: '2026-01-01', title: 'Older' })
    const newer = await storedReceipt(listing.id, { receiptDate: '2026-06-01', title: 'Newer' })
    await storedReceipt(other.id, { title: 'Theirs' })

    expect((await listReceiptsForSponsor(listing.id)).map((row) => row.id)).toEqual([newer, older])
    expect((await listReceiptsForMember(member.id)).map((row) => row.title)).toEqual(['Newer', 'Older'])
  })

  it('show a member nothing unless they are a sponsor linked to a listing', async () => {
    const listing = await createSponsor()
    await storedReceipt(listing.id)
    const [supporterWithStaleLink, unlinkedSponsor] = await Promise.all([
      createMember({ role: 'supporter', sponsorId: listing.id }),
      createMember({ role: 'sponsor', sponsorId: null }),
    ])

    expect(await listReceiptsForMember(supporterWithStaleLink.id)).toEqual([])
    expect(await listReceiptsForMember(unlinkedSponsor.id)).toEqual([])
    expect(await listReceiptsForMember(999)).toEqual([])
  })
})

describe('getReceiptForMember', () => {
  it('returns null for another listing’s receipt and for a missing one', async () => {
    const [mine, theirs] = await Promise.all([sponsorWithMember(), sponsorWithMember()])
    const theirReceipt = await storedReceipt(theirs.listing.id)

    expect(await getReceiptForMember(mine.member.id, theirReceipt)).toBeNull()
    expect(await getReceiptForMember(mine.member.id, 999)).toBeNull()
    expect(await getReceiptForMember(theirs.member.id, theirReceipt)).not.toBeNull()
  })

  it('stops working once the member is demoted or the listing link is cleared', async () => {
    const { listing, member } = await sponsorWithMember()
    const receipt = await storedReceipt(listing.id)

    await getDb().update(members).set({ role: 'supporter' }).where(eq(members.id, member.id))
    expect(await getReceiptForMember(member.id, receipt)).toBeNull()

    await getDb().update(members).set({ role: 'sponsor', sponsorId: null }).where(eq(members.id, member.id))
    expect(await getReceiptForMember(member.id, receipt)).toBeNull()
  })
})

describe('getReceiptForAdmin', () => {
  it('only finds a receipt under its own listing', async () => {
    const [listing, other] = await Promise.all([createSponsor(), createSponsor()])
    const receipt = await storedReceipt(listing.id)

    expect(await getReceiptForAdmin(receipt, listing.id)).toMatchObject({ id: receipt, fileName: 'gold.pdf' })
    expect(await getReceiptForAdmin(receipt, other.id)).toBeNull()
    expect(await getReceiptForAdmin(999, listing.id)).toBeNull()
  })
})

describe('deleting', () => {
  it('deletes a receipt only through its own listing', async () => {
    const [listing, other] = await Promise.all([createSponsor(), createSponsor()])
    const receipt = await storedReceipt(listing.id)

    expect(await deleteReceipt(receipt, other.id)).toBe(false)
    expect(await deleteReceipt(receipt, listing.id)).toBe(true)
    expect(await deleteReceipt(receipt, listing.id)).toBe(false)
    expect(await listReceiptsForSponsor(listing.id)).toEqual([])
  })

  it('removes a listing’s receipts with the listing', async () => {
    const [listing, other] = await Promise.all([createSponsor(), createSponsor()])
    await storedReceipt(listing.id)
    const kept = await storedReceipt(other.id)

    await getDb().delete(sponsors).where(eq(sponsors.id, listing.id))
    expect(await getDb().select({ id: sponsorReceipts.id }).from(sponsorReceipts)).toEqual([{ id: kept }])
  })
})
