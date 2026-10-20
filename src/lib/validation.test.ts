import { describe, expect, it } from 'vitest'
import { imageSource } from './validation'

const accepts = (value: string) => imageSource.safeParse(value).success

describe('imageSource', () => {
  it('accepts https URLs', () => {
    expect(accepts('https://example.org/logo.png')).toBe(true)
    expect(accepts('https://abc123.public.blob.vercel-storage.com/officers/jeff-x1y2.jpg')).toBe(true)
  })

  it('rejects plain http, which would be mixed content', () => {
    expect(accepts('http://example.org/logo.png')).toBe(false)
  })

  it('accepts the seeded officer and sponsor paths', () => {
    for (const path of [
      '/officers/jeff.jpg',
      '/officers/magaly.jpg',
      '/officers/sergio.jpg',
      '/officers/jayden.jpg',
      '/officers/ulises.jpg',
      '/sponsors/jgms.png',
      '/sponsors/sgm-inc-logo.svg',
    ]) {
      expect(accepts(path)).toBe(true)
    }
  })

  it('rejects paths that browsers resolve to another host', () => {
    expect(accepts('//evil.example/x.png')).toBe(false)
    expect(accepts('/\\evil.example/x.png')).toBe(false)
    expect(accepts('/\t/evil.example/x.png')).toBe(false)
    expect(accepts('/\n/evil.example/x.png')).toBe(false)
    expect(accepts('/officers\\..\\x.png')).toBe(false)
    expect(accepts('https://good.example\\@evil.example/x.png')).toBe(false)
  })

  it('rejects a bare slash, non-URL junk and relative paths without a leading slash', () => {
    expect(accepts('/')).toBe(false)
    expect(accepts('not a url')).toBe(false)
    expect(accepts('images/x.png')).toBe(false)
  })

  it('rejects data:, javascript: and other schemes', () => {
    expect(accepts('data:image/png;base64,AAAA')).toBe(false)
    expect(accepts('javascript:alert(1)')).toBe(false)
    expect(accepts('ftp://example.org/x.png')).toBe(false)
  })

  it('trims surrounding whitespace before checking', () => {
    expect(imageSource.safeParse('  /officers/jeff.jpg  ').data).toBe('/officers/jeff.jpg')
  })

  it('rejects values over 500 characters', () => {
    expect(accepts(`/x${'a'.repeat(500)}`)).toBe(false)
  })
})
