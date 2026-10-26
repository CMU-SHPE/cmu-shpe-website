import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AccountForm, { type AccountField } from './account-form'
import type { FormState } from '@/lib/member-accounts'

const fields: AccountField[] = [
  { name: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 12 characters.' },
  { name: 'ageConfirmed', label: 'I am 13 or older', type: 'checkbox' },
]

function fill() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mia' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mia@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret secret' } })
  fireEvent.click(screen.getByLabelText('I am 13 or older'))
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!)
}

function renderForm(action: (state: FormState, formData: FormData) => Promise<FormState>) {
  render(<AccountForm action={action} fields={fields} submitLabel="Create account" pendingLabel="Creating…" />)
}

describe('AccountForm', () => {
  it('labels every field and describes the password with its requirements', () => {
    renderForm(vi.fn())
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    expect(password).toHaveAccessibleDescription('At least 12 characters.')
    expect(screen.queryByRole('group', { name: 'There is a problem' })).not.toBeInTheDocument()
  })

  it('after a failed submit, focuses the error summary, marks the fields, and keeps what was typed except the password', async () => {
    const action = vi.fn(async (_state: FormState, formData: FormData) => ({
      errors: { email: 'Enter a valid email address.', password: 'Choose a longer password.' },
      values: { name: String(formData.get('name')), email: String(formData.get('email')), ageConfirmed: 'on' },
    }))
    renderForm(action)
    fill()

    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    await waitFor(() => expect(summary).toHaveFocus())
    expect(summary).toHaveTextContent('Enter a valid email address.')
    expect(screen.getByRole('link', { name: 'Choose a longer password.' }).getAttribute('href')).toBe(
      `#${screen.getByLabelText('Password').id}`,
    )

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Enter a valid email address.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Choose a longer password. At least 12 characters.')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')

    expect(screen.getByLabelText('Name')).toHaveValue('Mia')
    expect(email).toHaveValue('mia@example.com')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText('I am 13 or older')).toBeChecked()
  })

  it('shows a form-level error such as a failed send in the summary', async () => {
    renderForm(async () => ({ formError: "We couldn't send the email right now, try again later." }))
    fill()
    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    expect(summary).toHaveTextContent("We couldn't send the email right now")
    await waitFor(() => expect(summary).toHaveFocus())
  })

  it('does not also make the focused summary a live region, so it is read once', async () => {
    renderForm(async () => ({ formError: 'Try again.' }))
    fill()
    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    await waitFor(() => expect(summary).toHaveFocus())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(summary).not.toHaveAttribute('aria-live')
  })

  it('moves focus to the summary again on a repeated failure', async () => {
    renderForm(async () => ({ formError: 'Try again.' }))
    fill()
    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    await waitFor(() => expect(summary).toHaveFocus())
    screen.getByLabelText('Name').focus()
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('group', { name: 'There is a problem' })).toHaveFocus())
  })
})
