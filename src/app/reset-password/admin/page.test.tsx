import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resetAdminPasswordWithLink: vi.fn() }))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('./actions', () => ({ resetAdminPasswordWithLink: mocks.resetAdminPasswordWithLink }))

import ResetAdminPasswordPage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetAdminPasswordPage', () => {
  it('shows the same new-password form as members, never touching the database on GET', async () => {
    render(await ResetAdminPasswordPage({ searchParams: Promise.resolve({ token: TOKEN }) }))
    expect(screen.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/At least 12 characters/)
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.resetAdminPasswordWithLink).not.toHaveBeenCalled()
  })

  it('explains a malformed link and offers a new one from the shared page', async () => {
    render(await ResetAdminPasswordPage({ searchParams: Promise.resolve({ token: 'nope' }) }))
    expect(screen.getByRole('alert')).toHaveTextContent('expired, was already used')
    expect(screen.getByRole('link', { name: 'Send me a new reset link' })).toHaveAttribute('href', '/forgot-password')
  })
})
