import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { NewsletterListRow, NewsletterRecipientRow } from '@/lib/newsletter-admin'

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  list: [] as unknown[],
  newsletter: null as Record<string, unknown> | null,
  recipients: [] as unknown[],
  audience: 3,
  ready: { ok: true } as { ok: boolean; blocker?: string },
  settings: { mailingAddress: '5000 Forbes Ave' } as { mailingAddress: string } | null,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
  usePathname: () => '/admin/newsletters',
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => {
    mocks.calls.push('requireAdmin')
    return { user: { id: '1', email: 'ada@example.com' } }
  },
}))
vi.mock('@/lib/newsletter-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/newsletter-admin')>()),
  listNewsletters: async () => {
    mocks.calls.push('list')
    return mocks.list
  },
  getNewsletter: async () => mocks.newsletter,
  getNewsletterRecipients: async () => mocks.recipients,
  getTopicsWithConfirmedSubscriberCounts: async () => [{ id: 1, name: 'Events', subscriberCount: 3 }],
  countNewsletterAudience: async () => mocks.audience,
  previewSiteUrl: () => 'https://shpe.example',
}))
vi.mock('@/lib/queries', () => ({ getSiteSettings: async () => mocks.settings }))
vi.mock('@/lib/newsletter-send', () => ({ loadSendSnapshot: async () => mocks.ready }))
vi.mock('./actions', () => ({
  continueSending: vi.fn(),
  deleteNewsletterDraft: vi.fn(),
  reviewNewsletter: vi.fn(),
  saveNewsletter: vi.fn(),
  sendNewsletter: vi.fn(),
  sendTestNewsletter: vi.fn(),
}))
vi.mock('../actions', () => ({
  continueSending: vi.fn(),
  reviewNewsletter: vi.fn(),
  saveNewsletter: vi.fn(),
  sendTestNewsletter: vi.fn(),
}))
vi.mock('../../actions', () => ({ sendNewsletter: vi.fn() }))

import * as listPage from './page'
import * as newPage from './new/page'
import * as detailPage from './[id]/page'
import * as confirmPage from './[id]/send/page'

const sentAt = new Date('2026-10-20T22:30:00Z')

function listRow(overrides: Partial<NewsletterListRow>): NewsletterListRow {
  return {
    id: 1,
    subject: 'Spring update',
    status: 'sent',
    updatedAt: sentAt,
    sendStartedAt: sentAt,
    sentAt,
    sentByName: 'Ada',
    topicNames: 'Events\nJobs',
    recipientCount: 10,
    draftTopicNames: null,
    sentCount: 7,
    failedCount: 1,
    unknownCount: 1,
    skippedCount: 1,
    remainingCount: 0,
    ...overrides,
  }
}

function recipient(overrides: Partial<NewsletterRecipientRow>): NewsletterRecipientRow {
  return { id: 1, status: 'sent', errorCode: null, name: 'Ana', email: 'ana@example.com', ...overrides }
}

const sentNewsletter = {
  id: 4,
  status: 'sent',
  subject: 'Spring update',
  body: 'Hello',
  topicIds: [1],
  currentTopicNames: ['Events'],
  topicNames: 'Events',
  sendStartedAt: sentAt,
  sentAt,
  sentByName: 'Ada',
  recipientCount: 4,
  mailingAddress: '5000 Forbes Ave',
  siteUrl: 'https://shpe.example',
}

const params = (id = '4') => Promise.resolve({ id })
const searchParams = (values: Record<string, string> = {}) => Promise.resolve(values)

beforeEach(() => {
  mocks.calls.length = 0
  mocks.list = []
  mocks.newsletter = null
  mocks.recipients = []
  mocks.audience = 3
  mocks.ready = { ok: true }
  mocks.settings = { mailingAddress: '5000 Forbes Ave' }
})

describe('route segment config', () => {
  it('gives every page that posts a send or continue action the full 300 seconds', () => {
    expect(listPage.maxDuration).toBe(300)
    expect(detailPage.maxDuration).toBe(300)
    expect(confirmPage.maxDuration).toBe(300)
  })
})

describe('newsletters list page', () => {
  it('requires an admin before loading, and lists drafts and history with every outcome', async () => {
    mocks.list = [
      listRow({ id: 2, status: 'draft', subject: '', draftTopicNames: 'Events' }),
      listRow({ id: 1 }),
      listRow({ id: 3, status: 'sending', subject: 'Half done', sentAt: null, remainingCount: 4 }),
    ]
    render(await listPage.default({ searchParams: searchParams() }))
    expect(mocks.calls[0]).toBe('requireAdmin')
    expect(screen.getByRole('link', { name: 'New newsletter' })).toHaveAttribute('href', '/admin/newsletters/new')
    expect(screen.getByRole('link', { name: 'Untitled draft' })).toHaveAttribute('href', '/admin/newsletters/2')

    const table = screen.getByRole('table')
    const sent = within(table).getAllByRole('row')[1]
    expect(sent).toHaveTextContent('Events, Jobs')
    expect(sent).toHaveTextContent('Oct 20, 2026, 4:30 PM MT')
    expect(sent).toHaveTextContent('Ada')
    expect(sent).toHaveTextContent('7 sent')
    expect(sent).toHaveTextContent('1 failed')
    expect(sent).toHaveTextContent('1 unknown outcome')
    expect(sent).toHaveTextContent('1 skipped')

    const sending = within(table).getAllByRole('row')[2]
    expect(sending).toHaveTextContent('Sending…')
    expect(sending).toHaveTextContent('4 not sent yet')
    expect(within(sending).getByRole('button', { name: 'Continue sending Half done' })).toBeInTheDocument()
  })
})

