/**
 * Full sponsor journey against a preview deployment: two members sign up and confirm by email, the
 * admin links member A to a fresh listing, A edits the listing (live on /sponsors, logged in the edit
 * history), sees /sponsor and its event calendar, and downloads a receipt the admin uploaded, member B
 * (a supporter) is kept out of both, an RSVP fills and frees a capacity-1 event, B RSVPs and the admin
 * exports the attendee CSV. Everything it creates is deleted in afterAll, which runs even when a step
 * fails.
 *
 * Runs only when all of these are set, and skips otherwise:
 *   RESEND_API_KEY      read-only use of Resend's API to fetch the confirmation emails.
 *                       It is sent only to https://api.resend.com, never to the preview.
 *   E2E_ADMIN_EMAIL     an admin account on the preview.
 *   E2E_ADMIN_PASSWORD
 * BASE_URL and the optional VERCEL_BYPASS are handled by playwright.config.ts and fixtures.ts.
 *
 * Skips on a local server unless E2E_LOCAL_DATABASE_IS_DISPOSABLE=1. Every write is re-checked with
 * assertWriteTarget from preview-guard.ts first, so a reordered step can't
 * slip ahead of the guard.
 * Only delivered+…@resend.dev test inboxes are ever signed up.
 *
 * Receipt uploads and RSVPs report back in place rather than redirecting, so those steps wait for the
 * page's own status text. Receipts and audit rows go with the listing (ON DELETE CASCADE)
 * and RSVPs with the event, so cleanup deletes only the listing, the event and the two members.
 */
import { readFile } from 'node:fs/promises'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { bypassHeaders, expect, expectNoAxeViolations, installBypass, test, type Theme } from './fixtures'
import { assertWriteTarget, localWriteRefusal } from './preview-guard'

const REQUIRED_ENV = ['RESEND_API_KEY', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]?.trim())

const RUN_ID = Date.now()
const RESEND_API = 'https://api.resend.com'
const EMAIL_WAIT_MS = 120_000

type JourneyMember = { label: string; name: string; email: string; password: string }

const SPONSOR_MEMBER: JourneyMember = {
  label: 'Member A',
  name: `E2E Sponsor A ${RUN_ID}`,
  email: `delivered+sponsor-a-${RUN_ID}@resend.dev`,
  password: `e2e sponsor password a ${RUN_ID}`,
}
const SUPPORTER_MEMBER: JourneyMember = {
  label: 'Member B',
  name: `E2E Supporter B ${RUN_ID}`,
  email: `delivered+sponsor-b-${RUN_ID}@resend.dev`,
  password: `e2e sponsor password b ${RUN_ID}`,
}

const LISTING_NAME = `E2E Sponsor ${RUN_ID}`
const EDITED_LISTING = {
  name: `E2E Sponsor ${RUN_ID} edited`,
  website: 'https://example.com/e2e-sponsor',
  description: `Edited by the sponsor journey, run ${RUN_ID}.`,
  bgColor: '#1f6f8b',
}
const RECEIPT_TITLE = `E2E receipt ${RUN_ID}`
const RECEIPT_FILE_NAME = `e2e-receipt-${RUN_ID}.pdf`
const RECEIPT_DATE = '2026-01-15'
const EVENT_TITLE = `E2E RSVP event ${RUN_ID}`

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
  delete: (name: string) => `Delete ${name}`,
  adminSponsors: { name: 'Name', add: 'Add sponsor' },
  adminMembers: { listing: /Sponsor listing/, promote: 'Make sponsor', roleSponsor: 'Sponsor' },
  listingForm: {
    name: 'Name',
    website: 'Website (optional)',
    description: 'Description (optional)',
    bgColor: 'Logo background color',
    save: 'Save listing',
  },
  auditRegion: 'Edit history',
  receipts: {
    region: 'Receipts',
    title: 'Title',
    date: 'Receipt date',
    file: 'PDF file',
    upload: 'Upload receipt',
    uploaded: 'Receipt uploaded.',
  },
  adminEvents: {
    title: 'Title',
    description: 'Description',
    location: 'Location',
    date: 'Date',
    capacity: 'Capacity (optional)',
    add: 'Add event',
  },
  rsvp: { join: /^RSVP/, cancel: /^Cancel RSVP/, full: 'Full' },
  sponsorCalendar: 'Upcoming events',
  attendees: { link: `Attendees for ${EVENT_TITLE}`, csv: `Download CSV of attendees for ${EVENT_TITLE}` },
} as const

