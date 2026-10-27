/**
 * Full newsletter journey against a preview deployment: sign up, confirm by email, opt into a
 * fresh topic, receive a real newsletter, and unsubscribe from the page and by one-click POST.
 *
 * Runs only when all of these are set, and skips otherwise:
 *   RESEND_API_KEY      read-only use of Resend's API to fetch the emails the preview sent.
 *                       It is sent only to https://api.resend.com, never to the preview.
 *   E2E_ADMIN_EMAIL     an admin account on the preview.
 *   E2E_ADMIN_PASSWORD
 * BASE_URL and the optional VERCEL_BYPASS are handled by playwright.config.ts and fixtures.ts.
 *
 * The preview's Site settings must have a mailing address; the spec never changes settings.
 */
import type { Browser, BrowserContext, Page, PlaywrightWorkerArgs } from '@playwright/test'
import { expect, installBypass, test } from './fixtures'

const REQUIRED_ENV = ['RESEND_API_KEY', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]?.trim())

const RUN_ID = Date.now()
const MEMBER_EMAIL = `delivered+journey-${RUN_ID}@resend.dev`
const MEMBER_PASSWORD = `e2e journey password ${RUN_ID}`
const TOPIC_NAME = `E2E journey ${RUN_ID}`
const NEWSLETTER_SUBJECT = `E2E journey newsletter ${RUN_ID}`
const NEWSLETTER_BODY = `This is an automated end-to-end check (run ${RUN_ID}).\n\nNo action is needed.`

const RESEND_API = 'https://api.resend.com'
const EMAIL_WAIT_MS = 120_000

/** UI text as of the stage 2 newsletter work; kept here so a relabel is a one-line change. */
const UI = {
  signIn: { email: 'Email', password: 'Password', submit: 'Sign in', failed: 'Invalid email or password.' },
  join: {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    age: 'I am 13 or older',
    terms: /I agree to the Terms of Use/,
    submit: 'Create account',
  },
  confirm: { password: 'Password', submit: 'Confirm my email' },
  topics: { name: 'Name', add: 'Add topic', delete: (name: string) => `Delete ${name}` },
  settings: { mailingAddress: 'Mailing address' },
  composer: {
    subject: 'Subject',
    body: 'Body',
    review: 'Review and send…',
    noAddress: 'mailing address is filled in',
  },
  confirmSend: { heading: 'This will email 1 person now', send: 'Send to 1 person' },
  sentBanner: 'Sending finished: 1 accepted',
  account: {
    save: 'Save newsletter choices',
    deletePassword: 'Your password',
    deleteConfirm: 'Type DELETE to confirm',
    deleteSubmit: 'Delete my account',
  },
  unsubscribe: {
    these: (topic: string) => `Unsubscribe from ${topic}`,
    done: (topic: string) => `You’re unsubscribed from ${topic}.`,
  },
} as const

function env(name: (typeof REQUIRED_ENV)[number]): string {
  return process.env[name]!.trim()
}

type ResendListItem = { id: string; to: string[]; subject: string; created_at: string }
type ResendEmail = { id: string; subject: string; html: string | null; text: string | null; headers?: unknown }

/** Node's fetch rather than Playwright's request context, so the key never lands in a trace. */
async function resendGet<T>(path: string): Promise<T> {
  const url = new URL(path, RESEND_API)
  if (url.origin !== RESEND_API) throw new Error('Refusing to send the Resend key anywhere but api.resend.com')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'User-Agent': 'cmu-shpe-e2e-journey' },
  })
  if (!response.ok) throw new Error(`Resend API ${url.pathname} answered ${response.status}`)
  return (await response.json()) as T
}

