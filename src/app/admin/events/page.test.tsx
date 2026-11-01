import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
