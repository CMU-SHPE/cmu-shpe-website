import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Marked, type Token, type Tokens } from 'marked'

export const GUIDES = {
  officers: { title: 'Officer guide' },
  members: { title: 'Member guide' },
  sponsors: { title: 'Sponsor guide' },
} as const

export type GuideName = keyof typeof GUIDES

export const GUIDES_DIR = path.join(process.cwd(), 'docs', 'guides')

export const PUBLIC_GUIDE_PDF = '/help/shpe-website-guide.pdf'
export const OFFICER_HANDBOOK_PDF = '/admin/help/handbook.pdf'

export type TocEntry = { id: string; text: string; depth: 2 | 3 }

export type RenderedGuide = { title: string; toc: TocEntry[]; html: string }

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

/** Root-relative paths, in-page anchors, http(s) and mailto only; anything else (javascript:, data:, //host) is dropped. */
export function safeHref(href: string): string | null {
  const value = href.trim()
  if (/^(https?:|mailto:)/i.test(value) || value.startsWith('#') || /^\/(?!\/)/.test(value)) return value
  return null
}

function safeImageSrc(src: string): string | null {
  const value = src.trim()
  return /^\/(?!\/)/.test(value) ? value : null
}

/**
 * Raw HTML in the source is shown as text, never rendered, and heading ids come from the
 * heading text so links like #sending-a-newsletter keep working. `idPrefix` keeps ids unique
 * when several guides share one page, and in-page links are prefixed to match.
 */
export function renderGuide(markdown: string, { idPrefix = '' }: { idPrefix?: string } = {}): RenderedGuide {
  const used = new Map<string, number>()
  const toc: TocEntry[] = []
  const marked = new Marked({ gfm: true, async: false })

  function uniqueId(text: string) {
    const base = idPrefix + slugify(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }

  marked.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text)
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens, this.parser.textRenderer)
        const id = uniqueId(text)
        if (depth === 2 || depth === 3) toc.push({ id, text, depth })
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
      link({ href, tokens }: Tokens.Link) {
        const label = this.parser.parseInline(tokens)
        const safe = safeHref(href)
        if (!safe) return label
        const target = idPrefix && safe.startsWith('#') ? `#${idPrefix}${safe.slice(1)}` : safe
        const external = /^https?:/i.test(target) ? ' rel="noopener noreferrer"' : ''
        return `<a href="${escapeHtml(target)}"${external}>${label}</a>`
      },
      image({ href, text }: Tokens.Image) {
        const src = safeImageSrc(href)
        if (!src) return `<span class="guide-missing-image">${escapeHtml(text)}</span>`
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}" loading="lazy">`
      },
    },
  })

  const tokens = marked.lexer(markdown)
  const titleIndex = tokens.findIndex((token): token is Tokens.Heading => token.type === 'heading' && token.depth === 1)
  const titleToken = titleIndex === -1 ? null : (tokens[titleIndex] as Tokens.Heading)
  const body: Token[] = titleIndex === -1 ? tokens : tokens.filter((_, index) => index !== titleIndex)
  const html = marked.parser(Object.assign(body, { links: tokens.links }))

  return { title: titleToken ? titleToken.text : '', toc, html }
}

export async function loadGuide(name: GuideName, options?: { idPrefix?: string }): Promise<RenderedGuide> {
  const markdown = await readFile(path.join(GUIDES_DIR, `${name}.md`), 'utf8')
  return renderGuide(markdown, options)
}
