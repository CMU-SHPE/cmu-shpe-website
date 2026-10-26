import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The protection bypass secret is attached only to requests for the preview's own origin,
 * never to third-party requests the page makes (fonts, images, social embeds).
 */
export async function installBypass(context: BrowserContext, baseURL: string | undefined) {
  const secret = process.env.VERCEL_BYPASS
  if (!secret || !baseURL) return
  const origin = new URL(baseURL).origin
  let cookieRequested = false
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const headers: Record<string, string> = { ...route.request().headers(), 'x-vercel-protection-bypass': secret }
      if (!cookieRequested) {
        cookieRequested = true
        headers['x-vercel-set-bypass-cookie'] = 'true'
      }
      await route.continue({ headers })
    },
  )
}

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await installBypass(context, baseURL)
    await provide(context)
  },
})

export { expect }

export type Theme = 'light' | 'dark'

/** Matches the pre-paint script in src/app/layout.tsx, which reads localStorage before load. */
export async function setThemeBeforeLoad(page: Page, theme: Theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('theme', value)
  }, theme)
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }))
  expect(summary).toEqual([])
}

/** A Resend test inbox: accepted and reported as delivered, never a real mailbox. */
export function resendTestAddress(label: string) {
  return `delivered+${label}-${Date.now()}@resend.dev`
}

export const WELL_FORMED_UNKNOWN_TOKEN = 'e2eUnknownToken_0123456789abcdefghijklmnopq'
