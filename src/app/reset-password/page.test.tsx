import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resetMemberPassword: vi.fn() }))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('./actions', () => ({ resetMemberPassword: mocks.resetMemberPassword }))

import ResetPasswordPage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetPasswordPage', () => {
  it('shows the new-password form with the token, never touching the database on GET', async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ token: TOKEN }) }))
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/At least 12 characters/)
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password')
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.resetMemberPassword).not.toHaveBeenCalled()
  })

  it('explains a malformed link and offers a new one', async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ token: 'nope' }) }))
    expect(screen.getByRole('alert')).toHaveTextContent('expired, was already used')
    expect(screen.getByRole('link', { name: 'Send me a new reset link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})
