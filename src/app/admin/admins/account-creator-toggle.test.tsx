import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AccountCreatorToggle from './account-creator-toggle'

vi.mock('./actions', () => ({ setCanCreateAccounts: vi.fn() }))

describe('AccountCreatorToggle', () => {
  it('names the admin it applies to and reports the current state', () => {
    render(<AccountCreatorToggle id={2} name="Ana Admin" enabled={false} />)
    const toggle = screen.getByRole('button', { name: 'Can create accounts for Ana Admin' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows as pressed when the admin already has the permission', () => {
    render(<AccountCreatorToggle id={2} name="Ana Admin" enabled />)
    expect(screen.getByRole('button', { name: 'Can create accounts for Ana Admin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
