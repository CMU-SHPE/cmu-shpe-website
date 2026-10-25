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
  it('offers sign in and joining to visitors', async () => {
    render(await Footer({ editable: false }))
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('link', { name: 'Admin sign in' })).toBeNull()
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })

  it('hides sign in and join once an admin is signed in', async () => {
    render(await Footer({ editable: true }))
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Join' })).toBeNull()
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })

  it.each([[false], [true]])('always links the privacy policy and terms (editable: %s)', async (editable) => {
    render(await Footer({ editable }))
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})
