import type { APIRequestContext, Page, PlaywrightWorkerArgs } from '@playwright/test'
import { WELL_FORMED_UNKNOWN_TOKEN, expect, expectNoAxeViolations, setThemeBeforeLoad, test } from './fixtures'
import { localWriteRefusal } from './preview-guard'

const MALFORMED_TOKEN = 'bogus'
/** A real unsubscribe token for a member still subscribed to that newsletter's topics; see the README. */
const VALID_TOKEN = process.env.E2E_UNSUBSCRIBE_TOKEN

const pageAlert = (page: Page) => page.locator('main').getByRole('alert')

async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

/** API requests skip the browser context's routes, so the bypass header goes on the request itself. */
async function apiContext(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined) {
  const secret = process.env.VERCEL_BYPASS
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: secret ? { 'x-vercel-protection-bypass': secret } : {},
  })
}

function oneClick(request: APIRequestContext, token: string) {
  return request.post(`/unsubscribe/one-click?token=${encodeURIComponent(token)}`, {
    form: { 'List-Unsubscribe': 'One-Click' },
    maxRedirects: 0,
  })
}

async function expectInvalidLinkPage(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: "This link doesn't work" })).toBeVisible()
  await expect(pageAlert(page)).toContainText('This unsubscribe link is not valid.')
  await expect(page.locator('main').getByRole('button')).toHaveCount(0)
}

test.describe('unsubscribe links that do not work', () => {
  for (const token of [MALFORMED_TOKEN, WELL_FORMED_UNKNOWN_TOKEN]) {
    const kind = token === MALFORMED_TOKEN ? 'a malformed' : 'an unknown'
    test(`GET /unsubscribe with ${kind} token shows the alert and changes nothing`, async ({ page }) => {
      await open(page, `/unsubscribe?token=${token}`)
      await expectInvalidLinkPage(page)
      const first = await page.locator('main').innerText()
      await open(page, `/unsubscribe?token=${token}`)
      expect(await page.locator('main').innerText()).toBe(first)
    })
  }

  test('one-click POST refuses a malformed and an unknown token', async ({ playwright, baseURL }) => {
    const request = await apiContext(playwright, baseURL)
    expect((await oneClick(request, MALFORMED_TOKEN)).status()).toBe(400)
    expect((await oneClick(request, WELL_FORMED_UNKNOWN_TOKEN)).status()).toBe(404)
    await request.dispose()
  })

  test('one-click GET redirects to the unsubscribe page instead of unsubscribing', async ({ playwright, baseURL, page }) => {
    const request = await apiContext(playwright, baseURL)
    const response = await request.get(`/unsubscribe/one-click?token=${WELL_FORMED_UNKNOWN_TOKEN}`, { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe(`/unsubscribe?token=${WELL_FORMED_UNKNOWN_TOKEN}`)
    await request.dispose()

    await open(page, `/unsubscribe/one-click?token=${WELL_FORMED_UNKNOWN_TOKEN}`)
    await expect(page).toHaveURL((url) => url.pathname === '/unsubscribe')
    await expectInvalidLinkPage(page)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`axe scan of the invalid-link page, ${theme} mode`, async ({ page }) => {
      await setThemeBeforeLoad(page, theme)
      await open(page, `/unsubscribe?token=${WELL_FORMED_UNKNOWN_TOKEN}`)
      expect(/\bdark\b/.test((await page.locator('html').getAttribute('class')) ?? '')).toBe(theme === 'dark')
      await expectNoAxeViolations(page)
    })
  }
})

// Uses up the token's subscriptions, so it runs only when a fresh token is provided.
test.describe.serial('a working unsubscribe link', () => {
  test.skip(!VALID_TOKEN, 'Set E2E_UNSUBSCRIBE_TOKEN to run the unsubscribe happy path')
  test.skip(localWriteRefusal(process.env.BASE_URL) !== null, localWriteRefusal(process.env.BASE_URL) ?? '')
  const path = `/unsubscribe?token=${encodeURIComponent(VALID_TOKEN ?? '')}`

  test('opening it twice shows the unsubscribe form both times', async ({ page }) => {
    for (let visit = 0; visit < 2; visit += 1) {
      await open(page, path)
      await expect(page.getByRole('heading', { level: 1, name: 'Unsubscribe from SHPE @ CMU newsletters' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Unsubscribe from (?!all newsletters)/ })).toBeVisible()
    }
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`axe scan of the unsubscribe form, ${theme} mode`, async ({ page }) => {
      await setThemeBeforeLoad(page, theme)
      await open(page, path)
      await expectNoAxeViolations(page)
    })
  }

  test('one-click POST unsubscribes, and the page then says so', async ({ playwright, baseURL, page }) => {
    const request = await apiContext(playwright, baseURL)
    const response = await oneClick(request, VALID_TOKEN ?? '')
    expect(response.status()).toBe(200)
    expect((await oneClick(request, VALID_TOKEN ?? '')).status()).toBe(200)
    await request.dispose()

    await open(page, path)
    await expect(page.locator('main').getByRole('status')).toContainText('already unsubscribed')
    await expect(page.getByRole('button', { name: /^Unsubscribe from (?!all newsletters)/ })).toHaveCount(0)
  })

  // Exercises the page's server action, which the one-click POST above does not.
  test('the page form unsubscribes from everything that is left', async ({ page }) => {
    await open(page, path)
    const all = page.getByRole('button', { name: 'Unsubscribe from all newsletters' })
    test.skip((await all.count()) === 0, 'The member has no other subscriptions left to remove')
    await all.click()
    await expect(page.locator('main')).toContainText(/You’re unsubscribed from .+\.|already unsubscribed/)
    await open(page, path)
    await expect(page.locator('main').getByRole('status')).toContainText('already unsubscribed from all')
  })
})
