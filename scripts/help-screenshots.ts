/**
 * Captures the user-guide screenshots listed in docs/guides/screenshots.json from a Vercel preview.
 *
 *   BASE_URL=https://cmu-shpe-website-<hash>-shpecmu.vercel.app npm run help:screenshots [-- --only officers/topics,members/join] [-- --cleanup-only]
 *
 * Needs VERCEL_BYPASS, RESEND_API_KEY and a master account in E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 *
 * Preview databases are copies of production and hold real members, so the script makes its own
 * clearly fake records (a "Jordan Example" admin, "Alex Example" and "Sam Example" members on
 * @resend.dev, "Example Corp", "Example Mixer", "Example Updates"), captures every screen as one of
 * those accounts, hides or masks any row that is not one of them, and deletes it all at the end.
 * The one sent "Example newsletter" stays in the preview's send history; sent newsletters cannot be
 * deleted.
 *
 * The setup runs in stages and each shot names the stage it needs, because some screens only exist
 * in between (a confirmation link before it is used, an RSVP button before the member RSVPs).
 */
import { mkdir, readFile, stat } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'

const STAGES = ['start', 'signed-up', 'confirmed', 'linked', 'sponsor-rsvp', 'review', 'sent'] as const
type Stage = (typeof STAGES)[number]
type Role = 'signed-out' | 'member' | 'sponsor' | 'admin' | 'master'
type Prepare = 'edit-heading' | 'fake-settings' | 'compose' | 'choose-listing' | 'choose-logo'

type Shot = {
  guide: 'officers' | 'members' | 'sponsors'
  slug: string
  url: string
  role: Role
  stage: Stage
  setup: string
  viewport?: 'desktop' | 'mobile'
  prepare?: Prepare
  element?: string[]
  highlight?: string[]
  hideUnlessFake?: string[]
  mask?: string[]
}

const ROOT = process.cwd()
const MANIFEST = path.join(ROOT, 'docs/guides/screenshots.json')
const OUTPUT = path.join(ROOT, 'public/help/img')
const PREVIEW_HOST = /^cmu-shpe-website-[a-z0-9]+-shpecmu\.vercel\.app$/
const RESEND_API = 'https://api.resend.com'
const EMAIL_WAIT_MS = 120_000
const MAX_BYTES = 400 * 1024
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } } as const
const PREVIEW_AUDIENCE_NOTICE = 'Not the production site: only @resend.dev test addresses receive this newsletter.'
const FAKE = /\bExample\b|@resend\.dev\b/i
const HIGHLIGHT_COLOR = '#ea580c'

const RUN_ID = Date.now()
const password = () => `guides ${randomBytes(12).toString('base64url')}`

type Account = { name: string; email: string; password: string }
const FAKE_ADMIN: Account = { name: 'Jordan Example', email: `delivered+guides-admin-${RUN_ID}@resend.dev`, password: password() }
const FAKE_MEMBER: Account = { name: 'Alex Example', email: `delivered+guides-alex-${RUN_ID}@resend.dev`, password: password() }
const FAKE_SPONSOR: Account = { name: 'Sam Example', email: `delivered+guides-sam-${RUN_ID}@resend.dev`, password: password() }
const LISTING = {
  name: 'Example Corp',
  website: 'https://example.com',
  description: 'Example Corp builds sample software for sample customers. This listing is demo data.',
}
const EVENT = { title: 'Example Mixer', description: 'Meet officers and sponsors over snacks.', location: 'Example Hall 101', capacity: '30' }
const TOPIC = 'Example Updates'
const RECEIPT = { title: 'Example Corp sponsorship receipt', date: '2026-09-15', file: 'example-receipt.pdf' }
const NEWSLETTER = {
  subject: 'Example newsletter',
  body: 'Hello from the chapter!\n\nOur next meeting is Thursday. Bring a friend.',
}
const FAKE_SETTINGS: Record<string, string> = {
  contactEmail: 'chapter@example.org',
  meetingDay: 'Thursday',
  meetingTime: '6:00 PM',
  meetingLocation: 'Example Hall 101',
  mailingAddress: 'SHPE Example Chapter\n123 Example Ave\nGrand Junction, CO 81501',
}

const STABLE_CSS = `
*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
html { scroll-behavior: auto !important; }
#vercel-live-feedback, vercel-live-feedback, [data-vercel-toolbar] { display: none !important; }
`

