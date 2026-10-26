import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { contentDefaults } from '@/db/seed-data/content'

const mocks = vi.hoisted(() => ({
  admin: null as unknown,
  settings: { contactEmail: 'shpe@example.edu' } as { contactEmail: string } | null,
  overrides: {} as Record<string, string>,
}))

vi.mock('@/lib/queries', async () => {
  const { contentDefaults: defaults } = await import('@/db/seed-data/content')
  return {
    getSiteContentWithDefaults: async (keys: (keyof typeof defaults)[]) =>
      Object.fromEntries(keys.map((key) => [key, mocks.overrides[key] ?? defaults[key]])),
    getSiteSettings: async () => mocks.settings,
  }
})
vi.mock('@/lib/admin', () => ({ currentAdmin: async () => mocks.admin }))
vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }))

import Privacy from './page'

beforeEach(() => {
  mocks.admin = null
  mocks.settings = { contactEmail: 'shpe@example.edu' }
  mocks.overrides = {}
})

describe('Privacy page', () => {
  it('renders one h1 and a heading for every section', async () => {
    render(await Privacy())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'What we collect',
      'Why we collect it',
      'Who helps us handle it',
      'Cookies',
      'How long we keep it',
      'Your choices',
      'Children',
      'Changes to this policy',
      'Contact us',
    ])
  })

  it('shows the effective date', async () => {
    render(await Privacy())
    expect(screen.getByText(contentDefaults['privacy.updated'])).toBeInTheDocument()
    expect(screen.getByText('Last updated:')).toBeInTheDocument()
  })

  it('hides the date line when an admin blanked it', async () => {
    mocks.overrides = { 'privacy.updated': '' }
    render(await Privacy())
    expect(screen.queryByText('Last updated:')).toBeNull()
  })

  it('lists each processor and the retention rules as list items', async () => {
    render(await Privacy())
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    for (const processor of ['Vercel', 'Neon', 'Resend', 'Formspree']) {
      expect(items.some((item) => item?.startsWith(processor)), processor).toBe(true)
    }
    expect(items.some((item) => item?.includes('kept for 7 days'))).toBe(true)
  })

  it('links the contact email from site settings', async () => {
    render(await Privacy())
    expect(screen.getByRole('link', { name: 'shpe@example.edu' })).toHaveAttribute(
      'href',
      'mailto:shpe@example.edu',
    )
    expect(screen.getByRole('link', { name: 'Go to your account' })).toHaveAttribute('href', '/account')
  })

  it('points to the contact page when there are no site settings', async () => {
    mocks.settings = null
    render(await Privacy())
    expect(screen.getByRole('link', { name: 'contact page' })).toHaveAttribute('href', '/contact')
  })

  it('makes every section editable for admins', async () => {
    mocks.admin = { user: { id: '1' } }
    render(await Privacy())
    expect(screen.getByRole('textbox', { name: /Privacy: page title/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Privacy: last updated date/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Privacy: service providers, one per line/ })).toBeInTheDocument()
  })
})
