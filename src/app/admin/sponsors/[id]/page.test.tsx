import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  listing: null as unknown,
  linked: [] as { id: number; name: string; email: string }[],
  edits: [] as { id: number; memberId: number | null; memberName: string; fields: string[]; createdAt: Date }[],
}))

vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => {
    mocks.calls.push('requireAdmin')
    return { user: { id: '1' } }
  },
}))
vi.mock('@/lib/sponsor-portal-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sponsor-portal-admin')>()),
  getSponsorListing: async (id: number) => {
    mocks.calls.push(`listing ${id}`)
    return mocks.listing
  },
  getLinkedMembers: async () => mocks.linked,
  getSponsorEdits: async () => mocks.edits,
}))
vi.mock('@/components/admin/sponsor-receipts', () => ({
  default: ({ sponsorId }: { sponsorId: number }) => (
    <section aria-label="Receipts">
      <h2>Receipts</h2>
      listing {sponsorId}
    </section>
  ),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))

import AdminSponsorDetailPage from './page'

function page(id: string) {
  return AdminSponsorDetailPage({ params: Promise.resolve({ id }) })
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.listing = {
    id: 3,
    name: 'Acme',
    tier: 'Gold',
    website: 'https://acme.example',
    description: 'We build things.',
    logoUrl: null,
    logoOriginalUrl: null,
    logoCrop: null,
    bgColor: '#ffffff',
    sortOrder: 0,
  }
  mocks.linked = [{ id: 7, name: 'Sam', email: 'sam@acme.example' }]
  mocks.edits = [
    { id: 2, memberId: null, memberName: 'Gone Person', fields: ['logo', 'bgColor'], createdAt: new Date('2026-10-02T03:30:00Z') },
    { id: 1, memberId: 7, memberName: 'Sam', fields: ['name'], createdAt: new Date('2026-07-01T18:05:00Z') },
  ]
})

describe('AdminSponsorDetailPage', () => {
  it('requires an admin before loading the listing', async () => {
    await page('3')
    expect(mocks.calls).toEqual(['requireAdmin', 'listing 3'])
  })

  it.each([['0'], ['abc'], ['1.5'], ['99999999999']])('is not found for id %j without a lookup', async (id) => {
    await expect(page(id)).rejects.toThrow('NOT_FOUND')
    expect(mocks.calls).toEqual(['requireAdmin'])
  })

  it('is not found when the listing does not exist', async () => {
    mocks.listing = null
    await expect(page('3')).rejects.toThrow('NOT_FOUND')
  })

  it('shows the listing, its sponsor accounts and its edit history', async () => {
    render(await page('3'))
    expect(screen.getByRole('heading', { level: 1, name: 'Acme' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Listing',
      'Sponsor accounts',
      'Edit history',
      'Receipts',
    ])
    expect(screen.getByRole('region', { name: 'Receipts' })).toHaveTextContent('listing 3')
    expect(screen.getByText('We build things.')).toBeInTheDocument()

    const accounts = screen.getByRole('table', { name: 'Sponsor accounts linked to Acme' })
    expect(within(accounts).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Sam', 'sam@acme.example'])
  })

  it('lists edits newest first in Denver time, marking deleted accounts', async () => {
    render(await page('3'))
    const history = screen.getByRole('table', { name: 'Edits to Acme, newest first' })
    const [, newest, oldest] = within(history).getAllByRole('row')
    expect(within(newest).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Oct 1, 2026, 9:30 PM MDT',
      'Gone Person (account deleted)',
      'Logo, Logo background color',
    ])
    expect(within(oldest).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Jul 1, 2026, 12:05 PM MDT',
      'Sam',
      'Name',
    ])
  })

  it('explains empty sections', async () => {
    mocks.linked = []
    mocks.edits = []
    render(await page('3'))
    expect(screen.getByText('No one is linked to this listing yet.')).toBeInTheDocument()
    expect(screen.getByText('No sponsor has edited this listing yet.')).toBeInTheDocument()
  })
})
