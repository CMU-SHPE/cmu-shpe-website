/**
 * A real sign-in on a preview sets the known-device cookie with the attributes the browser needs
 * to keep it to this site, and signing out keeps it, so the next sign-in from this browser still
 * skips the per-account ceiling. Signs in as the master and signs out again in its own context,
 * which is closed afterwards, so nothing is left behind: a successful sign-in clears its own attempt.
 *
 * Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (the master), and skips otherwise.
 */
import type { Response } from '@playwright/test'
import { expect, test } from './fixtures'
import { assertWriteTarget } from './preview-guard'
import { newJourneyContext, signIn } from './journey-helpers'

const COOKIE = '__Host-known_device'
const ENV = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
const missingEnv = ENV.filter((name) => !process.env[name]?.trim())

// A trace would record the password typed into the form.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('known-device cookie', () => {
  test.skip(missingEnv.length > 0, `Set ${missingEnv.join(', ')} to run the known-device check`)

  test('a sign-in sets it as a Secure, HttpOnly, SameSite=Lax __Host- cookie, and signing out keeps it', async ({
    browser,
    baseURL,
  }) => {
    assertWriteTarget(baseURL, 'sign in as the master')
    const context = await newJourneyContext(browser, baseURL)
    try {
      const page = await context.newPage()
      const setCookies: string[] = []
      const collect = async (response: Response) => {
        for (const { name, value } of await response.headersArray()) {
          if (name.toLowerCase() === 'set-cookie' && value.startsWith(`${COOKIE}=`)) setCookies.push(value)
        }
      }
      page.on('response', collect)

      await signIn(page, process.env.E2E_ADMIN_EMAIL!.trim(), process.env.E2E_ADMIN_PASSWORD!.trim(), 'Master', '/admin')

      expect(setCookies.length, `the sign-in response sets ${COOKIE}`).toBeGreaterThan(0)
      const header = setCookies[0]
      expect(header).toMatch(/;\s*Secure/i)
      expect(header).toMatch(/;\s*HttpOnly/i)
      expect(header).toMatch(/;\s*SameSite=Lax/i)
      expect(header).toMatch(/;\s*Path=\//i)
      expect(header).not.toMatch(/;\s*Domain=/i)
      expect(header.slice(COOKIE.length + 1).split(';')[0]).not.toContain(process.env.E2E_ADMIN_EMAIL!.trim().split('@')[0])

      const [stored] = (await context.cookies()).filter((cookie) => cookie.name === COOKIE)
      expect(stored).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', path: '/' })
      const days = (stored.expires * 1000 - Date.now()) / (24 * 60 * 60 * 1000)
      expect(days).toBeGreaterThan(179)
      expect(days).toBeLessThanOrEqual(180)

      await page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }).first().click()
      await page.waitForURL((url) => url.pathname === '/')
      const afterSignOut = (await context.cookies()).filter((cookie) => cookie.name === COOKIE)
      expect(afterSignOut.map(({ value }) => value)).toEqual([stored.value])
      expect((await context.cookies()).filter((cookie) => cookie.name.includes('authjs.session-token'))).toEqual([])
    } finally {
      await context.close()
    }
  })
})
