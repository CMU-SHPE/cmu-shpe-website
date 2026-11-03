// @vitest-environment node
import { existsSync } from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import robots from './robots'
import sitemap from './sitemap'

function pathsOf(urls: string[]) {
  return urls.map((url) => new URL(url).pathname)
}

function blockedBy(rule: string, pathname: string) {
  return rule.endsWith('$') ? pathname === rule.slice(0, -1) : pathname.startsWith(rule)
}

function disallowed() {
  const { rules } = robots()
  const rule = Array.isArray(rules) ? rules[0] : rules
  return ([] as string[]).concat(rule.disallow ?? [])
}

beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://preview.shpe.example')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sitemap', () => {
  it('lists every public page, including join, privacy and terms, under the deployment’s site URL', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.every((url) => url.startsWith('https://preview.shpe.example'))).toBe(true)
    expect(pathsOf(urls)).toEqual(['/', '/about', '/events', '/sponsors', '/officers', '/contact', '/join', '/privacy', '/terms'])
  })

  it('lists only pages that exist', () => {
    for (const pathname of pathsOf(sitemap().map((entry) => entry.url))) {
      expect(existsSync(path.join(__dirname, pathname, 'page.tsx')), pathname).toBe(true)
    }
  })
})

describe('robots', () => {
  it('points crawlers at the sitemap on the deployment’s site URL', () => {
    expect(robots().sitemap).toBe('https://preview.shpe.example/sitemap.xml')
  })

  it.each([
    '/admin',
    '/admin/newsletters',
    '/account',
    '/account/deleted',
    '/sponsor',
    '/sponsor/receipts/4',
    '/login',
    '/unsubscribe',
    '/unsubscribe/one-click',
    '/forgot-password',
    '/reset-password',
    '/join/confirm',
    '/join/check-email',
    '/join/resend',
  ])('keeps crawlers out of %s', (pathname) => {
    expect(disallowed().some((rule) => blockedBy(rule, pathname))).toBe(true)
  })

  it('blocks no page the sitemap lists', () => {
    for (const pathname of pathsOf(sitemap().map((entry) => entry.url))) {
      expect(disallowed().some((rule) => blockedBy(rule, pathname)), pathname).toBe(false)
    }
  })
})
