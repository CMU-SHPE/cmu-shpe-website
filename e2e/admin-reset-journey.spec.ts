/**
 * Admin password reset by email against a preview deployment. The master never resets itself:
 * it creates a throwaway admin with a @resend.dev address, that admin signs in, then resets
 * its password from the shared Forgot password page with the emailed link. The old session is
 * ended, the old password stops working, the link can't be used twice, and a "password was
 * changed" notice arrives. afterAll deletes the throwaway admin even when a step fails.
 *
 * Needs RESEND_API_KEY, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (the master), and skips otherwise.
 */
import type { BrowserContext } from '@playwright/test'
import { expect, test } from './fixtures'
import {
  assertPreviewHost,
  axeInBothThemes,
  deleteByName,
  expectSaved,
  journeyEnv,
  linkIn,
  missingJourneyEnv,
  newJourneyContext,
  open,
  signIn,
  trySignIn,
  waitForEmail,
} from './journey-helpers'

const RUN_ID = Date.now()
const ADMIN = {
  name: `E2E Reset Admin ${RUN_ID}`,
  email: `delivered+admin-reset-${RUN_ID}@resend.dev`,
  password: `e2e admin first password ${RUN_ID}`,
  newPassword: `e2e admin second password ${RUN_ID}`,
}

const UI = {
  createAdmin: { name: 'Name', email: 'Email', password: /^Password \(/, submit: 'Create account' },
  forgotLink: 'Forgot password?',
  forgot: { email: 'Email', submit: 'Send reset link' },
  sentNotice: "If an account exists for that email, we've sent a reset link. The email says how long it works.",
  reset: { password: 'New password', confirm: 'Confirm new password', submit: 'Save new password' },
  resetDone: 'Your password was reset',
  usedLink: 'This reset link has expired or was already used.',
  subjects: { reset: 'Reset your SHPE @ CMU admin password', changed: 'Your SHPE @ CMU password was changed' },
} as const

const created = { baseURL: undefined as string | undefined, admin: false }

// A trace would record the passwords typed into the forms.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('admin password reset by email', () => {
  test.skip(missingJourneyEnv.length > 0, `Set ${missingJourneyEnv.join(', ')} to run the admin reset journey`)

  test('a throwaway admin resets its password by email and its old session ends', async ({ browser, baseURL }) => {
    assertPreviewHost(baseURL, 'sign in as the master')
    created.baseURL = baseURL
    test.setTimeout(6 * 60_000)
    const contexts: BrowserContext[] = []
    const newPage = async () => newJourneyContext(browser, baseURL).then((context) => (contexts.push(context), context.newPage()))
    const master = await newPage()
    const oldSession = await newPage()
    const visitor = await newPage()

    try {
      await test.step('the master creates a throwaway admin with a @resend.dev address', async () => {
        await signIn(master, journeyEnv('E2E_ADMIN_EMAIL'), journeyEnv('E2E_ADMIN_PASSWORD'), 'Master', '/admin')
        assertPreviewHost(baseURL, 'create a throwaway admin')
        await open(master, '/admin/admins')
        const form = master.locator('form').filter({ has: master.getByRole('button', { name: UI.createAdmin.submit, exact: true }) })
        await form.getByLabel(UI.createAdmin.name, { exact: true }).fill(ADMIN.name)
        await form.getByLabel(UI.createAdmin.email, { exact: true }).fill(ADMIN.email)
        await form.getByLabel(UI.createAdmin.password).fill(ADMIN.password)
        created.admin = true
        await form.getByRole('button', { name: UI.createAdmin.submit, exact: true }).click()
        await expectSaved(master, '/admin/admins', 'Creating the throwaway admin')
      })

      await test.step('the throwaway admin signs in', async () => {
        await signIn(oldSession, ADMIN.email, ADMIN.password, 'Throwaway admin', '/admin')
      })

      const requestedAt = Date.now()
      await test.step('Forgot password? on the sign-in page sends a link without saying who has an account', async () => {
        await open(visitor, '/login')
        await visitor.getByRole('link', { name: UI.forgotLink }).click()
        await expect(visitor).toHaveURL((url) => url.pathname === '/forgot-password')
        assertPreviewHost(baseURL, 'request an admin reset link')
        await visitor.getByLabel(UI.forgot.email, { exact: true }).fill(ADMIN.email)
        await visitor.getByRole('button', { name: UI.forgot.submit }).click()
        await expect(visitor.locator('#request-sent')).toHaveText(UI.sentNotice)

        await visitor.getByLabel(UI.forgot.email, { exact: true }).fill(`delivered+nobody-${RUN_ID}@resend.dev`)
        await visitor.getByRole('button', { name: UI.forgot.submit }).click()
        await expect(visitor.locator('#request-sent')).toHaveText(UI.sentNotice)
      })

      let resetPath = ''
      await test.step('the emailed admin link opens /reset-password/admin, which passes axe', async () => {
        const body = await waitForEmail(ADMIN.email, UI.subjects.reset, requestedAt)
        expect(body).toContain('expires in 30 minutes')
        resetPath = linkIn(body, '/reset-password/admin')
        await axeInBothThemes(visitor, resetPath)
      })

      await test.step('choosing a new password through the link works once', async () => {
        assertPreviewHost(baseURL, 'reset the throwaway admin password')
        await open(visitor, resetPath)
        await visitor.getByLabel(UI.reset.password, { exact: true }).fill(ADMIN.newPassword)
        await visitor.getByLabel(UI.reset.confirm, { exact: true }).fill(ADMIN.newPassword)
        await visitor.getByRole('button', { name: UI.reset.submit }).click()
        await visitor.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('reset') === '1')
        await expect(visitor.getByRole('status')).toContainText(UI.resetDone)

        await open(visitor, resetPath)
        await visitor.getByLabel(UI.reset.password, { exact: true }).fill(`${ADMIN.newPassword} again`)
        await visitor.getByLabel(UI.reset.confirm, { exact: true }).fill(`${ADMIN.newPassword} again`)
        await visitor.getByRole('button', { name: UI.reset.submit }).click()
        await expect(visitor.getByRole('group', { name: 'There is a problem' })).toContainText(UI.usedLink)
      })

      await test.step('the session from before the reset is signed out', async () => {
        await oldSession.goto('/admin')
        await expect(oldSession).toHaveURL((url) => url.pathname === '/login')
      })

      await test.step('only the new password signs in, and the change notice arrives', async () => {
        const refused = await trySignIn(visitor, ADMIN.email, ADMIN.password)
        expect(refused.searchParams.get('error'), 'the old password should be refused').toBe('1')
        await signIn(visitor, ADMIN.email, ADMIN.newPassword, 'Throwaway admin with the new password', '/admin')
        await waitForEmail(ADMIN.email, UI.subjects.changed, requestedAt)
      })
    } finally {
      for (const context of contexts) await context.close()
    }
  })

  test.afterAll(async ({ browser }) => {
    const baseURL = created.baseURL
    if (missingJourneyEnv.length > 0 || !baseURL || !created.admin) return
    test.setTimeout(2 * 60_000)
    const context = await newJourneyContext(browser, baseURL)
    try {
      const master = await context.newPage()
      assertPreviewHost(baseURL, 'delete the throwaway admin')
      await signIn(master, journeyEnv('E2E_ADMIN_EMAIL'), journeyEnv('E2E_ADMIN_PASSWORD'), 'Master', '/admin')
      await deleteByName(master, '/admin/admins', ADMIN.name, '/admin/admins')
    } catch (error) {
      throw new Error(
        `Admin reset journey cleanup left "${ADMIN.name}" (${ADMIN.email}) on the preview; delete it by hand: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      )
    } finally {
      await context.close()
    }
  })
})
