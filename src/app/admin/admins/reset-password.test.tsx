import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResetPassword from './reset-password'

vi.mock('./actions', () => ({ resetAdminPassword: vi.fn() }))

describe('ResetPassword', () => {
  it('gives the disclosure and the submit button different names', () => {
    const { container } = render(<ResetPassword id={2} name="Ana Admin" email="ana@example.com" />)

    const summary = screen.getByText('Reset password', { exact: false, selector: 'summary' })
    expect(summary).toHaveTextContent('Reset password for Ana Admin')
    container.querySelector('details')!.open = true

    expect(screen.getByRole('button', { name: 'Set new password for Ana Admin' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset password for Ana Admin' })).not.toBeInTheDocument()
  })

  it('tells password managers which account the new password belongs to', () => {
    const { container } = render(<ResetPassword id={2} name="Ana Admin" email="ana@example.com" />)
    const username = container.querySelector('input[autocomplete="username"]')
    expect(username).toHaveValue('ana@example.com')
    expect(username).toHaveAttribute('readonly')
    expect(username).not.toHaveAttribute('name')
  })

  it('labels both password fields for a new password', () => {
    render(<ResetPassword id={2} name="Ana Admin" email="ana@example.com" />)
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password')
  })
})
