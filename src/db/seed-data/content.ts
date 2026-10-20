import type { ContentKey } from '@/lib/content-keys'

export const contentDefaults = {
  'contact.subjects': 'General Inquiry\nMembership\nSponsorship\nEvents\nMedia / Press\nOther',
  'events.upcoming.heading': 'All Events',
  'events.upcoming.empty': 'No upcoming events right now — check back soon.',
  'events.past.heading': 'Past Events',
} satisfies Record<ContentKey, string>
