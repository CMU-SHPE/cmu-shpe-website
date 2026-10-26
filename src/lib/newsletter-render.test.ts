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
