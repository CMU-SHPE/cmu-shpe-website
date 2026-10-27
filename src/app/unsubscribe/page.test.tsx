import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hashToken } from '@/lib/member-tokens'
import { unsubscribeTokenFor } from '@/lib/newsletter-unsubscribe-token'
import {
  createFakeUnsubscribeDb,
  SEEDED_RECIPIENT_ID,
  seedUnsubscribeDb,
} from '@/lib/newsletter-unsubscribe.test-support'

const fake = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/db', () => ({ getDb: () => fake.current }))
vi.mock('./actions', () => ({ unsubscribeFromPage: vi.fn() }))

import UnsubscribePage, { metadata } from './page'

let db: ReturnType<typeof createFakeUnsubscribeDb>
let token: string

async function renderPage(searchParams: { token?: string | string[] }) {
  render(await UnsubscribePage({ searchParams: Promise.resolve(searchParams) }))
}

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  token = unsubscribeTokenFor(SEEDED_RECIPIENT_ID)
  db = createFakeUnsubscribeDb()
  seedUnsubscribeDb(db, hashToken(token))
  fake.current = db.db
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('UnsubscribePage', () => {
  it('keeps the token out of cross-site Referer headers while same-origin form posts keep their Origin', () => {
    expect(metadata.referrer).toBe('same-origin')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('shows the forms for a valid token without deleting or inserting anything', async () => {
    await renderPage({ token })
    expect(screen.getByRole('heading', { name: 'Unsubscribe from SHPE @ CMU newsletters' })).toBeInTheDocument()
    expect(screen.getByText('For the account m***@example.com.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unsubscribe from Events and Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unsubscribe from all newsletters' })).toBeInTheDocument()
    expect(screen.getByText(/including Other/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /manage your newsletters/i })[0]).toHaveAttribute('href', '/account')

    expect(db.state.writes).toBe(0)
    expect(db.state.statements.every((text) => text.startsWith('select'))).toBe(true)
    expect(db.state.subscriptions).toHaveLength(3)
    expect(db.state.log).toEqual([])
  })

  it('renders twice the same way, since opening the link changes nothing', async () => {
    await renderPage({ token })
    const first = document.body.innerHTML
    document.body.innerHTML = ''
    await renderPage({ token })
    expect(document.body.innerHTML).toBe(first)
  })

  it('says so when the member is already unsubscribed from this newsletter’s topics', async () => {
    db.state.subscriptions = [{ memberId: 7, topicId: 3 }]
    await renderPage({ token })
    expect(screen.getByRole('status')).toHaveTextContent('You’re already unsubscribed from Events and Jobs.')
    expect(screen.queryByRole('button', { name: /Events and Jobs/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Unsubscribe from all newsletters' })).toBeInTheDocument()
  })

  it('says so when the member has no subscriptions left', async () => {
    db.state.subscriptions = []
    await renderPage({ token })
    expect(screen.getByRole('status')).toHaveTextContent('already unsubscribed from all SHPE @ CMU newsletters')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each([
    ['missing', {}],
    ['malformed', { token: 'abc' }],
    ['repeated', { token: ['a', 'b'] }],
    ['unknown', { token: 'e2eUnknownToken_0123456789abcdefghijklmnopq' }],
  ])('shows the same alert for a %s token, revealing nothing about accounts', async (_, params) => {
    await renderPage(params)
    expect(screen.getByRole('heading', { name: "This link doesn't work" })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This unsubscribe link is not valid.')
    expect(screen.queryByRole('button')).toBeNull()
    expect(db.state.writes).toBe(0)
  })

  it('shows the same alert once the member’s account is deleted', async () => {
    db.state.members.clear()
    await renderPage({ token })
    expect(screen.getByRole('alert')).toHaveTextContent('This unsubscribe link is not valid.')
  })
})
