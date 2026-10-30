import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  listMyRsvps: vi.fn(),
  cancelEventRsvp: vi.fn(),
}))
vi.mock('@/lib/rsvp', () => ({ listMyRsvps: mocks.listMyRsvps }))
vi.mock('@/app/events/actions', () => ({ cancelEventRsvp: mocks.cancelEventRsvp, rsvpToEvent: vi.fn() }))

import MyRsvps from './my-rsvps'

beforeEach(() => {
  mocks.listMyRsvps.mockReset().mockResolvedValue([
    { eventId: 3, title: 'Resume Workshop', date: '2099-01-05', time: '6 PM', location: 'Room 1' },
    { eventId: 8, title: 'Social', date: '2099-02-01', time: null, location: 'Quad' },
    {
      eventId: 9,
      title: 'Hackathon',
      date: '2099-10-10',
      endDate: '2099-10-12',
      time: null,
      location: 'Lab',
      slots: [
        { startDate: '2099-10-10', endDate: '2099-10-11', startTime: '18:00:00', endTime: '20:00:00' },
        { startDate: '2099-10-12', endDate: '2099-10-12', startTime: '19:00:00', endTime: '20:00:00' },
      ],
    },
  ])
  mocks.cancelEventRsvp.mockReset().mockResolvedValue({ status: 'cancelled' })
})

describe('MyRsvps', () => {
  it('lists the member’s upcoming RSVPs under its own heading', async () => {
    render(await MyRsvps({ memberId: 7 }))

    expect(mocks.listMyRsvps).toHaveBeenCalledWith(7)
    expect(screen.getByRole('region', { name: 'My RSVPs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'My RSVPs' })).toBeInTheDocument()
    expect(screen.getByText('January 5, 2099 · 6 PM · Room 1')).toBeInTheDocument()
    expect(screen.getByText('February 1, 2099 · Quad')).toBeInTheDocument()
    expect(screen.getByText('Oct 10–12, 2099 · Lab')).toBeInTheDocument()
    expect(screen.getByText('Oct 10–11 · 6 PM – 8 PM')).toBeInTheDocument()
    expect(screen.getByText('Oct 12 · 7 PM – 8 PM')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel RSVP to Resume Workshop' })).toBeInTheDocument()
  })

  it('cancels one RSVP, announces it and returns focus to the heading', async () => {
    const user = userEvent.setup()
    render(await MyRsvps({ memberId: 7 }))

    await user.click(screen.getByRole('button', { name: 'Cancel RSVP to Social' }))

    expect(mocks.cancelEventRsvp).toHaveBeenCalledWith(8)
    expect(await screen.findByRole('status')).toHaveTextContent('Your RSVP to Social was cancelled.')
    expect(screen.getByRole('heading', { name: 'My RSVPs' })).toHaveFocus()
  })

  it('says so when a cancellation did not go through', async () => {
    mocks.cancelEventRsvp.mockResolvedValue({ status: 'not-cancelled' })
    const user = userEvent.setup()
    render(await MyRsvps({ memberId: 7 }))

    await user.click(screen.getByRole('button', { name: 'Cancel RSVP to Social' }))

    expect(await screen.findByRole('status')).toHaveTextContent('could not be cancelled')
  })

  it('points to the events page when there are no RSVPs', async () => {
    mocks.listMyRsvps.mockResolvedValue([])
    render(await MyRsvps({ memberId: 7 }))

    expect(screen.getByText(/haven’t RSVPed/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See upcoming events' })).toHaveAttribute('href', '/events')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
