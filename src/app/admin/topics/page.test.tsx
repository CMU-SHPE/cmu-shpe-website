import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  topics: [] as { id: number; name: string; description: string; subscriberCount: number }[],
}))

vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => {
    mocks.calls.push('requireAdmin')
    return { user: { id: '1' } }
  },
}))
vi.mock('@/lib/newsletter-topics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/newsletter-topics')>()),
  getNewsletterTopicsWithSubscriberCounts: async () => {
    mocks.calls.push('topics')
    return mocks.topics
  },
}))
vi.mock('./actions', () => ({
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
  moveTopic: vi.fn(),
}))

import AdminTopicsPage from './page'

async function renderPage(searchParams: { saved?: string; error?: string } = {}) {
  render(await AdminTopicsPage({ searchParams: Promise.resolve(searchParams) }))
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.topics = [
    { id: 1, name: 'Events', description: 'Meetups and socials', subscriberCount: 3 },
    { id: 2, name: 'Jobs', description: '', subscriberCount: 0 },
  ]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminTopicsPage', () => {
  it('requires an admin before loading topics', async () => {
    await renderPage()
    expect(mocks.calls[0]).toBe('requireAdmin')
  })

  it('shows each topic with its subscriber count and editable fields', async () => {
    await renderPage()
    expect(screen.getByText('3 subscribers')).toBeInTheDocument()
    expect(screen.getByText('0 subscribers')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: 'Name' }).map((input) => (input as HTMLInputElement).value)).toEqual([
      'Events',
      'Jobs',
      '',
    ])
    expect(screen.getByRole('button', { name: 'Add topic' })).toBeInTheDocument()
  })

  it('only offers moves that are possible', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: 'Move Events up' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Move Events down' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Jobs up' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move Jobs down' })).toBeNull()
  })

  it('warns that deleting a topic removes members’ choices for it', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Events' }))
    expect(confirm).toHaveBeenCalledWith(
      "Delete Events? 3 members have chosen it; their choice is removed and they will stop getting it. This can't be undone.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete Jobs' }))
    expect(confirm).toHaveBeenLastCalledWith("Delete Jobs? No members have chosen it yet. This can't be undone.")
  })

  it('says when there are no topics yet', async () => {
    mocks.topics = []
    await renderPage()
    expect(screen.getByText('No topics yet.')).toBeInTheDocument()
  })

  it('shows errors as alerts', async () => {
    await renderPage({ error: 'invalid' })
    expect(screen.getByRole('alert')).toHaveTextContent(/name of up to 100 characters/)
  })
})
