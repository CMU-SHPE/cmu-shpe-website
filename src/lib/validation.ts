import { z } from 'zod'

/**
 * Browsers treat `\` like `/` and strip tabs and newlines from URLs, so
 * `/\evil.example` or `/<tab>/evil.example` would load from another host.
 */
function hasUnsafeCharacter(value: string) {
  return (
    /[\\\s]/.test(value) ||
    Array.from(value).some((char) => {
      const code = char.charCodeAt(0)
      return code < 0x20 || code === 0x7f
    })
  )
}

function isSafeImageSource(value: string) {
  if (hasUnsafeCharacter(value)) return false
  if (value.startsWith('/')) return /^\/[^/]/.test(value)
  return URL.canParse(value) && new URL(value).protocol === 'https:'
}

export const imageSource = z
  .string()
  .trim()
  .max(500)
  .refine(isSafeImageSource, { message: 'Must be an https URL or a path on this site starting with /' })
