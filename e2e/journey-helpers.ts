import type { Browser, Page } from '@playwright/test'
import { expect, expectNoAxeViolations, installBypass, type Theme } from './fixtures'

/**
 * Shared by the account recovery journeys. Every write they make goes through assertWriteTarget,
 * and only @resend.dev test inboxes are used.
 */
export const JOURNEY_ENV = ['RESEND_API_KEY', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
export const missingJourneyEnv = JOURNEY_ENV.filter((name) => !process.env[name]?.trim())

const RESEND_API = 'https://api.resend.com'
const EMAIL_WAIT_MS = 120_000

export function journeyEnv(name: (typeof JOURNEY_ENV)[number]): string {
  return process.env[name]!.trim()
}

type ResendListItem = { id: string; to: string[]; subject: string; created_at: string }
type ResendEmail = { id: string; subject: string; html: string | null; text: string | null }

/** Node's fetch rather than Playwright's request context, so the key never lands in a trace. */
async function resendGet<T>(path: string): Promise<T> {
  const url = new URL(path, RESEND_API)
  if (url.origin !== RESEND_API) throw new Error('Refusing to send the Resend key anywhere but api.resend.com')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${journeyEnv('RESEND_API_KEY')}`, 'User-Agent': 'cmu-shpe-e2e-account-recovery' },
  })
  if (!response.ok) throw new Error(`Resend API ${url.pathname} answered ${response.status}`)
  return (await response.json()) as T
}

/** The newest email to `address` with `subject` sent at or after `since`; the list can lag, so this polls. */
export async function waitForEmail(address: string, subject: string, since: number): Promise<string> {
  const deadline = Date.now() + EMAIL_WAIT_MS
  while (Date.now() < deadline) {
    const list = await resendGet<{ data: ResendListItem[] }>('/emails?limit=100')
    const newest = list.data
      .filter(
        (email) =>
          email.subject === subject &&
          Date.parse(email.created_at) >= since - 5_000 &&
          email.to.some((to) => to.toLowerCase() === address.toLowerCase()),
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (newest) {
      const email = await resendGet<ResendEmail>(`/emails/${encodeURIComponent(newest.id)}`)
      if (email.text !== null || email.html !== null) return `${email.text ?? ''}\n${email.html ?? ''}`
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  throw new Error(`No "${subject}" email for ${address} showed up in Resend within ${EMAIL_WAIT_MS / 1000}s`)
}

export function linkIn(body: string, path: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const link = body.match(new RegExp(`https?://[^\\s"<>]+${escaped}\\?token=[\\w-]+`))?.[0]
  if (!link) throw new Error(`The email carries no ${path} link`)
  const url = new URL(link)
  return `${url.pathname}${url.search}`
}

export async function newJourneyContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  await installBypass(context, baseURL)
  return context
}

export async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

/** Returns where sign-in landed: the expected page, or /login with ?error= when it was refused. */
export async function trySignIn(page: Page, email: string, password: string) {
  await open(page, '/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/login' || url.searchParams.has('error'))
  return new URL(page.url())
}

export async function signIn(page: Page, email: string, password: string, who: string, landing: string) {
  const landed = await trySignIn(page, email, password)
  if (landed.pathname !== landing) throw new Error(`${who} sign-in failed (landed on ${landed.pathname}${landed.search})`)
}

/** Waits for a form action's redirect and fails with the ?error= code when it was refused. */
export async function expectSaved(page: Page, pathname: string, what: string) {
  await page.waitForURL((url) => url.pathname === pathname && (url.searchParams.has('saved') || url.searchParams.has('error')))
  expect(new URL(page.url()).searchParams.get('error'), `${what} was refused`).toBeNull()
}

export async function axeInBothThemes(page: Page, path: string) {
  for (const theme of ['light', 'dark'] satisfies Theme[]) {
    await page.evaluate((value) => window.localStorage.setItem('theme', value), theme)
    await open(page, path)
    const htmlClass = (await page.locator('html').getAttribute('class')) ?? ''
    expect(/\bdark\b/.test(htmlClass), `${path} in ${theme} mode`).toBe(theme === 'dark')
    await expectNoAxeViolations(page)
  }
}

/** Deletes a row through its "Delete <name>" button; returns false when there was nothing to delete. */
export async function deleteByName(page: Page, path: string, name: string, successPath: string) {
  await open(page, path)
  const button = page.getByRole('button', { name: `Delete ${name}`, exact: true })
  if ((await button.count()) === 0) return false
  page.once('dialog', (dialog) => dialog.accept())
  await button.click()
  await expectSaved(page, successPath, `Deleting ${name}`)
  await open(page, path)
  await expect(page.getByRole('button', { name: `Delete ${name}`, exact: true })).toHaveCount(0)
  return true
}