/** The list endpoint can lag behind a send, so this polls until a matching email shows up. */
async function waitForEmail(describe: string, matches: (email: ResendListItem) => boolean): Promise<ResendEmail> {
  const deadline = Date.now() + EMAIL_WAIT_MS
  while (Date.now() < deadline) {
    const list = await resendGet<{ data: ResendListItem[] }>('/emails?limit=100')
    const newest = list.data
      .filter((email) => email.to.some((to) => to.toLowerCase() === MEMBER_EMAIL) && matches(email))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (newest) {
      const email = await resendGet<ResendEmail>(`/emails/${encodeURIComponent(newest.id)}`)
      if (email.html !== null || email.text !== null) return email
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  throw new Error(`No ${describe} for the journey member showed up in Resend within ${EMAIL_WAIT_MS / 1000}s`)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const entries = Array.isArray(headers)
    ? headers.map((header: { name?: string; value?: string }) => [header.name ?? '', header.value ?? ''] as const)
    : Object.entries(headers as Record<string, string>)
  return entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
}

async function newContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  await installBypass(context, baseURL)
  return context
}

async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

async function signIn(page: Page, email: string, password: string, who: string, landing: string) {
  await open(page, '/login')
  await page.getByLabel(UI.signIn.email, { exact: true }).fill(email)
  await page.getByLabel(UI.signIn.password, { exact: true }).fill(password)
  await page.getByRole('button', { name: UI.signIn.submit, exact: true }).click()
  await page.waitForURL((url) => url.pathname === landing || url.searchParams.has('error'))
  if (new URL(page.url()).pathname !== landing) throw new Error(`${who} sign-in failed (${UI.signIn.failed})`)
}

/** API requests skip the browser context's routes, so the bypass header goes on the request itself. */
async function previewRequest(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined) {
  const secret = process.env.VERCEL_BYPASS
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: secret ? { 'x-vercel-protection-bypass': secret } : {},
  })
}

function previewPath(link: string) {
  const url = new URL(link)
  return `${url.pathname}${url.search}`
}

async function accountTopicBox(page: Page) {
  await open(page, '/account')
  return page.getByRole('checkbox', { name: TOPIC_NAME, exact: true })
}

