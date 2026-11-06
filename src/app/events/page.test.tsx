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
    seriesId: null,
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

describe('events page weekly series', () => {
  it('shows only the next week of a series in Upcoming, labelled with its repeat, and past weeks in Past', async () => {
    mocks.events = [
      event(10, { title: 'Chapter meeting', date: '2000-01-06', seriesId: 'thursdays' }),
      event(11, { title: 'Chapter meeting', date: '2099-01-01', seriesId: 'thursdays' }),
      event(12, { title: 'Chapter meeting', date: '2099-01-08', seriesId: 'thursdays' }),
      event(13, { title: 'Mixer', date: '2099-01-02' }),
    ]
    mocks.currentMember.mockResolvedValue({ user: { id: '7', kind: 'member' } })
    render(await Events())

    const meetings = screen.getAllByRole('heading', { name: 'Chapter meeting' })
    expect(meetings).toHaveLength(2)
    const [next, past] = meetings.map((heading) => within(heading.parentElement as HTMLElement))
    expect(next.getByText('Every Thursday')).toBeInTheDocument()
    expect(next.getByText('January 1, 2099')).toBeInTheDocument()
    expect(next.getByText('RSVP button 11 open')).toBeInTheDocument()
    expect(past.getByText('January 6, 2000')).toBeInTheDocument()
    expect(past.queryByText(/^Every /)).not.toBeInTheDocument()
    expect(card('Mixer').queryByText(/^Every /)).not.toBeInTheDocument()
    expect(mocks.getRsvpStates).toHaveBeenCalledWith(7, [11, 13])
  })
})
