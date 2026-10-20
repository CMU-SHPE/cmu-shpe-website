import { describe, expect, it } from 'vitest'
import { imageSource } from './validation'

describe('imageSource', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(imageSource.safeParse('https://example.org/logo.png').success).toBe(true)
    expect(imageSource.safeParse('http://example.org/logo.png').success).toBe(true)
  })

  it('accepts root-relative paths like the bundled officer and sponsor images', () => {
    expect(imageSource.safeParse('/officers/jeff.jpg').success).toBe(true)
    expect(imageSource.safeParse('/sponsors/sgm-inc-logo.svg').success).toBe(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(imageSource.safeParse('//evil.example/x.png').success).toBe(false)
  })

  it('rejects non-URL junk and relative paths without a leading slash', () => {
    expect(imageSource.safeParse('not a url').success).toBe(false)
    expect(imageSource.safeParse('images/x.png').success).toBe(false)
  })

  it('rejects data: and javascript: URIs', () => {
    expect(imageSource.safeParse('data:image/png;base64,AAAA').success).toBe(false)
    expect(imageSource.safeParse('javascript:alert(1)').success).toBe(false)
  })

  it('rejects values over 500 characters', () => {
    expect(imageSource.safeParse(`/x${'a'.repeat(500)}`).success).toBe(false)
  })
})
