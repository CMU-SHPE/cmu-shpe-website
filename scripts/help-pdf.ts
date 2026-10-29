/**
 * Prints the user guides to PDF from a Vercel preview:
 *   /help/print/public  -> public/help/shpe-website-guide.pdf      (signed out)
 *   /admin/help/print   -> docs/guides/pdf/officer-handbook.pdf    (signed in as the master)
 *
 *   BASE_URL=https://cmu-shpe-website-<hash>-shpecmu.vercel.app npm run help:pdf [-- --only public|officer] [-- --local-images]
 *
 * Needs VERCEL_BYPASS and, for the handbook, E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. Nothing is written
 * to the preview. The navbar's "Signed in as <name>" is removed before printing, and the run stops if
 * the signed-in account's name or email is still anywhere in the printed text.
 *
 * --local-images answers /help/img/** from this checkout's public/help/img, for printing before the
 * screenshots are deployed. Images missing locally still come from the preview.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'

const ROOT = process.cwd()
const PREVIEW_HOST = /^cmu-shpe-website-[a-z0-9]+-shpecmu\.vercel\.app$/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

const DOCUMENTS = {
  public: { url: '/help/print/public', title: 'SHPE @ CMU website guide', output: 'public/help/shpe-website-guide.pdf', signedIn: false },
  officer: { url: '/admin/help/print', title: 'SHPE @ CMU officer handbook', output: 'docs/guides/pdf/officer-handbook.pdf', signedIn: true },
} as const
type DocumentName = keyof typeof DOCUMENTS

const PRINT_CSS = `
*, *::before, *::after { animation: none !important; transition: none !important; }
#vercel-live-feedback, vercel-live-feedback, [data-vercel-toolbar] { display: none !important; }
`

function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name}`)
  return value
}

const BASE_URL = new URL(env('BASE_URL')).origin

function assertAllowedHost() {
  const url = new URL(BASE_URL)
  const allowed = LOCAL_HOSTS.has(url.hostname) || (url.protocol === 'https:' && PREVIEW_HOST.test(url.hostname))
  if (!allowed) throw new Error(`Refusing to print from ${url.hostname}: only a cmu-shpe-website-<hash>-shpecmu.vercel.app preview or localhost.`)
}

async function newContext(browser: Browser, localImages: boolean) {
  const context = await browser.newContext({ baseURL: BASE_URL, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-US' })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  await context.route(/^https:\/\/vercel\.live\//, (route) => route.abort())
  if (localImages) {
    await context.route(
      (url) => url.origin === BASE_URL && url.pathname.startsWith('/help/img/'),
      async (route) => {
        const relative = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '')
        const file = path.join(ROOT, 'public', relative)
        if (!file.startsWith(path.join(ROOT, 'public', 'help', 'img') + path.sep)) return route.fallback()
        try {
          await route.fulfill({ status: 200, contentType: 'image/png', body: await readFile(file) })
        } catch {
          await route.fallback()
        }
      },
    )
  }
  await installBypass(context)
  return context
}

async function installBypass(context: BrowserContext) {
  const secret = process.env.VERCEL_BYPASS
  if (!secret) return
  let cookieRequested = false
  await context.route(
    (url) => url.origin === BASE_URL,
    async (route) => {
      const headers: Record<string, string> = {
        ...route.request().headers(),
        'x-vercel-protection-bypass': secret,
        'x-vercel-skip-toolbar': '1',
      }
      if (!cookieRequested) {
        cookieRequested = true
        headers['x-vercel-set-bypass-cookie'] = 'true'
      }
      await route.fallback({ headers })
    },
  )
}

async function open(page: Page, url: string) {
  const response = await page.goto(url)
  if (!response || response.status() >= 400) throw new Error(`${url} answered ${response?.status()}`)
  await page.waitForLoadState('networkidle')
}

async function signIn(page: Page) {
  await open(page, '/login')
  await page.getByLabel('Email', { exact: true }).fill(env('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Password', { exact: true }).fill(env('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/admin' || url.searchParams.has('error'))
  if (new URL(page.url()).pathname !== '/admin') throw new Error('Admin sign-in failed')
}

/** Screenshots docs/guides/screenshots.json marks pending are left out of the print instead of failing it. */
async function pendingImagePaths() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'docs/guides/screenshots.json'), 'utf8')) as {
    shots: { guide: string; slug: string; pending?: string }[]
  }
  return manifest.shots.filter((shot) => shot.pending).map((shot) => `/help/img/${shot.guide}/${shot.slug}.png`)
}

