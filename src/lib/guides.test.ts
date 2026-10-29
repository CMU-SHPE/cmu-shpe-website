import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDES, GUIDES_DIR, OFFICER_HANDBOOK_FILE, loadGuide, renderGuide, safeHref, slugify, type GuideName } from './guides'

describe('renderGuide', () => {
  it('takes the title from the h1 and leaves it out of the body', () => {
    const guide = renderGuide('# Member guide\n\nHello.\n\n## Signing in\n')
    expect(guide.title).toBe('Member guide')
    expect(guide.html).not.toContain('<h1')
    expect(guide.html).toContain('<p>Hello.</p>')
  })

  it('gives every heading an id from its text and lists h2 and h3 in the contents', () => {
    const guide = renderGuide('# T\n\n## Signing in\n\n### How to sign in\n\n#### Detail\n')
    expect(guide.html).toContain('<h2 id="signing-in">Signing in</h2>')
    expect(guide.html).toContain('<h3 id="how-to-sign-in">How to sign in</h3>')
    expect(guide.html).toContain('<h4 id="detail">Detail</h4>')
    expect(guide.toc).toEqual([
      { id: 'signing-in', text: 'Signing in', depth: 2 },
      { id: 'how-to-sign-in', text: 'How to sign in', depth: 3 },
    ])
  })

  it('numbers repeated headings so ids stay unique', () => {
    const guide = renderGuide('## Events\n\n## Events\n\n## Events\n')
    expect(guide.toc.map((entry) => entry.id)).toEqual(['events', 'events-2', 'events-3'])
  })

  it('keeps contents text unescaped and the heading HTML escaped once', () => {
    const guide = renderGuide('## Privacy & "terms" it’s\n')
    expect(guide.toc[0]).toEqual({ id: 'privacy-terms-it-s', text: 'Privacy & "terms" it’s', depth: 2 })
    expect(guide.html).toContain('>Privacy &amp; &quot;terms&quot; it’s</h2>')
  })

  it('shows raw HTML as text instead of rendering it', () => {
    const guide = renderGuide('Hello <b onclick="x()">bold</b>\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n')
    expect(guide.html).not.toMatch(/<(b|script|img)[\s>]/)
    expect(guide.html).toContain('&lt;b onclick=&quot;x()&quot;&gt;bold&lt;/b&gt;')
    expect(guide.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('drops HTML comments, inline and on their own line', () => {
    const guide = renderGuide(
      '## Events <!-- heading note -->\n\nSet the start date. <!-- event-date-range -->\n\n<!--\nA longer note\n-->\n\n1. Step. <!-- x -->\n',
    )
    expect(guide.html).not.toContain('<!--')
    expect(guide.html).not.toContain('&lt;!--')
    expect(guide.html).not.toContain('note')
    expect(guide.html).toContain('Set the start date.')
    expect(guide.toc[0]).toEqual({ id: 'events', text: 'Events', depth: 2 })
  })

  it('keeps safe links, drops unsafe ones and marks external links', () => {
    const guide = renderGuide(
      '[a](/account) [b](https://shpe.org) [c](mailto:x@example.com) [d](#events) [e](javascript:alert(1)) [f](//evil.example)',
    )
    expect(guide.html).toContain('<a href="/account">a</a>')
    expect(guide.html).toContain('<a href="https://shpe.org" rel="noopener noreferrer">b</a>')
    expect(guide.html).toContain('<a href="mailto:x@example.com">c</a>')
    expect(guide.html).toContain('<a href="#events">d</a>')
    expect(guide.html).not.toContain('javascript:')
    expect(guide.html).not.toContain('evil.example')
    expect(guide.html).toContain(' e ')
  })

  it('prefixes ids and in-page links when several guides share a page', () => {
    const guide = renderGuide('## Events\n\nSee [events](#events).', { idPrefix: 'members-' })
    expect(guide.html).toContain('<h2 id="members-events">')
    expect(guide.html).toContain('<a href="#members-events">events</a>')
  })

  it('renders site images with their alt text and refuses images from elsewhere', () => {
    const guide = renderGuide('![The "Sign in" page](/help/img/members/join.png)\n\n![Remote](https://evil.example/a.png)')
    expect(guide.html).toContain('<img src="/help/img/members/join.png" alt="The &quot;Sign in&quot; page" loading="lazy">')
    expect(guide.html).not.toContain('evil.example')
    expect(guide.html).toContain('<span class="guide-missing-image">Remote</span>')
  })
})

describe('helpers', () => {
  it('keeps the officer handbook outside public/', () => {
    expect(path.relative(process.cwd(), OFFICER_HANDBOOK_FILE)).toBe(path.join('docs', 'guides', 'pdf', 'officer-handbook.pdf'))
  })

  it('slugifies accents and punctuation', () => {
    expect(slugify('Añadir un evento: ¿cómo?')).toBe('anadir-un-evento-como')
    expect(slugify('***')).toBe('section')
  })

  it('accepts only root paths, anchors, http(s) and mailto links', () => {
    expect(safeHref('/join')).toBe('/join')
    expect(safeHref('data:text/html,x')).toBeNull()
    expect(safeHref('//host')).toBeNull()
  })
})

describe.each(Object.keys(GUIDES) as GuideName[])('the %s guide', (name) => {
  it('has a title, no skipped heading levels and no raw HTML in the output', async () => {
    const guide = await loadGuide(name)
    expect(guide.title).toBe(GUIDES[name].title)
    expect(guide.toc.length).toBeGreaterThan(3)

    const levels = [...guide.html.matchAll(/<h([1-6]) /g)].map((match) => Number(match[1]))
    expect(levels[0]).toBe(2)
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `heading ${index}`).toBeLessThanOrEqual(levels[index - 1] + 1)
    })
    expect(guide.html).not.toContain('&lt;')
    expect(guide.html).not.toContain('guide-missing-image')
  })

  it('points every image at /help/img/<guide>/<slug>.png with real alt text', async () => {
    const markdown = await readFile(path.join(GUIDES_DIR, `${name}.md`), 'utf8')
    const images = [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)]
    expect(images.length).toBeGreaterThan(0)
    for (const [, alt, src] of images) {
      expect(src).toMatch(new RegExp(`^/help/img/${name}/[a-z0-9-]+\\.png$`))
      expect(alt.length, src).toBeGreaterThan(15)
    }
  })

  it('links only to headings that exist', async () => {
    const guide = await loadGuide(name)
    const ids = new Set([...guide.html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]))
    for (const [, target] of guide.html.matchAll(/href="#([^"]+)"/g)) expect(ids, target).toContain(target)
  })

  it('calls the CMU student organization platform MavLife, never Presence', async () => {
    const markdown = await readFile(path.join(GUIDES_DIR, `${name}.md`), 'utf8')
    expect(markdown).not.toMatch(/presence/i)
  })
})