function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name}`)
  return value
}

const BASE_URL = new URL(env('BASE_URL')).origin

/** Checked before each write rather than once, so a reordered step can't slip ahead of it. */
function assertPreviewHost(action: string) {
  const host = new URL(BASE_URL).hostname
  if (!PREVIEW_HOST.test(host)) {
    throw new Error(`Refusing to ${action} on ${host}: only a cmu-shpe-website-<hash>-shpecmu.vercel.app preview.`)
  }
}

async function installBypass(context: BrowserContext) {
  await context.route(/^https:\/\/vercel\.live\//, (route) => route.abort())
  const secret = process.env.VERCEL_BYPASS
  if (!secret) return
  let cookieRequested = false
  await context.route(
    (url) => url.origin === BASE_URL,
    async (route) => {
      const headers: Record<string, string> = {
        ...route.request().headers(),
        'x-vercel-protection-bypass': secret,
        'x-vercel-skip-toolbar': '1',
      }
      if (!cookieRequested) {
        cookieRequested = true
        headers['x-vercel-set-bypass-cookie'] = 'true'
      }
      await route.continue({ headers })
    },
  )
}

async function newContext(browser: Browser, viewport: keyof typeof VIEWPORTS = 'desktop') {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'America/Denver',
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  await installBypass(context)
  return context
}

async function open(page: Page, url: string) {
  const response = await page.goto(url)
  if (!response || response.status() >= 400) throw new Error(`${url} answered ${response?.status()}`)
  await page.waitForLoadState('networkidle')
}

async function signIn(page: Page, account: Pick<Account, 'email' | 'password'>, who: string, landing: string) {
  await open(page, '/login')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === landing || url.searchParams.has('error'))
  if (new URL(page.url()).pathname !== landing) throw new Error(`${who} sign-in failed`)
}

async function expectSaved(page: Page, pathname: RegExp, what: string) {
  await page.waitForURL((url) => pathname.test(url.pathname) && (url.searchParams.has('saved') || url.searchParams.has('error')))
  const error = new URL(page.url()).searchParams.get('error')
  if (error) throw new Error(`${what} was refused (${error})`)
}

function formWithButton(page: Page, button: string) {
  return page.locator('form').filter({ has: page.getByRole('button', { name: button, exact: true }) })
}

function eventCard(page: Page) {
  return page
    .locator('main div, main article, main li')
    .filter({ has: page.getByRole('heading', { name: EVENT.title, exact: true }) })
    .last()
}

function previewPath(link: string) {
  const url = new URL(link)
  return `${url.pathname}${url.search}`
}

type ResendListItem = { id: string; to: string[]; subject: string; created_at: string }
type ResendEmail = { id: string; subject: string; html: string | null; text: string | null }

/** Node's fetch, so the key only ever goes to api.resend.com. */
async function resendGet<T>(pathname: string): Promise<T> {
  const url = new URL(pathname, RESEND_API)
  if (url.origin !== RESEND_API) throw new Error('Refusing to send the Resend key anywhere but api.resend.com')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'User-Agent': 'cmu-shpe-help-screenshots' },
  })
  if (!response.ok) throw new Error(`Resend API ${url.pathname} answered ${response.status}`)
  return (await response.json()) as T
}

async function waitForEmail(address: string, matches: (email: ResendListItem) => boolean, describe: string) {
  const deadline = Date.now() + EMAIL_WAIT_MS
  while (Date.now() < deadline) {
    const list = await resendGet<{ data: ResendListItem[] }>('/emails?limit=100')
    const newest = list.data
      .filter((email) => email.to.some((to) => to.toLowerCase() === address) && matches(email))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (newest) {
      const email = await resendGet<ResendEmail>(`/emails/${encodeURIComponent(newest.id)}`)
      if (email.html !== null || email.text !== null) return `${email.text ?? ''}\n${email.html ?? ''}`
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  throw new Error(`No ${describe} for ${address} showed up in Resend within ${EMAIL_WAIT_MS / 1000}s`)
}

/** What cleanup has to remove; each entry is recorded just before its submit. */
const created = {
  admin: false,
  members: [] as Account[],
  listingId: null as string | null,
  listing: false,
  event: false,
  topic: false,
  draftSubject: null as string | null,
}

const state = {
  confirmPath: '',
  listingId: '',
  eventId: '',
  newsletterId: '',
  unsubscribePath: '',
}

type Pages = Record<Exclude<Role, 'signed-out'>, Page>

async function makeSampleFiles(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 600, height: 300 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.setContent(
    '<div id="logo" style="width:480px;height:240px;display:flex;align-items:center;justify-content:center;background:#1f6f8b;color:#fff;font:700 52px Arial,sans-serif">Example Corp</div>',
  )
  const logo = await page.locator('#logo').screenshot({ type: 'png' })
  await page.setContent(
    `<main style="font:14px Arial,sans-serif;padding:48px"><h1>Example Corp</h1><h2>Sponsorship receipt (sample)</h2>
     <p>Date: ${RECEIPT.date}</p><p>Amount: $500.00</p><p>This is demo data for the SHPE @ CMU user guides.</p></main>`,
  )
  const receipt = await page.pdf({ format: 'Letter' })
  await context.close()
  return { logo, receipt }
}

async function assertPreviewDatabase(admin: Page) {
  await open(admin, '/admin/newsletters/new')
  const notice = await admin.getByRole('note').filter({ hasText: PREVIEW_AUDIENCE_NOTICE }).count()
  if (notice === 0) {
    throw new Error('The composer does not show the preview-only audience notice, so this may be production. Stopping before any write.')
  }
}

async function signUp(page: Page, account: Account) {
  assertPreviewHost(`sign up ${account.name}`)
  await open(page, '/join')
  await page.getByLabel('Name', { exact: true }).fill(account.name)
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByLabel('Confirm password', { exact: true }).fill(account.password)
  await page.getByLabel('I am 13 or older').check()
  await page.getByLabel(/I agree to the Terms of Use/).check()
  created.members.push(account)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('**/join/check-email')
  const email = await waitForEmail(account.email, () => true, 'confirmation email')
  const link = email.match(/https?:\/\/[^\s"<>]+\/join\/confirm\?token=[\w-]+/)?.[0]
  if (!link) throw new Error(`${account.name}'s confirmation email has no /join/confirm link`)
  return previewPath(link)
}

