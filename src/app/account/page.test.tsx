import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ requireMember: vi.fn() }))

vi.mock('@/lib/member', () => ({ requireMember: mocks.requireMember }))

import AccountPage from './page'

beforeEach(() => {
  mocks.requireMember.mockReset()
})

describe('AccountPage', () => {
  it('requires a member before rendering anything', async () => {
    mocks.requireMember.mockRejectedValue(new Error('REDIRECT /login'))
    await expect(AccountPage()).rejects.toThrow('REDIRECT /login')
  })

  it('greets the signed-in member', async () => {
    mocks.requireMember.mockResolvedValue({ user: { name: 'Mia', email: 'mia@example.com', kind: 'member' } })
    render(await AccountPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument()
    expect(screen.getByText('Mia')).toBeInTheDocument()
  })
})
