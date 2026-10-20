export type ContentKeyDefinition = {
  key: string
  label: string
  multiline: boolean
}

export const CONTENT_KEYS = [
  { key: 'home.hero.eyebrow', label: 'Home: line above the title', multiline: false },
  { key: 'home.hero.subtitle', label: 'Home: subtitle under the title', multiline: false },
  { key: 'home.hero.intro', label: 'Home: intro paragraph', multiline: false },
  { key: 'home.mission.eyebrow', label: 'Home: mission label', multiline: false },
  { key: 'home.mission.heading', label: 'Home: mission heading', multiline: false },
  { key: 'home.mission.paragraph1', label: 'Home: mission first paragraph', multiline: false },
  { key: 'home.mission.paragraph2', label: 'Home: mission second paragraph', multiline: false },
  { key: 'home.events.eyebrow', label: 'Home: events label', multiline: false },
  { key: 'home.events.heading', label: 'Home: events heading', multiline: false },
  { key: 'home.sponsors.eyebrow', label: 'Home: sponsors label', multiline: false },
  { key: 'home.sponsors.heading', label: 'Home: sponsors heading', multiline: false },
  { key: 'home.sponsors.intro', label: 'Home: sponsors paragraph', multiline: false },
  { key: 'home.cta.heading', label: 'Home: closing heading', multiline: false },
  { key: 'home.cta.paragraph', label: 'Home: closing paragraph', multiline: false },

  { key: 'about.header.eyebrow', label: 'About: line above the title', multiline: false },
  { key: 'about.header.heading', label: 'About: page title', multiline: false },
  { key: 'about.header.intro', label: 'About: intro paragraph', multiline: false },
  { key: 'about.chapter.heading', label: 'About: chapter heading', multiline: false },
  { key: 'about.chapter.paragraph1', label: 'About: chapter first paragraph', multiline: false },
  { key: 'about.chapter.paragraph2', label: 'About: chapter second paragraph', multiline: false },
  { key: 'about.chapter.paragraph3', label: 'About: chapter third paragraph', multiline: false },
  { key: 'about.quote.text', label: 'About: SHPE mission quote', multiline: false },
  { key: 'about.quote.cite', label: 'About: quote source', multiline: false },
  { key: 'about.values.heading', label: 'About: values heading', multiline: false },
  { key: 'about.values.items', label: 'About: values, one per line', multiline: true },
  { key: 'about.joinReasons.heading', label: 'About: why join heading', multiline: false },
  { key: 'about.joinReasons.items', label: 'About: reasons to join, one per line', multiline: true },
  { key: 'about.national.eyebrow', label: 'About: SHPE National label', multiline: false },
  { key: 'about.national.heading', label: 'About: SHPE National heading', multiline: false },
  { key: 'about.national.intro', label: 'About: SHPE National paragraph', multiline: false },
  { key: 'about.cta.heading', label: 'About: closing heading', multiline: false },
  { key: 'about.cta.paragraph', label: 'About: closing paragraph', multiline: false },

  { key: 'events.header.eyebrow', label: 'Events: line above the title', multiline: false },
  { key: 'events.header.heading', label: 'Events: page title', multiline: false },
  { key: 'events.header.intro', label: 'Events: intro paragraph', multiline: false },
  { key: 'events.upcoming.heading', label: 'Events: upcoming events heading', multiline: false },
  { key: 'events.upcoming.empty', label: 'Message shown when there are no upcoming events', multiline: false },
  { key: 'events.past.heading', label: 'Events: past events heading', multiline: false },
  { key: 'events.updates.heading', label: 'Events: stay updated heading', multiline: false },
  { key: 'events.updates.paragraph', label: 'Events: stay updated paragraph', multiline: false },

  { key: 'sponsors.header.eyebrow', label: 'Sponsors: line above the title', multiline: false },
  { key: 'sponsors.header.heading', label: 'Sponsors: page title', multiline: false },
  { key: 'sponsors.header.intro', label: 'Sponsors: intro paragraph', multiline: false },
  { key: 'sponsors.tier.platinum.amount', label: 'Sponsors: Platinum tier amount', multiline: false },
  { key: 'sponsors.tier.gold.amount', label: 'Sponsors: Gold tier amount', multiline: false },
  { key: 'sponsors.tier.silver.amount', label: 'Sponsors: Silver tier amount', multiline: false },
  { key: 'sponsors.tier.bronze.amount', label: 'Sponsors: Bronze tier amount', multiline: false },
  { key: 'sponsors.become.eyebrow', label: 'Sponsors: partner label', multiline: false },
  { key: 'sponsors.become.heading', label: 'Sponsors: become a sponsor heading', multiline: false },
  { key: 'sponsors.become.intro', label: 'Sponsors: become a sponsor paragraph', multiline: false },
  { key: 'sponsors.cta.heading', label: 'Sponsors: closing heading', multiline: false },
  { key: 'sponsors.cta.paragraph', label: 'Sponsors: closing paragraph', multiline: false },

  { key: 'officers.header.eyebrow', label: 'Officers: line above the title', multiline: false },
  { key: 'officers.header.heading', label: 'Officers: page title', multiline: false },
  { key: 'officers.header.intro', label: 'Officers: intro paragraph', multiline: false },
  { key: 'officers.board.heading', label: 'Officers: executive board heading', multiline: false },
  { key: 'officers.advisor.heading', label: 'Officers: faculty advisor heading', multiline: false },
  { key: 'officers.elections.heading', label: 'Officers: elections heading', multiline: false },
  { key: 'officers.elections.paragraph', label: 'Officers: elections paragraph', multiline: false },

  { key: 'contact.header.eyebrow', label: 'Contact: line above the title', multiline: false },
  { key: 'contact.header.heading', label: 'Contact: page title', multiline: false },
  { key: 'contact.header.intro', label: 'Contact: intro paragraph', multiline: false },
  { key: 'contact.form.heading', label: 'Contact: form heading', multiline: false },
  { key: 'contact.info.heading', label: 'Contact: other ways to reach us heading', multiline: false },
  { key: 'contact.location', label: 'Contact: location', multiline: false },
  { key: 'contact.social.heading', label: 'Contact: social links heading', multiline: false },
  { key: 'contact.join.heading', label: 'Contact: join heading', multiline: false },
  { key: 'contact.join.paragraph', label: 'Contact: join paragraph', multiline: false },
  { key: 'contact.subjects', label: 'Contact form subject options', multiline: true },

  { key: 'footer.tagline', label: 'Footer: chapter name, one line each', multiline: true },
  { key: 'footer.location', label: 'Footer: location', multiline: false },
  { key: 'footer.quickLinks.heading', label: 'Footer: links heading', multiline: false },
  { key: 'footer.connect.heading', label: 'Footer: connect heading', multiline: false },
  { key: 'footer.copyright', label: 'Footer: copyright line', multiline: false },
] as const satisfies readonly ContentKeyDefinition[]

export type ContentKey = (typeof CONTENT_KEYS)[number]['key']

export type ContentKeyWithPrefix<P extends string> = Extract<ContentKey, `${P}.${string}`>

const definitions = new Map<string, ContentKeyDefinition>(
  CONTENT_KEYS.map((entry) => [entry.key, entry]),
)

export function isContentKey(key: string): key is ContentKey {
  return definitions.has(key)
}

export function contentKeyDefinition(key: ContentKey): ContentKeyDefinition {
  return definitions.get(key)!
}

export function contentKeysFor<P extends string>(prefix: P): ContentKeyWithPrefix<P>[] {
  return CONTENT_KEYS.map((entry) => entry.key).filter(
    (key): key is ContentKeyWithPrefix<P> => key.startsWith(`${prefix}.`),
  )
}
