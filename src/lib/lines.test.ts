import { describe, expect, it } from 'vitest'
import { toLines } from './lines'

describe('toLines', () => {
  it('splits seeded single-newline values into trimmed items', () => {
    expect(toLines('General Inquiry\nMembership\n  Other  ')).toEqual([
      'General Inquiry',
      'Membership',
      'Other',
    ])
  })

  it('treats the blank-line breaks the inline editor produces as one separator', () => {
    expect(toLines('First value\n\nSecond value\n\n\nThird value')).toEqual([
      'First value',
      'Second value',
      'Third value',
    ])
  })

  it('drops whitespace-only lines and handles CRLF', () => {
    expect(toLines('a\r\n   \r\nb\r\n')).toEqual(['a', 'b'])
  })

  it('returns an empty list for an empty value', () => {
    expect(toLines('')).toEqual([])
  })
})
