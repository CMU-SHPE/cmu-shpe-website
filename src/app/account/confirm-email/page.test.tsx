import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ findEmailChange: vi.fn(), confirmEmailChangeFromLink: vi.fn() }))

vi.mock('@/lib/member-email-change', () => ({ findEmailChange: mocks.findEmailChange }))
vi.mock('./actions', () => ({ confirmEmailChangeFromLink: mocks.confirmEmailChangeFromLink }))

import ConfirmEmailChangePage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

function page(params: Record<string, string>) {
  return ConfirmEmailChangePage({ searchParams: Promise.resolve(params) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findEmailChange.mockResolvedValue({
    newEmail: 'nina@new.example',
    currentEmail: 'mia@example.com',
    passwordHash: '$2b$12$stored',
  })
})

describe('ConfirmEmailChangePage', () => {
  it('names the new address and asks for the password on GET, without using the link', async () => {
    render(await page({ token: TOKEN }))
    expect(screen.getByRole('heading', { level: 1, name: 'Confirm your new email' })).toBeInTheDocument()
    expect(screen.getByText('nina@new.example')).toBeInTheDocument()
    expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument()
    expect(screen.getByText(/If you didn't ask for this, close this page/)).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Confirm my new email' })).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.confirmEmailChangeFromLink).not.toHaveBeenCalled()
  })

  it('never shows the account’s own email or password hash', async () => {
    render(await page({ token: TOKEN }))
    expect(document.documentElement.innerHTML).not.toContain('mia@example.com')
    expect(document.documentElement.innerHTML).not.toContain('$2b$12$stored')
  })

  it.each<[string, Record<string, string>, unknown]>([
    ['a used or expired token', { token: TOKEN }, null],
    ['an ?invalid=1 redirect', { token: TOKEN, invalid: '1' }, undefined],
    ['no token', {}, undefined],
  ])('explains %s without claiming what happened to the email', async (_case, params, found) => {
    if (found === null) mocks.findEmailChange.mockResolvedValue(null)
    render(await page(params))
    expect(screen.getByRole('heading', { level: 1, name: "This link doesn't work" })).toBeInTheDocument()
    expect(screen.getByRole('alert')).not.toHaveTextContent(/hasn't changed|has changed/)
    expect(screen.getByRole('link', { name: 'Go to your account' })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('explains an address taken by another account without saying which kind', async () => {
    render(await page({ 'in-use': '1' }))
    expect(screen.getByRole('heading', { level: 1, name: "This email address can't be used" })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('That address already belongs to another account')
    expect(screen.getByRole('alert')).not.toHaveTextContent(/admin/i)
  })
})
