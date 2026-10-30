// Uploaded SVGs are served publicly from the Blob store, where opening the URL renders them as a
// document. Anything that could run script or pull in another resource is refused rather than
// sanitised, because a plain logo needs none of it.

const SCRIPTABLE_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'handler',
  'listener',
])
const SCRIPT_SCHEME = /(^|[^a-z0-9+.-])(javascript|vbscript|data):/
const NAME_END = /[\s/>=]/
const WHITESPACE = /\s/

function localName(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1).toLowerCase()
}

function decodeCharacterReferences(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
}

function isUnsafeAttribute(name: string, rawValue: string): boolean {
  const attribute = localName(name)
  if (attribute.startsWith('on')) return true
  if (attribute === 'href' && !rawValue.trimStart().startsWith('#')) return true
  const value = decodeCharacterReferences(rawValue).replace(/[\s\u0000-\u001f]/g, '').toLowerCase()
  return SCRIPT_SCHEME.test(value)
}

function readName(text: string, start: number): number {
  let end = start
  while (end < text.length && !NAME_END.test(text[end])) end += 1
  return end
}

function skipWhitespace(text: string, start: number): number {
  let index = start
  while (index < text.length && WHITESPACE.test(text[index])) index += 1
  return index
}

/** Returns the index just past the start tag's `>`, or -1 when the tag is unsafe or malformed. */
function scanStartTag(text: string, nameStart: number): number {
  let index = readName(text, nameStart)
  if (index === nameStart) return -1
  if (SCRIPTABLE_ELEMENTS.has(localName(text.slice(nameStart, index)))) return -1

  for (;;) {
    index = skipWhitespace(text, index)
    if (index >= text.length) return -1
    if (text[index] === '>') return index + 1
    if (text.startsWith('/>', index)) return index + 2

    const attributeStart = index
    index = readName(text, index)
    if (index === attributeStart) return -1
    const attribute = text.slice(attributeStart, index)

    index = skipWhitespace(text, index)
    let value = ''
    if (text[index] === '=') {
      index = skipWhitespace(text, index + 1)
      const quote = text[index]
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, index + 1)
        if (close === -1) return -1
        value = text.slice(index + 1, close)
        index = close + 1
      } else {
        const valueStart = index
        while (index < text.length && !/[\s>]/.test(text[index])) index += 1
        value = text.slice(valueStart, index)
      }
    }
    if (isUnsafeAttribute(attribute, value)) return -1
  }
}

function skipPast(text: string, from: number, terminator: string): number {
  const end = text.indexOf(terminator, from)
  return end === -1 ? -1 : end + terminator.length
}

/** Scans every tag of an SVG document; false if any part could run script or load another resource. */
export function isSafeSvg(text: string): boolean {
  if (text.includes('\u0000')) return false

  let index = 0
  for (;;) {
    const open = text.indexOf('<', index)
    if (open === -1) return true

    if (text.startsWith('<!--', open)) {
      index = skipPast(text, open + 4, '-->')
    } else if (text.startsWith('<![CDATA[', open)) {
      index = skipPast(text, open + 9, ']]>')
    } else if (text.startsWith('<!', open)) {
      index = skipPast(text, open + 2, '>')
      // An internal DTD subset can declare entities that expand into script elements.
      if (index !== -1 && /[[\]]|entity/i.test(text.slice(open, index))) return false
    } else if (text.startsWith('<?', open)) {
      // Only the XML declaration; xml-stylesheet can load XSLT that emits script.
      if (!/^<\?xml\s/.test(text.slice(open, open + 6))) return false
      index = skipPast(text, open + 2, '?>')
    } else if (text.startsWith('</', open)) {
      const nameEnd = readName(text, open + 2)
      if (SCRIPTABLE_ELEMENTS.has(localName(text.slice(open + 2, nameEnd)))) return false
      index = skipPast(text, nameEnd, '>')
    } else {
      index = scanStartTag(text, open + 1)
    }
    if (index === -1) return false
  }
}

export async function isSafeSvgFile(file: Blob): Promise<boolean> {
  try {
    return isSafeSvg(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()))
  } catch {
    return false
  }
}
