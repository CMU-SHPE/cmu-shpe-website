import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ resendConfirmation: vi.fn() }))

vi.mock('./actions', () => ({ resendConfirmation: mocks.resendConfirmation }))

import ResendConfirmationPage from './page'

describe('ResendConfirmationPage', () => {
  it('confirms a request only conditionally', async () => {
    render(await ResendConfirmationPage({ searchParams: Promise.resolve({ sent: '1' }) }))
    expect(screen.getByRole('status')).toHaveTextContent(
      "If an unconfirmed account exists for that email, we've sent a new confirmation link.",
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it.each([{}, { sent: '1' }])('moves focus to the error on every failed submit, even the same error twice (%o)', async (params) => {
    mocks.resendConfirmation.mockReset()
    mocks.resendConfirmation.mockResolvedValue({ errors: { email: 'Enter a valid email address.' }, values: { email: 'nope' } })
    render(await ResendConfirmationPage({ searchParams: Promise.resolve(params) }))

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      screen.getByRole('button', { name: 'Send a new link' }).focus()
      fireEvent.submit(screen.getByRole('button', { name: 'Send a new link' }).closest('form')!)
      await waitFor(() => expect(mocks.resendConfirmation).toHaveBeenCalledTimes(attempt))
      await waitFor(() => expect(screen.getByRole('group', { name: 'There is a problem' })).toHaveFocus())
    }
  })

  it('moves focus to the notice after every request, including a second one to the same URL, and clears an earlier error', async () => {
    mocks.resendConfirmation.mockReset().mockResolvedValue({ errors: { email: 'Enter a valid email address.' } })
    const { rerender } = render(await ResendConfirmationPage({ searchParams: Promise.resolve({ sent: '1' }) }))
    const notice = () => document.getElementById('request-sent')
    expect(notice()).toHaveTextContent('If an unconfirmed account exists')
    expect(notice()).toHaveFocus()

    fireEvent.submit(screen.getByRole('button', { name: 'Send a new link' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('group', { name: 'There is a problem' })).toHaveFocus())

    const again = await ResendConfirmationPage({ searchParams: Promise.resolve({ sent: '1' }) })
    await act(async () => rerender(again))
    expect(notice()).toHaveFocus()
    expect(screen.queryByRole('group', { name: 'There is a problem' })).toBeNull()
  })
})
