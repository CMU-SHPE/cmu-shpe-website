import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { Sponsor } from '@/db/schema'
import { contentDefaults } from '@/db/seed-data/content'

const mocks = vi.hoisted(() => ({
  currentAdmin: vi.fn(),
  currentMember: vi.fn(),
  findOwnListing: vi.fn(),
  events: [] as {
    id: number
    title: string
    date: string
    time: string | null
    location: string
    capacity: number | null
  }[],
  states: new Map<number, 'going' | 'open' | 'full'>(),
  counts: new Map<number, number>(),
  getRsvpStates: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({ currentAdmin: mocks.currentAdmin }))
vi.mock('@/lib/member', () => ({ currentMember: mocks.currentMember }))
vi.mock('@/lib/sponsor-portal-listing', () => ({ findOwnListing: mocks.findOwnListing }))
vi.mock('@/lib/queries', async () => {
  const { contentDefaults: defaults } = await import('@/db/seed-data/content')
  return {
    getSiteContentWithDefaults: async (keys: (keyof typeof defaults)[]) =>
      Object.fromEntries(keys.map((key) => [key, defaults[key]])),
    getEvents: async () => mocks.events,
  }
})
vi.mock('@/lib/rsvp', () => ({
  getRsvpStates: mocks.getRsvpStates,
  rsvpCounts: async () => mocks.counts,
}))
vi.mock('@/app/events/actions', () => ({ rsvpToEvent: vi.fn(), cancelEventRsvp: vi.fn() }))
vi.mock('@/components/rsvp/my-rsvps', () => ({
  default: ({ memberId }: { memberId: number }) => (
    <section aria-label="My RSVPs component">
      <h2>My RSVPs</h2>
      member {memberId}
    </section>
  ),
}))
vi.mock('@/components/sponsor/receipts-list', () => ({
  default: ({ memberId }: { memberId: number }) => (
    <section aria-label="Receipts component">
      <h2>Receipts</h2>
      member {memberId}
    </section>
  ),
}))
vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('./actions', () => ({ updateListing: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
  useRouter: () => ({ refresh() {} }),
  unstable_rethrow() {},
}))

import SponsorPortalPage, { metadata } from './page'

const listing: Sponsor = {
  id: 3,
  name: 'Acme',
  tier: 'Gold',
  website: 'https://acme.example',
  description: 'We build things.',
  logoUrl: null,
  logoOriginalUrl: null,
  logoCrop: null,
  bgColor: '#ffffff',
  sortOrder: 0,
}

const sam = { user: { id: '7', name: 'Sam', email: 'sam@acme.example', kind: 'member', role: 'sponsor' } }

function page(searchParams: { saved?: string; error?: string } = {}) {
  return SponsorPortalPage({ searchParams: Promise.resolve(searchParams) })
}

beforeEach(() => {
  mocks.currentAdmin.mockReset().mockResolvedValue(null)
  mocks.currentMember.mockReset().mockResolvedValue(sam)
  mocks.findOwnListing.mockReset().mockResolvedValue(listing)
  mocks.events = [
    { id: 1, title: 'Career Night', date: '2099-03-04', time: '6:00 PM', location: 'Student Center 221', capacity: null },
    { id: 2, title: 'Old Meetup', date: '2000-01-01', time: null, location: 'Library', capacity: null },
  ]
  mocks.states = new Map()
  mocks.counts = new Map()
  mocks.getRsvpStates.mockReset().mockImplementation(async () => mocks.states)
})

describe('SponsorPortalPage access', () => {
  it('sends a signed-out visitor to /login', async () => {
    mocks.currentMember.mockResolvedValue(null)
    await expect(page()).rejects.toThrow('REDIRECT /login')
    expect(mocks.findOwnListing).not.toHaveBeenCalled()
  })

  it('sends a supporter to /account', async () => {
    mocks.currentMember.mockResolvedValue({ user: { ...sam.user, role: 'supporter' } })
    mocks.findOwnListing.mockResolvedValue(null)
    await expect(page()).rejects.toThrow('REDIRECT /account')
  })

  it('sends a sponsor whose listing is missing to /account', async () => {
    mocks.findOwnListing.mockResolvedValue(null)
    await expect(page()).rejects.toThrow('REDIRECT /account')
    expect(mocks.findOwnListing).toHaveBeenCalledWith(7)
  })

  it('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.title).toBe('Sponsor portal | SHPE @ Colorado Mesa University')
  })
})

describe('SponsorPortalPage for a sponsor', () => {
  it('shows the sections in order under one h1', async () => {
    render(await page())
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      contentDefaults['sponsor.header.heading'],
    ])
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your listing',
      'Upcoming events',
      'My RSVPs',
      'Receipts',
    ])
    expect(screen.getByText(contentDefaults['sponsor.header.intro'])).toBeInTheDocument()
  })

  it('fills the listing form from the sponsor’s own listing', async () => {
    render(await page())
    const section = screen.getByRole('region', { name: 'Your listing' })
    expect(within(section).getByRole('textbox', { name: 'Name' })).toHaveValue('Acme')
    expect(within(section).getByRole('textbox', { name: 'Website (optional)' })).toHaveValue('https://acme.example')
    expect(within(section).getByRole('textbox', { name: 'Description (optional)' })).toHaveValue('We build things.')
    expect(within(section).queryByRole('combobox', { name: /tier/i })).toBeNull()
    expect(within(section).queryByRole('textbox', { name: /logo path/i })).toBeNull()
    expect(within(section).getByRole('button', { name: 'Save listing' })).toBeInTheDocument()
  })

  it('lists only upcoming events', async () => {
    render(await page())
    const section = screen.getByRole('region', { name: 'Upcoming events' })
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Career Night'])
  })

  it('says when there are no upcoming events', async () => {
    mocks.events = []
    render(await page())
    expect(screen.getByText(contentDefaults['sponsor.events.empty'])).toBeInTheDocument()
  })

  it('shows copy as plain text, not editors', async () => {
    render(await page())
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it.each([
    [{ saved: 'listing' }, 'status', 'Your listing was saved.'],
    [{ saved: 'unchanged' }, 'status', 'Nothing changed, so there was nothing to save.'],
    [{ error: 'invalid' }, 'alert', 'Please check the fields'],
    [{ error: 'missing' }, 'alert', 'changed while you were editing'],
  ] as const)('reports %j', async (params, role, text) => {
    render(await page(params))
    expect(screen.getAllByRole(role).filter((element) => element.textContent?.includes(text))).toHaveLength(1)
  })
})

