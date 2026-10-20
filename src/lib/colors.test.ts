import { describe, expect, it } from 'vitest'
import { safeHexColor } from './colors'

describe('safeHexColor', () => {
  it('passes a #rrggbb color through', () => {
    expect(safeHexColor('#555555', '#ffffff')).toBe('#555555')
  })

  it('uses the fallback for anything else', () => {
    for (const value of [undefined, null, '', 'red', '#fff', 'url(javascript:alert(1))']) {
      expect(safeHexColor(value, '#ffffff')).toBe('#ffffff')
    }
  })
})
