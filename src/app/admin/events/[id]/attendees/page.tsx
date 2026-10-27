import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  secondaryButtonClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import { formatEventDate } from '@/lib/event-dates'
import { recordId } from '@/lib/form-fields'
import { findEvent, listAttendees } from '@/lib/rsvp'

export const metadata: Metadata = { title: 'Attendees | Admin' }

const rsvpTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  dateStyle: 'medium',
  timeStyle: 'short',
})

const linkClass = `rounded text-sm font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`

export default async function AttendeesPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const id = recordId.safeParse((await props.params).id)
  if (!id.success) notFound()

  const [event, attendees] = await Promise.all([findEvent(id.data), listAttendees(id.data)])
  if (!event) notFound()

  const going = event.capacity === null ? `${attendees.length}` : `${attendees.length} of ${event.capacity}`

  return (
    <div className="space-y-6">
      <Link href="/admin/events" className={linkClass}>
        <span aria-hidden="true">&larr;</span> All events
      </Link>
      <div>
        <h1 className={pageHeadingClass}>Attendees: {event.title}</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          {formatEventDate(event.date)}
          {event.time && ` · ${event.time}`} · {going} going
        </p>
      </div>

      <section className={`${cardClass} overflow-x-auto`}>
        {attendees.length === 0 ? (
          <p className={mutedTextClass}>No one has RSVPed yet.</p>
        ) : (
          <>
            <a href={`/admin/events/${event.id}/attendees.csv`} download className={`inline-block ${secondaryButtonClass}`}>
              {'Download CSV '}
              <span className="sr-only">of attendees for {event.title}</span>
            </a>
            <table className={`mt-4 ${tableClass}`}>
              <caption className="sr-only">People who RSVPed to {event.title}, earliest first</caption>
              <thead>
                <tr className={tableHeadRowClass}>
                  <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Email</th>
                  <th scope="col" className="py-2 font-medium">RSVP time (Mountain)</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={`${attendee.email}-${attendee.rsvpAt.toISOString()}`} className={tableRowClass}>
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{attendee.name}</td>
                    <td className="py-3 pr-4 break-all">{attendee.email}</td>
                    <td className="py-3 whitespace-nowrap">
                      <time dateTime={attendee.rsvpAt.toISOString()}>{rsvpTime.format(attendee.rsvpAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  )
}
