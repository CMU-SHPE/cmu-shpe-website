import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), confirmEmailChangeFromLink: vi.fn() }))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('./actions', () => ({ confirmEmailChangeFromLink: mocks.confirmEmailChangeFromLink }))

import ConfirmEmailChangePage from './page'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-01234'

function page(params: Record<string, string>) {
  return ConfirmEmailChangePage({ searchParams: Promise.resolve(params) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmEmailChangePage', () => {
  it('only shows a button on GET, so a mail scanner opening the link changes nothing', async () => {
    render(await page({ token: TOKEN }))
    expect(screen.getByRole('heading', { level: 1, name: 'Confirm your new email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm my new email' })).toBeInTheDocument()
    expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.confirmEmailChangeFromLink).not.toHaveBeenCalled()
  })

  it.each<Record<string, string>>([{ token: 'nope' }, { token: TOKEN, invalid: '1' }, {}])('explains a link that does not work (%o)', async (params) => {
    render(await page(params))
    expect(screen.getByRole('heading', { level: 1, name: "This link doesn't work" })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("Your email address hasn't changed.")
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
