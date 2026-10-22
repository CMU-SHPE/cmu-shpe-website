import { describe, expect, it } from 'vitest'
import { normalizeNewlines } from './text'

describe('normalizeNewlines', () => {
  it('converts CRLF form-submission line endings to LF', () => {
    expect(normalizeNewlines('para one\r\n\r\npara two')).toBe('para one\n\npara two')
  })

  it('converts bare CR to LF', () => {
    expect(normalizeNewlines('a\rb')).toBe('a\nb')
  })

  it('leaves LF-only text unchanged', () => {
    expect(normalizeNewlines('a\n\nb\nc')).toBe('a\n\nb\nc')
  })
})
