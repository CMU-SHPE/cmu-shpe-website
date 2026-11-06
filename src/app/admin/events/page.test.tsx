import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { EventWithSlots } from '@/lib/queries'

const mocks = vi.hoisted(() => ({ events: [] as EventWithSlots[], counts: new Map<number, number>() }))

vi.mock('@/lib/admin', () => ({ requireAdmin: async () => ({}) }))
vi.mock('@/lib/queries', () => ({ getEvents: async () => mocks.events }))
vi.mock('@/lib/rsvp', () => ({ rsvpCounts: async () => mocks.counts }))
vi.mock('./actions', () => ({ createEvent: vi.fn(), deleteEvent: vi.fn(), updateEvent: vi.fn() }))

import AdminEventsPage from './page'

function event(id: number, title: string): EventWithSlots {
  return {
    id,
    title,
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
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminEventsPage delete confirmation', () => {
  it.each([
    ['Empty', 1, 0, "Delete Empty? It has no RSVPs to remove. This can't be undone."],
    ['Single', 2, 1, "Delete Single? This also removes its 1 RSVP. This can't be undone."],
    ['Busy', 3, 12, "Delete Busy? This also removes its 12 RSVPs. This can't be undone."],
  ])('states what deleting %s removes', async (title, id, going, message) => {
    mocks.events = [event(id, title)]
    mocks.counts = going === 0 ? new Map() : new Map([[id, going]])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(await AdminEventsPage({ searchParams: Promise.resolve({}) }))
    fireEvent.click(screen.getByRole('button', { name: `Delete ${title}` }))

    expect(confirm).toHaveBeenCalledWith(message)
  })
})

describe('AdminEventsPage series', () => {
  const series = (id: number, date: string, seriesId = 'thursdays') => ({ ...event(id, 'Chapter meeting'), date, seriesId })

  it('labels each week with its place in the series and leaves one-off events unlabelled', async () => {
    mocks.events = [series(1, '2099-01-01'), series(2, '2099-01-08'), series(3, '2099-01-15'), event(4, 'Mixer')]
    mocks.counts = new Map()
    render(await AdminEventsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('Weekly · 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Weekly · 3 of 3')).toBeInTheDocument()
    expect(screen.queryByText(/Weekly · \d of 4/)).not.toBeInTheDocument()
  })

  it('warns about every RSVP a this-and-later delete removes, leaving out past weeks', async () => {
    mocks.events = [series(1, '2000-01-06'), series(2, '2099-01-01'), series(3, '2099-01-08'), series(4, '2099-01-15')]
    mocks.counts = new Map([
      [1, 50],
      [2, 3],
      [3, 1],
      [4, 2],
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(await AdminEventsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('link', { name: 'Attendees for Chapter meeting on January 1, 2099' })).toBeInTheDocument()
    const deleteFirst = () => screen.getByRole('button', { name: 'Delete Chapter meeting on January 1, 2099' })
    const first = within(deleteFirst().closest('form') as HTMLElement).getByRole('group', { name: 'Delete which events?' })
    expect(within(first).queryByText(/Chapter meeting/)).not.toBeInTheDocument()
    fireEvent.click(within(first).getByLabelText('This and later events in the series'))
    fireEvent.click(deleteFirst())
    expect(confirm).toHaveBeenLastCalledWith(
      "Delete Chapter meeting on January 1, 2099? This deletes this event and the 2 later events in the series. This also removes their 6 RSVPs. This can't be undone.",
    )

    fireEvent.click(within(first).getByLabelText('This event'))
    fireEvent.click(deleteFirst())
    expect(confirm).toHaveBeenLastCalledWith(
      "Delete Chapter meeting on January 1, 2099? This also removes its 3 RSVPs. This can't be undone.",
    )
  })

  it('offers no series choice on the last week or on a past week', async () => {
    mocks.events = [series(1, '2000-01-06'), series(2, '2099-01-01')]
    mocks.counts = new Map()
    render(await AdminEventsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.queryByRole('group', { name: 'Delete which events?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Apply changes to' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Chapter meeting on January 6, 2000' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Chapter meeting on January 1, 2099' })).toBeInTheDocument()
  })
})
