import { describe, expect, it } from 'vitest'
import {
  CONTENT_KEYS,
  INLINE_CONTENT_KEYS,
  contentKeyDefinition,
  contentKeysFor,
  isContentKey,
  isInlineContentKey,
} from './content-keys'

describe('CONTENT_KEYS', () => {
  it('has unique keys, each with a label', () => {
    const keys = CONTENT_KEYS.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const entry of CONTENT_KEYS) expect(entry.label.trim()).not.toBe('')
  })

  it('marks only the list and line-break keys as multiline', () => {
    const multiline = CONTENT_KEYS.filter((entry) => entry.multiline).map((entry) => entry.key)
    expect(multiline.sort()).toEqual(
      [
        'about.joinReasons.items',
        'about.values.items',
        'contact.subjects',
        'footer.tagline',
        'privacy.collect.items',
        'privacy.use.items',
        'privacy.processors.items',
        'privacy.retention.items',
        'privacy.choices.items',
        'terms.use.items',
      ].sort(),
    )
  })
})

describe('isContentKey and contentKeyDefinition', () => {
  it('recognises whitelisted keys only', () => {
    expect(isContentKey('home.hero.intro')).toBe(true)
    expect(isContentKey('home.hero')).toBe(false)
    expect(isContentKey('__proto__')).toBe(false)
  })

  it('returns the label and multiline flag for a key', () => {
    expect(contentKeyDefinition('footer.tagline')).toMatchObject({ multiline: true })
  })
})

describe('contentKeysFor', () => {
  it('returns every key under a page prefix and nothing else', () => {
    const footer = contentKeysFor('footer')
    expect(footer).toEqual([
      'footer.tagline',
      'footer.location',
      'footer.quickLinks.heading',
      'footer.connect.heading',
      'footer.copyright',
    ])
  })

  it('does not match a prefix that is only the start of another word', () => {
    expect(contentKeysFor('event')).toEqual([])
  })
})

describe('inline-editable keys', () => {
  it('excludes the contact subjects, which only the settings form may write', () => {
    expect(isInlineContentKey('contact.subjects')).toBe(false)
    expect(INLINE_CONTENT_KEYS).not.toContain('contact.subjects')
    expect(INLINE_CONTENT_KEYS).toHaveLength(CONTENT_KEYS.length - 1)
  })

  it('accepts page text and rejects unknown keys', () => {
    expect(isInlineContentKey('footer.tagline')).toBe(true)
    expect(isInlineContentKey('nope')).toBe(false)
  })
})
