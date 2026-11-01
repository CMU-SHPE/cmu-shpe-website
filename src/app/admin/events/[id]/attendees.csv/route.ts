import { currentAdmin } from '@/lib/admin'
import { toCsv } from '@/lib/csv'
import { eventSchedule, formatDenverTimestamp, lastEventDay } from '@/lib/event-dates'
import { recordId } from '@/lib/form-fields'
import { findEvent, listAttendees } from '@/lib/rsvp'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

// A route handler answers with status codes rather than the /login redirect pages use, so a download
// link that outlived its session fails visibly instead of saving the sign-in page as a .csv.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return new Response('Unauthorized', { status: 401, headers: PRIVATE_HEADERS })

  const id = recordId.safeParse((await context.params).id)
  if (!id.success) return new Response('Not found', { status: 404, headers: PRIVATE_HEADERS })

  const [event, attendees] = await Promise.all([findEvent(id.data), listAttendees(id.data)])
  if (!event) return new Response('Not found', { status: 404, headers: PRIVATE_HEADERS })

  const times = eventSchedule(event).times.join('; ')
  const csv = toCsv([
    ['Name', 'Email', 'RSVP time (Mountain)', 'Event start date', 'Event end date', 'Event times'],
    ...attendees.map((attendee) => [
      attendee.name,
      attendee.email,
      formatDenverTimestamp(attendee.rsvpAt),
      event.date,
      lastEventDay(event),
      times,
    ]),
  ])
  return new Response(csv, {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="event-${event.id}-attendees.csv"`,
    },
  })
}
