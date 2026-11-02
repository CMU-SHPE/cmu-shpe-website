import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('ListingForm', () => {
  it('sends the listing it rendered', () => {
    const { container } = render(<ListingForm listing={LISTING} action={vi.fn()} />)
    expect(loadedField(container)).toBe(listingSnapshot(LISTING))
  })

  it('after a refusal shows the notice, the typed text and the latest row as the new baseline', async () => {
    const latest = { ...LISTING, name: 'Officer name', description: 'Officer words' }
    const refusal: ListingSaveRefusal = {
      shown: { ...latest, description: 'Sponsor words' },
      loaded: listingSnapshot(latest),
      conflicts: [{ field: 'Description', saved: 'Officer words' }],
      logoDropped: true,
    }
    const user = userEvent.setup()
    const { container } = render(<ListingForm listing={LISTING} action={vi.fn(async () => refusal)} />)

    await user.click(screen.getByRole('button', { name: 'Save listing' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Someone else changed this listing while you were editing, so nothing was saved.')
    expect(alert).toHaveTextContent('Description, saved version: Officer words')
    expect(alert).toHaveTextContent('choose yours again before saving')
    expect(screen.getByLabelText('Name')).toHaveValue('Officer name')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Sponsor words')
    expect(loadedField(container)).toBe(listingSnapshot(latest))
  })

  it('drops a dirty field and any refusal when the page brings a newer listing', async () => {
    const refusal: ListingSaveRefusal = {
      shown: LISTING,
      loaded: listingSnapshot(LISTING),
      conflicts: [],
      logoDropped: false,
    }
    const user = userEvent.setup()
    const action = vi.fn(async () => refusal)
    const { container, rerender } = render(<ListingForm listing={LISTING} action={action} />)
    await user.click(screen.getByRole('button', { name: 'Save listing' }))
    await screen.findByRole('alert')
    await user.type(screen.getByLabelText('Name'), ' typed')

    const newer = { ...LISTING, name: 'Newer' }
    rerender(<ListingForm listing={newer} action={action} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Newer')
    expect(loadedField(container)).toBe(listingSnapshot(newer))
  })
})
