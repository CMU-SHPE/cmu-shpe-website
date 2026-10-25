import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./actions', () => ({ requestPasswordReset: vi.fn() }))

import ForgotPasswordPage from './page'

describe('ForgotPasswordPage', () => {
  it('asks for an email', async () => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('confirms a request only conditionally, never claiming an email was sent', async () => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({ sent: '1' }) }))
    expect(screen.getByRole('status')).toHaveTextContent("If an account exists for that email, we've sent a reset link.")
  })
})
