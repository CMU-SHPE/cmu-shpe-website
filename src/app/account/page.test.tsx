import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  topics: [] as { id: number; name: string; description: string }[],
  subscribed: [] as number[],
}))

vi.mock('@/lib/member', () => ({ requireMember: mocks.requireMember }))
vi.mock('@/lib/newsletter-topics', () => ({ getNewsletterTopics: async () => mocks.topics }))
vi.mock('@/lib/member-account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-account')>()),
  getMemberTopicIds: async () => mocks.subscribed,
}))
vi.mock('@/components/rsvp/my-rsvps', () => ({
  default: ({ memberId }: { memberId: number }) => <p>My RSVPs for member {memberId}</p>,
}))
vi.mock('./actions', () => ({
  updateName: vi.fn(),
  changePassword: vi.fn(),
  saveTopics: vi.fn(),
  deleteAccount: vi.fn(),
}))

import AccountPage from './page'

async function renderPage(searchParams: { saved?: string; error?: string } = {}) {
  render(await AccountPage({ searchParams: Promise.resolve(searchParams) }))
}

beforeEach(() => {
  mocks.requireMember.mockReset().mockResolvedValue({
    user: { id: '7', name: 'Mia', email: 'mia@example.com', kind: 'member' },
  })
  mocks.topics = [
    { id: 1, name: 'Events', description: 'Meetups and socials' },
    { id: 2, name: 'Jobs', description: '' },
  ]
  mocks.subscribed = [2]
})

describe('AccountPage', () => {
  it('links a sponsor to the sponsor portal', async () => {
    mocks.requireMember.mockResolvedValue({
      user: { id: '7', name: 'Mia', email: 'mia@example.com', kind: 'member', role: 'sponsor' },
    })
    await renderPage()
    expect(screen.getByRole('link', { name: 'Sponsor portal' })).toHaveAttribute('href', '/sponsor')
  })

  it('shows no sponsor portal link to a supporter', async () => {
    mocks.requireMember.mockResolvedValue({
      user: { id: '7', name: 'Mia', email: 'mia@example.com', kind: 'member', role: 'supporter' },
    })
    await renderPage()
    expect(screen.queryByRole('link', { name: 'Sponsor portal' })).toBeNull()
  })

  it('requires a member before rendering anything', async () => {
    mocks.requireMember.mockRejectedValue(new Error('REDIRECT /login'))
    await expect(AccountPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT /login')
  })

  it('shows the account sections under one h1', async () => {
    await renderPage()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Your account'])
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your name',
      'Newsletters',
      'Change password',
      'Delete my account',
    ])
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Mia')
  })

  it('shows the signed-in member’s RSVPs', async () => {
    await renderPage()
    expect(screen.getByText('My RSVPs for member 7')).toBeInTheDocument()
  })

  it('lists every topic as a labelled checkbox reflecting current choices', async () => {
    await renderPage()
    const group = screen.getByRole('group', { name: 'Email me about' })
    const events = within(group).getByRole('checkbox', { name: 'Events' })
    expect(events).not.toBeChecked()
    expect(events).toHaveAccessibleDescription('Meetups and socials')
    expect(within(group).getByRole('checkbox', { name: 'Jobs' })).toBeChecked()
  })

  it('starts a new member with every topic unchecked', async () => {
    mocks.subscribed = []
    await renderPage()
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked()
  })

  it('explains when there are no topics', async () => {
    mocks.topics = []
    await renderPage()
    expect(screen.getByText('There are no newsletters to choose from yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save newsletter choices' })).toBeNull()
  })

  it('requires the password and the word DELETE to delete the account', async () => {
    await renderPage()
    const button = screen.getByRole('button', { name: 'Delete my account' })
    const form = button.closest('form')!
    expect(within(form).getByLabelText('Your password')).toBeRequired()
    expect(within(form).getByRole('textbox', { name: 'Type DELETE to confirm' })).toBeRequired()
  })

  it('moves focus to a saved message without also making it a live region', async () => {
    await renderPage({ saved: 'topics' })
    const banner = document.getElementById('account-status')
    expect(banner).toHaveTextContent('Your newsletter choices were saved.')
    expect(document.activeElement).toBe(banner)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('marks the field an error is about and links it to the message', async () => {
    await renderPage({ error: 'password-current' })
    expect(document.getElementById('account-status')).toHaveTextContent('Your current password is incorrect.')
    expect(screen.queryByRole('alert')).toBeNull()
    const current = screen.getByLabelText('Current password')
    expect(current).toHaveAttribute('aria-invalid', 'true')
    expect(current).toHaveAccessibleDescription('Your current password is incorrect.')
    expect(screen.getByLabelText('Your password')).not.toHaveAttribute('aria-invalid')
    expect(document.activeElement).toBe(document.getElementById('account-status'))
  })

  it('states the shared password rule without a character cap, since the limit is in bytes', async () => {
    await renderPage({ error: 'password-password' })
    const newPassword = screen.getByLabelText('New password')
    expect(newPassword).not.toHaveAttribute('maxlength')
    expect(screen.getByLabelText('Confirm new password')).not.toHaveAttribute('maxlength')
    expect(newPassword).toHaveAttribute('aria-invalid', 'true')
    expect(newPassword).toHaveAccessibleDescription(/^Choose a password with at least 12 characters.*At least 12 characters/)
  })

  it('marks the delete confirmation when the word was wrong', async () => {
    await renderPage({ error: 'delete-confirm' })
    expect(screen.getByRole('textbox', { name: 'Type DELETE to confirm' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows no banner for an unknown saved value', async () => {
    await renderPage({ saved: 'whatever' })
    expect(document.getElementById('account-status')).toBeNull()
  })
})
