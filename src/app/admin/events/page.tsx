import Link from 'next/link'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import EditDetails from '@/components/admin/edit-details'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import type { ClubEvent } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { MAX_EVENT_CAPACITY, MAX_EVENT_DESCRIPTION_LENGTH } from '@/lib/event-schema'
import { EVENT_TYPES } from '@/lib/event-types'
import { getEvents } from '@/lib/queries'
import { rsvpCounts } from '@/lib/rsvp'
import { createEvent, deleteEvent, updateEvent } from './actions'

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — the title, location, type and a real date are required, and a capacity must be a whole number from 1 to 10,000.',
  missing: 'That event no longer exists.',
}

function EventFields({ event }: { event?: ClubEvent }) {
  return (
    <>
      <label className={labelClass}>
        Title
        <input name="title" required maxLength={200} defaultValue={event?.title} className={inputClass} />
      </label>
      <label className={labelClass}>
        Description
        <textarea
          name="description"
          rows={3}
          maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
          defaultValue={event?.description}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Location
        <input
          name="location"
          required
          maxLength={200}
          defaultValue={event?.location}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Type
        <select name="type" required defaultValue={event?.type ?? EVENT_TYPES[0]} className={inputClass}>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Date
          <input name="date" type="date" required defaultValue={event?.date} className={inputClass} />
        </label>
        <label className={labelClass}>
          Time (optional)
          <input
            name="time"
            maxLength={100}
            defaultValue={event?.time ?? ''}
            placeholder="6:00 PM – 9:00 PM"
            className={inputClass}
          />
        </label>
      </div>
      <label className={labelClass}>
        Capacity (optional)
        <input
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_EVENT_CAPACITY}
          step={1}
          defaultValue={event?.capacity ?? ''}
          aria-describedby={capacityHintId(event)}
          className={inputClass}
        />
      </label>
      <p id={capacityHintId(event)} className={`-mt-2 ${mutedTextClass}`}>
        Leave blank for no limit. Members can RSVP until it is full.
      </p>
    </>
  )
}

function capacityHintId(event?: ClubEvent) {
  return event ? `capacity-hint-${event.id}` : 'capacity-hint-new'
}

function RsvpSummary({ event, going }: { event: ClubEvent; going: number }) {
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
        <span className="sr-only">for {event.title}</span>
      </Link>
    </p>
  )
}

function EventList({
  events,
  counts,
  emptyText,
}: {
  events: ClubEvent[]
  counts: Map<number, number>
  emptyText: string
}) {
  if (events.length === 0) return <p className={`mt-4 ${mutedTextClass}`}>{emptyText}</p>

  return (
    <ul className="mt-4 space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{event.title}</p>
              <p className={mutedTextClass}>
                {formatEventDate(event.date)}
                {event.time && ` · ${event.time}`} · {event.type}
              </p>
              <RsvpSummary event={event} going={counts.get(event.id) ?? 0} />
            </div>
            <form action={deleteEvent.bind(null, event.id)}>
              <DeleteButton name={event.title} />
            </form>
          </div>
          <EditDetails name={event.title}>
            <form action={updateEvent.bind(null, event.id)} className="mt-4 max-w-md space-y-4">
              <EventFields event={event} />
              <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                Save changes
              </SubmitButton>
            </form>
          </EditDetails>
        </li>
      ))}
    </ul>
  )
}

export default async function AdminEventsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, rows, counts] = await Promise.all([props.searchParams, getEvents(), rsvpCounts()])
  const { upcoming, past } = splitEvents(rows, todayInDenver(new Date()))

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Events</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="add-event-heading">
        <h2 id="add-event-heading" className={sectionHeadingClass}>
          Add event
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Events move from Upcoming to Past on their own the day after they happen.
        </p>
        <form action={createEvent} className="mt-4 max-w-md space-y-4">
          <EventFields />
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add event
          </SubmitButton>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="upcoming-events-heading">
        <h2 id="upcoming-events-heading" className={sectionHeadingClass}>
          Upcoming events
        </h2>
        <EventList events={upcoming} counts={counts} emptyText="No upcoming events." />
      </section>

      <section className={cardClass} aria-labelledby="past-events-heading">
        <h2 id="past-events-heading" className={sectionHeadingClass}>
          Past events
        </h2>
        <EventList events={past} counts={counts} emptyText="No past events." />
      </section>
    </div>
  )
}
