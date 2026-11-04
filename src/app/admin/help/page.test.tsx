import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/db', () => ({
  getDb: () => {
    throw new Error('database touched')
  },
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))

import AdminHelpPage from './page'

beforeEach(() => {
  mocks.auth.mockReset()
})

describe('AdminHelpPage', () => {
  it('sends a signed-out visitor to sign in before reading the guide', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(AdminHelpPage()).rejects.toThrow('REDIRECT /login')
  })

  it('sends a member session to sign in too', async () => {
    mocks.auth.mockResolvedValue({ user: { id: '1', email: 'm@example.com', kind: 'member' }, expires: '' })
    await expect(AdminHelpPage()).rejects.toThrow('REDIRECT /login')
  })
})

describe('AdminHelpPage for an admin', () => {
  it('renders the officer guide with its contents, the private PDF link and the public guides', async () => {
    vi.resetModules()
    vi.doMock('@/lib/admin', () => ({ requireAdmin: async () => ({ user: { id: '1' } }) }))
    const { default: Page } = await import('./page')
    render(await Page())

    expect(screen.getByRole('heading', { level: 1, name: 'Officer guide' })).toBeInTheDocument()
    const contents = screen.getByRole('navigation', { name: 'Contents' })
    expect(within(contents).getByRole('link', { name: 'Newsletters' })).toHaveAttribute('href', '#newsletters')
    expect(screen.getByRole('heading', { level: 2, name: 'Newsletters' })).toHaveAttribute('id', 'newsletters')
    expect(screen.getByRole('link', { name: 'Download the officer handbook (PDF)' })).toHaveAttribute(
      'href',
      '/admin/help/handbook.pdf',
    )
    expect(screen.getByRole('link', { name: 'Member and sponsor guides' })).toHaveAttribute('href', '/help')
    expect(document.body.textContent).not.toContain('event-date-range')
    vi.doUnmock('@/lib/admin')
  })
})
