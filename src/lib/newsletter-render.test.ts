import { describe, expect, it } from 'vitest'
import { newsletterSubject, paragraphsOf, renderNewsletter, SAMPLE_UNSUBSCRIBE_LABEL } from './newsletter-render'

const UNSUBSCRIBE = 'https://shpe.example/unsubscribe?token=abc_DEF-123'

function render(body: string, overrides: Partial<Parameters<typeof renderNewsletter>[0]> = {}) {
  return renderNewsletter({
    subject: 'Spring update',
    body,
    topicNames: ['Events', 'Jobs & internships'],
    mailingAddress: '5000 Forbes Ave\nPittsburgh, PA 15213',
    siteUrl: 'https://shpe.example',
    unsubscribe: { url: UNSUBSCRIBE },
    ...overrides,
  })
}

function bodyOf(html: string): string {
  return html.slice(html.indexOf('<body'), html.indexOf('<hr'))
}

describe('renderNewsletter body', () => {
  it('splits paragraphs on blank lines and turns single newlines into <br>', () => {
    const { html, text } = render('First line\nsecond line\n\n\nNext paragraph\r\n\r\nLast')
    expect(bodyOf(html)).toContain('<p style="margin:0 0 16px">First line<br>second line</p>')
    expect(bodyOf(html)).toContain('>Next paragraph</p>')
    expect(bodyOf(html)).toContain('>Last</p>')
    expect(text.startsWith('First line\nsecond line\n\nNext paragraph\n\nLast\n\n')).toBe(true)
  })

  it('escapes script tags and attribute injection instead of passing HTML through', () => {
    const { html } = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)"> "quoted" \'single\'')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &quot;quoted&quot; &#39;single&#39;')
  })

  it('links bare http and https URLs, leaving trailing punctuation outside the link', () => {
    const { html } = render('See https://shpe.org/events?a=1&b=2. Or http://example.com/x)')
    expect(html).toContain('<a href="https://shpe.org/events?a=1&amp;b=2">https://shpe.org/events?a=1&amp;b=2</a>.')
    expect(html).toContain('<a href="http://example.com/x">http://example.com/x</a>)')
  })

  it('does not link javascript:, data: or other schemes', () => {
    const { html } = render('javascript:alert(1) data:text/html;base64,PHNjcmlwdD4= ftp://files.example vbscript:x')
    expect(bodyOf(html)).not.toContain('<a ')
    expect(html).toContain('javascript:alert(1)')
  })

  it('cannot break out of an href with a quote or angle bracket inside a URL', () => {
    const { html } = render('https://evil.example/"onmouseover="alert(1) https://evil.example/<script>')
    expect(html).toContain('<a href="https://evil.example/">https://evil.example/</a>&quot;onmouseover=')
    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/href="[^"]*"[^>]*onmouseover/)
  })
})

describe('renderNewsletter footer', () => {
  it('says why, links unsubscribe and account management, and shows the mailing address in the HTML part', () => {
    const { html } = render('Hi')
    expect(html).toContain('You&#39;re receiving this because you subscribed to: Events, Jobs &amp; internships.')
    expect(html).toContain(`<a href="${UNSUBSCRIBE}">Unsubscribe</a>`)
    expect(html).toContain('<a href="https://shpe.example/account">Manage your newsletters</a>')
    expect(html).toContain('SHPE @ CMU<br>5000 Forbes Ave<br>Pittsburgh, PA 15213')
  })

  it('says the same in the text part', () => {
    const { text } = render('Hi')
    expect(text).toContain("You're receiving this because you subscribed to: Events, Jobs & internships.")
    expect(text).toContain(`Unsubscribe: ${UNSUBSCRIBE}`)
    expect(text).toContain('Manage your newsletters: https://shpe.example/account')
    expect(text).toContain('SHPE @ CMU\n5000 Forbes Ave\nPittsburgh, PA 15213\n')
  })

  it('escapes the topic names and mailing address', () => {
    const { html } = render('Hi', { topicNames: ['<b>x</b>'], mailingAddress: '<script>1</script>' })
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<script>1</script>')
  })

  it('renders a labelled, inert sample in place of the unsubscribe link for previews and tests', () => {
    const { html, text } = render('Hi', { unsubscribe: { sample: true } })
    expect(html).toContain(SAMPLE_UNSUBSCRIBE_LABEL)
    expect(html).not.toContain('/unsubscribe')
    expect(text).toContain(SAMPLE_UNSUBSCRIBE_LABEL)
  })
})

describe('newsletterSubject', () => {
  it('keeps the admin subject verbatim apart from trimming and line breaks', () => {
    expect(newsletterSubject('  Spring <update> & more \r\nBcc: x@y.z ')).toBe('Spring <update> & more Bcc: x@y.z')
    expect(render('x', { subject: ' Hello\nthere ' }).subject).toBe('Hello there')
  })
})

describe('paragraphsOf', () => {
  it('drops empty paragraphs', () => {
    expect(paragraphsOf('\n\n a \n\n\n\n  \n\nb\n')).toEqual([' a ', 'b'])
  })
})

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
}

