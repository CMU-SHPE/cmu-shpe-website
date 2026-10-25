import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
  it('only shows a confirm button for a link, never touching the database on GET', async () => {
    render(await page({ token: TOKEN }))
    expect(screen.getByRole('button', { name: 'Confirm my email' })).toBeInTheDocument()
    expect(document.querySelector('input[name="token"]')).toHaveValue(TOKEN)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.confirmMemberEmail).not.toHaveBeenCalled()
  })

  it.each([{}, { token: 'too-short' }, { token: TOKEN, invalid: '1' }])(
    'explains a broken link and offers a new one for %o',
    async (params) => {
      render(await page(params))
      expect(screen.getByRole('alert')).toHaveTextContent('expired, was already used')
      expect(screen.getByRole('link', { name: 'Send me a new confirmation link' })).toHaveAttribute('href', '/join/resend')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )
})