// A trace would record the admin password typed into the sign-in form.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('newsletter journey', () => {
  test.skip(missingEnv.length > 0, `Set ${missingEnv.join(', ')} to run the newsletter journey`)

  test('sign up, confirm, subscribe, receive, unsubscribe and clean up', async ({ browser, baseURL, playwright }) => {
    test.setTimeout(8 * 60_000)
    const contexts: BrowserContext[] = []
    const admin = await newContext(browser, baseURL).then((context) => (contexts.push(context), context.newPage()))
    const member = await newContext(browser, baseURL).then((context) => (contexts.push(context), context.newPage()))
    let topicCreated = false
    let memberSignedIn = false

    try {
      let mailingAddressLines: string[] = []

      await test.step('admin signs in, checks the mailing address and adds the journey topic', async () => {
        await signIn(admin, env('E2E_ADMIN_EMAIL'), env('E2E_ADMIN_PASSWORD'), 'Admin', '/admin')

        await open(admin, '/admin/settings')
        const address = await admin.getByLabel(UI.settings.mailingAddress, { exact: true }).inputValue()
        mailingAddressLines = address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        if (mailingAddressLines.length === 0) {
          throw new Error(
            'The preview has no mailing address, so newsletters cannot be sent. Set Site settings → Mailing address on the preview, then rerun.',
          )
        }

        await open(admin, '/admin/topics')
        const addForm = admin.locator('form').filter({ has: admin.getByRole('button', { name: UI.topics.add, exact: true }) })
        await addForm.getByLabel(UI.topics.name, { exact: true }).fill(TOPIC_NAME)
        await addForm.getByRole('button', { name: UI.topics.add, exact: true }).click()
        await admin.waitForURL((url) => url.pathname === '/admin/topics' && url.searchParams.get('saved') === '1')
        topicCreated = true
      })

      await test.step('member signs up without opting into anything', async () => {
        await open(member, '/join')
        await member.getByLabel(UI.join.name, { exact: true }).fill('E2E Journey Tester')
        await member.getByLabel(UI.join.email, { exact: true }).fill(MEMBER_EMAIL)
        await member.getByLabel(UI.join.password, { exact: true }).fill(MEMBER_PASSWORD)
        await member.getByLabel(UI.join.confirmPassword, { exact: true }).fill(MEMBER_PASSWORD)
        await member.getByLabel(UI.join.age).check()
        await member.getByLabel(UI.join.terms).check()
        await member.getByRole('button', { name: UI.join.submit }).click()
        await member.waitForURL('**/join/check-email')
      })

      await test.step('member confirms through the emailed link', async () => {
        const email = await waitForEmail('confirmation email', () => true)
        const link = `${email.text ?? ''}\n${email.html ?? ''}`.match(/https?:\/\/[^\s"<>]+\/join\/confirm\?token=[\w-]+/)?.[0]
        expect(link, 'the confirmation email should carry a /join/confirm link').toBeTruthy()
        await open(member, previewPath(link!))
        await member.getByLabel(UI.confirm.password, { exact: true }).fill(MEMBER_PASSWORD)
        await member.getByRole('button', { name: UI.confirm.submit }).click()
        await member.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')
      })

      await test.step('member signs in and opts into the journey topic', async () => {
        await signIn(member, MEMBER_EMAIL, MEMBER_PASSWORD, 'Member', '/account')
        memberSignedIn = true
        const box = await accountTopicBox(member)
        await expect(box).not.toBeChecked()
        await box.check()
        await member.getByRole('button', { name: UI.account.save, exact: true }).click()
        await member.waitForURL((url) => url.pathname === '/account' && url.searchParams.get('saved') === 'topics')
        await expect(await accountTopicBox(member)).toBeChecked()
      })

      await test.step('admin sends a newsletter to that topic only', async () => {
        await open(admin, '/admin/newsletters/new')
        if (await admin.getByText(UI.composer.noAddress).isVisible()) {
          throw new Error('The composer says the mailing address is missing. Set Site settings → Mailing address on the preview.')
        }
        await admin.getByLabel(UI.composer.subject, { exact: true }).fill(NEWSLETTER_SUBJECT)
        await admin.getByLabel(UI.composer.body, { exact: true }).fill(NEWSLETTER_BODY)
        await admin.getByRole('checkbox', { name: TOPIC_NAME }).check()
        await admin.getByRole('button', { name: UI.composer.review, exact: true }).click()
        await admin.waitForURL(/\/admin\/newsletters\/\d+\/send$/)

        await expect(admin.getByRole('heading', { level: 2, name: UI.confirmSend.heading })).toBeVisible()
        await admin.getByRole('button', { name: UI.confirmSend.send, exact: true }).click()
        await admin.waitForURL((url) => /^\/admin\/newsletters\/\d+$/.test(url.pathname) && url.searchParams.get('sent') === '1', {
          timeout: 120_000,
        })
        await expect(admin.locator('main').getByRole('status').filter({ hasText: UI.sentBanner })).toBeVisible()
      })

      let unsubscribeLink = ''
      let token = ''

      await test.step('the newsletter arrives with the mailing address, an unsubscribe link and one-click headers', async () => {
        const email = await waitForEmail('newsletter', (item) => item.subject === NEWSLETTER_SUBJECT)
        const html = email.html ?? ''
        const text = email.text ?? ''
        expect(html, 'the newsletter should have an html part').not.toBe('')
        expect(text, 'the newsletter should have a text part').not.toBe('')

        for (const line of mailingAddressLines) {
          expect(text, 'mailing address in the text part').toContain(line)
          expect(html, 'mailing address in the html part').toContain(escapeHtml(line))
        }

        unsubscribeLink = text.match(/https:\/\/\S+\/unsubscribe\?token=[\w-]{43}/)?.[0] ?? ''
        expect(unsubscribeLink, 'the text part should carry an /unsubscribe?token= link').not.toBe('')
        token = new URL(unsubscribeLink).searchParams.get('token')!
        expect(html, 'the html part should carry the same unsubscribe link').toContain(`/unsubscribe?token=${token}`)

        const listUnsubscribe = headerValue(email.headers, 'List-Unsubscribe')
        const listUnsubscribePost = headerValue(email.headers, 'List-Unsubscribe-Post')
        if (listUnsubscribe === undefined && listUnsubscribePost === undefined) {
          test.info().annotations.push({
            type: 'not checked',
            description: 'Resend’s retrieve-email response does not expose headers, so List-Unsubscribe was not verified here.',
          })
        } else {
          expect(listUnsubscribe).toBe(`<${new URL(unsubscribeLink).origin}/unsubscribe/one-click?token=${token}>`)
          expect(listUnsubscribePost).toBe('List-Unsubscribe=One-Click')
        }
      })

      await test.step('opening the unsubscribe link changes nothing until the button is pressed', async () => {
        if (new URL(unsubscribeLink).origin !== new URL(baseURL!).origin) {
          test.info().annotations.push({
            type: 'origin',
            description: 'The emailed link points at the preview’s SITE_URL, not BASE_URL; its path was opened on BASE_URL.',
          })
        }
        const unsubscribeButton = member.getByRole('button', { name: UI.unsubscribe.these(TOPIC_NAME), exact: true })
        await open(member, previewPath(unsubscribeLink))
        await expect(unsubscribeButton).toBeVisible()
        await member.reload()
        await expect(unsubscribeButton).toBeVisible()
        await expect(await accountTopicBox(member)).toBeChecked()

        await open(member, previewPath(unsubscribeLink))
        await unsubscribeButton.click()
        await expect(member.getByText(UI.unsubscribe.done(TOPIC_NAME), { exact: true })).toBeVisible()
        await expect(await accountTopicBox(member)).not.toBeChecked()
      })

      await test.step('one-click POST answers 200, and 200 again on a repeat', async () => {
        const request = await previewRequest(playwright, baseURL)
        try {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await request.post(`/unsubscribe/one-click?token=${encodeURIComponent(token)}`, {
              data: 'List-Unsubscribe=One-Click',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              maxRedirects: 0,
            })
            expect(response.status(), `one-click POST attempt ${attempt + 1}`).toBe(200)
          }
        } finally {
          await request.dispose()
        }
      })
    } finally {
      const cleanupProblems: string[] = []

      await test.step('clean up the journey topic and member', async () => {
        if (topicCreated) {
          try {
            await open(admin, '/admin/topics')
            admin.once('dialog', (dialog) => dialog.accept())
            await admin.getByRole('button', { name: UI.topics.delete(TOPIC_NAME), exact: true }).click()
            await admin.waitForURL((url) => url.searchParams.get('saved') === '1')
            await expect(admin.getByRole('button', { name: UI.topics.delete(TOPIC_NAME), exact: true })).toHaveCount(0)
          } catch {
            cleanupProblems.push(`delete the topic "${TOPIC_NAME}" in /admin/topics`)
          }
        }

        try {
          if (!memberSignedIn) await signIn(member, MEMBER_EMAIL, MEMBER_PASSWORD, 'Member', '/account')
          await open(member, '/account')
          await member.getByLabel(UI.account.deletePassword, { exact: true }).fill(MEMBER_PASSWORD)
          await member.getByLabel(UI.account.deleteConfirm, { exact: true }).fill('DELETE')
          await member.getByRole('button', { name: UI.account.deleteSubmit, exact: true }).click()
          await member.waitForURL('**/account/deleted')
        } catch {
          cleanupProblems.push(`delete the member ${MEMBER_EMAIL} (it may never have been confirmed)`)
        }
      })

      for (const context of contexts) await context.close()
      if (cleanupProblems.length > 0) {
        test.info().annotations.push({ type: 'cleanup needed', description: cleanupProblems.join('; ') })
      }
    }
  })
})
