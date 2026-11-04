import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import HelpPage from './page'
import MemberGuidePage from './members/page'
import SponsorGuidePage from './sponsors/page'

describe('Help hub', () => {
  it('links the member and sponsor guides and the public PDF', () => {
    render(<HelpPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Member guide/ })).toHaveAttribute('href', '/help/members')
    expect(screen.getByRole('link', { name: /Sponsor guide/ })).toHaveAttribute('href', '/help/sponsors')
    expect(screen.getByRole('link', { name: 'Download both guides as a PDF' })).toHaveAttribute(
      'href',
      '/help/shpe-website-guide.pdf',
    )
    expect(screen.queryByRole('link', { name: /officer/i })).toBeNull()
  })
})

describe.each([
  ['members', MemberGuidePage, 'Member guide', 'Creating an account'],
  ['sponsors', SponsorGuidePage, 'Sponsor guide', 'Getting access'],
])('/help/%s', (_name, Page, title, firstSection) => {
  it('renders the guide under one h1 with contents that link to its sections', async () => {
    render(await Page())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()

    const contents = screen.getByRole('navigation', { name: 'Contents' })
    const link = within(contents).getByRole('link', { name: firstSection })
    const target = link.getAttribute('href')!.slice(1)
    expect(screen.getByRole('heading', { level: 2, name: firstSection })).toHaveAttribute('id', target)

    expect(screen.getByRole('link', { name: 'All guides' })).toHaveAttribute('href', '/help')
    expect(screen.getByRole('link', { name: 'Download the guides as a PDF' })).toHaveAttribute(
      'href',
      '/help/shpe-website-guide.pdf',
    )
  })

  it('shows images by their alt text and no leftover HTML comments', async () => {
    const { container } = render(await Page())
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) expect(image.getAttribute('alt')).not.toBe('')
    expect(container.innerHTML).not.toContain('<!--')
    expect(container.textContent).not.toContain('event-date-range')
  })
})