async function confirm(page: Page, account: Account, confirmPath: string) {
  assertPreviewHost(`confirm ${account.name}`)
  await open(page, confirmPath)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Confirm my email' }).click()
  await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')
}

const stageSetup: Record<Stage, (pages: Pages, files: { logo: Buffer; receipt: Buffer }) => Promise<void>> = {
  async start({ master, admin }) {
    await signIn(master, { email: env('E2E_ADMIN_EMAIL'), password: env('E2E_ADMIN_PASSWORD') }, 'Master', '/admin')
    await assertPreviewDatabase(master)
    assertPreviewHost('create the example admin')
    await open(master, '/admin/admins')
    const form = master.locator('section[aria-labelledby="create-admin-heading"] form')
    await form.getByLabel('Name').fill(FAKE_ADMIN.name)
    await form.getByLabel('Email').fill(FAKE_ADMIN.email)
    await form.getByLabel(/^Password/).fill(FAKE_ADMIN.password)
    created.admin = true
    await form.getByRole('button', { name: 'Create account' }).click()
    await expectSaved(master, /^\/admin\/admins$/, 'Creating the example admin')
    await signIn(admin, FAKE_ADMIN, 'Example admin', '/admin')
    await assertPreviewDatabase(admin)
  },

  async 'signed-up'({ member }) {
    state.confirmPath = await signUp(member, FAKE_MEMBER)
  },

  async confirmed({ admin, member, sponsor }) {
    await confirm(member, FAKE_MEMBER, state.confirmPath)
    await confirm(sponsor, FAKE_SPONSOR, await signUp(sponsor, FAKE_SPONSOR))

    assertPreviewHost('create the example topic')
    await open(admin, '/admin/topics')
    const topicForm = formWithButton(admin, 'Add topic')
    await topicForm.getByLabel('Name', { exact: true }).fill(TOPIC)
    created.topic = true
    await topicForm.getByRole('button', { name: 'Add topic', exact: true }).click()
    await expectSaved(admin, /^\/admin\/topics$/, 'Creating the topic')

    assertPreviewHost('create the example listing')
    await open(admin, '/admin/sponsors')
    const listingForm = formWithButton(admin, 'Add sponsor')
    await listingForm.getByLabel('Name', { exact: true }).fill(LISTING.name)
    created.listing = true
    await listingForm.getByRole('button', { name: 'Add sponsor', exact: true }).click()
    await expectSaved(admin, /^\/admin\/sponsors(\/\d+)?$/, 'Creating the listing')
    let id = new URL(admin.url()).pathname.match(/^\/admin\/sponsors\/(\d+)$/)?.[1]
    if (!id) {
      const href = await admin.locator('li').filter({ hasText: LISTING.name }).locator('a[href^="/admin/sponsors/"]').first().getAttribute('href')
      id = href?.match(/^\/admin\/sponsors\/(\d+)$/)?.[1]
    }
    if (!id) throw new Error(`No /admin/sponsors/<id> link for ${LISTING.name}`)
    state.listingId = created.listingId = id

    assertPreviewHost('create the example event')
    await open(admin, '/admin/events')
    const eventForm = formWithButton(admin, 'Add event')
    await eventForm.getByLabel('Title', { exact: true }).fill(EVENT.title)
    await eventForm.getByLabel('Description', { exact: true }).fill(EVENT.description)
    await eventForm.getByLabel('Location', { exact: true }).fill(EVENT.location)
    await eventForm.getByLabel('Date', { exact: true }).fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
    await eventForm.getByLabel('Capacity (optional)', { exact: true }).fill(EVENT.capacity)
    created.event = true
    await eventForm.getByRole('button', { name: 'Add event', exact: true }).click()
    await expectSaved(admin, /^\/admin\/events$/, 'Creating the event')
    await open(admin, '/admin/events')
    const attendees = await admin.getByRole('link', { name: `Attendees for ${EVENT.title}`, exact: true }).getAttribute('href')
    state.eventId = attendees?.match(/^\/admin\/events\/(\d+)\/attendees$/)?.[1] ?? ''
    if (!state.eventId) throw new Error(`No attendees link for ${EVENT.title}`)

    await signIn(member, FAKE_MEMBER, 'Alex', '/account')
  },

  async linked({ admin, member, sponsor }, files) {
    assertPreviewHost('make Sam a sponsor')
    await open(admin, `/admin/members?q=${encodeURIComponent(FAKE_SPONSOR.email)}`)
    const row = admin.getByRole('row').filter({ hasText: FAKE_SPONSOR.email })
    await row.getByLabel(/Sponsor listing/).selectOption({ label: LISTING.name })
    await row.getByRole('button', { name: 'Make sponsor' }).click()
    await expectSaved(admin, /^\/admin\/members$/, 'Making Sam a sponsor')

    await signIn(sponsor, FAKE_SPONSOR, 'Sam', '/sponsor')
    assertPreviewHost('edit the example listing')
    const listingForm = formWithButton(sponsor, 'Save listing')
    await listingForm.getByLabel('Website (optional)', { exact: true }).fill(LISTING.website)
    await listingForm.getByRole('textbox', { name: 'Description (optional)', exact: true }).fill(LISTING.description)
    await listingForm.getByRole('button', { name: 'Save listing', exact: true }).click()
    await expectSaved(sponsor, /^\/sponsor$/, 'Saving the listing')

    assertPreviewHost('upload the example receipt')
    await open(admin, `/admin/sponsors/${state.listingId}`)
    const receipts = admin.getByRole('region', { name: 'Receipts' })
    await receipts.getByLabel('Title', { exact: true }).fill(RECEIPT.title)
    await receipts.getByLabel('Receipt date', { exact: true }).fill(RECEIPT.date)
    await receipts.getByLabel('PDF file', { exact: true }).setInputFiles({ name: RECEIPT.file, mimeType: 'application/pdf', buffer: files.receipt })
    await receipts.getByRole('button', { name: 'Upload receipt', exact: true }).click()
    await receipts.getByRole('status').filter({ hasText: 'Receipt uploaded.' }).waitFor()

    assertPreviewHost('subscribe Alex to the example topic')
    await open(member, '/account')
    await member.getByRole('checkbox', { name: TOPIC, exact: true }).check()
    await member.getByRole('button', { name: 'Save newsletter choices', exact: true }).click()
    await member.waitForURL((url) => url.pathname === '/account' && url.searchParams.get('saved') === 'topics')

    assertPreviewHost('RSVP as Alex')
    await open(member, '/events')
    await eventCard(member).getByRole('button', { name: /^RSVP/ }).click()
    await eventCard(member).getByRole('button', { name: /^Cancel RSVP/ }).waitFor()
  },

  async 'sponsor-rsvp'({ sponsor }) {
    assertPreviewHost('RSVP as Sam')
    await open(sponsor, '/events')
    await eventCard(sponsor).getByRole('button', { name: /^RSVP/ }).click()
    await eventCard(sponsor).getByRole('button', { name: /^Cancel RSVP/ }).waitFor()
  },

  async review({ admin }) {
    await assertPreviewDatabase(admin)
    if (await admin.getByText('mailing address is filled in').isVisible()) {
      throw new Error('The preview has no mailing address, so newsletters cannot be sent there.')
    }
    assertPreviewHost('save the example newsletter')
    await admin.getByLabel('Subject', { exact: true }).fill(NEWSLETTER.subject)
    await admin.getByLabel('Body', { exact: true }).fill(NEWSLETTER.body)
    await admin.getByRole('checkbox', { name: TOPIC, exact: true }).check()
    created.draftSubject = NEWSLETTER.subject
    await admin.getByRole('button', { name: 'Review and send…', exact: true }).click()
    await admin.waitForURL(/\/admin\/newsletters\/\d+\/send$/)
    state.newsletterId = new URL(admin.url()).pathname.match(/\/admin\/newsletters\/(\d+)\/send$/)![1]
  },

  async sent({ admin }) {
    await open(admin, `/admin/newsletters/${state.newsletterId}/send`)
    const notice = await admin.getByRole('note').filter({ hasText: PREVIEW_AUDIENCE_NOTICE }).count()
    const send = admin.getByRole('button', { name: 'Send to 1 person', exact: true })
    if (notice === 0 || (await send.count()) !== 1) {
      throw new Error('Refusing to send: the page is not limited to @resend.dev or the audience is not exactly Alex Example.')
    }
    assertPreviewHost('send the example newsletter')
    await send.click()
    created.draftSubject = null
    await admin.waitForURL((url) => url.pathname === `/admin/newsletters/${state.newsletterId}` && url.searchParams.get('sent') === '1', {
      timeout: 120_000,
    })
    const email = await waitForEmail(FAKE_MEMBER.email, (item) => item.subject === NEWSLETTER.subject, 'newsletter')
    const link = email.match(/https:\/\/\S+?\/unsubscribe\?token=[\w-]{43}/)?.[0]
    if (!link) throw new Error('The example newsletter has no /unsubscribe link')
    state.unsubscribePath = previewPath(link)
  },
}

