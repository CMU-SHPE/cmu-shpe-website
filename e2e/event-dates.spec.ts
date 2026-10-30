/**
 * The admin event form with a date range and per-day time slots, against a preview deployment: an
 * overlapping slot is refused with the error next to it and nothing typed is lost, the approved
 * Hackathon example then saves, /events shows it as "Oct 10–12, 2026" with one line per slot, and
 * editing pre-fills the slots. The event is deleted in afterAll, which runs even when a step fails.
 *
 * Runs only when E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin on the preview) are set.
 * Each write first calls assertWriteTarget from preview-guard.ts, and the spec skips on a local server
 * unless its database is declared disposable.
 */
import type { Page } from '@playwright/test'
import { expect, expectNoAxeViolations, installBypass, test } from './fixtures'
import { assertWriteTarget, localWriteRefusal } from './preview-guard'

const REQUIRED_ENV = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]?.trim())

const EVENT_TITLE = `E2E Hackathon ${Date.now()}`

const SLOTS = [
  { from: '2026-10-10', to: '2026-10-11', start: '18:00', end: '20:00' },
  { from: '2026-10-12', to: '2026-10-12', start: '19:00', end: '20:00' },
]

async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

async function signInAsAdmin(page: Page) {
  await open(page, '/login')
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!.trim())
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!.trim())
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/admin' || url.searchParams.has('error'))
  expect(new URL(page.url()).pathname, 'admin sign-in').toBe('/admin')
}

function addForm(page: Page) {
  return page.locator('form').filter({ has: page.getByRole('button', { name: 'Add event', exact: true }) })
}

let eventCreated = false

test.describe('event date ranges', () => {
  test.skip(missingEnv.length > 0, `Set ${missingEnv.join(', ')} to run the event date range spec`)
  test.skip(localWriteRefusal(process.env.BASE_URL) !== null, localWriteRefusal(process.env.BASE_URL) ?? '')

  test('an admin adds a three-day event with per-day times and /events shows them', async ({ page, baseURL }) => {
    test.setTimeout(180_000)
    assertWriteTarget(baseURL, 'sign in as the admin')
    await signInAsAdmin(page)

    await test.step('an overlapping slot is refused next to the field, keeping what was typed', async () => {
      assertWriteTarget(baseURL, 'submit the event form')
      await open(page, '/admin/events')
      const form = addForm(page)
      await form.getByLabel('Title', { exact: true }).fill(EVENT_TITLE)
      await form.getByLabel('Location', { exact: true }).fill('E2E test room')
      await form.getByLabel('Start date', { exact: true }).fill('2026-10-10')
      await form.getByLabel('End date (optional)', { exact: true }).fill('2026-10-12')

      for (const [index, slot] of [...SLOTS, { from: '2026-10-11', to: '2026-10-11', start: '19:00', end: '21:00' }].entries()) {
        await form.getByRole('button', { name: 'Add time slot', exact: true }).click()
        const row = form.getByRole('group', { name: `Time slot ${index + 1}`, exact: true })
        await expect(row.getByLabel('From', { exact: true })).toBeFocused()
        await row.getByLabel('From', { exact: true }).fill(slot.from)
        await row.getByLabel('To', { exact: true }).fill(slot.to)
        await row.getByLabel('Start time', { exact: true }).fill(slot.start)
        await row.getByLabel('End time', { exact: true }).fill(slot.end)
      }
      await expect(form.getByLabel('Time (optional)', { exact: true })).toHaveCount(0)
      await expectNoAxeViolations(page)

      await form.getByRole('button', { name: 'Add event', exact: true }).click()
      const summary = page.getByRole('group', { name: 'There is a problem' })
      await expect(summary).toBeFocused()
      await expect(summary).toContainText('Time slot 3: This overlaps time slot 1 on the same day.')
      const overlapping = addForm(page).getByRole('group', { name: 'Time slot 3', exact: true }).getByLabel('Start time')
      await expect(overlapping).toHaveAttribute('aria-invalid', 'true')
      await expect(overlapping).toHaveValue('19:00')
      await expect(addForm(page).getByLabel('Title', { exact: true })).toHaveValue(EVENT_TITLE)
      await expectNoAxeViolations(page)
    })

    await test.step('removing the overlapping slot lets the event save', async () => {
      assertWriteTarget(baseURL, 'create the event')
      const form = addForm(page)
      await form.getByRole('button', { name: 'Remove time slot 3', exact: true }).click()
      await expect(form.getByRole('group', { name: 'Time slot 2', exact: true }).getByLabel('From')).toBeFocused()
      eventCreated = true
      await form.getByRole('button', { name: 'Add event', exact: true }).click()
      await page.waitForURL((url) => url.pathname === '/admin/events' && url.searchParams.get('saved') === '1')
    })

    await test.step('/events shows the date range and one line per slot', async () => {
      await open(page, '/events')
      const card = page
        .locator('main div')
        .filter({ has: page.getByRole('heading', { name: EVENT_TITLE, exact: true }) })
        .last()
      await expect(card).toContainText('Oct 10–12, 2026')
      await expect(card.getByText('Oct 10–11 · 6 PM – 8 PM', { exact: true })).toBeVisible()
      await expect(card.getByText('Oct 12 · 7 PM – 8 PM', { exact: true })).toBeVisible()
    })

    await test.step('editing pre-fills the range and the slots', async () => {
      await open(page, '/admin/events')
      const item = page.locator('main li').filter({ has: page.getByText(EVENT_TITLE, { exact: true }) }).first()
      await expect(item).toContainText('Oct 10–12, 2026')
      await item.locator('summary').click()
      await expect(item.getByLabel('End date (optional)', { exact: true })).toHaveValue('2026-10-12')
      const second = item.getByRole('group', { name: 'Time slot 2', exact: true })
      await expect(second.getByLabel('From', { exact: true })).toHaveValue('2026-10-12')
      await expect(second.getByLabel('Start time', { exact: true })).toHaveValue('19:00')
    })
  })

  test.afterAll(async ({ browser, baseURL }) => {
    if (!eventCreated) return
    assertWriteTarget(baseURL, 'delete the event')
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
    await installBypass(context, baseURL)
    const page = await context.newPage()
    page.on('dialog', (dialog) => dialog.accept())
    try {
      await signInAsAdmin(page)
      await open(page, '/admin/events')
      const button = page.getByRole('button', { name: `Delete ${EVENT_TITLE}`, exact: true })
      if ((await button.count()) === 0) return
      await button.click()
      await page.waitForURL((url) => url.pathname === '/admin/events' && url.searchParams.has('saved'))
      await open(page, '/admin/events')
      await expect(page.getByRole('button', { name: `Delete ${EVENT_TITLE}`, exact: true })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})
