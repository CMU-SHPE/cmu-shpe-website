import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  listMembers: vi.fn(),
  listSponsorOptions: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => {
    mocks.calls.push('requireAdmin')
    return { user: { id: '1' } }
  },
}))
vi.mock('@/lib/member-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-admin')>()),
  listMembers: mocks.listMembers,
  listSponsorOptions: mocks.listSponsorOptions,
}))
vi.mock('./actions', () => ({ deleteMember: vi.fn(), linkMemberToSponsor: vi.fn(), removeSponsorAccess: vi.fn() }))

import AdminMembersPage from './page'

const ana = {
  id: 1,
  name: 'Ana <b>Lopez</b>',
  email: 'ana@example.com',
  role: 'supporter' as const,
  emailConfirmedAt: new Date('2026-10-01T12:00:00Z'),
  createdAt: new Date('2026-10-01T12:00:00Z'),
  topicCount: 2,
  sponsorId: null as number | null,
  sponsorName: null as string | null,
}
const ben = { ...ana, id: 2, name: 'Ben', email: 'ben@example.com', role: 'sponsor' as const, emailConfirmedAt: null, topicCount: 0 }
const cleo = {
  ...ana,
  id: 3,
  name: 'Cleo',
  email: 'cleo@example.com',
  role: 'sponsor' as const,
  sponsorId: 20,
  sponsorName: 'Globex',
}

async function renderPage(searchParams: Record<string, string | string[]> = {}) {
  render(await AdminMembersPage({ searchParams: Promise.resolve(searchParams) }))
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.listMembers.mockReset().mockImplementation(async () => {
    mocks.calls.push('listMembers')
    return { rows: [ana, ben], hasNext: false }
  })
  mocks.listSponsorOptions.mockReset().mockResolvedValue([
    { id: 10, name: 'Acme' },
    { id: 20, name: 'Globex' },
  ])
})

describe('AdminMembersPage', () => {
  it('requires an admin before loading members', async () => {
    await renderPage()
    expect(mocks.calls[0]).toBe('requireAdmin')
    expect(mocks.calls).toContain('listMembers')
  })

  it('lists members with role, listing, confirmation, join date and topic count', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [ana, ben, cleo], hasNext: false })
    await renderPage()
    const table = screen.getByRole('table', { name: 'Members, newest first, page 1' })
    const [, first, second, third] = within(table).getAllByRole('row')
    expect(within(first).getAllByRole('cell').slice(0, 7).map((cell) => cell.textContent)).toEqual([
      'Ana <b>Lopez</b>',
      'ana@example.com',
      'Supporter',
      '—',
      'Yes',
      'Oct 1, 2026',
      '2',
    ])
    expect(within(second).getAllByRole('cell').slice(2, 5).map((cell) => cell.textContent)).toEqual(['Sponsor', '—', 'No'])
    expect(within(third).getAllByRole('cell').slice(2, 4).map((cell) => cell.textContent)).toEqual(['Sponsor', 'Globex'])
  })

  it('offers a confirmed supporter a listing choice and a Make sponsor button', async () => {
    await renderPage()
    const select = screen.getByRole('combobox', { name: 'Sponsor listing for Ana <b>Lopez</b>' })
    expect(select).toHaveValue('')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a listing',
      'Acme',
      'Globex',
    ])
    expect(screen.getByRole('button', { name: 'Make sponsor for Ana <b>Lopez</b>' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove sponsor access for Ana/ })).toBeNull()
  })

  it('gives an unconfirmed member no sponsor controls', async () => {
    await renderPage()
    expect(screen.queryByRole('combobox', { name: 'Sponsor listing for Ben' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make sponsor for Ben' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change listing for Ben' })).toBeNull()
  })

  it('lets an admin change or remove a sponsor’s listing', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [cleo], hasNext: false })
    await renderPage()
    expect(screen.getByRole('combobox', { name: 'Sponsor listing for Cleo' })).toHaveValue('20')
    expect(screen.getByRole('button', { name: 'Change listing for Cleo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove sponsor access for Cleo' })).toBeInTheDocument()
  })

  it('hides the listing choice when there are no listings yet', async () => {
    mocks.listSponsorOptions.mockResolvedValue([])
    await renderPage()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('has a labelled search box that keeps the current search', async () => {
    await renderPage({ q: 'ana' })
    expect(mocks.listMembers).toHaveBeenCalledWith({ q: 'ana', page: 1 })
    expect(screen.getByRole('searchbox', { name: 'Search by name or email' })).toHaveValue('ana')
    expect(screen.getByRole('table', { name: 'Members matching “ana”, page 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', '/admin/members')
  })

  it('ignores malformed params instead of failing', async () => {
    await renderPage({ q: ['ana', 'x'], page: 'nope' })
    expect(mocks.listMembers).toHaveBeenCalledWith({ q: 'ana', page: 1 })
  })

  it('links to neighbouring pages and keeps the search', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [ana], hasNext: true })
    await renderPage({ q: 'a b', page: '2' })
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/admin/members?q=a+b')
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/admin/members?q=a+b&page=3')
  })

  it('says when a search finds nobody', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [], hasNext: false })
    await renderPage({ q: 'zed' })
    expect(screen.getByText('No members match that search.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('announces a deleted member', async () => {
    await renderPage({ saved: 'deleted' })
    expect(screen.getByRole('status')).toHaveTextContent('Member deleted.')
  })

  it.each([
    ['sponsor', 'Sponsor access saved.'],
    ['supporter', 'Sponsor access removed.'],
  ])('announces saved=%s', async (saved, message) => {
    await renderPage({ saved })
    expect(screen.getByRole('status')).toHaveTextContent(message)
  })

  it('ignores an unknown saved value', async () => {
    await renderPage({ saved: 'nope' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows errors as alerts', async () => {
    await renderPage({ error: 'missing' })
    expect(screen.getByRole('alert')).toHaveTextContent('That member no longer exists.')
  })
})