function resolveUrl(url: string) {
  const values: Record<string, string> = { ...state, memberName: FAKE_MEMBER.name, sponsorName: FAKE_SPONSOR.name }
  return url.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    if (!value) throw new Error(`No value yet for {${key}} in ${url}`)
    return key.endsWith('Name') ? encodeURIComponent(value) : value
  })
}

const prepares: Record<Prepare, (page: Page, files: { logo: Buffer }) => Promise<void>> = {
  async 'edit-heading'(page) {
    const textbox = page.locator('main [role="heading"] [role="textbox"]').first()
    await textbox.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' today')
    await page.getByRole('button', { name: 'Discard', exact: true }).waitFor()
    await textbox.blur()
  },
  async 'fake-settings'(page) {
    const card = page.locator('section[aria-labelledby="contact-settings-heading"]')
    for (const [name, value] of Object.entries(FAKE_SETTINGS)) {
      const field = card.locator(`[name="${name}"]`)
      if ((await field.count()) > 0) await field.fill(value)
    }
  },
  async compose(page) {
    await page.getByLabel('Subject', { exact: true }).fill(NEWSLETTER.subject)
    await page.getByLabel('Body', { exact: true }).fill(NEWSLETTER.body)
    await page.getByRole('checkbox', { name: TOPIC, exact: true }).check()
    await page.locator(':focus').blur()
  },
  async 'choose-listing'(page) {
    const row = page.getByRole('row').filter({ hasText: FAKE_SPONSOR.email })
    await row.getByLabel(/Sponsor listing/).selectOption({ label: LISTING.name })
  },
  async 'choose-logo'(page, files) {
    await page
      .locator('section[aria-labelledby="listing-heading"] input[type="file"][accept="image/*"]')
      .first()
      .setInputFiles({ name: 'example-corp-logo.png', mimeType: 'image/png', buffer: files.logo })
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(500)
  },
}

