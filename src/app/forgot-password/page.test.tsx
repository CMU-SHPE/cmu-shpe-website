import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }))

vi.mock('./actions', () => ({ requestPasswordReset: mocks.requestPasswordReset }))

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

  it.each([{}, { sent: '1' }])('moves focus to the error on every failed submit, even the same error twice (%o)', async (params) => {
    mocks.requestPasswordReset.mockReset()
    mocks.requestPasswordReset.mockResolvedValue({ errors: { email: 'Enter a valid email address.' }, values: { email: 'nope' } })
    render(await ForgotPasswordPage({ searchParams: Promise.resolve(params) }))

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      screen.getByRole('button', { name: 'Send reset link' }).focus()
      fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!)
      await waitFor(() => expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(attempt))
      await waitFor(() => expect(screen.getByRole('group', { name: 'There is a problem' })).toHaveFocus())
    }
  })

  it('moves focus to the notice after every request, including a second one to the same URL, and clears an earlier error', async () => {
    mocks.requestPasswordReset.mockReset().mockResolvedValue({ errors: { email: 'Enter a valid email address.' } })
    const { rerender } = render(await ForgotPasswordPage({ searchParams: Promise.resolve({ sent: '1' }) }))
    const notice = () => document.getElementById('request-sent')
    expect(notice()).toHaveTextContent('If an account exists')
    expect(notice()).toHaveFocus()

    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('group', { name: 'There is a problem' })).toHaveFocus())

    const again = await ForgotPasswordPage({ searchParams: Promise.resolve({ sent: '1' }) })
    await act(async () => rerender(again))
    expect(notice()).toHaveFocus()
    expect(screen.queryByRole('group', { name: 'There is a problem' })).toBeNull()
  })
})
