import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SocialLinks from './social-links'

const ALL = {
  instagramUrl: 'https://instagram.example/shpe',
  linkedinUrl: 'https://linkedin.example/shpe',
  xUrl: 'https://x.example/shpe',
  youtubeUrl: 'https://youtube.example/shpe',
  tiktokUrl: 'https://tiktok.example/shpe',
  mavlifeUrl: 'https://mavlife.example/shpe',
}

describe('SocialLinks', () => {
  it('links each configured network in a fixed order, every one opening in a new tab', () => {
    render(<SocialLinks settings={ALL} className="row" linkClassName="link" />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Instagram',
      'LinkedIn',
      'X (Twitter)',
      'YouTube',
      'TikTok',
      'MavLife',
    ])
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveClass('link')
    }
    expect(links.map((link) => link.getAttribute('href'))).toEqual(Object.values(ALL))
  })

  it('leaves out networks with no URL, and renders none without settings', () => {
    const { rerender } = render(
      <SocialLinks settings={{ ...ALL, linkedinUrl: null, xUrl: '' }} className="row" linkClassName="link" />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(4)
    rerender(<SocialLinks settings={null} className="row" linkClassName="link" />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
