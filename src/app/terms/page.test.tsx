import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { contentDefaults } from '@/db/seed-data/content'

const mocks = vi.hoisted(() => ({
  admin: null as unknown,
  settings: { contactEmail: 'shpe@example.edu' } as { contactEmail: string } | null,
}))

vi.mock('@/lib/queries', async () => {
  const { contentDefaults: defaults } = await import('@/db/seed-data/content')
  return {
    getSiteContentWithDefaults: async (keys: (keyof typeof defaults)[]) =>
      Object.fromEntries(keys.map((key) => [key, defaults[key]])),
    getSiteSettings: async () => mocks.settings,
  }
})
vi.mock('@/lib/admin', () => ({ currentAdmin: async () => mocks.admin }))
vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }))

import Terms from './page'

beforeEach(() => {
  mocks.admin = null
  mocks.settings = { contactEmail: 'shpe@example.edu' }
})

describe('Terms page', () => {
  it('renders the title, effective date and section headings', async () => {
    render(await Terms())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument()
    expect(screen.getByText(contentDefaults['terms.updated'])).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your account',
      'Acceptable use',
      'Ending your account',
      'No warranty',
      'Changes to these terms',
      'Contact us',
    ])
  })

  it('links the contact email and the privacy policy', async () => {
    render(await Terms())
    expect(screen.getByRole('link', { name: 'shpe@example.edu' })).toHaveAttribute(
      'href',
      'mailto:shpe@example.edu',
    )
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  })

  it('points to the contact page when there are no site settings', async () => {
    mocks.settings = null
    render(await Terms())
    expect(screen.getByRole('link', { name: 'contact page' })).toHaveAttribute('href', '/contact')
  })

  it('makes the text editable for admins', async () => {
    mocks.admin = { user: { id: '1' } }
    render(await Terms())
    expect(screen.getByRole('textbox', { name: /Terms: page title/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Terms: things not allowed/ })).toBeInTheDocument()
  })
})
