import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LOADED_LISTING_FIELD, type ListingSaveRefusal, type LoadedListing, listingSnapshot } from '@/lib/sponsor-schema'
import ListingForm from './listing-form'

const LISTING: LoadedListing = {
  name: 'Acme',
  tier: 'Gold',
  website: null,
  bgColor: '#ffffff',
  description: 'Old words',
  logoUrl: null,
  logoOriginalUrl: null,
  logoCrop: null,
}

function loadedField(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>(`input[name="${LOADED_LISTING_FIELD}"]`)!.value
}

/**
 * The action's result renders in a transition after its promise resolves, outside user-event's own
 * act() calls. The mocked action resolves at once, so wrapping the click in act() has React finish that
 * render and move focus before the test looks, instead of a findBy having to catch it within 1 s,
 * which a busy machine can miss.
 */
async function submitAndSettle(user: ReturnType<typeof userEvent.setup>) {
  await act(() => user.click(screen.getByRole('button', { name: 'Save listing' })))
}

describe('ListingForm', () => {
  it('sends the listing it rendered', () => {
    const { container } = render(<ListingForm listing={LISTING} action={vi.fn()} />)
    expect(loadedField(container)).toBe(listingSnapshot(LISTING))
  })

  it('after a refusal shows the notice, the typed text and the latest row as the new baseline', async () => {
    const latest = { ...LISTING, name: 'Officer name', description: 'Officer words' }
    const refusal: ListingSaveRefusal = {
      reason: 'conflict',
      shown: { ...latest, description: 'Sponsor words' },
      loaded: listingSnapshot(latest),
      conflicts: [{ field: 'Description', saved: 'Officer words' }],
      logoDropped: true,
    }
    const user = userEvent.setup()
    const { container } = render(<ListingForm listing={LISTING} action={vi.fn(async () => refusal)} />)

    await submitAndSettle(user)

    const notice = screen.getByRole('group', { name: 'Nothing was saved' })
    expect(notice).toHaveFocus()
    expect(notice).toHaveTextContent('Someone else changed this listing while you were editing, so nothing was saved.')
    expect(notice).toHaveTextContent('Description, saved version: Officer words')
    expect(notice).toHaveTextContent('choose yours again before saving')
    expect(screen.getByLabelText('Name')).toHaveValue('Officer name')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Sponsor words')
    expect(loadedField(container)).toBe(listingSnapshot(latest))
  })

  it('keeps typed text and the listing it showed when the page brings a newer one', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(<ListingForm listing={LISTING} action={vi.fn()} />)
    await user.type(screen.getByLabelText('Name'), ' typed')

    rerender(<ListingForm listing={{ ...LISTING, name: 'Newer' }} action={vi.fn()} />)

    expect(screen.getByLabelText('Name')).toHaveValue('Acme typed')
    expect(loadedField(container)).toBe(listingSnapshot(LISTING))
  })

  it('moves to the newer listing once its own save has gone through', async () => {
    const user = userEvent.setup()
    let finish = () => {}
    const action = vi.fn(() => new Promise<null>((resolve) => (finish = () => resolve(null))))
    const { container, rerender } = render(<ListingForm listing={LISTING} action={action} />)
    await user.click(screen.getByRole('button', { name: 'Save listing' }))

    const newer = { ...LISTING, name: 'Newer' }
    rerender(<ListingForm listing={newer} action={action} />)

    expect(screen.getByLabelText('Name')).toHaveValue('Newer')
    expect(loadedField(container)).toBe(listingSnapshot(newer))
    await act(async () => finish())
  })

  it('says the page was out of date when no field can be named', async () => {
    const refusal: ListingSaveRefusal = {
      reason: 'outdated',
      shown: LISTING,
      loaded: listingSnapshot(LISTING),
      conflicts: [],
      logoDropped: false,
    }
    const user = userEvent.setup()
    render(<ListingForm listing={LISTING} action={vi.fn(async () => refusal)} />)
    await submitAndSettle(user)

    const notice = screen.getByRole('group', { name: 'Nothing was saved' })
    expect(notice).toHaveTextContent('This page was out of date, so nothing was saved.')
    expect(notice).toHaveTextContent('Check the form and save again.')
    expect(notice).not.toHaveTextContent('Someone else')
  })
})
