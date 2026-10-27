/**
 * Signed-out checks for the sponsor portal, receipts and event attendee exports. Read-only: nothing is
 * created, so these run under the same BASE_URL guard as members.spec.ts. The /events and /login axe
 * scans live in members.spec.ts's ACCESSIBILITY_PAGES.
 *
 * Ids 1 are lookup keys that may or may not exist on the preview; a signed-out visitor must be refused
 * either way, so a 404 is as acceptable as a 401 or a redirect to /login. What must never come back is
 * the file itself.
 *
 * None of these routes existed when this was written, so they pass on a plain 404 today. Once the
 * receipt and CSV handlers land, pin each one to the status its handler actually chose.
 */
import { expect, previewRequest, test } from './fixtures'

const PROTECTED_FILES = [
  { path: '/sponsor/receipts/1', forbiddenType: 'application/pdf' },
  { path: '/admin/sponsors/1/receipts/1', forbiddenType: 'application/pdf' },
  { path: '/admin/events/1/attendees.csv', forbiddenType: 'text/csv' },
]

const REFUSED_STATUSES = [401, 403, 404]

test.describe('signed out', () => {
  for (const path of ['/sponsor', '/admin/sponsors/1']) {
    test(`${path} sends a signed-out visitor to /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL((url) => url.pathname === '/login')
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    })
  }

  for (const { path, forbiddenType } of PROTECTED_FILES) {
    test(`${path} refuses a signed-out visitor and sends no file`, async ({ playwright, baseURL }) => {
      const request = await previewRequest(playwright, baseURL)
      try {
        const response = await request.get(path, { maxRedirects: 0 })
        const status = response.status()
        const contentType = response.headers()['content-type'] ?? ''
        const disposition = response.headers()['content-disposition'] ?? ''

        expect(contentType, `${path} content type`).not.toContain(forbiddenType)
        expect(disposition, `${path} must not offer a download`).not.toMatch(/attachment/i)

        if (status >= 300 && status < 400) {
          const location = new URL(response.headers()['location'] ?? '', baseURL)
          expect(location.pathname, `${path} redirect target`).toBe('/login')
        } else {
          expect(REFUSED_STATUSES, `${path} answered ${status}`).toContain(status)
        }
      } finally {
        await request.dispose()
      }
    })
  }
})
