export const EVENT_TYPES = [
  'Networking',
  'Workshop',
  'Social',
  'Academic',
  'Community',
  'Panel',
  'Conference',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const typeColors: Record<EventType, string> = {
  Networking: 'bg-blue-100 text-blue-800',
  Workshop: 'bg-green-100 text-green-800',
  Social: 'bg-purple-100 text-purple-800',
  Academic: 'bg-yellow-100 text-yellow-800',
  Community: 'bg-orange-100 text-orange-800',
  Panel: 'bg-pink-100 text-pink-800',
  Conference: 'bg-indigo-100 text-indigo-800',
}

export function eventTypeColor(type: string): string {
  return Object.hasOwn(typeColors, type) ? typeColors[type as EventType] : ''
}
