import { normalizeNewlines } from './text'

/**
 * The inline editor turns Enter into a blank-line paragraph break while seeded
 * values use single newlines, so any run of newlines separates two items.
 */
export function toLines(value: string): string[] {
  return normalizeNewlines(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function uniqueIgnoringCase(items: readonly string[]): string[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const folded = item.toLocaleLowerCase()
    if (seen.has(folded)) return false
    seen.add(folded)
    return true
  })
}
