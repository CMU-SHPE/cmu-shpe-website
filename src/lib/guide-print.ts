import { escapeHtml, type RenderedGuide } from '@/lib/guides'

export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

const PRINT_STYLES = `
  @page { margin: 18mm 16mm; }
  body { font-family: Inter, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.55; font-size: 11pt; margin: 0 auto; max-width: 48rem; padding: 1.5rem; }
  .cover { border-top: 10px solid #4B0012; padding-top: 1.5rem; }
  .cover p { color: #4b5563; }
  h1 { color: #4B0012; font-size: 26pt; margin: 0 0 0.5rem; }
  h2 { color: #4B0012; font-size: 18pt; border-bottom: 3px solid #FDB913; padding-bottom: 0.25rem; margin-top: 0; break-before: page; page-break-before: always; }
  h3 { color: #C8102E; font-size: 13pt; margin-top: 1.5rem; break-after: avoid; page-break-after: avoid; }
  a { color: #C8102E; }
  img { max-width: 100%; height: auto; border: 1px solid #d1d5db; border-radius: 6px; margin: 0.5rem 0; break-inside: avoid; page-break-inside: avoid; font-style: italic; color: #4b5563; }
  li { margin: 0.25rem 0; }
  .guide + .guide { break-before: page; page-break-before: always; }
  nav ul { list-style: none; padding-left: 0; }
  nav li.sub { padding-left: 1.25rem; }
`

function contents(guide: RenderedGuide): string {
  if (guide.toc.length === 0) return ''
  const items = guide.toc
    .map(
      (entry) =>
        `<li${entry.depth === 3 ? ' class="sub"' : ''}><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.text)}</a></li>`,
    )
    .join('')
  return `<nav aria-label="Contents of the ${escapeHtml(guide.title)}"><p><strong>Contents</strong></p><ul>${items}</ul></nav>`
}

/** A standalone page with no site navigation, for printing the guides to PDF. */
export function printDocument(title: string, guides: RenderedGuide[]): string {
  const sections = guides
    .map(
      (guide) =>
        `<section class="guide"><div class="cover"><h1>${escapeHtml(guide.title)}</h1><p>SHPE @ Colorado Mesa University · shpecmu.com</p></div>${contents(guide)}${guide.html}</section>`,
    )
    .join('\n')
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PRINT_STYLES}</style>`,
    '</head><body><main>',
    sections,
    '</main></body></html>',
  ].join('\n')
}

export function htmlResponse(html: string, headers: Record<string, string> = {}): Response {
  return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
}
