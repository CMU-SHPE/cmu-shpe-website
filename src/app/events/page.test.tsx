import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { EventWithSlots } from '@/lib/queries'

const mocks = vi.hoisted(() => ({
  currentAdmin: vi.fn(),
  currentMember: vi.fn(),
  getRsvpStates: vi.fn(),
  rsvpCounts: vi.fn(),
  events: [] as EventWithSlots[],
}))

vi.mock('@/lib/admin', () => ({ currentAdmin: mocks.currentAdmin }))
vi.mock('@/lib/member', () => ({ currentMember: mocks.currentMember }))
vi.mock('@/lib/rsvp', () => ({ getRsvpStates: mocks.getRsvpStates, rsvpCounts: mocks.rsvpCounts }))
vi.mock('@/lib/queries', () => ({
  getEvents: async () => mocks.events,
  getSiteContent: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, key])),
  getSiteSettings: async () => null,
}))
vi.mock('@/components/editable', () => ({
  default: ({ as: Tag, value }: { as: 'h2'; value: string }) => <Tag>{value}</Tag>,
}))
vi.mock('@/components/rsvp/rsvp-button', () => ({
  default: ({ eventId, state }: { eventId: number; state: string }) => (
    <p>
      RSVP button {eventId} {state}
    </p>
  ),
}))

import Events from './page'

function event(id: number, overrides: Partial<EventWithSlots> = {}): EventWithSlots {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    location: 'Room 1',
    type: 'Meeting',
    date: '2099-01-01',
    endDate: null,
    time: null,
    capacity: null,
    createdAt: new Date(),
    slots: [],
    ...overrides,
  }
}

function card(title: string) {
  return within(screen.getByRole('heading', { name: title }).parentElement as HTMLElement)
}

beforeEach(() => {
  mocks.currentAdmin.mockReset().mockResolvedValue(null)
  mocks.currentMember.mockReset().mockResolvedValue(null)
  mocks.getRsvpStates.mockReset().mockResolvedValue(new Map())
  mocks.rsvpCounts.mockReset().mockResolvedValue(new Map([[2, 3], [3, 5]]))
  mocks.events = [
    event(1),
    event(2, { capacity: 10 }),
    event(3, { capacity: 5 }),
    event(4, { date: '2000-01-01', capacity: 5 }),
  ]
})

describe('events page RSVPs', () => {
  it('shows visitors spots left and a sign-in link, but no link for a full or past event', async () => {
    render(await Events())

    expect(card('Event 1').getByRole('link', { name: 'Sign in to RSVP to Event 1' })).toHaveAttribute('href', '/login')
    expect(card('Event 2').getByText('7 spots left')).toBeInTheDocument()
    expect(card('Event 3').getByText('Full')).toBeInTheDocument()
    expect(card('Event 3').queryByRole('link')).not.toBeInTheDocument()
    expect(card('Event 4').queryByRole('link')).not.toBeInTheDocument()
    expect(card('Event 4').queryByText(/spots? left|Full/)).not.toBeInTheDocument()
    expect(mocks.getRsvpStates).not.toHaveBeenCalled()
    expect(mocks.rsvpCounts).toHaveBeenCalledWith([2, 3])
  })

  it('gives a signed-in member an RSVP button per upcoming event with their state', async () => {
    mocks.currentMember.mockResolvedValue({ user: { id: '7', kind: 'member' } })
    mocks.getRsvpStates.mockResolvedValue(new Map([[1, 'going'], [2, 'open'], [3, 'full']]))
    render(await Events())

    expect(mocks.getRsvpStates).toHaveBeenCalledWith(7, [1, 2, 3])
    expect(card('Event 1').getByText('RSVP button 1 going')).toBeInTheDocument()
    expect(card('Event 2').getByText('RSVP button 2 open')).toBeInTheDocument()
    expect(card('Event 3').getByText('RSVP button 3 full')).toBeInTheDocument()
    expect(card('Event 3').queryByText('Full')).not.toBeInTheDocument()
    expect(card('Event 4').queryByText(/RSVP button/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Sign in to RSVP/ })).not.toBeInTheDocument()
  })

  it('shows an admin spots left but no RSVP controls', async () => {
    mocks.currentAdmin.mockResolvedValue({ user: { id: '1', kind: 'admin' } })
    render(await Events())

    expect(card('Event 2').getByText('7 spots left')).toBeInTheDocument()
    expect(screen.queryByText(/RSVP button/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Sign in to RSVP/ })).not.toBeInTheDocument()
  })
})
