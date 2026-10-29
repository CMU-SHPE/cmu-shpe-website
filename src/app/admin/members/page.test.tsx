import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  listMembers: vi.fn(),
  listSponsorOptions: vi.fn(),
  deleteMember: vi.fn(),
  linkMemberToSponsor: vi.fn(),
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
vi.mock('./actions', () => ({
  deleteMember: mocks.deleteMember,
  linkMemberToSponsor: mocks.linkMemberToSponsor,
  removeSponsorAccess: vi.fn(),
}))

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
  mocks.deleteMember.mockReset()
  mocks.linkMemberToSponsor.mockReset()
  mocks.listMembers.mockReset().mockImplementation(async () => {
    mocks.calls.push('listMembers')
    return { rows: [ana, ben], hasNext: false }
  })
  mocks.listSponsorOptions.mockReset().mockResolvedValue([
    { id: 10, name: 'Acme' },
    { id: 20, name: 'Globex' },
  ])
})

afterEach(() => {
  vi.restoreAllMocks()
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

  it('shows an unconfirmed member a focusable, unavailable sponsor control that says why', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [{ ...ben, role: 'supporter' }], hasNext: false })
    await renderPage()
    expect(screen.queryByRole('combobox', { name: 'Sponsor listing for Ben' })).toBeNull()
    const button = screen.getByRole('button', { name: 'Make sponsor for Ben' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('type', 'button')
    expect(button.closest('form')).toBeNull()
    expect(button).toHaveAccessibleDescription('Available once this member confirms their email.')
    expect(screen.getByText('Available once this member confirms their email.')).toBeVisible()

    await userEvent.tab()
    while (document.activeElement !== button && document.activeElement !== document.body) await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(mocks.linkMemberToSponsor).not.toHaveBeenCalled()
  })

  it('labels the unavailable control Change listing for an unconfirmed sponsor', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [ben], hasNext: false })
    await renderPage()
    expect(screen.getByRole('button', { name: 'Change listing for Ben' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('lets an admin change or remove a sponsor’s listing', async () => {
    mocks.listMembers.mockResolvedValue({ rows: [cleo], hasNext: false })
    await renderPage()
    expect(screen.getByRole('combobox', { name: 'Sponsor listing for Cleo' })).toHaveValue('20')
    expect(screen.getByRole('button', { name: 'Change listing for Cleo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove sponsor access for Cleo' })).toBeInTheDocument()
  })

  it('points to the Sponsors page when there are no listings yet', async () => {
    mocks.listSponsorOptions.mockResolvedValue([])
    mocks.listMembers.mockResolvedValue({ rows: [ana], hasNext: false })
    await renderPage()
    expect(screen.queryByRole('combobox')).toBeNull()
    const button = screen.getByRole('button', { name: 'Make sponsor for Ana <b>Lopez</b>' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Add a sponsor listing on the Sponsors page first.')
    expect(screen.getByRole('link', { name: 'Sponsors page' })).toHaveAttribute('href', '/admin/sponsors')
  })

  it('gives both reasons when the member is unconfirmed and there are no listings', async () => {
    mocks.listSponsorOptions.mockResolvedValue([])
    mocks.listMembers.mockResolvedValue({ rows: [{ ...ben, role: 'supporter' }], hasNext: false })
    await renderPage()
    expect(screen.getByRole('button', { name: 'Make sponsor for Ben' })).toHaveAccessibleDescription(
      'Available once this member confirms their email. Add a sponsor listing on the Sponsors page first.',
    )
  })

  it('warns exactly what deleting a member removes and what stays', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mocks.listMembers.mockResolvedValue({ rows: [ana], hasNext: false })
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Ana <b>Lopez</b>' }))
    expect(confirm).toHaveBeenCalledWith(
      'Delete Ana <b>Lopez</b>? This removes their account, sign-in and password reset links, newsletter choices, records of the newsletters sent to them and of their unsubscribes, their event RSVPs (they come off attendee lists), and any sponsor portal access. Sponsor listings, receipts and edit history stay, and the edit history keeps their name. This can\'t be undone.',
    )
    expect(mocks.deleteMember).not.toHaveBeenCalled()
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
