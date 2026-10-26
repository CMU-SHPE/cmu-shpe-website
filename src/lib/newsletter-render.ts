import { escapeHtml } from './email-templates'

export type NewsletterUnsubscribeLink = { url: string } | { sample: true }

export type NewsletterRenderInput = {
  subject: string
  body: string
  topicNames: readonly string[]
  mailingAddress: string
  siteUrl: string
  unsubscribe: NewsletterUnsubscribeLink
}

export type RenderedNewsletter = {
  subject: string
  text: string
  html: string
}

export const SAMPLE_UNSUBSCRIBE_LABEL = 'Unsubscribe (sample: each recipient gets their own link here)'

// Only http(s) is matched, so javascript:, data: and other schemes stay plain text.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/

export function newsletterSubject(subject: string): string {
  return subject.replace(/[^\S\r\n]*[\r\n]+\s*/g, ' ').trim()
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

export function paragraphsOf(body: string): string[] {
  return normalizeLines(body)
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ''))
    .filter((paragraph) => paragraph.trim() !== '')
}

function linkify(line: string): string {
  let html = ''
  let last = 0
  for (const match of line.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const url = raw.replace(TRAILING_PUNCTUATION, '')
    const start = match.index
    html += escapeHtml(line.slice(last, start))
    html += `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`
    last = start + url.length
  }
  return html + escapeHtml(line.slice(last))
}

function paragraphHtml(paragraph: string): string {
  return `<p style="margin:0 0 16px">${paragraph.split('\n').map(linkify).join('<br>')}</p>`
}

function topicList(topicNames: readonly string[]): string {
  return topicNames.join(', ')
}

function addressLines(mailingAddress: string): string[] {
  return normalizeLines(mailingAddress)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function footerText(input: NewsletterRenderInput): string {
  const unsubscribe =
    'url' in input.unsubscribe ? `Unsubscribe: ${input.unsubscribe.url}` : SAMPLE_UNSUBSCRIBE_LABEL
  return [
    '--',
    `You're receiving this because you subscribed to: ${topicList(input.topicNames)}.`,
    unsubscribe,
    `Manage your newsletters: ${input.siteUrl}/account`,
    '',
    'SHPE @ CMU',
    ...addressLines(input.mailingAddress),
  ].join('\n')
}

function footerHtml(input: NewsletterRenderInput): string {
  const unsubscribe =
    'url' in input.unsubscribe
      ? `<a href="${escapeHtml(input.unsubscribe.url)}">Unsubscribe</a>`
      : `<span>${escapeHtml(SAMPLE_UNSUBSCRIBE_LABEL)}</span>`
  const account = `<a href="${escapeHtml(`${input.siteUrl}/account`)}">Manage your newsletters</a>`
  const address = ['SHPE @ CMU', ...addressLines(input.mailingAddress)].map(escapeHtml).join('<br>')
  return [
    '<hr style="border:none;border-top:1px solid #d1d5db;margin:24px 0">',
    '<div style="font-size:13px;color:#4b5563">',
    `<p style="margin:0 0 8px">You&#39;re receiving this because you subscribed to: ${escapeHtml(topicList(input.topicNames))}.</p>`,
    `<p style="margin:0 0 8px">${unsubscribe} &middot; ${account}</p>`,
    `<p style="margin:0">${address}</p>`,
    '</div>',
  ].join('\n')
}

/** The one renderer behind the admin preview, test sends and real sends, so all three match. */
export function renderNewsletter(input: NewsletterRenderInput): RenderedNewsletter {
  const subject = newsletterSubject(input.subject)
  const paragraphs = paragraphsOf(input.body)

  const text = `${paragraphs.join('\n\n')}\n\n${footerText(input)}\n`
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(subject)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#ffffff;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">',
    '<div style="max-width:600px;margin:0 auto">',
    ...paragraphs.map(paragraphHtml),
    footerHtml(input),
    '</div>',
    '</body>',
    '</html>',
  ].join('\n')

  return { subject, text, html }
}
