import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  confirmMemberEmail: vi.fn(),
  findEmail: vi.fn<(token: string, purpose: string) => Promise<string | null>>(),
  consume: vi.fn(),
}))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  findMemberEmailForToken: mocks.findEmail,
  consumeMemberToken: mocks.consume,
}))
vi.mock('./actions', () => ({ confirmMemberEmail: mocks.confirmMemberEmail }))

import ConfirmEmailPage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

function page(params: { token?: string; invalid?: string }) {
  return ConfirmEmailPage({ searchParams: Promise.resolve(params) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findEmail.mockResolvedValue('mia@example.com')
})

describe('ConfirmEmailPage', () => {
  it('asks for the sign-up password alongside the token, never using the link up on GET', async () => {
    render(await page({ token: TOKEN }))
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('name', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toBeRequired()
    expect(screen.getByRole('button', { name: 'Confirm my email' })).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.findEmail).toHaveBeenCalledWith(TOKEN, 'confirm_email')
    expect(mocks.consume).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.confirmMemberEmail).not.toHaveBeenCalled()
  })

  it('gives password managers the account email in a hidden username field that screen readers skip', async () => {
    render(await page({ token: TOKEN }))
    const username = document.querySelector('input[autocomplete="username"]')!
    expect(username).toHaveAttribute('type', 'email')
    expect(username).toHaveAttribute('name', 'username')
    expect(username).toHaveValue('mia@example.com')
    expect(username).toHaveAttribute('readonly')
    expect(username).not.toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(username.compareDocumentPosition(screen.getByLabelText('Password')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the username field after a failed attempt', async () => {
    mocks.confirmMemberEmail.mockResolvedValue({ formError: 'Try again.' })
    render(await page({ token: TOKEN }))
    fireEvent.submit(screen.getByRole('button', { name: 'Confirm my email' }).closest('form')!)
    await screen.findByRole('group', { name: 'There is a problem' })
    expect(document.querySelector('input[autocomplete="username"]')).toHaveValue('mia@example.com')
  })

  it('leaves the username field out when the link no longer matches an account', async () => {
    mocks.findEmail.mockResolvedValue(null)
    render(await page({ token: TOKEN }))
    expect(document.querySelector('input[autocomplete="username"]')).toBeNull()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('moves focus to the error when the password does not match, keeping the token for another try', async () => {
    const mismatch = "That password doesn't match this sign-up."
    mocks.confirmMemberEmail.mockResolvedValue({ formError: mismatch })
    render(await page({ token: TOKEN }))
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not the one' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Confirm my email' }).closest('form')!)

    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    await waitFor(() => expect(summary).toHaveFocus())
    expect(summary).toHaveAccessibleDescription(mismatch)
    expect(mocks.confirmMemberEmail.mock.calls[0][1].get('token')).toBe(TOKEN)
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it.each([{}, { token: 'too-short' }, { token: TOKEN, invalid: '1' }])(
    'explains a broken link and offers a new one for %o',
    async (params) => {
      render(await page(params))
      expect(screen.getByRole('alert')).toHaveTextContent('expired, was already used')
      expect(screen.getByRole('link', { name: 'Send me a new confirmation link' })).toHaveAttribute('href', '/join/resend')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    },
  )
})
