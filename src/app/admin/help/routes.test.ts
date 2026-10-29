import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ admin: null as unknown, handbookFile: '' }))

vi.mock('@/lib/admin', () => ({ currentAdmin: async () => mocks.admin }))
vi.mock('@/lib/guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/guides')>()
  return {
    ...actual,
    get OFFICER_HANDBOOK_FILE() {
      return mocks.handbookFile
    },
  }
})

import { GET as handbook } from './handbook.pdf/route'
import { GET as adminPrint } from './print/route'
import { GET as publicPrint } from '../../help/print/public/route'

let dir = ''

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'handbook-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

beforeEach(() => {
  mocks.admin = null
  mocks.handbookFile = path.join(dir, 'missing.pdf')
})

describe('GET /admin/help/handbook.pdf', () => {
  it('refuses a signed-out visitor with 401, even when the file exists', async () => {
    mocks.handbookFile = path.join(dir, 'present.pdf')
    await writeFile(mocks.handbookFile, '%PDF-1.7')
    const response = await handbook()
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('%PDF')
  })

  it('answers 404 when the handbook has not been generated', async () => {
    mocks.admin = { user: { id: '1' } }
    const response = await handbook()
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('streams the handbook to an admin as a private PDF', async () => {
    mocks.admin = { user: { id: '1' } }
    mocks.handbookFile = path.join(dir, 'present.pdf')
    await writeFile(mocks.handbookFile, '%PDF-1.7')
    const response = await handbook()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-length')).toBe('8')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('%PDF-1.7')
  })
})

describe('GET /admin/help/print', () => {
  it('refuses a signed-out visitor with 401', async () => {
    const response = await adminPrint()
    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('Officer guide')
  })

  it('gives an admin the officer guide as a plain printable page', async () => {
    mocks.admin = { user: { id: '1' } }
    const response = await adminPrint()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const html = await response.text()
    expect(html).toContain('<title>SHPE @ CMU officer handbook</title>')
    expect(html).toContain('<h1>Officer guide</h1>')
    expect(html).toMatch(/h2 \{[^}]*break-before: page/)
    expect(html).toMatch(/img \{[^}]*max-width: 100%/)
    expect(html).not.toContain('<!--')
    expect(html).not.toContain('event-date-range')
  })
})

describe('GET /help/print/public', () => {
  it('prints the member and sponsor guides, with ids kept apart, for anyone', async () => {
    const response = await publicPrint()
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<title>SHPE @ CMU website guide</title>')
    expect(html).toContain('<h1>Member guide</h1>')
    expect(html).toContain('<h1>Sponsor guide</h1>')
    expect(html).toContain('id="members-creating-an-account"')
    expect(html).toContain('id="sponsors-getting-access"')
    expect(html).not.toContain('Officer guide')
    expect(html).not.toContain('<nav class')
  })
})
