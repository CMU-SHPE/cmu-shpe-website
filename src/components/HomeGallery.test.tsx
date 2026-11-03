import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/app/edit-actions', () => ({ saveContentText: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }))

import HomeGallery from './HomeGallery'

const photos = [
  { id: 1, imageUrl: '/gallery/banner.jpg', altText: 'Members holding the chapter banner', caption: 'National Convention 2026' },
  { id: 2, imageUrl: 'https://store.public.blob.vercel-storage.com/gallery/booth.jpg', altText: 'Officers at the career fair booth', caption: '' },
]

function renderGallery(list = photos) {
  return render(
    <HomeGallery photos={list} eyebrow="In Pictures" heading="Our Chapter in Action" editable={false} />,
  )
}

describe('HomeGallery', () => {
  it('renders nothing at all when there are no photos', () => {
    const { container } = renderGallery([])

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('heading', { name: 'Our Chapter in Action' })).not.toBeInTheDocument()
  })

  it('shows the heading and every photo in order, with its alt text', () => {
    renderGallery()

    expect(screen.getByRole('heading', { level: 2, name: 'Our Chapter in Action' })).toBeInTheDocument()
    expect(screen.getByText('In Pictures')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('img').getAttribute('alt'))).toEqual([
      'Members holding the chapter banner',
      'Officers at the career fair booth',
    ])
    expect(within(items[1]).getByRole('img')).toHaveAttribute('src', photos[1].imageUrl)
  })

  it('lazy-loads every image', () => {
    renderGallery()

    for (const image of screen.getAllByRole('img')) {
      expect(image).toHaveAttribute('loading', 'lazy')
      expect(image).toHaveAttribute('decoding', 'async')
    }
  })

  it('shows a caption only for photos that have one, inside its figure', () => {
    renderGallery()

    const [withCaption, withoutCaption] = screen.getAllByRole('figure')
    expect(within(withCaption).getByText('National Convention 2026').tagName).toBe('FIGCAPTION')
    expect(withoutCaption.querySelector('figcaption')).toBeNull()
  })

  it('adds no focus stops, so keyboard users move straight past it', () => {
    const { container } = renderGallery()

    expect(container.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
  })
})
