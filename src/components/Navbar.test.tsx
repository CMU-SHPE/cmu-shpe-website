import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Navbar from './Navbar'

const signOutAction = vi.fn(async () => {})

describe('Navbar', () => {
  it('shows no admin controls when signed out', () => {
    render(<Navbar user={null} signOutAction={signOutAction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('shows the admin name, Admin link and Sign out button when signed in', () => {
    render(<Navbar user={{ name: 'Ana Admin' }} signOutAction={signOutAction} />)

    expect(screen.getByText('Ana Admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute('type', 'submit')
  })

  it('repeats the admin controls in the mobile menu', () => {
    render(<Navbar user={{ name: 'Ana Admin' }} signOutAction={signOutAction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))

    expect(screen.getAllByText('Ana Admin')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Admin' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(2)
  })
})
