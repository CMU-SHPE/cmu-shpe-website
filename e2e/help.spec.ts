/**
 * The user guides: the public /help pages render, pass axe in both themes and every screenshot they
 * show loads; the public PDF is served; the officer guide and handbook are for signed-in admins only.
 *
 * Read-only. The signed-in checks run only when E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are set.
 * BASE_URL and the optional VERCEL_BYPASS are handled by playwright.config.ts and fixtures.ts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { bypassHeaders, expect, expectNoAxeViolations, previewRequest, setThemeBeforeLoad, test } from './fixtures'

const PUBLIC_GUIDES = ['/help', '/help/members', '/help/sponsors']
const PUBLIC_PDF = '/help/shpe-website-guide.pdf'
const OFFICER_GUIDE = '/admin/help'
const HANDBOOK_PDF = '/admin/help/handbook.pdf'
const REFUSED_STATUSES = [401, 403, 404]

/** Screenshots docs/guides/screenshots.json marks pending are not captured yet, so they are reported, not failed. */
const PENDING_IMAGES = new Set(
  (JSON.parse(readFileSync(path.join(__dirname, '..', 'docs', 'guides', 'screenshots.json'), 'utf8')) as {
    shots: { guide: string; slug: string; pending?: string }[]
  }).shots
    .filter((shot) => shot.pending)
    .map((shot) => `/help/img/${shot.guide}/${shot.slug}.png`),
)

const ADMIN_ENV = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const
const missingAdminEnv = ADMIN_ENV.filter((name) => !process.env[name]?.trim())

// A trace would record the admin password typed into the sign-in form.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

async function open(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
}

/** Guide images are loading="lazy", so they are read from the DOM rather than from network events. */
async function imageSources(page: Page) {
  const sources = await page.locator('main img').evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''))
  return [...new Set(sources)]
}

function isPdf(body: Buffer) {
  return body.subarray(0, 5).toString('latin1') === '%PDF-'
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`help pages, axe scan, ${theme} mode`, () => {
    for (const path of PUBLIC_GUIDES) {
      test(path, async ({ page }) => {
        await setThemeBeforeLoad(page, theme)
        await open(page, path)
        await expect(page.locator('main h1')).toBeVisible()
        const htmlClass = (await page.locator('html').getAttribute('class')) ?? ''
        expect(/\bdark\b/.test(htmlClass)).toBe(theme === 'dark')
        await expectNoAxeViolations(page)
      })
    }
  })
}

test.describe('help pages, signed out', () => {
  test('every screenshot the public guides show loads as an image', async ({ page, playwright, baseURL }) => {
    const sources = new Set<string>()
    for (const path of PUBLIC_GUIDES) {
      await open(page, path)
      for (const source of await imageSources(page)) sources.add(source)
    }
    expect(sources.size, 'the public guides should show screenshots').toBeGreaterThan(0)

    const request = await previewRequest(playwright, baseURL)
    try {
      for (const source of sources) {
        const response = await request.get(source)
        expect(response.status(), source).toBe(200)
        expect(response.headers()['content-type'] ?? '', source).toMatch(/^image\//)
      }
    } finally {
      await request.dispose()
    }
  })

  test(`${PUBLIC_PDF} is a PDF`, async ({ playwright, baseURL }) => {
    const request = await previewRequest(playwright, baseURL)
    try {
      const response = await request.get(PUBLIC_PDF)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toMatch(/^application\/pdf\b/)
      expect(isPdf(await response.body())).toBe(true)
    } finally {
      await request.dispose()
    }
  })

  test(`${OFFICER_GUIDE} sends a signed-out visitor to /login`, async ({ page }) => {
    await page.goto(OFFICER_GUIDE)
    await expect(page).toHaveURL((url) => url.pathname === '/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  })

  test(`${HANDBOOK_PDF} refuses a signed-out visitor and sends no file`, async ({ playwright, baseURL }) => {
    const request = await previewRequest(playwright, baseURL)
    try {
      const response = await request.get(HANDBOOK_PDF, { maxRedirects: 0 })
      const status = response.status()
      expect(response.headers()['content-type'] ?? '').not.toContain('application/pdf')
      expect(response.headers()['content-disposition'] ?? '').not.toMatch(/attachment/i)
      expect(isPdf(await response.body())).toBe(false)
      if (status >= 300 && status < 400) {
        expect(new URL(response.headers()['location'] ?? '', baseURL).pathname).toBe('/login')
      } else {
        expect(REFUSED_STATUSES, `${HANDBOOK_PDF} answered ${status}`).toContain(status)
      }
    } finally {
      await request.dispose()
    }
  })
})

test.describe('help pages, signed in as an admin', () => {
  test.skip(missingAdminEnv.length > 0, `Set ${missingAdminEnv.join(', ')} to check the officer guide`)

  test('the officer guide renders and the handbook downloads', async ({ page }) => {
    await open(page, '/login')
    await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!.trim())
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!.trim())
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/admin' || url.searchParams.has('error'))
    expect(new URL(page.url()).pathname, 'admin sign-in').toBe('/admin')

    await open(page, OFFICER_GUIDE)
    await expect(page.locator('main h1')).toBeVisible()
    for (const source of await imageSources(page)) {
      if (PENDING_IMAGES.has(source)) {
        test.info().annotations.push({ type: 'pending screenshot', description: source })
        continue
      }
      const image = await page.context().request.get(source, { headers: bypassHeaders() })
      expect(image.status(), source).toBe(200)
    }

    const response = await page.context().request.get(HANDBOOK_PDF, { headers: bypassHeaders(), maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^application\/pdf\b/)
    expect(isPdf(await response.body())).toBe(true)
  })
})