describe('new newsletter page', () => {
  it('requires an admin and shows the composer', async () => {
    render(await newPage.default({ searchParams: searchParams() }))
    expect(mocks.calls[0]).toBe('requireAdmin')
    expect(screen.getByRole('heading', { name: 'New newsletter' })).toBeInTheDocument()
    expect(screen.getByTitle('Newsletter preview')).toBeInTheDocument()
  })
})

describe('newsletter detail page', () => {
  it('rejects a bad id', async () => {
    await expect(detailPage.default({ params: params('abc'), searchParams: searchParams() })).rejects.toThrow('NOT_FOUND')
  })

  it('shows a draft in the composer', async () => {
    mocks.newsletter = { ...sentNewsletter, status: 'draft' }
    render(await detailPage.default({ params: params(), searchParams: searchParams({ tested: '1' }) }))
    expect(screen.getByRole('heading', { name: 'Edit draft' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('a test sent to ada@example.com')
  })

  it('lists failures clearly and never reports them as delivered', async () => {
    mocks.newsletter = sentNewsletter
    mocks.recipients = [
      recipient({ id: 1, status: 'failed', errorCode: 'rejected', name: 'Bad Address', email: 'bad@example' }),
      recipient({ id: 2, status: 'failed', errorCode: 'unknown_outcome', name: 'Maybe', email: 'maybe@example.com' }),
      recipient({ id: 3, status: 'skipped', errorCode: 'unsubscribed', name: 'Gone', email: 'gone@example.com' }),
    ]
    render(await detailPage.default({ params: params(), searchParams: searchParams({ sent: '1' }) }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Sending finished: 0 accepted by the email service. 2 did not go through for certain',
    )
    const problems = screen.getByRole('heading', { name: 'Not delivered for certain (2)' }).closest('section')!
    expect(problems).toHaveTextContent('Bad Address <bad@example>: Rejected by the email service')
    expect(problems).toHaveTextContent('Maybe <maybe@example.com>: Unknown: it may or may not have been delivered')
    expect(problems).not.toHaveTextContent('Gone')
    expect(screen.getByText('Accounts deleted since sending started').nextSibling).toHaveTextContent('1')
    expect(screen.getByTitle('Newsletter preview')).toHaveAttribute('sandbox', '')
  })

  it('offers Continue sending while a send is unfinished', async () => {
    mocks.newsletter = { ...sentNewsletter, status: 'sending', sentAt: null }
    mocks.recipients = [recipient({ status: 'pending' })]
    render(await detailPage.default({ params: params(), searchParams: searchParams({ progress: 'time_budget' }) }))
    expect(screen.getByRole('button', { name: 'Continue sending' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Press Continue sending to send the rest')
  })

  it.each([
    ['outcome_unconfirmed', 'within 24 hours'],
    ['retry_later', 'nobody in it got the newsletter yet'],
  ])('explains what %s means for the next Continue sending', async (progress, text) => {
    mocks.newsletter = { ...sentNewsletter, status: 'sending', sentAt: null }
    mocks.recipients = [recipient({ status: 'pending' })]
    render(await detailPage.default({ params: params(), searchParams: searchParams({ progress }) }))
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })
})

describe('confirm send page', () => {
  it('shows the exact recipient count and an explicit send button', async () => {
    mocks.newsletter = { ...sentNewsletter, status: 'draft' }
    mocks.audience = 1234
    const { container } = render(await confirmPage.default({ params: params(), searchParams: searchParams() }))
    expect(mocks.calls[0]).toBe('requireAdmin')
    expect(screen.getByRole('heading', { name: 'This will email 1,234 people now' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to 1,234 people' })).toBeInTheDocument()
    expect(container.querySelector('input[name="expectedCount"]')).toHaveValue('1234')
  })

  it('warns on a preview deployment that only @resend.dev test addresses are counted and sent to', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    mocks.newsletter = { ...sentNewsletter, status: 'draft' }
    render(await confirmPage.default({ params: params(), searchParams: searchParams() }))
    expect(screen.getByRole('note')).toHaveTextContent('only @resend.dev test addresses receive this newsletter')
    vi.unstubAllEnvs()
  })

  it('refuses without a mailing address and links to settings', async () => {
    mocks.newsletter = { ...sentNewsletter, status: 'draft' }
    mocks.ready = { ok: false, blocker: 'no_mailing_address' }
    render(await confirmPage.default({ params: params(), searchParams: searchParams() }))
    expect(screen.queryByRole('button', { name: /Send to/ })).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('mailing address')
    expect(screen.getByRole('link', { name: /Site settings/ })).toHaveAttribute('href', '/admin/settings')
  })

  it('offers no send when no one would get it', async () => {
    mocks.newsletter = { ...sentNewsletter, status: 'draft' }
    mocks.audience = 0
    render(await confirmPage.default({ params: params(), searchParams: searchParams() }))
    expect(screen.getByRole('heading', { name: 'No one to send to' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Send to/ })).toBeNull()
  })

  it('sends a newsletter that is no longer a draft back to its page', async () => {
    mocks.newsletter = sentNewsletter
    await expect(confirmPage.default({ params: params(), searchParams: searchParams() })).rejects.toThrow(
      'REDIRECT /admin/newsletters/4',
    )
  })
})
