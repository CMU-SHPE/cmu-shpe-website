export type ContentKeyDefinition = {
  key: string
  label: string
  multiline: boolean
}

export const CONTENT_KEYS = [
  { key: 'contact.subjects', label: 'Contact form subject options', multiline: true },
  { key: 'events.upcoming.heading', label: 'Events page: upcoming events heading', multiline: false },
  { key: 'events.upcoming.empty', label: 'Message shown when there are no upcoming events', multiline: false },
  { key: 'events.past.heading', label: 'Events page: past events heading', multiline: false },
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
