import { afterEach, describe, expect, it, vi } from 'vitest'
import { VERIFIED_ORIGIN_ENV, assertPreviewTarget, previewOrigin, verifyPreviewTarget } from './preview-guard'

const PREVIEW_HASH = 'https://cmu-shpe-website-e74uhdsnp-shpecmu.vercel.app'
const PRODUCTION_HASH = 'https://cmu-shpe-website-a9jmr3ra0-shpecmu.vercel.app'
const BRANCH_ALIAS = 'https://cmu-shpe-website-git-feat-user-guides-shpecmu.vercel.app'
const LOCAL = 'http://localhost:3000'

function vercelAnswers(status: number, body: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

afterEach(() => vi.unstubAllEnvs())

describe('previewOrigin', () => {
  it.each([
    ['the custom domain', 'https://shpecmu.com'],
    ['the www custom domain', 'https://www.shpecmu.com/join'],
    ['the git-main alias', 'https://cmu-shpe-website-git-main-shpecmu.vercel.app'],
    ['another project', 'https://other-site-e74uhdsnp-shpecmu.vercel.app'],
    ['another team', 'https://cmu-shpe-website-e74uhdsnp-someone.vercel.app'],
    ['plain http to Vercel', 'http://cmu-shpe-website-e74uhdsnp-shpecmu.vercel.app'],
  ])('refuses %s', (_, url) => {
    expect(() => previewOrigin(url)).toThrow(/^Refusing to run e2e on /)
  })

  it('asks for BASE_URL when it is missing', () => {
    expect(() => previewOrigin(undefined)).toThrow(/Set BASE_URL/)
  })

  it.each([LOCAL, 'http://127.0.0.1:3000', PREVIEW_HASH, PRODUCTION_HASH, BRANCH_ALIAS])('passes the shape check for %s', (url) => {
    expect(previewOrigin(`${url}/some/path`)).toBe(url)
  })
})

describe('verifyPreviewTarget', () => {
  it.each(['https://shpecmu.com', 'https://cmu-shpe-website-git-main-shpecmu.vercel.app'])(
    'refuses %s without asking Vercel',
    async (url) => {
      const fetchImpl = vercelAnswers(200, { name: 'cmu-shpe-website', target: null })
      await expect(verifyPreviewTarget(url, { token: 't', fetchImpl })).rejects.toThrow(/production site/)
      expect(fetchImpl).not.toHaveBeenCalled()
    },
  )

  it('refuses a production deployment URL that Vercel reports as production', async () => {
    const fetchImpl = vercelAnswers(200, { name: 'cmu-shpe-website', target: 'production' })
    await expect(verifyPreviewTarget(PRODUCTION_HASH, { token: 't', fetchImpl })).rejects.toThrow(/target as production/)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.vercel.com/v13/deployments/cmu-shpe-website-a9jmr3ra0-shpecmu.vercel.app?slug=shpecmu',
      { headers: { Authorization: 'Bearer t' } },
    )
  })

  it.each([PREVIEW_HASH, BRANCH_ALIAS])('passes %s once Vercel reports it as a preview', async (url) => {
    const fetchImpl = vercelAnswers(200, { name: 'cmu-shpe-website', target: null })
    await expect(verifyPreviewTarget(url, { token: 't', fetchImpl })).resolves.toBe(url)
  })

  it('refuses a deployment of another project', async () => {
    const fetchImpl = vercelAnswers(200, { name: 'something-else', target: null })
    await expect(verifyPreviewTarget(PREVIEW_HASH, { token: 't', fetchImpl })).rejects.toThrow(/not a cmu-shpe-website deployment/)
  })

  it('refuses when Vercel reports no target field at all', async () => {
    const fetchImpl = vercelAnswers(200, { name: 'cmu-shpe-website' })
    await expect(verifyPreviewTarget(PREVIEW_HASH, { token: 't', fetchImpl })).rejects.toThrow(/target as undefined/)
  })

  it.each([404, 403, 500])('refuses when Vercel answers %i', async (status) => {
    const fetchImpl = vercelAnswers(status)
    await expect(verifyPreviewTarget(PREVIEW_HASH, { token: 't', fetchImpl })).rejects.toThrow(`answered ${status}`)
  })

  it('refuses when Vercel cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(verifyPreviewTarget(PREVIEW_HASH, { token: 't', fetchImpl })).rejects.toThrow(/could not be reached \(fetch failed\)/)
  })

  it.each([undefined, '', '  '])('refuses a Vercel host when VERCEL_TOKEN is %j', async (token) => {
    const fetchImpl = vercelAnswers(200, { name: 'cmu-shpe-website', target: null })
    await expect(verifyPreviewTarget(BRANCH_ALIAS, { token, fetchImpl })).rejects.toThrow(/set VERCEL_TOKEN/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes localhost without a token or a request', async () => {
    const fetchImpl = vercelAnswers(500)
    await expect(verifyPreviewTarget(LOCAL, { token: undefined, fetchImpl })).resolves.toBe(LOCAL)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('assertPreviewTarget', () => {
  it('passes localhost without a verified origin', () => {
    vi.stubEnv(VERIFIED_ORIGIN_ENV, undefined)
    expect(() => assertPreviewTarget(LOCAL, 'send a newsletter')).not.toThrow()
  })

  it.each([PREVIEW_HASH, BRANCH_ALIAS])('passes %s once the global setup verified that same origin', (url) => {
    vi.stubEnv(VERIFIED_ORIGIN_ENV, url)
    expect(() => assertPreviewTarget(`${url}/admin`, 'send a newsletter')).not.toThrow()
  })

  it('refuses a Vercel host the global setup did not verify', () => {
    vi.stubEnv(VERIFIED_ORIGIN_ENV, PREVIEW_HASH)
    expect(() => assertPreviewTarget(BRANCH_ALIAS, 'send a newsletter')).toThrow(/^Refusing to send a newsletter on .*not confirmed/)
  })

  it('refuses the production site even with a matching verified origin', () => {
    vi.stubEnv(VERIFIED_ORIGIN_ENV, 'https://shpecmu.com')
    expect(() => assertPreviewTarget('https://shpecmu.com', 'send a newsletter')).toThrow(/production site/)
  })
})
