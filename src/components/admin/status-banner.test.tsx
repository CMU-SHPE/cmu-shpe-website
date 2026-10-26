import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBanner from './status-banner'

const errorMessages = { duplicate: 'An account with that email already exists.' }

describe('StatusBanner', () => {
  it('renders nothing without saved or error', () => {
    const { container } = render(<StatusBanner errorMessages={errorMessages} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces a save as a status message', () => {
    render(<StatusBanner saved="1" errorMessages={errorMessages} savedMessage="Officer saved." />)
    expect(screen.getByRole('status')).toHaveTextContent('Officer saved.')
  })

  it('maps a known error code to its message as an alert', () => {
    render(<StatusBanner error="duplicate" errorMessages={errorMessages} />)
    expect(screen.getByRole('alert')).toHaveTextContent('An account with that email already exists.')
  })

  it('falls back to a generic message for unknown or inherited codes', () => {
    render(<StatusBanner error="toString" errorMessages={errorMessages} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('prefers the error when both params are present', () => {
    render(<StatusBanner saved="1" error="duplicate" errorMessages={errorMessages} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('drops the live role when the caller moves focus to it instead', () => {
    const { rerender } = render(<StatusBanner error="duplicate" errorMessages={errorMessages} live={false} />)
    expect(screen.getByText('An account with that email already exists.')).not.toHaveAttribute('role')
    rerender(<StatusBanner saved="1" errorMessages={errorMessages} savedMessage="Officer saved." live={false} />)
    expect(screen.getByText('Officer saved.')).not.toHaveAttribute('role')
  })
})
