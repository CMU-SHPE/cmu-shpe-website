import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./actions', () => ({ signUp: vi.fn() }))

import JoinPage, { metadata } from './page'

describe('JoinPage', () => {
  it('asks for everything sign-up needs, with the legal pages linked from the consent box hint', () => {
    render(<JoinPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Create an account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '100')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/At least 12 characters/)
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('I am 13 or older')).toHaveAttribute('type', 'checkbox')
    const consent = screen.getByRole<HTMLInputElement>('checkbox', { name: 'I agree to the Terms of Use and Privacy Policy' })
    expect(consent).toHaveAccessibleDescription('Read the Terms of Use and Privacy Policy.')
    expect(consent.labels?.[0].querySelector('a')).toBeNull()
    const hint = document.getElementById(consent.getAttribute('aria-describedby')!)!
    expect(hint).toContainElement(screen.getByRole('link', { name: 'Terms of Use' }))
    expect(hint).toContainElement(screen.getByRole('link', { name: 'Privacy Policy' }))
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('has its own title', () => {
    expect(metadata.title).toBe('Create an account | SHPE @ Colorado Mesa University')
  })
})
