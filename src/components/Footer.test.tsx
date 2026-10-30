import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const queries = vi.hoisted(() => ({ settings: null as Record<string, unknown> | null }))
vi.mock('@/lib/queries', () => ({
  getSiteContent: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, key])),
  getSiteSettings: async () => queries.settings,
}))
vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }))

import Footer from './Footer'

afterEach(() => {
  queries.settings = null
})

describe('Footer', () => {
  it('shows the social links from site settings, each opening in a new tab', async () => {
    queries.settings = {
      contactEmail: 'shpe@example.org',
      meetingDay: 'Mon',
      meetingTime: '6pm',
      meetingLocation: 'Room 1',
      instagramUrl: 'https://instagram.example/shpe',
      linkedinUrl: null,
      xUrl: null,
      youtubeUrl: null,
      tiktokUrl: null,
      mavlifeUrl: 'https://mavlife.example/shpe',
    }
    render(await Footer({ editable: false, signedIn: false }))
    for (const [name, href] of [
      ['Instagram', 'https://instagram.example/shpe'],
      ['MavLife', 'https://mavlife.example/shpe'],
    ]) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).toBeNull()
  })

  it('colours the SHPE wordmark with the tint that passes contrast on maroon', async () => {
    render(await Footer({ editable: false, signedIn: false }))
    const wordmark = screen.getByText('SHPE')
    expect(wordmark).toHaveClass('text-shpe-red-on-maroon')
    expect(wordmark).not.toHaveClass('text-shpe-red')
  })

  it('offers sign in and joining to visitors', async () => {
    render(await Footer({ editable: false, signedIn: false }))
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('link', { name: 'Admin sign in' })).toBeNull()
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })

  it('hides sign in and join once an admin is signed in', async () => {
    render(await Footer({ editable: true, signedIn: true }))
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Join' })).toBeNull()
    expect(screen.getByRole('link', { name: 'SHPE National →' })).toBeInTheDocument()
  })

  it('hides sign in and join from a signed-in member without making the footer editable', async () => {
    render(await Footer({ editable: false, signedIn: true }))
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Join' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('footer.copyright')).toBeInTheDocument()
  })

  it.each([
    [false, false],
    [false, true],
    [true, true],
  ])('always links the privacy policy and terms (editable: %s, signed in: %s)', async (editable, signedIn) => {
    render(await Footer({ editable, signedIn }))
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})