describe('renderNewsletter against hostile input', () => {
  it('only ever produces http(s) hrefs, whatever schemes or casing the body uses', () => {
    const { html } = render(
      'JavaScript:alert(1) jAvAsCrIpT:alert(1) javascript:https://shpe.example data:text/html,<b>x</b> VBScript:msgbox(1) //evil.example',
    )
    for (const href of hrefsOf(bodyOf(html))) expect(href).toMatch(/^https?:\/\//)
    expect(bodyOf(html)).not.toMatch(/href="(?:javascript|data|vbscript):/i)
  })

  it('ends a link at an attribute break-out and escapes the rest', () => {
    const { html } = render('https://evil.example/"><img src=x onerror=alert(1)> and https://evil.example/\'onmouseover=alert(1)')
    expect(html).not.toContain('<img')
    expect(hrefsOf(bodyOf(html))).toEqual(['https://evil.example/', 'https://evil.example/'])
    expect(bodyOf(html)).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;')
  })

  it('ends a link before a < so it cannot open a tag', () => {
    const { html } = render('https://shpe.example/a<b>c')
    expect(hrefsOf(bodyOf(html))).toEqual(['https://shpe.example/a'])
    expect(bodyOf(html)).toContain('</a>&lt;b&gt;c')
  })

  it('leaves trailing sentence punctuation outside the link in html and verbatim in text', () => {
    const { html, text } = render('Sign up (https://shpe.example/join). Then: https://shpe.example/a?b=1!')
    expect(hrefsOf(bodyOf(html))).toEqual(['https://shpe.example/join', 'https://shpe.example/a?b=1'])
    expect(bodyOf(html)).toContain('</a>).')
    expect(bodyOf(html)).toContain('</a>!')
    expect(text).toContain('Sign up (https://shpe.example/join). Then: https://shpe.example/a?b=1!')
  })

  it('keeps a balanced closing parenthesis inside a link such as a Wikipedia page', () => {
    const { html } = render(
      'Read https://en.wikipedia.org/wiki/SHPE_(organization). Also (see https://en.wikipedia.org/wiki/A_(b)) and https://x.example/a)b)',
    )
    expect(hrefsOf(bodyOf(html))).toEqual([
      'https://en.wikipedia.org/wiki/SHPE_(organization)',
      'https://en.wikipedia.org/wiki/A_(b)',
      'https://x.example/a)b',
    ])
    expect(bodyOf(html)).toContain('SHPE_(organization)</a>.')
    expect(bodyOf(html)).toContain('A_(b)</a>) and')
  })

  it('keeps unicode text, emoji and RTL characters intact without breaking the markup', () => {
    const body = 'Bienvenidos, ¡año nuevo! 🎉\n\nمرحبا ‮gnp.exe‬ and ‏⁦isolated⁩'
    const { html, text } = render(body, { subject: 'Año nuevo 🎉 ‮cmu' })
    expect(text.startsWith('Bienvenidos, ¡año nuevo! 🎉\n\nمرحبا ‮gnp.exe‬')).toBe(true)
    expect(bodyOf(html)).toContain('Bienvenidos, ¡año nuevo! 🎉</p>')
    expect(bodyOf(html).match(/<p /g)).toHaveLength(2)
    expect(html).toContain('<title>Año nuevo 🎉 ‮cmu</title>')
  })

  it.todo(
    'keeps bidi and zero-width control characters out of link hrefs (needs-decision: URL_PATTERN in ' +
      'newsletter-render.ts matches U+202E, so "https://shpe.example/\\u202Efdp.exe" links with the override inside)',
  )
})

describe('newsletterSubject header safety', () => {
  it.each([
    ['CRLF', 'Hello\r\nBcc: x@y.z'],
    ['lone CR', 'Hello\rBcc: x@y.z'],
    ['lone LF', 'Hello\nBcc: x@y.z'],
    ['repeated breaks', 'Hello\r\r\n\n Bcc: x@y.z'],
    ['a trailing break', 'Hello Bcc: x@y.z\r\n'],
  ])('folds %s so no header can be injected', (_, subject) => {
    const folded = render('x', { subject }).subject
    expect(folded).not.toMatch(/[\r\n]/)
    expect(folded).toBe('Hello Bcc: x@y.z')
  })

  it('escapes the subject in the html title', () => {
    expect(render('x', { subject: '</title><script>alert(1)</script>' }).html).toContain(
      '<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>',
    )
  })
})

describe('renderNewsletter footer in both parts', () => {
  it('puts the reason, unsubscribe link, account link and mailing address after the body in html and text', () => {
    const { html, text } = render('Body text', { mailingAddress: ' 5000 Forbes Ave \r\n\r\n Pittsburgh, PA 15213 ' })
    for (const part of [html, text]) {
      const bodyAt = part.indexOf('Body text')
      for (const piece of ['receiving this because you subscribed to: Events', UNSUBSCRIBE, 'https://shpe.example/account', '5000 Forbes Ave', 'Pittsburgh, PA 15213']) {
        expect(part.indexOf(piece)).toBeGreaterThan(bodyAt)
      }
    }
    expect(text).toContain('SHPE @ CMU\n5000 Forbes Ave\nPittsburgh, PA 15213\n')
    expect(html).toContain('SHPE @ CMU<br>5000 Forbes Ave<br>Pittsburgh, PA 15213')
  })

  it('gives the test-send sample no working token in either part', () => {
    const { html, text } = render('Hi', { unsubscribe: { sample: true } })
    for (const part of [html, text]) {
      expect(part).not.toContain('token=')
      expect(part).not.toContain('/unsubscribe')
      expect(part).toContain(SAMPLE_UNSUBSCRIBE_LABEL)
      expect(part).toContain('https://shpe.example/account')
    }
    expect(hrefsOf(html)).toEqual(['https://shpe.example/account'])
  })
})
