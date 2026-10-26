import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), confirmMemberEmail: vi.fn() }))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('./actions', () => ({ confirmMemberEmail: mocks.confirmMemberEmail }))

import ConfirmEmailPage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

function page(params: { token?: string; invalid?: string }) {
  return ConfirmEmailPage({ searchParams: Promise.resolve(params) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmEmailPage', () => {
  it('asks for the sign-up password alongside the token, never touching the database on GET', async () => {
    render(await page({ token: TOKEN }))
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('name', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toBeRequired()
    expect(screen.getByRole('button', { name: 'Confirm my email' })).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.confirmMemberEmail).not.toHaveBeenCalled()
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
