/**
 * Member email change against a preview deployment: a member signs up and confirms, asks to
 * change their email twice (the first link must then stop working), confirms the second through
 * the emailed link, is signed out, signs in with the new address only, and the old address gets
 * a notice naming the new one only as d***@resend.dev. afterAll deletes the member.
 *
 * Needs RESEND_API_KEY, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (for cleanup), and skips otherwise.
 */
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { assertWriteTarget } from './preview-guard'
import {
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
const MEMBER = {
  name: `E2E Email Change ${RUN_ID}`,
  oldEmail: `delivered+email-old-${RUN_ID}@resend.dev`,
  firstNewEmail: `delivered+email-first-${RUN_ID}@resend.dev`,
  newEmail: `delivered+email-new-${RUN_ID}@resend.dev`,
  password: `e2e email change password ${RUN_ID}`,
}

const UI = {
  join: {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    age: 'I am 13 or older',
    terms: /I agree to the Terms of Use/,
    submit: 'Create account',
  },
  confirmSignUp: { password: 'Password', submit: 'Confirm my email' },
  change: { newEmail: 'New email', password: 'Current password', submit: 'Send confirmation link' },
  sent: 'Check the inbox of your new email address for a confirmation link. Your email won’t change until you open it. The link works for 24 hours.',
  confirmChange: 'Confirm my new email',
  brokenLink: "This link doesn't work",
  changedStatus: 'Your email address was changed — sign in with your new email address.',
  subjects: {
    signUp: 'Confirm your email for SHPE @ CMU',
    confirmNew: 'Confirm your new email for SHPE @ CMU',
    changed: 'Your SHPE @ CMU email address was changed',
  },
} as const

const created = { baseURL: undefined as string | undefined, member: false }

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

async function requestChange(page: Page, baseURL: string | undefined, newEmail: string) {
  assertWriteTarget(baseURL, 'request an email change')
  await open(page, '/account')
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: UI.change.submit }) })
  await form.getByLabel(UI.change.newEmail, { exact: true }).fill(newEmail)
  await form.getByLabel(UI.change.password, { exact: true }).fill(MEMBER.password)
  await form.getByRole('button', { name: UI.change.submit }).click()
  await expectSaved(page, '/account', `Requesting a change to ${newEmail}`)
  await expect(page.locator('#account-status')).toHaveText(UI.sent)
}