/** The guide renderer marks images loading="lazy", which page.pdf would print as empty boxes. */
async function loadAllImages(page: Page, pending: string[]) {
  const { total, loaded, broken, skipped } = await page.evaluate(async (pending) => {
    const images = [...document.images]
    for (const image of images) image.loading = 'eager'
    await Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true })
              image.addEventListener('error', resolve, { once: true })
            }),
      ),
    )
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
    const ok = images.filter((image) => image.complete && image.naturalWidth > 0)
    const failed = images.filter((image) => !ok.includes(image))
    const skipped: string[] = []
    for (const image of failed) {
      const source = new URL(image.src).pathname
      if (pending.includes(source)) {
        skipped.push(source)
        image.remove()
      }
    }
    return {
      total: images.length - skipped.length,
      loaded: ok.length,
      broken: failed.map((image) => image.getAttribute('src')).filter((source) => source && !skipped.includes(source)),
      skipped,
    }
  }, pending)
  for (const source of skipped) console.warn(`  left out ${source}: its screenshot is pending`)
  if (loaded !== total) throw new Error(`${total - loaded} of ${total} images did not load: ${broken.join(', ')}`)
  return total
}

/** Returns the signed-in name it removed, so the text check below can look for it too. */
async function removeSignedInAs(page: Page) {
  return page.evaluate(() => {
    const names: string[] = []
    for (const element of document.querySelectorAll('span')) {
      if (element.isConnected && /^Signed in as\b/.test(element.textContent ?? '')) {
        const name = element.querySelector('span')?.textContent?.trim()
        if (name) names.push(name)
        element.remove()
      }
    }
    return names
  })
}

function countPages(pdf: Buffer) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
}

async function print(browser: Browser, name: DocumentName, localImages: boolean) {
  const doc = DOCUMENTS[name]
  const context = await newContext(browser, localImages)
  try {
    const page = await context.newPage()
    if (doc.signedIn) await signIn(page)
    await open(page, doc.url)
    await page.addStyleTag({ content: PRINT_CSS })
    await page.emulateMedia({ media: 'print', colorScheme: 'light' })
    const images = await loadAllImages(page, await pendingImagePaths())
    await page.evaluate(() => document.fonts.ready)

    if (doc.signedIn) {
      const names = await removeSignedInAs(page)
      const text = (await page.locator('body').innerText()).toLowerCase()
      for (const secret of [env('E2E_ADMIN_EMAIL'), ...names]) {
        if (secret && text.includes(secret.toLowerCase())) {
          throw new Error(`The ${name} print still shows the signed-in account's name or email; not printing it.`)
        }
      }
    }

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.75in', bottom: '0.75in', left: '0.7in', right: '0.7in' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:9px;width:100%;padding:0 0.7in;color:#4b5563;font-family:Arial,sans-serif;display:flex;justify-content:space-between"><span>${doc.title}</span><span>shpecmu.com</span></div>`,
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center;color:#4b5563;font-family:Arial,sans-serif">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    })
    const file = path.join(ROOT, doc.output)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, pdf)
    const { size } = await stat(file)
    if (size === 0 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${doc.output} is empty or not a PDF`)
    console.log(`${doc.output}: ${countPages(pdf)} pages, ${(size / 1024).toFixed(0)} KB, ${images} images`)
  } finally {
    await context.close()
  }
}

async function main() {
  assertAllowedHost()
  const args = process.argv.slice(2)
  const onlyIndex = args.indexOf('--only')
  const onlyArg = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length) ?? (onlyIndex === -1 ? undefined : args[onlyIndex + 1])
  const names = (onlyArg ? onlyArg.split(',') : Object.keys(DOCUMENTS)) as DocumentName[]
  for (const name of names) if (!(name in DOCUMENTS)) throw new Error(`Unknown document ${name}; use public or officer`)

  const browser = await chromium.launch()
  try {
    for (const name of names) await print(browser, name, args.includes('--local-images'))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
