import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OfficerAvatar from './OfficerAvatar'

describe('OfficerAvatar', () => {
  it('renders initials when no photo is given', () => {
    render(<OfficerAvatar name="Jane Doe" />)

    expect(screen.getByText('JD')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the photo when one is given', () => {
    render(<OfficerAvatar name="Jane Doe" photo="/officers/jane.jpg" />)

    const img = screen.getByRole('img', { name: 'Jane Doe' })
    expect(img).toHaveAttribute('src', '/officers/jane.jpg')
  })

  it('falls back to initials if the photo fails to load', () => {
    render(<OfficerAvatar name="Jane Doe" photo="/officers/jane.jpg" />)

    fireEvent.error(screen.getByRole('img', { name: 'Jane Doe' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})
