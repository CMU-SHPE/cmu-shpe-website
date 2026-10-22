import { describe, expect, it } from 'vitest'
import {
  HTTP_URL_INPUT,
  IMAGE_SOURCE_INPUT,
  MAX_RECORD_ID,
  emailAddress,
  hexColor,
  httpUrl,
  moveDirection,
  moveRequest,
  optionalEmail,
  optionalHttpUrl,
  optionalText,
  recordId,
  requiredText,
} from './form-fields'
import { imageSource } from './validation'

describe('httpUrl', () => {
  it('accepts http and https URLs and trims them', () => {
    expect(httpUrl.parse(' https://www.jgmsinc.com/ ')).toBe('https://www.jgmsinc.com/')
    expect(httpUrl.safeParse('http://example.org/path?q=1').success).toBe(true)
  })

  it('rejects javascript:, data: and other non-http schemes', () => {
    expect(httpUrl.safeParse('javascript:alert(1)').success).toBe(false)
    expect(httpUrl.safeParse('JavaScript:alert(1)').success).toBe(false)
    expect(httpUrl.safeParse('data:text/html,<script>alert(1)</script>').success).toBe(false)
    expect(httpUrl.safeParse('ftp://example.org/file').success).toBe(false)
    expect(httpUrl.safeParse('mailto:a@example.org').success).toBe(false)
  })

  it('rejects relative paths and junk', () => {
    expect(httpUrl.safeParse('/sponsors').success).toBe(false)
    expect(httpUrl.safeParse('example.org').success).toBe(false)
    expect(httpUrl.safeParse('not a url').success).toBe(false)
  })

  it('rejects values over 500 characters', () => {
    expect(httpUrl.safeParse(`https://example.org/${'a'.repeat(500)}`).success).toBe(false)
  })
})

describe('optionalHttpUrl', () => {
  it('turns blank and missing values into null', () => {
    expect(optionalHttpUrl.parse('')).toBeNull()
    expect(optionalHttpUrl.parse('   ')).toBeNull()
    expect(optionalHttpUrl.parse(null)).toBeNull()
  })

  it('still rejects non-http schemes when a value is given', () => {
    expect(optionalHttpUrl.safeParse('javascript:alert(1)').success).toBe(false)
    expect(optionalHttpUrl.parse('https://x.com/cmu_shpe')).toBe('https://x.com/cmu_shpe')
  })
})

describe('emailAddress and optionalEmail', () => {
  it('accepts and trims a valid email', () => {
    expect(emailAddress.parse(' shpecmu9@gmail.com ')).toBe('shpecmu9@gmail.com')
  })

  it('rejects malformed emails', () => {
    expect(emailAddress.safeParse('not-an-email').success).toBe(false)
    expect(optionalEmail.safeParse('still not').success).toBe(false)
  })

  it('treats a blank optional email as null', () => {
    expect(optionalEmail.parse('')).toBeNull()
  })
})

describe('text fields', () => {
  it('requiredText trims and rejects blank or overlong values', () => {
    expect(requiredText(5).parse('  abc  ')).toBe('abc')
    expect(requiredText(5).safeParse('   ').success).toBe(false)
    expect(requiredText(5).safeParse('abcdef').success).toBe(false)
  })

  it('optionalText turns blank into null and enforces the max', () => {
    expect(optionalText(5).parse(' ')).toBeNull()
    expect(optionalText(5).parse(' 6 PM ')).toBe('6 PM')
    expect(optionalText(5).safeParse('abcdef').success).toBe(false)
  })
})

describe('hexColor', () => {
  it('accepts six-digit hex colors', () => {
    expect(hexColor.parse('#555555')).toBe('#555555')
    expect(hexColor.parse('#FfA0b1')).toBe('#FfA0b1')
  })

  it('rejects anything that is not exactly #rrggbb', () => {
    for (const value of ['555555', '#555', '#5555555', '#gggggg', 'red', 'url(x)', '#fff;color:red']) {
      expect(hexColor.safeParse(value).success).toBe(false)
    }
  })
})

describe('recordId and moveDirection', () => {
  it('coerces positive integer ids', () => {
    expect(recordId.parse('42')).toBe(42)
    expect(recordId.parse(7)).toBe(7)
  })

  it('rejects non-integer, zero and negative ids', () => {
    for (const value of ['1.5', '0', '-3', 'abc', '']) {
      expect(recordId.safeParse(value).success).toBe(false)
    }
  })

  it('rejects ids beyond the Postgres integer range', () => {
    expect(recordId.parse(MAX_RECORD_ID)).toBe(MAX_RECORD_ID)
    expect(recordId.safeParse(MAX_RECORD_ID + 1).success).toBe(false)
    expect(recordId.safeParse(1e20).success).toBe(false)
    expect(recordId.safeParse('1e20').success).toBe(false)
  })

  it('only allows up and down', () => {
    expect(moveDirection.parse('up')).toBe('up')
    expect(moveDirection.safeParse('sideways').success).toBe(false)
  })
})

describe('moveRequest', () => {
  it('accepts a bound id and direction', () => {
    expect(moveRequest.parse({ id: 3, direction: 'down' })).toEqual({ id: 3, direction: 'down' })
  })

  it('rejects tampered bound arguments', () => {
    expect(moveRequest.safeParse({ id: 1.5, direction: 'up' }).success).toBe(false)
    expect(moveRequest.safeParse({ id: 3, direction: 'left' }).success).toBe(false)
  })
})

function browserAccepts(pattern: string, value: string) {
  return new RegExp(`^(?:${pattern})$`, 'v').test(value)
}

describe('input patterns', () => {
  it('compile under the v flag browsers use for the pattern attribute', () => {
    expect(() => new RegExp(HTTP_URL_INPUT.pattern, 'v')).not.toThrow()
    expect(() => new RegExp(IMAGE_SOURCE_INPUT.pattern, 'v')).not.toThrow()
  })

  it('agree with the server on links', () => {
    for (const value of [
      'https://www.linkedin.com/in/jtorresn/',
      'http://example.org/page',
      'javascript:alert(1)',
      'ftp://example.org/file',
      'example.org',
      '/sponsors',
    ]) {
      expect(browserAccepts(HTTP_URL_INPUT.pattern, value), value).toBe(httpUrl.safeParse(value).success)
    }
  })

  it('agree with the server on image paths and links', () => {
    for (const value of [
      '/officers/jeff.jpg',
      '/sponsors/sgm-inc-logo.svg',
      'https://example.org/logo.png',
      'http://example.org/logo.png',
      '//evil.example/x.png',
      '/',
      '/\\evil.example/x.png',
      '/a b.png',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      'images/x.png',
    ]) {
      expect(browserAccepts(IMAGE_SOURCE_INPUT.pattern, value), value).toBe(imageSource.safeParse(value).success)
    }
  })
})
