import type { Page } from '@playwright/test'
import {
  WELL_FORMED_UNKNOWN_TOKEN,
  expect,
  expectNoAxeViolations,
  installBypass,
  resendTestAddress,
  setThemeBeforeLoad,
  test,
} from './fixtures'

const PASSWORD = 'e2e preview password 123'

async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

// Next's route announcer is also role="alert", but lives outside <main>.
const pageAlert = (page: Page) => page.locator('main').getByRole('alert')
// The form error summary takes focus instead of being a live region.
const formErrors = (page: Page) => page.locator('main').getByRole('group', { name: 'There is a problem' })

async function fillSignUp(page: Page, email: string, overrides: { ageConfirmed?: boolean } = {}) {
  await page.getByLabel('Name', { exact: true }).fill('E2E Preview Tester')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD)
  if (overrides.ageConfirmed ?? true) await page.getByLabel('I am 13 or older').check()
  await page.getByLabel(/I agree to the Terms of Use/).check()
}

async function submitSignUp(page: Page) {
  await page.getByRole('button', { name: 'Create account' }).click()
}

async function signUpOutcome(page: Page, email: string) {
  await open(page, '/join')
  await fillSignUp(page, email)
  await submitSignUp(page)
  await Promise.race([page.waitForURL('**/join/check-email'), formErrors(page).waitFor()])
  await expect(
    page.url().endsWith('/join/check-email') ? page.locator('main').getByRole('status') : formErrors(page),
  ).toBeVisible()
  return { path: new URL(page.url()).pathname, text: (await page.locator('main').innerText()).trim() }
}

/** What a visitor can see after asking for an email: where they ended up and what the page says. */
async function emailRequestOutcome(page: Page, path: string, submitLabel: string, email: string) {
  await open(page, path)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: submitLabel }).click()
  await page.waitForURL((url) => url.searchParams.get('sent') === '1')
  await expect(page.locator('main').getByRole('status')).toBeVisible()
  const url = new URL(page.url())
  return { location: `${url.pathname}${url.search}`, text: (await page.locator('main').innerText()).trim() }
}