const ROUTES = {
  sponsorHome: '/sponsor',
  supporterHome: '/account',
  adminHome: '/admin',
  listingDetail: /^\/admin\/sponsors\/(\d+)$/,
  receiptDownload: /^\/sponsor\/receipts\/\d+$/,
} as const

function env(name: (typeof REQUIRED_ENV)[number]): string {
  return process.env[name]!.trim()
}

type ResendListItem = { id: string; to: string[]; subject: string; created_at: string }
type ResendEmail = { id: string; subject: string; html: string | null; text: string | null }

/** Node's fetch rather than Playwright's request context, so the key never lands in a trace. */
async function resendGet<T>(path: string): Promise<T> {
  const url = new URL(path, RESEND_API)
  if (url.origin !== RESEND_API) throw new Error('Refusing to send the Resend key anywhere but api.resend.com')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'User-Agent': 'cmu-shpe-e2e-sponsor-journey' },
  })
  if (!response.ok) throw new Error(`Resend API ${url.pathname} answered ${response.status}`)
  return (await response.json()) as T
}

/** The list endpoint can lag behind a send, so this polls until the email shows up. */
async function waitForConfirmationEmail(address: string): Promise<ResendEmail> {
  const deadline = Date.now() + EMAIL_WAIT_MS
  while (Date.now() < deadline) {
    const list = await resendGet<{ data: ResendListItem[] }>('/emails?limit=100')
    const newest = list.data
      .filter((email) => email.to.some((to) => to.toLowerCase() === address))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (newest) {
      const email = await resendGet<ResendEmail>(`/emails/${encodeURIComponent(newest.id)}`)
      if (email.html !== null || email.text !== null) return email
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  throw new Error(`No confirmation email for ${address} showed up in Resend within ${EMAIL_WAIT_MS / 1000}s`)
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

/** Waits for a form action's redirect and fails with the ?error= code when it was refused. */
async function expectSaved(page: Page, pathname: string | RegExp, what: string) {
  const matchesPath = (path: string) => (typeof pathname === 'string' ? path === pathname : pathname.test(path))
  await page.waitForURL((url) => matchesPath(url.pathname) && (url.searchParams.has('saved') || url.searchParams.has('error')))
  const error = new URL(page.url()).searchParams.get('error')
  expect(error, `${what} was refused`).toBeNull()
}

function previewPath(link: string) {
  const url = new URL(link)
  return `${url.pathname}${url.search}`
}

async function signUpAndConfirm(page: Page, member: JourneyMember, baseURL: string | undefined) {
  assertWriteTarget(baseURL, `sign up ${member.label}`)
  await open(page, '/join')
  await page.getByLabel(UI.join.name, { exact: true }).fill(member.name)
  await page.getByLabel(UI.join.email, { exact: true }).fill(member.email)
  await page.getByLabel(UI.join.password, { exact: true }).fill(member.password)
  await page.getByLabel(UI.join.confirmPassword, { exact: true }).fill(member.password)
  await page.getByLabel(UI.join.age).check()
  await page.getByLabel(UI.join.terms).check()
  created.members.push(member)
  await page.getByRole('button', { name: UI.join.submit }).click()
  await page.waitForURL('**/join/check-email')

  const email = await waitForConfirmationEmail(member.email)
  const link = `${email.text ?? ''}\n${email.html ?? ''}`.match(/https?:\/\/[^\s"<>]+\/join\/confirm\?token=[\w-]+/)?.[0]
  expect(link, `${member.label}'s confirmation email should carry a /join/confirm link`).toBeTruthy()
  assertWriteTarget(baseURL, `confirm ${member.label}`)
  await open(page, previewPath(link!))
  await page.getByLabel(UI.confirm.password, { exact: true }).fill(member.password)
  await page.getByRole('button', { name: UI.confirm.submit }).click()
  await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')
}

function formWithButton(page: Page, button: string) {
  return page.locator('form').filter({ has: page.getByRole('button', { name: button, exact: true }) })
}

/** Ancestors come before descendants in document order, so the last match is the card itself. */
function eventCard(page: Page) {
  return page
    .locator('main div, main article, main li')
    .filter({ has: page.getByRole('heading', { name: EVENT_TITLE, exact: true }) })
    .last()
}

async function axeInBothThemes(page: Page, path: string) {
  for (const theme of ['light', 'dark'] satisfies Theme[]) {
    await page.evaluate((value) => window.localStorage.setItem('theme', value), theme)
    await open(page, path)
    const htmlClass = (await page.locator('html').getAttribute('class')) ?? ''
    expect(/\bdark\b/.test(htmlClass), `${path} in ${theme} mode`).toBe(theme === 'dark')
    await expectNoAxeViolations(page)
  }
}

/** A PDF by magic bytes, just under the 4 MB cap, with non-text bytes so any re-encoding shows up. */
function generatedPdf(): Buffer {
  const size = Math.floor(3.9 * 1024 * 1024)
  const pdf = Buffer.alloc(size)
  for (let index = 0; index < size; index += 1) pdf[index] = (index * 131 + 17) & 0xff
  pdf.write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 0, 'latin1')
  pdf.write('\n%%EOF\n', size - 7, 'latin1')
  return pdf
}

function dateInDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * What afterAll has to remove. Each entry is recorded just before its submit, so a create that went
 * through but failed a later check is still cleaned up; cleanup treats a missing record as gone.
 * Listing names are newest first, since an edit may have landed without passing its checks.
 */
const created = {
  baseURL: undefined as string | undefined,
  listing: null as null | { id: string | null; names: string[] },
  event: false,
  members: [] as JourneyMember[],
}

// A trace would record the admin and member passwords typed into the forms.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('sponsor journey', () => {
  test.skip(missingEnv.length > 0, `Set ${missingEnv.join(', ')} to run the sponsor journey`)
  test.skip(localWriteRefusal(process.env.BASE_URL) !== null, localWriteRefusal(process.env.BASE_URL) ?? '')

  test('link a sponsor, edit the listing, download a receipt, keep a supporter out, fill an event', async ({
    browser,
    baseURL,
  }) => {
    assertWriteTarget(baseURL, 'sign in as the admin')
    created.baseURL = baseURL
    test.setTimeout(10 * 60_000)
    const contexts: BrowserContext[] = []
    const newPage = async () => newContext(browser, baseURL).then((context) => (contexts.push(context), context.newPage()))
    const admin = await newPage()
    const sponsor = await newPage()
    const supporter = await newPage()

    try {
      await test.step('admin signs in and creates the journey listing', async () => {
        await signIn(admin, env('E2E_ADMIN_EMAIL'), env('E2E_ADMIN_PASSWORD'), 'Admin', ROUTES.adminHome)
        assertWriteTarget(baseURL, 'create a sponsor listing')
        await open(admin, '/admin/sponsors')
        const addForm = formWithButton(admin, UI.adminSponsors.add)
        await addForm.getByLabel(UI.adminSponsors.name, { exact: true }).fill(LISTING_NAME)
        created.listing = { id: null, names: [LISTING_NAME] }
        await addForm.getByRole('button', { name: UI.adminSponsors.add, exact: true }).click()
        await expectSaved(admin, /^\/admin\/sponsors(\/\d+)?$/, 'Creating the listing')

        let id = new URL(admin.url()).pathname.match(ROUTES.listingDetail)?.[1]
        if (!id) {
          const item = admin.locator('li').filter({ hasText: LISTING_NAME })
          const href = await item.locator('a[href^="/admin/sponsors/"]').first().getAttribute('href')
          id = href?.match(ROUTES.listingDetail)?.[1]
        }
        if (!id) throw new Error(`No /admin/sponsors/<id> link found for "${LISTING_NAME}" (assumption 1)`)
        created.listing.id = id
      })

      await test.step('members A and B sign up and confirm through the emailed links', async () => {
        await signUpAndConfirm(sponsor, SPONSOR_MEMBER, baseURL)
        await signUpAndConfirm(supporter, SUPPORTER_MEMBER, baseURL)
      })

      await test.step('admin promotes member A and links the listing', async () => {
        assertWriteTarget(baseURL, 'promote member A')
        await open(admin, `/admin/members?q=${encodeURIComponent(SPONSOR_MEMBER.email)}`)
        const row = admin.getByRole('row').filter({ hasText: SPONSOR_MEMBER.email })
        await row.getByLabel(UI.adminMembers.listing).selectOption({ label: LISTING_NAME })
        await row.getByRole('button', { name: UI.adminMembers.promote }).click()
        await expectSaved(admin, '/admin/members', 'Promoting member A')
        await open(admin, `/admin/members?q=${encodeURIComponent(SPONSOR_MEMBER.email)}`)
        await expect(admin.getByRole('row').filter({ hasText: SPONSOR_MEMBER.email })).toContainText(
          UI.adminMembers.roleSponsor,
        )
      })

      await test.step('member A signs in, lands on /sponsor and the page passes axe', async () => {
        await signIn(sponsor, SPONSOR_MEMBER.email, SPONSOR_MEMBER.password, 'Member A', ROUTES.sponsorHome)
        await expect(
          formWithButton(sponsor, UI.listingForm.save).getByLabel(UI.listingForm.name, { exact: true }),
        ).toHaveValue(LISTING_NAME)
        await axeInBothThemes(sponsor, ROUTES.sponsorHome)
      })

      await test.step('member A edits the listing and the change is live', async () => {
        assertWriteTarget(baseURL, 'edit the listing as member A')
        await open(sponsor, ROUTES.sponsorHome)
        const form = formWithButton(sponsor, UI.listingForm.save)
        await form.getByLabel(UI.listingForm.name, { exact: true }).fill(EDITED_LISTING.name)
        await form.getByLabel(UI.listingForm.website, { exact: true }).fill(EDITED_LISTING.website)
        await form.getByRole('textbox', { name: UI.listingForm.description, exact: true }).fill(EDITED_LISTING.description)
        await form.getByLabel(UI.listingForm.bgColor, { exact: true }).fill(EDITED_LISTING.bgColor)
        created.listing!.names.unshift(EDITED_LISTING.name)
        await form.getByRole('button', { name: UI.listingForm.save, exact: true }).click()
        await expectSaved(sponsor, ROUTES.sponsorHome, 'Saving the listing')

        await open(sponsor, ROUTES.sponsorHome)
        const saved = formWithButton(sponsor, UI.listingForm.save)
        await expect(saved.getByLabel(UI.listingForm.name, { exact: true })).toHaveValue(EDITED_LISTING.name)
        await expect(saved.getByRole('textbox', { name: UI.listingForm.description, exact: true })).toHaveValue(EDITED_LISTING.description)
        await expect(saved.getByLabel(UI.listingForm.bgColor, { exact: true })).toHaveValue(EDITED_LISTING.bgColor)

        await open(supporter, '/sponsors')
        await expect(supporter.locator('main')).toContainText(EDITED_LISTING.name)
      })

      await test.step('the admin sees the edit in the listing audit log', async () => {
        await open(admin, `/admin/sponsors/${created.listing!.id}`)
        const audit = admin.getByRole('region', { name: UI.auditRegion })
        await expect(audit).toContainText(SPONSOR_MEMBER.name)
        for (const field of [/name/i, /description/i, /colou?r/i]) await expect(audit).toContainText(field)
        await expect(audit).not.toContainText(SPONSOR_MEMBER.email)
      })

      const pdf = generatedPdf()

      await test.step('admin uploads a 3.9 MB PDF receipt to the listing', async () => {
        assertWriteTarget(baseURL, 'upload a receipt')
        const detailPath = `/admin/sponsors/${created.listing!.id}`
        await open(admin, detailPath)
        const receipts = admin.getByRole('region', { name: UI.receipts.region })
        await receipts.getByLabel(UI.receipts.title, { exact: true }).fill(RECEIPT_TITLE)
        await receipts.getByLabel(UI.receipts.date, { exact: true }).fill(RECEIPT_DATE)
        await receipts
          .getByLabel(UI.receipts.file, { exact: true })
          .setInputFiles({ name: RECEIPT_FILE_NAME, mimeType: 'application/pdf', buffer: pdf })
        await receipts.getByRole('button', { name: UI.receipts.upload, exact: true }).click()
        await expect(receipts.getByRole('status')).toContainText(UI.receipts.uploaded)
        await expect(receipts).toContainText(RECEIPT_TITLE)
      })

      let receiptPath = ''

      await test.step('member A downloads the receipt byte for byte, as a private attachment', async () => {
        await open(sponsor, ROUTES.sponsorHome)
        const link = sponsor.getByRole('region', { name: UI.receipts.region }).getByRole('link', { name: RECEIPT_TITLE })
        receiptPath = new URL((await link.getAttribute('href')) ?? '', baseURL).pathname
        expect(receiptPath, 'receipt download link').toMatch(ROUTES.receiptDownload)

        const response = await sponsor.context().request.get(receiptPath, { headers: bypassHeaders(), maxRedirects: 0 })
        expect(response.status()).toBe(200)
        const headers = response.headers()
        expect(headers['content-type']).toMatch(/^application\/pdf\b/)
        expect(headers['content-disposition']).toMatch(/^attachment\s*;/i)
        expect(headers['content-disposition']).toContain(RECEIPT_FILE_NAME)
        expect(headers['cache-control']).toMatch(/\bprivate\b/)
        expect(headers['cache-control']).toMatch(/\bno-store\b/)
        expect(headers['x-content-type-options']).toBe('nosniff')

        const body = await response.body()
        expect(body.length, 'downloaded size').toBe(pdf.length)
        expect(body.equals(pdf), 'downloaded bytes match the upload').toBe(true)
      })

      await test.step('member B gets no PDF from the same URL and is sent from /sponsor to /account', async () => {
        await signIn(supporter, SUPPORTER_MEMBER.email, SUPPORTER_MEMBER.password, 'Member B', ROUTES.supporterHome)
        const response = await supporter.context().request.get(receiptPath, { headers: bypassHeaders(), maxRedirects: 0 })
        expect(response.status(), 'another member asking for the receipt').toBe(404)
        expect(response.headers()['content-type'] ?? '').not.toContain('application/pdf')
        expect(response.headers()['content-disposition'] ?? '').not.toMatch(/attachment/i)

        await supporter.goto(ROUTES.sponsorHome)
        await expect(supporter).toHaveURL((url) => url.pathname === ROUTES.supporterHome)
      })

      await test.step('admin creates an upcoming event with room for one', async () => {
        assertWriteTarget(baseURL, 'create an event')
        await open(admin, '/admin/events')
        const addForm = formWithButton(admin, UI.adminEvents.add)
        await addForm.getByLabel(UI.adminEvents.title, { exact: true }).fill(EVENT_TITLE)
        await addForm.getByLabel(UI.adminEvents.description, { exact: true }).fill(`Sponsor journey run ${RUN_ID}.`)
        await addForm.getByLabel(UI.adminEvents.location, { exact: true }).fill('E2E test room')
        await addForm.getByLabel(UI.adminEvents.date, { exact: true }).fill(dateInDays(14))
        await addForm.getByLabel(UI.adminEvents.capacity, { exact: true }).fill('1')
        created.event = true
        await addForm.getByRole('button', { name: UI.adminEvents.add, exact: true }).click()
        await expectSaved(admin, '/admin/events', 'Creating the event')
      })

      await test.step('member A sees the event on the /sponsor calendar', async () => {
        await open(sponsor, ROUTES.sponsorHome)
        const calendar = sponsor
          .locator('main section')
          .filter({ has: sponsor.getByRole('heading', { level: 2, name: UI.sponsorCalendar, exact: true }) })
        await expect(calendar.getByRole('heading', { name: EVENT_TITLE, exact: true })).toBeVisible()
      })

      await test.step('member A takes the only place and member B sees the event as full', async () => {
        assertWriteTarget(baseURL, 'RSVP as member A')
        await open(sponsor, '/events')
        await eventCard(sponsor).getByRole('button', { name: UI.rsvp.join }).click()
        await expect(eventCard(sponsor).getByRole('button', { name: UI.rsvp.cancel })).toBeVisible()

        await open(supporter, '/events')
        await expect(eventCard(supporter)).toContainText(UI.rsvp.full)
        await expect(eventCard(supporter).getByRole('button', { name: UI.rsvp.join })).toHaveCount(0)
        await axeInBothThemes(supporter, '/events')
      })

      await test.step('member A cancels and the place opens up again', async () => {
        assertWriteTarget(baseURL, 'cancel member A’s RSVP')
        await open(sponsor, '/events')
        await eventCard(sponsor).getByRole('button', { name: UI.rsvp.cancel }).click()
        await expect(eventCard(sponsor).getByRole('button', { name: UI.rsvp.join })).toBeVisible()

        await open(supporter, '/events')
        await expect(eventCard(supporter).getByRole('button', { name: UI.rsvp.join })).toBeVisible()
      })

      await test.step('member B RSVPs and the admin exports the attendee CSV', async () => {
        assertWriteTarget(baseURL, 'RSVP as member B')
        await eventCard(supporter).getByRole('button', { name: UI.rsvp.join }).click()
        await expect(eventCard(supporter).getByRole('button', { name: UI.rsvp.cancel })).toBeVisible()

        await open(admin, '/admin/events')
        await admin.getByRole('link', { name: UI.attendees.link, exact: true }).click()
        await expect(admin.locator('main')).toContainText(SUPPORTER_MEMBER.email)
        const [download] = await Promise.all([
          admin.waitForEvent('download'),
          admin.getByRole('link', { name: UI.attendees.csv, exact: true }).click(),
        ])
        expect(download.suggestedFilename()).toMatch(/^event-\d+-attendees\.csv$/)
        const csv = await readFile(await download.path(), 'utf8')
        const lines = csv.trim().split(/\r?\n/)
        expect(lines[0]).toBe('Name,Email,RSVP time (UTC)')
        expect(lines.slice(1)).toEqual([expect.stringContaining(SUPPORTER_MEMBER.email)])
      })
    } finally {
      for (const context of contexts) await context.close()
    }
  })

  test.afterAll(async ({ browser }) => {
    const baseURL = created.baseURL
    const anythingCreated = created.listing || created.event || created.members.length > 0
    if (missingEnv.length > 0 || !baseURL || !anythingCreated) return
    test.setTimeout(3 * 60_000)

    const context = await newContext(browser, baseURL)
    const admin = await context.newPage()
    admin.on('dialog', (dialog) => dialog.accept())
    const problems: string[] = []

    async function attempt(description: string, run: () => Promise<void>) {
      try {
        assertWriteTarget(baseURL, description)
        await run()
      } catch (error) {
        problems.push(`${description}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
      }
    }

    /** Returns false when there was nothing to delete under that name. */
    async function deleteFrom(path: string, name: string, successPath: string) {
      await open(admin, path)
      const button = admin.getByRole('button', { name: UI.delete(name), exact: true })
      if ((await button.count()) === 0) return false
      await button.click()
      await expectSaved(admin, successPath, `Deleting ${name}`)
      await open(admin, path)
      await expect(admin.getByRole('button', { name: UI.delete(name), exact: true })).toHaveCount(0)
      return true
    }

    try {
      await signIn(admin, env('E2E_ADMIN_EMAIL'), env('E2E_ADMIN_PASSWORD'), 'Admin', ROUTES.adminHome)

      const listing = created.listing
      if (listing) {
        await attempt(`delete the listing "${listing.names.join('" or "')}"`, async () => {
          for (const name of listing.names) {
            if (await deleteFrom('/admin/sponsors', name, '/admin/sponsors')) return
          }
        })
      }
      if (created.event) {
        await attempt(`delete the event "${EVENT_TITLE}"`, async () => {
          await deleteFrom('/admin/events', EVENT_TITLE, '/admin/events')
        })
      }
      for (const member of created.members) {
        await attempt(`delete the member ${member.email}`, async () => {
          await deleteFrom(`/admin/members?q=${encodeURIComponent(member.email)}`, member.name, '/admin/members')
        })
      }
    } catch (error) {
      problems.push(`admin sign-in for cleanup: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    } finally {
      await context.close()
    }

    if (problems.length > 0) {
      throw new Error(`Sponsor journey cleanup left data on the preview; remove it by hand:\n- ${problems.join('\n- ')}`)
    }
  })
})
