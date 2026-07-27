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

  it('falls back to the placeholder if the logo fails to load', () => {
    render(<SponsorLogo name="Acme Co." tier="Gold" logo="/sponsors/acme.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'Acme Co. logo' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Acme Co.')).toBeInTheDocument()
  })
})
