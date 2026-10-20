import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SponsorLogo from './SponsorLogo'

describe('SponsorLogo', () => {
  it('renders a placeholder with the sponsor name when there is no logo', () => {
    render(<SponsorLogo name="Acme Co." tier="Bronze" />)

    expect(screen.getByText('Acme Co.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the logo, linked to the website when one is given', () => {
    render(<SponsorLogo name="Acme Co." tier="Platinum" logo="/sponsors/acme.png" website="https://acme.example" />)

    const img = screen.getByRole('img', { name: 'Acme Co. logo' })
    expect(img).toHaveAttribute('src', '/sponsors/acme.png')
    expect(img.closest('a')).toHaveAttribute('href', 'https://acme.example')
  })

  it('paints the logo tile with the sponsor background color', () => {
    render(<SponsorLogo name="SGM" tier="Platinum" logo="/sponsors/sgm.svg" bgColor="#555555" />)

    const tile = screen.getByRole('img', { name: 'SGM logo' }).parentElement
    expect(tile).toHaveStyle({ backgroundColor: '#555555' })
  })

  it('falls back to a white tile for a missing or malformed background color', () => {
    const { rerender } = render(<SponsorLogo name="Acme Co." tier="Gold" logo="/sponsors/acme.png" />)
    const tile = () => screen.getByRole('img', { name: 'Acme Co. logo' }).parentElement
    expect(tile()).toHaveStyle({ backgroundColor: '#ffffff' })

    rerender(<SponsorLogo name="Acme Co." tier="Gold" logo="/sponsors/acme.png" bgColor="red;background:url(x)" />)
    expect(tile()).toHaveStyle({ backgroundColor: '#ffffff' })
  })

  it('falls back to the placeholder if the logo fails to load', () => {
    render(<SponsorLogo name="Acme Co." tier="Gold" logo="/sponsors/acme.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'Acme Co. logo' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Acme Co.')).toBeInTheDocument()
  })
})
