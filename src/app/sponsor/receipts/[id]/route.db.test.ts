import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))

import { getDb } from '@/db'
import { members } from '@/db/schema'
import { uploadReceipt } from '@/lib/receipts'
import { createAdmin, createMember, createSponsor, resetDb } from '@/test/db'
import { GET } from './route'

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset()
})

function signInAs(kind: 'member' | 'admin', person: { id: number; email: string; name: string }) {
  mocks.auth.mockResolvedValue({
    user: { id: String(person.id), email: person.email, name: person.name, kind },
    authTime: Date.now(),
    expires: '',
  })
}

function download(id: string | number) {
  return GET(new Request(`http://localhost/sponsor/receipts/${id}`), { params: Promise.resolve({ id: String(id) }) })
}

async function listingWithReceipt(fileName = 'gold.pdf') {
  const [listing, admin] = await Promise.all([createSponsor(), createAdmin()])
  const content = randomBytes(1024)
  content.write('%PDF-1.7\n', 0, 'ascii')
  const result = await uploadReceipt(admin.id, listing.id, { title: 'Gold', receiptDate: '2026-09-01', fileName, content })
  if (!result.ok) throw new Error('upload failed')
  const member = await createMember({ role: 'sponsor', sponsorId: listing.id })
  return { listing, member, receiptId: result.id, content }
}

describe('GET /sponsor/receipts/[id]', () => {
  it('sends the sponsor their own receipt as a private PDF attachment', async () => {
    const { member, receiptId, content } = await listingWithReceipt('Recibo año.pdf')
    signInAs('member', member)

    const response = await download(receiptId)
    expect(response.status).toBe(200)
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="Recibo ano.pdf"; filename*=UTF-8''Recibo%20a%C3%B1o.pdf`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-length': String(content.length),
    })
    expect(Buffer.compare(Buffer.from(await response.arrayBuffer()), content)).toBe(0)
  })

  it('answers 404 when sponsor A asks for sponsor B’s receipt by id', async () => {
    const [a, b] = await Promise.all([listingWithReceipt(), listingWithReceipt()])
    signInAs('member', a.member)

    const response = await download(b.receiptId)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('Not found')
  })

  it('answers 404 for a missing receipt and a malformed id', async () => {
    const { member } = await listingWithReceipt()
    signInAs('member', member)
    for (const id of ['999', 'abc', '0', '-1', '1.5', '1e3']) {
      expect((await download(id)).status, id).toBe(404)
    }
  })

  it('answers 404 to a supporter, even one with a stale listing link', async () => {
    const { listing, receiptId } = await listingWithReceipt()
    signInAs('member', await createMember({ role: 'supporter', sponsorId: listing.id }))
    expect((await download(receiptId)).status).toBe(404)
  })

  it('answers 404 once the sponsor is demoted', async () => {
    const { member, receiptId } = await listingWithReceipt()
    signInAs('member', member)
    expect((await download(receiptId)).status).toBe(200)

    await getDb().update(members).set({ role: 'supporter', sponsorId: null }).where(eq(members.id, member.id))
    expect((await download(receiptId)).status).toBe(404)
  })

  it('answers 401 when nobody is signed in or the session is an admin’s', async () => {
    const { receiptId, member } = await listingWithReceipt()
    mocks.auth.mockResolvedValue(null)
    expect((await download(receiptId)).status).toBe(401)

    const admin = await createAdmin({ email: member.email })
    signInAs('admin', { ...admin, id: member.id })
    expect((await download(receiptId)).status).toBe(401)
  })
})
