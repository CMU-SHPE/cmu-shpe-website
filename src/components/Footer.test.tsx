import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/queries', () => ({
  getSiteContent: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, key])),
  getSiteSettings: async () => null,
}))
vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }))

import Footer from './Footer'

describe('Footer', () => {
  it('offers admin sign in to visitors', async () => {
    render(await Footer({ editable: false }))
    expect(screen.getByRole('link', { name: 'Admin sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })

  it('hides admin sign in once an admin is signed in', async () => {
    render(await Footer({ editable: true }))
    expect(screen.queryByRole('link', { name: 'Admin sign in' })).toBeNull()
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })
})
