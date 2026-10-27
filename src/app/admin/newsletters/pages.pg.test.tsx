import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, hasTestDatabase, query, seed } from '@/db/pg-test-support'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: async () => ({ user: { id: '1', email: 'ada@example.org', name: 'Ada' } }),
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendNewsletterBatch: async (emails: unknown[]) => ({ ok: true, outcomes: emails.map((_, i) => ({ id: `re_${i}` })) }),
}))

import NewsletterListPage from './page'
import NewNewsletterPage from './new/page'
import NewsletterPage from './[id]/page'
import ConfirmSendPage from './[id]/send/page'
import AdminTopicsPage from '@/app/admin/topics/page'
import AdminMembersPage from '@/app/admin/members/page'
import UnsubscribePage from '@/app/unsubscribe/page'
import { processNewsletterSend, startNewsletterSend } from '@/lib/newsletter-send'
import { unsubscribeTokenFor } from '@/lib/newsletter-unsubscribe-token'

const SNAPSHOT = {
  mailingAddress: '5000 Forbes Ave',
  replyTo: 'shpe@example.org',
  siteUrl: 'https://shpe.example',
  fromAddress: '"SHPE @ CMU" <news@example.org>',
}

function text(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

const none = () => Promise.resolve({})

describe.skipIf(!hasTestDatabase).each(['production', 'preview'])('admin and unsubscribe page loaders on real Postgres, VERCEL_ENV=%s', (env) => {
  const restricted = env !== 'production'

  beforeEach(async () => {
    vi.stubEnv('VERCEL_ENV', env)
    vi.stubEnv('AUTH_SECRET', 'pg-test-secret')
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_EMAIL_DOMAIN', 'example.org')
    vi.stubEnv('SITE_URL', 'https://shpe.example')
    await seed([
      { email: 'ana@example.com', topics: [1, 2] },
      { email: 'delivered+bo@resend.dev', topics: [1] },
      { email: 'cy@example.com', confirmed: false, topics: [1] },
    ])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders /admin/newsletters with drafts and sent results', async () => {
    const pending = await draft([1, 2], 'Draft one')
    const sent = await draft([1], 'Sent one')
    await startNewsletterSend(sent, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(sent)

    const html = text(renderToString(await NewsletterListPage({ searchParams: none() })))
    expect(html).toContain('Draft one')
    expect(html).toContain('Topics: Events, Jobs')
    expect(html).toContain(`${restricted ? 1 : 2} sent`)
    expect(pending).toBeGreaterThan(0)
  })

  it('renders /admin/newsletters/new with confirmed counts and the audience notice where it applies', async () => {
    const html = text(renderToString(await NewNewsletterPage({ searchParams: none() })))
    expect(html).toContain(restricted ? 'Events ( 1 confirmed subscriber )' : 'Events ( 2 confirmed subscribers )')
    expect(html.includes('Not the production site')).toBe(restricted)
  })

  it('renders a draft’s edit page and its confirm page with the exact audience', async () => {
    const id = await draft([1, 2])
    const edit = text(renderToString(await NewsletterPage({ params: Promise.resolve({ id: String(id) }), searchParams: none() })))
    expect(edit).toContain('Edit draft')

    const confirm = text(renderToString(await ConfirmSendPage({ params: Promise.resolve({ id: String(id) }), searchParams: none() })))
    expect(confirm).toContain(restricted ? 'This will email 1 person now' : 'This will email 2 people now')
  })

  it('renders a sent newsletter’s results page', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(id)
    const html = text(renderToString(await NewsletterPage({ params: Promise.resolve({ id: String(id) }), searchParams: none() })))
    expect(html).toContain('Recipients when sending started')
    expect(html).toContain('delivered+bo@resend.dev')
    expect(html.includes('ana@example.com')).toBe(!restricted)
  })

  it('renders the stage 1 topics and members pages with correct counts', async () => {
    const topics = text(renderToString(await AdminTopicsPage({ searchParams: Promise.resolve({}) })))
    expect(topics).toContain('3 subscribers')
    expect(topics).toContain('1 subscriber')
    const members = text(renderToString(await AdminMembersPage({ searchParams: Promise.resolve({}) })))
    expect(members).toMatch(/ana@example\.com .*? 2 /)
  })

  it('renders the unsubscribe page for a real link without changing anything', async () => {
    const id = await draft([1])
    await startNewsletterSend(id, { id: 1, name: 'Ada' }, SNAPSHOT)
    await processNewsletterSend(id)
    const [{ id: recipientId }] = await query<{ id: number }>('select id from newsletter_recipients order by id limit 1')
    const before = await query('select member_id, topic_id from member_topic_subscriptions order by 1, 2')
    const html = text(renderToString(await UnsubscribePage({ searchParams: Promise.resolve({ token: unsubscribeTokenFor(recipientId) }) })))
    expect(html).toContain('Unsubscribe from Events')
    expect(await query('select member_id, topic_id from member_topic_subscriptions order by 1, 2')).toEqual(before)
  })
})
