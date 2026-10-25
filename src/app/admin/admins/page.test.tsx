import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  const accounts = [
    {
      id: 1,
      name: 'Max Master',
      role: 'master',
      email: 'max@example.com',
      canCreateAccounts: false,
      createdByName: null,
    },
    {
      id: 2,
      name: 'Ela Elevated',
      role: 'admin',
      email: 'ela@example.com',
      canCreateAccounts: true,
      createdByName: 'Max Master',
    },
    {
      id: 3,
      name: 'Pat Plain',
      role: 'admin',
      email: 'pat@example.com',
      canCreateAccounts: false,
      createdByName: null,
    },
  ]
  const state = { session: null as unknown, selected: [] as string[][] }
  return {
    accounts,
    state,
    select: (fields: Record<string, unknown>) => {
      const keys = Object.keys(fields)
      state.selected.push(keys)
      const query = {
        from: () => query,
        leftJoin: () => query,
        orderBy: async () =>
          accounts.map((account) =>
            Object.fromEntries(keys.map((key) => [key, account[key as keyof typeof account]])),
          ),
      }
      return query
    },
  }
})

vi.mock('@/db', () => ({ getDb: () => ({ select: mocks.select }) }))
vi.mock('@/lib/admin', () => ({ requireAccountCreator: async () => mocks.state.session }))
vi.mock('./actions', () => ({
  createAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
  resetAdminPassword: vi.fn(),
  setCanCreateAccounts: vi.fn(),
}))

import AdminAccountsPage from './page'

async function renderAs(user: { id: string; role: 'admin' | 'master'; canCreateAccounts: boolean }) {
  mocks.state.session = { user: { ...user, email: `${user.id}@example.com` }, expires: '' }
  render(await AdminAccountsPage({ searchParams: Promise.resolve({}) }))
}

const emails = /@example\.com/

function rowOf(name: string) {
  const row = screen
    .getAllByRole('row')
    .find((candidate) => (candidate as HTMLTableRowElement).cells[0].textContent?.startsWith(name))
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

beforeEach(() => {
  mocks.state.selected = []
})

describe('AdminAccountsPage for an elevated admin', () => {
  beforeEach(async () => {
    await renderAs({ id: '2', role: 'admin', canCreateAccounts: true })
  })

  it('never loads emails, permissions or creators', () => {
    expect(mocks.state.selected).toEqual([['id', 'name', 'role']])
  })

  it('shows names and roles but no email addresses', () => {
    const table = screen.getByRole('table')
    expect(within(table).getByText('Pat Plain')).toBeInTheDocument()
    expect(within(table).getAllByText('Admin')).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(emails)
    expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Created by' })).not.toBeInTheDocument()
  })

  it('shows no toggle, delete or reset controls', () => {
    expect(screen.queryByRole('button', { name: /Can create accounts/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Reset password', { exact: false })).not.toBeInTheDocument()
  })

  it('still offers the create form', () => {
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })
})

describe('AdminAccountsPage for the master', () => {
  beforeEach(async () => {
    await renderAs({ id: '1', role: 'master', canCreateAccounts: false })
  })

  it('shows emails and who created each account', () => {
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByText('pat@example.com')).toBeInTheDocument()
    expect(within(rowOf('Ela Elevated')).getByText('Max Master')).toBeInTheDocument()
    expect(within(rowOf('Pat Plain')).getByText('—')).toBeInTheDocument()
  })

  it('offers the toggle, delete and reset for other admins but not for itself', () => {
    expect(screen.getByRole('button', { name: 'Can create accounts for Ela Elevated' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Delete Pat Plain' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Can create accounts for Max Master' })).not.toBeInTheDocument()
    expect(within(rowOf('Max Master')).queryByRole('button')).not.toBeInTheDocument()
  })
})
