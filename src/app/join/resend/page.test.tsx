import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./actions', () => ({ resendConfirmation: vi.fn() }))

import ResendConfirmationPage from './page'

describe('ResendConfirmationPage', () => {
  it('confirms a request only conditionally', async () => {
    render(await ResendConfirmationPage({ searchParams: Promise.resolve({ sent: '1' }) }))
    expect(screen.getByRole('status')).toHaveTextContent(
      "If an unconfirmed account exists for that email, we've sent a new confirmation link.",
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
