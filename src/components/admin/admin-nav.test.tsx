import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminNav from './admin-nav'

const navigation = vi.hoisted(() => ({ pathname: '/admin' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

beforeEach(() => {
  navigation.pathname = '/admin'
})

describe('AdminNav', () => {
  it('hides admin accounts from regular admins', () => {
    render(<AdminNav isMaster={false} />)
    expect(screen.queryByRole('link', { name: 'Admin accounts' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Page lists' })).toHaveAttribute('href', '/admin/lists')
  })

  it('shows admin accounts to masters', () => {
    render(<AdminNav isMaster />)
    expect(screen.getByRole('link', { name: 'Admin accounts' })).toHaveAttribute('href', '/admin/admins')
  })

  it('marks only the dashboard current on /admin', () => {
    render(<AdminNav isMaster />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Officers' })).not.toHaveAttribute('aria-current')
  })

  it('shows Change password to every admin', () => {
    for (const isMaster of [false, true]) {
      const { unmount } = render(<AdminNav isMaster={isMaster} />)
      expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/admin/account')
      unmount()
    }
  })

  it('marks Change password current on /admin/account', () => {
    navigation.pathname = '/admin/account'
    render(<AdminNav isMaster={false} />)
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks a section current on its nested routes', () => {
    navigation.pathname = '/admin/officers/12'
    render(<AdminNav isMaster={false} />)
    expect(screen.getByRole('link', { name: 'Officers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })
})