describe('SponsorPortalPage RSVPs and receipts', () => {
  it('passes the sponsor’s own member id to My RSVPs, receipts and the RSVP states', async () => {
    render(await page())
    expect(screen.getByRole('region', { name: 'My RSVPs component' })).toHaveTextContent('member 7')
    expect(screen.getByRole('region', { name: 'Receipts component' })).toHaveTextContent('member 7')
    expect(mocks.getRsvpStates).toHaveBeenCalledWith(7, [1])
  })

  it('offers an RSVP button on each upcoming event', async () => {
    render(await page())
    const event = screen.getByRole('listitem')
    expect(within(event).getByRole('button', { name: 'RSVP' })).toBeInTheDocument()
  })

  it('lets a sponsor who is going cancel', async () => {
    mocks.states = new Map([[1, 'going']])
    render(await page())
    expect(within(screen.getByRole('listitem')).getByRole('button', { name: 'Cancel RSVP' })).toBeInTheDocument()
  })

  it('shows spots left for a capped event, and Full without a button once it fills', async () => {
    mocks.events = [
      { id: 1, title: 'Lab Tour', date: '2099-03-04', time: null, location: 'Lab', capacity: 10 },
      { id: 3, title: 'Dinner', date: '2099-03-05', time: null, location: 'Hall', capacity: 2 },
    ]
    mocks.counts = new Map([
      [1, 9],
      [3, 2],
    ])
    mocks.states = new Map([[3, 'full']])
    render(await page())
    const [tour, dinner] = screen.getAllByRole('listitem')
    expect(within(tour).getByText('1 spot left')).toBeInTheDocument()
    expect(within(tour).getByRole('button', { name: 'RSVP' })).toBeInTheDocument()
    expect(within(dinner).getByText('Full')).toBeInTheDocument()
    expect(within(dinner).queryByRole('button')).toBeNull()
  })
})

describe('SponsorPortalPage for an admin', () => {
  beforeEach(() => {
    mocks.currentAdmin.mockResolvedValue({ user: { id: '1', kind: 'admin' } })
    mocks.currentMember.mockResolvedValue(null)
  })

  it('shows spots left without an RSVP button', async () => {
    mocks.events = [{ id: 1, title: 'Lab Tour', date: '2099-03-04', time: null, location: 'Lab', capacity: 10 }]
    mocks.counts = new Map([[1, 4]])
    render(await page())
    expect(within(screen.getByRole('listitem')).getByText('6 spots left')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RSVP' })).toBeNull()
  })

  it('shows a preview with editable copy and no listing form, without looking up a listing', async () => {
    render(await page())
    expect(screen.getByRole('note')).toHaveTextContent('previewing the sponsor portal as an admin')
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save listing' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'My RSVPs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Receipts' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'My RSVPs component' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Receipts component' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'RSVP' })).toBeNull()
    expect(mocks.getRsvpStates).not.toHaveBeenCalled()
    expect(mocks.currentMember).not.toHaveBeenCalled()
    expect(mocks.findOwnListing).not.toHaveBeenCalled()
  })
})