test.describe('member email change', () => {
  test.skip(missingJourneyEnv.length > 0, `Set ${missingJourneyEnv.join(', ')} to run the email change journey`)

  test('confirm the new address, notify the old one, and keep the account', async ({ browser, baseURL }) => {
    assertWriteTarget(baseURL, 'sign up a member')
    created.baseURL = baseURL
    test.setTimeout(8 * 60_000)
    const contexts: BrowserContext[] = []
    const newPage = async () => newJourneyContext(browser, baseURL).then((context) => (contexts.push(context), context.newPage()))
    const member = await newPage()
    const inbox = await newPage()
    const start = Date.now()

    try {
      await test.step('the member signs up and confirms', async () => {
        await open(member, '/join')
        await member.getByLabel(UI.join.name, { exact: true }).fill(MEMBER.name)
        await member.getByLabel(UI.join.email, { exact: true }).fill(MEMBER.oldEmail)
        await member.getByLabel(UI.join.password, { exact: true }).fill(MEMBER.password)
        await member.getByLabel(UI.join.confirmPassword, { exact: true }).fill(MEMBER.password)
        await member.getByLabel(UI.join.age).check()
        await member.getByLabel(UI.join.terms).check()
        created.member = true
        await member.getByRole('button', { name: UI.join.submit }).click()
        await member.waitForURL('**/join/check-email')
        const confirmPath = linkIn(await waitForEmail(MEMBER.oldEmail, UI.subjects.signUp, start), '/join/confirm')
        assertWriteTarget(baseURL, 'confirm the member')
        await open(member, confirmPath)
        await member.getByLabel(UI.confirmSignUp.password, { exact: true }).fill(MEMBER.password)
        await member.getByRole('button', { name: UI.confirmSignUp.submit }).click()
        await member.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('confirmed') === '1')
        await signIn(member, MEMBER.oldEmail, MEMBER.password, 'Member', '/account')
      })

      await test.step('/account with the Change email section passes axe', async () => {
        await axeInBothThemes(member, '/account')
      })

      let firstRequestAt = 0
      let secondRequestAt = 0
      await test.step('a taken address gets the same answer, and a newer request replaces an older one', async () => {
        await requestChange(member, baseURL, journeyEnv('E2E_ADMIN_EMAIL'))
        firstRequestAt = Date.now()
        await requestChange(member, baseURL, MEMBER.firstNewEmail)
        secondRequestAt = Date.now()
        await requestChange(member, baseURL, MEMBER.newEmail)
      })

      await test.step('the replaced link no longer works', async () => {
        const path = linkIn(await waitForEmail(MEMBER.firstNewEmail, UI.subjects.confirmNew, firstRequestAt), '/account/confirm-email')
        assertWriteTarget(baseURL, 'use the replaced email change link')
        await open(inbox, path)
        await inbox.getByRole('button', { name: UI.confirmChange }).click()
        await expect(inbox.getByRole('heading', { level: 1 })).toHaveText(UI.brokenLink)
      })

      let confirmPath = ''
      await test.step('the newest link confirms the change and the confirm page passes axe', async () => {
        confirmPath = linkIn(await waitForEmail(MEMBER.newEmail, UI.subjects.confirmNew, secondRequestAt), '/account/confirm-email')
        await axeInBothThemes(inbox, confirmPath)
        assertWriteTarget(baseURL, 'confirm the email change')
        await open(inbox, confirmPath)
        await inbox.getByRole('button', { name: UI.confirmChange }).click()
        await inbox.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('emailChanged') === '1')
        await expect(inbox.getByRole('status')).toHaveText(UI.changedStatus)
      })

      await test.step('the link is single-use', async () => {
        await open(inbox, confirmPath)
        await inbox.getByRole('button', { name: UI.confirmChange }).click()
        await expect(inbox.getByRole('heading', { level: 1 })).toHaveText(UI.brokenLink)
      })

      await test.step('the member is signed out and only the new address signs in', async () => {
        await member.goto('/account')
        await expect(member).toHaveURL((url) => url.pathname === '/login')
        const refused = await trySignIn(member, MEMBER.oldEmail, MEMBER.password)
        expect(refused.searchParams.get('error'), 'the old address should no longer sign in').toBe('1')
        await signIn(member, MEMBER.newEmail, MEMBER.password, 'Member with the new address', '/account')
        await expect(member.getByText(`Signed in as ${MEMBER.newEmail}`)).toBeVisible()
      })

      await test.step('the old address is told, with the new one masked and the club contact', async () => {
        const body = await waitForEmail(MEMBER.oldEmail, UI.subjects.changed, secondRequestAt)
        expect(body).toContain('changed to d***@resend.dev')
        expect(body).not.toContain(MEMBER.newEmail)
        expect(body).toMatch(/If this wasn’t you, contact \S+@\S+ right away/)
      })
    } finally {
      for (const context of contexts) await context.close()
    }
  })

  test.afterAll(async ({ browser }) => {
    const baseURL = created.baseURL
    if (missingJourneyEnv.length > 0 || !baseURL || !created.member) return
    test.setTimeout(2 * 60_000)
    const context = await newJourneyContext(browser, baseURL)
    try {
      const admin = await context.newPage()
      assertWriteTarget(baseURL, 'delete the journey member')
      await signIn(admin, journeyEnv('E2E_ADMIN_EMAIL'), journeyEnv('E2E_ADMIN_PASSWORD'), 'Admin', '/admin')
      for (const email of [MEMBER.newEmail, MEMBER.oldEmail]) {
        if (await deleteByName(admin, `/admin/members?q=${encodeURIComponent(email)}`, MEMBER.name, '/admin/members')) return
      }
    } catch (error) {
      throw new Error(
        `Email change journey cleanup left "${MEMBER.name}" on the preview; delete it by hand: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      )
    } finally {
      await context.close()
    }
  })
})