async function requireOne(page: Page, selector: string, shot: Shot): Promise<Locator> {
  const locator = page.locator(selector)
  if ((await locator.count()) === 0) throw new Error(`${shot.guide}/${shot.slug}: nothing matches ${selector}`)
  return locator
}

async function capture(pages: Pages, browser: Browser, shot: Shot, files: { logo: Buffer }) {
  const own = shot.role === 'signed-out' ? await newContext(browser, shot.viewport) : null
  const page = own ? await own.newPage() : pages[shot.role as Exclude<Role, 'signed-out'>]
  if (!own && shot.viewport === 'mobile') await page.setViewportSize(VIEWPORTS.mobile)
  try {
    await open(page, resolveUrl(shot.url))
    await page.addStyleTag({ content: STABLE_CSS })
    if (shot.prepare) await prepares[shot.prepare](page, files)

    for (const selector of shot.hideUnlessFake ?? []) {
      await page.locator(selector).evaluateAll(
        (elements, source) => {
          const fake = new RegExp(source, 'i')
          for (const element of elements) if (!fake.test(element.textContent ?? '')) (element as HTMLElement).style.display = 'none'
        },
        FAKE.source,
      )
    }
    for (const selector of shot.highlight ?? []) {
      const target = (await requireOne(page, selector, shot)).first()
      await target.evaluate((element, color) => {
        const style = (element as HTMLElement).style
        style.outline = `3px solid ${color}`
        style.outlineOffset = '3px'
        style.borderRadius = style.borderRadius || '6px'
      }, HIGHLIGHT_COLOR)
    }
    await page.evaluate(() => document.fonts.ready)

    const mask = (shot.mask ?? []).map((selector) => page.locator(selector))
    if (shot.role === 'master') mask.push(page.locator('nav span').filter({ hasText: /^Signed in as/ }))

    const file = path.join(OUTPUT, shot.guide, `${shot.slug}.png`)
    await mkdir(path.dirname(file), { recursive: true })
    const common = { path: file, mask, maskColor: '#9ca3af', animations: 'disabled', caret: 'hide', scale: 'css' } as const

    if (shot.element?.length) {
      const boxes = []
      for (const selector of shot.element) {
        const target = (await requireOne(page, selector, shot)).first()
        boxes.push(
          await target.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, right: rect.right + window.scrollX, bottom: rect.bottom + window.scrollY }
          }),
        )
      }
      const pad = 12
      const x = Math.max(0, Math.min(...boxes.map((box) => box.x)) - pad)
      const y = Math.max(0, Math.min(...boxes.map((box) => box.y)) - pad)
      const width = Math.max(...boxes.map((box) => box.right)) + pad - x
      const height = Math.max(...boxes.map((box) => box.bottom)) + pad - y
      await page.screenshot({ ...common, fullPage: true, clip: { x, y, width, height } })
    } else {
      await page.screenshot({ ...common, fullPage: false })
    }

    const unexpectedEmails = await page.evaluate((source) => {
      const fake = new RegExp(source, 'i')
      const text = document.body.innerText
      return (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []).filter((email) => !fake.test(email) && !/@example\.(org|com)$/i.test(email)).length
    }, FAKE.source)

    const { size } = await stat(file)
    const note = [
      size > MAX_BYTES ? `OVER ${MAX_BYTES / 1024} KB` : '',
      unexpectedEmails ? `${unexpectedEmails} non-example email(s) in the page text; check they are hidden or masked` : '',
    ].filter(Boolean)
    console.log(`  ${shot.guide}/${shot.slug}.png ${(size / 1024).toFixed(0)} KB${note.length ? `  WARNING: ${note.join('; ')}` : ''}`)
  } finally {
    await own?.close()
  }
}

