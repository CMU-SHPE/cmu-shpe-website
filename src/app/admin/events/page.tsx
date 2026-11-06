import Link from 'next/link'
import DeleteButton from '@/components/admin/delete-button'
import EditDetails from '@/components/admin/edit-details'
import EventForm from '@/components/admin/event-form'
import SeriesDeleteForm from '@/components/admin/series-delete-form'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import { eventSchedule, formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { eventDeleteWarning, seriesDeleteWarning, storedEventFormValues } from '@/lib/event-form'
import { laterInSeries, seriesLabel, seriesPositions } from '@/lib/event-series'
import { type EventWithSlots, getEvents } from '@/lib/queries'
import { rsvpCounts } from '@/lib/rsvp'
import { createEvent, deleteEvent, updateEvent } from './actions'

const errorMessages: Record<string, string> = {
  invalid: 'That event could not be found. Reload the page and try again.',
  missing: 'That event no longer exists.',
}

// Every week of a series shares its title, so screen readers need the date to tell the controls apart.
function controlName(event: EventWithSlots) {
  return event.seriesId ? `${event.title} on ${formatEventDate(event.date)}` : event.title
}

function RsvpSummary({ event, going }: { event: EventWithSlots; going: number }) {
  const label = going === 1 ? 'RSVP' : 'RSVPs'
  return (
    <p className={mutedTextClass}>
      {event.capacity === null ? `${going} ${label}` : `${going} / ${event.capacity} ${label}`}
      {' · '}
      <Link
        href={`/admin/events/${event.id}/attendees`}
        className={`rounded text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`}
      >
        {'Attendees '}
        <span className="sr-only">for {controlName(event)}</span>
      </Link>
    </p>
  )
}

function EventList({
  events,
  allEvents,
  today,
  counts,
  emptyText,
}: {
  events: EventWithSlots[]
  allEvents: EventWithSlots[]
  today: string
  counts: Map<number, number>
  emptyText: string
}) {
  if (events.length === 0) return <p className={`mt-4 ${mutedTextClass}`}>{emptyText}</p>
  const positions = seriesPositions(allEvents)
  const going = (event: EventWithSlots) => counts.get(event.id) ?? 0

  return (
    <ul className="mt-4 space-y-3">
      {events.map((event) => {
        const { dates, times } = eventSchedule(event)
        const position = positions.get(event.id)
        const later = laterInSeries(allEvents, event, today)
        const thisAndLaterGoing = later.reduce((total, week) => total + going(week), going(event))
        return (
          <li key={event.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{event.title}</p>
                {position && <p className={mutedTextClass}>{seriesLabel(position)}</p>}
                <p className={mutedTextClass}>
                  {dates}
                  {times.length === 1 && ` · ${times[0]}`} · {event.type}
                </p>
                {times.length > 1 && (
                  <ul className={mutedTextClass}>
                    {times.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <RsvpSummary event={event} going={going(event)} />
              </div>
              {later.length > 0 ? (
                <SeriesDeleteForm
                  action={deleteEvent.bind(null, event.id)}
                  name={controlName(event)}
                  eventWarning={eventDeleteWarning(going(event))}
                  laterWarning={seriesDeleteWarning(later.length, thisAndLaterGoing)}
                />
              ) : (
                <form action={deleteEvent.bind(null, event.id)}>
                  <DeleteButton name={controlName(event)} warning={eventDeleteWarning(going(event))} />
                </form>
              )}
            </div>
            <EditDetails name={controlName(event)}>
              <EventForm
                action={updateEvent.bind(null, event.id)}
                initialValues={storedEventFormValues(event)}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                laterInSeries={later.length}
              />
            </EditDetails>
          </li>
        )
      })}
    </ul>
  )
}

export default async function AdminEventsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, rows, counts] = await Promise.all([props.searchParams, getEvents(), rsvpCounts()])
  const today = todayInDenver(new Date())
  const { upcoming, past } = splitEvents(rows, today)

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Events</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="add-event-heading">
        <h2 id="add-event-heading" className={sectionHeadingClass}>
          Add event
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Events move from Upcoming to Past on their own the day after their last day.
        </p>
        <EventForm action={createEvent} submitLabel="Add event" pendingLabel="Adding…" repeatable />
      </section>

      <section className={cardClass} aria-labelledby="upcoming-events-heading">
        <h2 id="upcoming-events-heading" className={sectionHeadingClass}>
          Upcoming events
        </h2>
        <EventList events={upcoming} allEvents={rows} today={today} counts={counts} emptyText="No upcoming events." />
      </section>

      <section className={cardClass} aria-labelledby="past-events-heading">
        <h2 id="past-events-heading" className={sectionHeadingClass}>
          Past events
        </h2>
        <EventList events={past} allEvents={rows} today={today} counts={counts} emptyText="No past events." />
      </section>
    </div>
  )
}
