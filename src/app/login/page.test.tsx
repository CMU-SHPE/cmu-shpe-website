import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  class FakeAuthError extends Error {}
  return {
    FakeAuthError,
    currentAdmin: vi.fn(),
    currentMember: vi.fn(),
    signIn: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('next-auth', () => ({ AuthError: mocks.FakeAuthError }))
vi.mock('@/auth', () => ({ signIn: mocks.signIn }))
vi.mock('@/lib/admin', () => ({ currentAdmin: mocks.currentAdmin }))
vi.mock('@/lib/member', () => ({ currentMember: mocks.currentMember }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import LoginPage, { metadata } from './page'

function page(params: Record<string, string> = {}) {
  return LoginPage({ searchParams: Promise.resolve(params) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentAdmin.mockResolvedValue(null)
  mocks.currentMember.mockResolvedValue(null)
})

describe('LoginPage routing', () => {
  it('sends a signed-in admin to /admin', async () => {
    mocks.currentAdmin.mockResolvedValue({ user: { id: '1', kind: 'admin' } })
    await expect(page()).rejects.toThrow('REDIRECT /admin')
  })

  it('sends a signed-in member to /account', async () => {
    mocks.currentMember.mockResolvedValue({ user: { id: '7', kind: 'member' } })
    await expect(page()).rejects.toThrow('REDIRECT /account')
  })

  it('shows the form to a signed-out visitor', async () => {
    render(await page())
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('signs in back to /login so the page can route by account kind', async () => {
    mocks.signIn.mockResolvedValue(undefined)
    render(await page())
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mia@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'member horse battery' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalled())
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
      email: 'mia@example.com',
      password: 'member horse battery',
      redirectTo: '/login',
    })
  })
})

describe('LoginPage messages and links', () => {
  it('ties the generic error to both fields', async () => {
    render(await page({ error: '1' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Invalid email or password.')
    for (const label of ['Email', 'Password']) {
      const field = screen.getByLabelText(label)
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAttribute('aria-describedby', alert.id)
    }
  })

  it('leaves the fields unmarked without an error', async () => {
    render(await page())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })

  it.each([
    ['confirmed', 'Your email is confirmed'],
    ['reset', 'Your password was reset'],
    ['changed', 'Your password was changed'],
  ])('announces ?%s=1 as a status message', async (param, text) => {
    render(await page({ [param]: '1' }))
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('shows only the error when an error and a status arrive together', async () => {
    render(await page({ error: '1', confirmed: '1' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('links to account creation, password reset and resending the confirmation email', async () => {
    render(await page())
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/join')
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: "Didn't get the confirmation email?" })).toHaveAttribute(
      'href',
      '/join/resend',
    )
  })
})

describe('LoginPage metadata', () => {
  it('has its own title', () => {
    expect(metadata.title).toBe('Sign in | SHPE @ Colorado Mesa University')
  })
})
