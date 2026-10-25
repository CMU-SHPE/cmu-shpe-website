import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { siteUrl } from './site-url'

const VARS = ['SITE_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_BRANCH_URL', 'VERCEL_URL', 'NODE_ENV']

beforeEach(() => {
  for (const name of VARS) vi.stubEnv(name, '')
})
afterEach(() => vi.unstubAllEnvs())

function stub(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value)
}

describe('siteUrl', () => {
  it.each<[string, Record<string, string>, string]>([
    ['SITE_URL wins over Vercel', { SITE_URL: 'https://shpecmu.com/', VERCEL_ENV: 'preview', VERCEL_URL: 'x.vercel.app' }, 'https://shpecmu.com'],
    ['SITE_URL in production', { SITE_URL: 'https://shpecmu.com', NODE_ENV: 'production' }, 'https://shpecmu.com'],
    ['production domain', { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'shpecmu.com', NODE_ENV: 'production' }, 'https://shpecmu.com'],
    ['preview branch URL', { VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'site-git-feat.vercel.app', VERCEL_URL: 'site-abc.vercel.app' }, 'https://site-git-feat.vercel.app'],
    ['preview deployment URL fallback', { VERCEL_ENV: 'preview', VERCEL_URL: 'site-abc.vercel.app' }, 'https://site-abc.vercel.app'],
    ['local development', {}, 'http://localhost:3000'],
    ['vercel dev', { VERCEL_ENV: 'development', VERCEL_URL: 'localhost:3000' }, 'http://localhost:3000'],
    ['test runs', { NODE_ENV: 'test' }, 'http://localhost:3000'],
  ])('%s', (_, values, expected) => {
    stub(values)
    expect(siteUrl()).toBe(expected)
  })

  it('strips every trailing slash', () => {
    stub({ SITE_URL: 'https://shpecmu.com//' })
    expect(siteUrl()).toBe('https://shpecmu.com')
  })

  it('allows plain http for localhost in a local production build', () => {
    stub({ SITE_URL: 'http://localhost:3000', NODE_ENV: 'production' })
    expect(siteUrl()).toBe('http://localhost:3000')
  })

  it.each<[string, Record<string, string>, string]>([
    ['not a URL', { SITE_URL: 'shpecmu.com' }, 'not a valid URL'],
    ['a non-http scheme', { SITE_URL: 'javascript:alert(1)' }, 'http(s)'],
    ['a path', { SITE_URL: 'https://shpecmu.com/app' }, 'bare origin'],
    ['a query string', { SITE_URL: 'https://shpecmu.com/?x=1' }, 'bare origin'],
    ['credentials', { SITE_URL: 'https://user:pw@shpecmu.com' }, 'bare origin'],
    ['plain http in production', { SITE_URL: 'http://shpecmu.com', VERCEL_ENV: 'production' }, 'https'],
    ['plain http in a production build', { SITE_URL: 'http://shpecmu.com', NODE_ENV: 'production' }, 'https'],
  ])('rejects a SITE_URL with %s', (_, values, message) => {
    stub(values)
    expect(() => siteUrl()).toThrow(message)
  })

  it('accepts plain http SITE_URL outside production', () => {
    stub({ SITE_URL: 'http://192.168.1.5:3000' })
    expect(siteUrl()).toBe('http://192.168.1.5:3000')
  })

  it.each<[string, Record<string, string>]>([
    ['local production build', { NODE_ENV: 'production' }],
    ['Vercel production without its domain', { VERCEL_ENV: 'production' }],
    ['Vercel preview without a URL', { VERCEL_ENV: 'preview' }],
  ])('throws for %s with nothing set', (_, values) => {
    stub(values)
    expect(() => siteUrl()).toThrow('SITE_URL is not set')
  })
})
