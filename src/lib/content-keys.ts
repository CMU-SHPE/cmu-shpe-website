export type ContentKeyDefinition = {
  key: string
  label: string
  multiline: boolean
}

export const CONTENT_KEYS = [
  { key: 'contact.subjects', label: 'Contact form subject options', multiline: true },
] as const satisfies readonly ContentKeyDefinition[]

export type ContentKey = (typeof CONTENT_KEYS)[number]['key']

const definitions = new Map<string, ContentKeyDefinition>(
  CONTENT_KEYS.map((entry) => [entry.key, entry]),
)

export function isContentKey(key: string): key is ContentKey {
  return definitions.has(key)
}

export function contentKeyDefinition(key: ContentKey): ContentKeyDefinition {
  return definitions.get(key)!
}
