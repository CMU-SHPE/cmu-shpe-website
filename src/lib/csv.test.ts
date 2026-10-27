import { describe, expect, it } from 'vitest'
import { csvField, toCsv } from './csv'

describe('csvField', () => {
  it('passes plain values through unchanged', () => {
    expect(csvField('Jane Doe')).toBe('Jane Doe')
    expect(csvField(42)).toBe('42')
  })

  it('returns an empty string for null', () => {
    expect(csvField(null)).toBe('')
  })

  it('quotes values containing commas, quotes or line breaks', () => {
    expect(csvField('Doe, Jane')).toBe('"Doe, Jane"')
    expect(csvField('Jane "JD" Doe')).toBe('"Jane ""JD"" Doe"')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
    expect(csvField('line1\rline2')).toBe('"line1\rline2"')
  })

  it('defuses formula-leading characters with a quote prefix', () => {
    expect(csvField('=HYPERLINK("https://evil.example","x")')).toBe(
      '"\'=HYPERLINK(""https://evil.example"",""x"")"',
    )
    expect(csvField('+1234')).toBe("'+1234")
    expect(csvField('-cmd')).toBe("'-cmd")
    expect(csvField('@import')).toBe("'@import")
    expect(csvField('\tpadded')).toBe("'\tpadded")
    expect(csvField('\r=1+1')).toBe('"\'\r=1+1"')
    expect(csvField(-5)).toBe("'-5")
  })

  it('defuses formulas hidden behind leading whitespace', () => {
    expect(csvField(' =1+1')).toBe("' =1+1")
    expect(csvField('   @SUM(A1)')).toBe("'   @SUM(A1)")
    expect(csvField('\n=1+1')).toBe('"\'\n=1+1"')
    expect(csvField(' +1')).toBe("' +1")
  })

  it('leaves formula characters mid-string alone', () => {
    expect(csvField("Anne-Marie O'Neil")).toBe("Anne-Marie O'Neil")
    expect(csvField('a=b')).toBe('a=b')
    expect(csvField(' plain')).toBe(' plain')
  })
})

describe('toCsv', () => {
  it('joins fields with commas and ends every row with CRLF', () => {
    expect(
      toCsv([
        ['Name', 'Email'],
        ['=Mia', 'mia@example.com'],
      ]),
    ).toBe("Name,Email\r\n'=Mia,mia@example.com\r\n")
  })
})
