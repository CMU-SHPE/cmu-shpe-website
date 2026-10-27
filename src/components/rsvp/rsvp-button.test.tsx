import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  rsvpToEvent: vi.fn(),
  cancelEventRsvp: vi.fn(),
}))
vi.mock('@/app/events/actions', () => mocks)

import RsvpButton from './rsvp-button'

beforeEach(() => {
  mocks.rsvpToEvent.mockReset().mockResolvedValue({ status: 'going' })
  mocks.cancelEventRsvp.mockReset().mockResolvedValue({ status: 'cancelled' })
})

describe('RsvpButton', () => {
  it('RSVPs to an open event and announces the outcome', async () => {
    const user = userEvent.setup()
    render(<RsvpButton eventId={4} state="open" />)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'RSVP' }))

    expect(mocks.rsvpToEvent).toHaveBeenCalledWith(4)
    expect(mocks.cancelEventRsvp).not.toHaveBeenCalled()
    expect(await screen.findByText('You’re going. See you there!')).toBe(status)
  })

  it('tells the member when the event filled up first', async () => {
    mocks.rsvpToEvent.mockResolvedValue({ status: 'full' })
    const user = userEvent.setup()
    render(<RsvpButton eventId={4} state="open" />)
    await user.click(screen.getByRole('button', { name: 'RSVP' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Sorry, this event is full.')
  })

  it('offers a cancel button to a member who is going', async () => {
    const user = userEvent.setup()
    render(<RsvpButton eventId={4} state="going" />)
    expect(screen.getByText('You’re going')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel RSVP' }))

    expect(mocks.cancelEventRsvp).toHaveBeenCalledWith(4)
    expect(mocks.rsvpToEvent).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Your RSVP was cancelled.')
  })

  it('shows a full event without a button', () => {
    render(<RsvpButton eventId={4} state="full" />)
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