async function cleanup(browser: Browser, admin: Page | null) {
  const problems: string[] = []
  const context = await newContext(browser)
  const master = await context.newPage()
  master.on('dialog', (dialog) => dialog.accept())
  admin?.on('dialog', (dialog) => dialog.accept())

  async function attempt(description: string, run: () => Promise<void>) {
    try {
      assertPreviewHost(description)
      await run()
    } catch (error) {
      problems.push(`${description}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    }
  }

  async function deleteFrom(page: Page, url: string, name: string, successPath: RegExp) {
    await open(page, url)
    const button = page.getByRole('button', { name: `Delete ${name}`, exact: true })
    const count = await button.count()
    for (let index = 0; index < count; index += 1) {
      await page.getByRole('button', { name: `Delete ${name}`, exact: true }).first().click()
      await expectSaved(page, successPath, `Deleting ${name}`)
      await open(page, url)
    }
    if ((await page.getByRole('button', { name: `Delete ${name}`, exact: true }).count()) > 0) throw new Error(`${name} is still there`)
  }

  try {
    await signIn(master, { email: env('E2E_ADMIN_EMAIL'), password: env('E2E_ADMIN_PASSWORD') }, 'Master', '/admin')
    const owner = master
    if (created.draftSubject) {
      await attempt(`delete the draft "${created.draftSubject}"`, () => deleteFrom(owner, '/admin/newsletters', created.draftSubject!, /^\/admin\/newsletters$/))
    }
    if (created.listing) await attempt(`delete the listing "${LISTING.name}"`, () => deleteFrom(owner, '/admin/sponsors', LISTING.name, /^\/admin\/sponsors$/))
    if (created.event) await attempt(`delete the event "${EVENT.title}"`, () => deleteFrom(owner, '/admin/events', EVENT.title, /^\/admin\/events$/))
    if (created.topic) await attempt(`delete the topic "${TOPIC}"`, () => deleteFrom(owner, '/admin/topics', TOPIC, /^\/admin\/topics$/))
    for (const member of created.members) {
      await attempt(`delete the member ${member.email}`, () =>
        deleteFrom(owner, `/admin/members?q=${encodeURIComponent(member.email)}`, member.name, /^\/admin\/members$/),
      )
    }
    if (created.admin) await attempt(`delete the admin "${FAKE_ADMIN.name}"`, () => deleteFrom(owner, '/admin/admins', FAKE_ADMIN.name, /^\/admin\/admins$/))
  } catch (error) {
    problems.push(`master sign-in for cleanup: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
  } finally {
    await context.close()
  }
  return problems
}

/** Deletes example records a crashed run left behind; names are fixed, so they are found by name. */
function markEverythingForCleanup() {
  created.admin = true
  created.listing = true
  created.event = true
  created.topic = true
  created.draftSubject = NEWSLETTER.subject
  created.members.push(
    { ...FAKE_MEMBER, email: 'Alex Example' },
    { ...FAKE_SPONSOR, email: 'Sam Example' },
  )
}

async function main() {
  const args = process.argv.slice(2)
  const onlyArg = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length) ?? args[args.indexOf('--only') + 1]
  const only = args.includes('--only') || onlyArg ? new Set((onlyArg ?? '').split(',').filter(Boolean)) : null
  assertPreviewHost('take screenshots')
  env('RESEND_API_KEY')

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as { shots: Shot[] }
  const shots = manifest.shots.filter((shot) => !only || only.has(`${shot.guide}/${shot.slug}`))
  if (only && shots.length !== only.size) throw new Error(`Unknown shot in --only: ${[...only].join(', ')}`)

  const browser = await chromium.launch()
  const failures: string[] = []
  let adminPage: Page | null = null
  try {
    if (args.includes('--cleanup-only')) {
      markEverythingForCleanup()
      return
    }
    const files = await makeSampleFiles(browser)
    const lastStage = Math.max(...shots.map((shot) => STAGES.indexOf(shot.stage)))
    const pages = {} as Pages
    for (const role of ['master', 'admin', 'member', 'sponsor'] as const) pages[role] = await (await newContext(browser)).newPage()
    adminPage = pages.admin

    for (const stage of STAGES.slice(0, lastStage + 1)) {
      console.log(`stage ${stage}`)
      await stageSetup[stage](pages, files)
      for (const shot of shots.filter((candidate) => candidate.stage === stage)) {
        try {
          await capture(pages, browser, shot, files)
        } catch (error) {
          failures.push(`${shot.guide}/${shot.slug}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
          console.log(`  FAILED ${failures.at(-1)}`)
        }
      }
    }
  } finally {
    if (!args.includes('--keep')) {
      const problems = await cleanup(browser, adminPage)
      if (problems.length) {
        console.error(`Cleanup left example data on the preview; remove it by hand:\n- ${problems.join('\n- ')}`)
        process.exitCode = 1
      } else {
        console.log('cleanup: all example records deleted')
      }
    }
    await browser.close()
  }
  if (failures.length) {
    console.error(`${failures.length} screenshot(s) failed:\n- ${failures.join('\n- ')}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
