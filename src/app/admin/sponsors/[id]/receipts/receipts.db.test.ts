import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect, auth: vi.fn(), revalidated: [] as string[] }
})

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => mocks.revalidated.push(path) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))

import { getDb } from '@/db'
import { sponsorReceipts } from '@/db/schema'
import { MAX_RECEIPT_BYTES } from '@/lib/receipt-files'
import { listReceiptsForSponsor } from '@/lib/receipts'
import { createAdmin, createMember, createSponsor, resetDb } from '@/test/db'
import { deleteSponsorReceipt, uploadSponsorReceipt } from './actions'
import { GET } from './[receiptId]/route'

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset()
  mocks.revalidated.length = 0
})

function signInAs(kind: 'member' | 'admin', person: { id: number; email: string; name: string }) {
  mocks.auth.mockResolvedValue({
    user: { id: String(person.id), email: person.email, name: person.name, kind },
    authTime: Date.now(),
    expires: '',
  })
}

function pdf(size: number) {
  const bytes = randomBytes(size)
  bytes.write('%PDF-1.7\n', 0, 'ascii')
  return bytes
}

function uploadForm(file: File, title = 'Gold 2026') {
  const form = new FormData()
  form.set('title', title)
  form.set('date', '2026-09-01')
  form.set('file', file)
  return form
}

function download(sponsorId: number, receiptId: number | string) {
  return GET(new Request(`http://localhost/admin/sponsors/${sponsorId}/receipts/${receiptId}`), {
    params: Promise.resolve({ id: String(sponsorId), receiptId: String(receiptId) }),
  })
}

async function storedIds() {
  return getDb().select({ id: sponsorReceipts.id }).from(sponsorReceipts)
}

describe('admin receipt upload and download', () => {
  it('stores a 4 MiB PDF that downloads byte for byte', async () => {
    const [admin, listing] = await Promise.all([createAdmin(), createSponsor()])
    signInAs('admin', admin)
    const content = pdf(MAX_RECEIPT_BYTES)

    const result = await uploadSponsorReceipt(
      listing.id,
      null,
      uploadForm(new File([content], 'C:\\scans\\gold "2026".pdf', { type: 'application/pdf' })),
    )
    expect(result).toEqual({ status: 'uploaded' })
    expect(mocks.revalidated).toEqual([`/admin/sponsors/${listing.id}`])

    const [listed] = await listReceiptsForSponsor(listing.id)
    expect(listed).toMatchObject({ title: 'Gold 2026', fileName: 'gold "2026".pdf', byteSize: MAX_RECEIPT_BYTES })

    const response = await download(listing.id, listed.id)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="gold 2026.pdf"; filename*=UTF-8''gold%20%222026%22.pdf`,
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.compare(Buffer.from(await response.arrayBuffer()), content)).toBe(0)
  }, 90_000)

  it('refuses a file over 4 MiB without storing anything', async () => {
    const [admin, listing] = await Promise.all([createAdmin(), createSponsor()])
    signInAs('admin', admin)

    const result = await uploadSponsorReceipt(listing.id, null, uploadForm(new File([pdf(MAX_RECEIPT_BYTES + 1)], 'big.pdf')))
    expect(result).toEqual({ status: 'size' })
    expect(await storedIds()).toEqual([])
  })

  it('refuses a non-PDF that claims to be one', async () => {
    const [admin, listing] = await Promise.all([createAdmin(), createSponsor()])
    signInAs('admin', admin)
    const html = new File(['<html><script>alert(1)</script></html>'], 'receipt.pdf', { type: 'application/pdf' })

    expect(await uploadSponsorReceipt(listing.id, null, uploadForm(html))).toEqual({ status: 'type' })
    expect(await storedIds()).toEqual([])
  })

  it('reports a listing deleted before the upload', async () => {
    signInAs('admin', await createAdmin())
    const result = await uploadSponsorReceipt(999, null, uploadForm(new File([pdf(100)], 'a.pdf')))
    expect(result).toEqual({ status: 'missing-listing' })
  })

  it('only downloads a receipt under its own listing', async () => {
    const [admin, listing, other] = await Promise.all([createAdmin(), createSponsor(), createSponsor()])
    signInAs('admin', admin)
    await uploadSponsorReceipt(listing.id, null, uploadForm(new File([pdf(100)], 'a.pdf')))
    const [{ id }] = await storedIds()

    expect((await download(other.id, id)).status).toBe(404)
    expect((await download(listing.id, 999)).status).toBe(404)
    expect((await download(listing.id, 'abc')).status).toBe(404)
    expect((await download(listing.id, id)).status).toBe(200)
  })

  it('refuses member sessions, even a sponsor of the listing whose id and email match an admin', async () => {
    const [admin, listing] = await Promise.all([createAdmin(), createSponsor()])
    signInAs('admin', admin)
    await uploadSponsorReceipt(listing.id, null, uploadForm(new File([pdf(100)], 'a.pdf')))
    const [{ id }] = await storedIds()
    const member = await createMember({ id: admin.id, email: admin.email, role: 'sponsor', sponsorId: listing.id })
    signInAs('member', member)

    expect((await download(listing.id, id)).status).toBe(401)
    await expect(uploadSponsorReceipt(listing.id, null, uploadForm(new File([pdf(100)], 'b.pdf')))).rejects.toMatchObject({
      url: '/login',
    })
    await expect(deleteSponsorReceipt(listing.id, id)).rejects.toMatchObject({ url: '/login' })
    expect(await storedIds()).toEqual([{ id }])

    mocks.auth.mockResolvedValue(null)
    expect((await download(listing.id, id)).status).toBe(401)
  })
})

describe('admin receipt delete', () => {
  it('deletes a receipt through its own listing only', async () => {
    const [admin, listing, other] = await Promise.all([createAdmin(), createSponsor(), createSponsor()])
    signInAs('admin', admin)
    await uploadSponsorReceipt(listing.id, null, uploadForm(new File([pdf(100)], 'a.pdf')))
    const [{ id }] = await storedIds()

    expect(await deleteSponsorReceipt(other.id, id)).toEqual({ status: 'missing-receipt' })
    expect(await storedIds()).toEqual([{ id }])

    expect(await deleteSponsorReceipt(listing.id, id)).toEqual({ status: 'deleted' })
    expect(await storedIds()).toEqual([])
    expect(await deleteSponsorReceipt(listing.id, id)).toEqual({ status: 'missing-receipt' })
  })
})