test.describe('signed out', () => {
  test('carries no session cookie and the footer offers sign in, not Admin or Account', async ({ page, context }) => {
    await open(page, '/')
    const cookies = await context.cookies()
    expect(cookies.filter((cookie) => cookie.name.includes('authjs.session-token'))).toEqual([])

    const footer = page.locator('footer')
    for (const [name, href] of [
      ['Sign in', '/login'],
      ['Join', '/join'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
    ]) {
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
    }
    for (const name of ['Admin', 'Account', 'Admin sign in']) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  })

  for (const path of [
    '/account',
    '/admin',
    '/admin/account',
    '/admin/admins',
    '/admin/events',
    '/admin/lists',
    '/admin/members',
    '/admin/officers',
    '/admin/settings',
    '/admin/sponsors',
    '/admin/topics',
  ]) {
    test(`${path} sends a signed-out visitor to /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL((url) => url.pathname === '/login')
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    })
  }

  for (const path of ['/privacy', '/terms']) {
    test(`${path} renders`, async ({ page }) => {
      await open(page, path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(200)
    })
  }
})

test.describe('sign-up form', () => {
  test('labels every field and marks it required', async ({ page }) => {
    await open(page, '/join')
    for (const label of ['Name', 'Email', 'Password', 'Confirm password', 'I am 13 or older']) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('required', '')
    }
    await expect(page.getByLabel(/I agree to the Terms of Use/)).toHaveAttribute('required', '')
    await expect(page.getByLabel('I am 13 or older')).toHaveAttribute('type', 'checkbox')
  })

  test('links the Terms of Use and Privacy Policy it asks the visitor to accept', async ({ page }) => {
    await open(page, '/join')
    const form = page.locator('main form')
    await expect(form.getByRole('link', { name: 'Terms of Use', exact: true })).toHaveAttribute('href', '/terms')
    await expect(form.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute('href', '/privacy')
  })

  test('an empty submit focuses the error summary and ties each error to its field', async ({ page }) => {
    await open(page, '/join')
    await submitSignUp(page)

    const summary = formErrors(page)
    await expect(summary).toBeVisible()
    await expect(summary).toBeFocused()
    await expect(page).toHaveURL((url) => url.pathname === '/join')

    for (const label of ['Name', 'Email', 'Password', 'I am 13 or older']) {
      const field = page.getByLabel(label, { exact: true })
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const describedBy = (await field.getAttribute('aria-describedby')) ?? ''
      const errorId = describedBy.split(' ').find((id) => id.endsWith('-error'))
      expect(errorId, `${label} should point at its error text`).toBeTruthy()
      await expect(page.locator(`[id="${errorId}"]`)).not.toBeEmpty()
    }
  })

  test('refuses an account without the 13-or-older box, keeping what was typed except passwords', async ({ page }) => {
    const email = resendTestAddress('age-gate')
    await open(page, '/join')
    await fillSignUp(page, email, { ageConfirmed: false })
    await submitSignUp(page)

    await expect(formErrors(page)).toContainText('You must be 13 or older')
    await expect(page).toHaveURL((url) => url.pathname === '/join')
    await expect(page.getByLabel('I am 13 or older')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  })

  test('a valid sign-up lands on the check-your-inbox page', async ({ page }) => {
    const outcome = await signUpOutcome(page, resendTestAddress('new'))
    expect(outcome.path).toBe('/join/check-email')
    await expect(page.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible()
  })

  test('signing up the same address twice looks exactly like the first time', async ({ browser, baseURL }) => {
    const email = resendTestAddress('duplicate')
    const outcomes = []
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
      await installBypass(context, baseURL)
      const page = await context.newPage()
      outcomes.push(await signUpOutcome(page, email))
      await context.close()
    }
    expect(outcomes[1]).toEqual(outcomes[0])
    expect(outcomes[0].path).toBe('/join/check-email')
  })
})

// The known address is a fresh unconfirmed sign-up: confirming it would need the inbox,
// which a resend.dev test address doesn't give us.
test.describe('email requests do not reveal who has an account', () => {
  for (const { path, submitLabel } of [
    { path: '/join/resend', submitLabel: 'Send a new link' },
    { path: '/forgot-password', submitLabel: 'Send reset link' },
  ]) {
    test(`${path} answers a known and an unknown address the same way`, async ({ page }) => {
      const known = resendTestAddress('known')
      expect((await signUpOutcome(page, known)).path).toBe('/join/check-email')

      const knownOutcome = await emailRequestOutcome(page, path, submitLabel, known)
      const unknownOutcome = await emailRequestOutcome(page, path, submitLabel, resendTestAddress('unknown'))

      expect(knownOutcome).toEqual(unknownOutcome)
      expect(knownOutcome.location).toBe(`${path}?sent=1`)
      await expect(page.locator('main').getByRole('status')).toContainText('If an')
    })
  }
})

test.describe('confirmation links', () => {
  test('a malformed token shows the broken-link page with no confirm button', async ({ page }) => {
    await open(page, '/join/confirm?token=bogus')
    await expect(pageAlert(page)).toContainText('expired, was already used')
    await expect(page.getByRole('button', { name: 'Confirm my email' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Send me a new confirmation link' })).toHaveAttribute('href', '/join/resend')
  })

  test('a well-formed but unknown or expired token is refused when the button is pressed', async ({ page }) => {
    await open(page, `/join/confirm?token=${WELL_FORMED_UNKNOWN_TOKEN}`)
    await page.getByRole('button', { name: 'Confirm my email' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/join/confirm' && url.searchParams.get('invalid') === '1')
    await expect(pageAlert(page)).toContainText('expired, was already used')
  })
})

test.describe('password reset links', () => {
  test('a malformed token shows the broken-link page with no password form', async ({ page }) => {
    await open(page, '/reset-password?token=bogus')
    await expect(pageAlert(page)).toContainText('expired, was already used')
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Send me a new reset link' })).toHaveAttribute('href', '/forgot-password')
  })

  test('a well-formed but unknown or expired token is refused when the form is submitted', async ({ page }) => {
    await open(page, `/reset-password?token=${WELL_FORMED_UNKNOWN_TOKEN}`)
    await page.getByLabel('New password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm new password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Save new password' }).click()

    await expect(formErrors(page)).toContainText('expired or was already used')
    await expect(page).toHaveURL((url) => url.pathname === '/reset-password')
  })
})

const ACCESSIBILITY_PAGES = [
  '/join',
  '/join/check-email',
  `/join/confirm?token=${WELL_FORMED_UNKNOWN_TOKEN}`,
  '/join/confirm?invalid=1',
  '/join/resend',
  '/forgot-password',
  `/reset-password?token=${WELL_FORMED_UNKNOWN_TOKEN}`,
  '/reset-password',
  '/login',
  '/privacy',
  '/terms',
]

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe scan, ${theme} mode`, () => {
    for (const path of ACCESSIBILITY_PAGES) {
      test(path, async ({ page }) => {
        await setThemeBeforeLoad(page, theme)
        await open(page, path)
        const htmlClass = (await page.locator('html').getAttribute('class')) ?? ''
        expect(/\bdark\b/.test(htmlClass)).toBe(theme === 'dark')
        await expectNoAxeViolations(page)
      })
    }
  })
}
