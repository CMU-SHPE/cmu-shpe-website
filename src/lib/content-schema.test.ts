import { describe, expect, it } from 'vitest'
import { MAX_CONTENT_LENGTH, contentTextSchema } from './content-schema'

describe('contentTextSchema', () => {
  it('rejects keys outside the whitelist', () => {
    expect(contentTextSchema.safeParse({ key: 'admin.password', value: 'x' }).success).toBe(false)
  })

  it('trims and collapses whitespace in single-line keys', () => {
    const parsed = contentTextSchema.parse({ key: 'home.hero.intro', value: '  Hello\r\n   world  ' })
    expect(parsed).toEqual({ key: 'home.hero.intro', value: 'Hello world' })
  })

  it('keeps line breaks in multiline keys but normalises CRLF', () => {
    const parsed = contentTextSchema.parse({
      key: 'about.values.items',
      value: ' First\r\nSecond\r\n\r\nThird ',
    })
    expect(parsed.value).toBe('First\nSecond\n\nThird')
  })

  it('allows an empty value', () => {
    expect(contentTextSchema.parse({ key: 'sponsors.tier.gold.amount', value: '   ' }).value).toBe('')
  })

  it('enforces the maximum length after trimming', () => {
    const exact = 'a'.repeat(MAX_CONTENT_LENGTH)
    expect(contentTextSchema.safeParse({ key: 'home.hero.intro', value: ` ${exact} ` }).success).toBe(true)
    expect(
      contentTextSchema.safeParse({ key: 'home.hero.intro', value: `${exact}a` }).success,
    ).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(contentTextSchema.safeParse({ key: 'home.hero.intro', value: 42 }).success).toBe(false)
  })
})
