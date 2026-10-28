import Link from 'next/link'
import Editable from '@/components/editable'
import { LocationIcon } from '@/components/icons'
import { focusRingClass } from '@/components/admin/styles'
import RsvpButton from '@/components/rsvp/rsvp-button'
import type { ClubEvent } from '@/db/schema'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { eventTypeColor } from '@/lib/event-types'
import { currentMember } from '@/lib/member'
import { getEvents, getSiteContent, getSiteSettings } from '@/lib/queries'
import { getRsvpStates, rsvpCounts, type RsvpState } from '@/lib/rsvp'

type Viewer = 'member' | 'admin' | 'visitor'

export default async function Events() {
  const [content, admin, member, settings, events] = await Promise.all([
    getSiteContent(contentKeysFor('events')),
    currentAdmin(),
    currentMember(),
    getSiteSettings(),
    getEvents(),
  ])
  const editable = Boolean(admin)
  const { upcoming, past } = splitEvents(events, todayInDenver(new Date()))
  const upcomingIds = upcoming.map((event) => event.id)
  const [states, counts] = await Promise.all([
    member ? getRsvpStates(Number(member.user.id), upcomingIds) : new Map<number, RsvpState>(),
    rsvpCounts(upcoming.filter((event) => event.capacity !== null).map((event) => event.id)),
  ])
  const viewer: Viewer = member ? 'member' : admin ? 'admin' : 'visitor'

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <Editable
              as="span"
              contentKey="events.header.eyebrow"
              value={content['events.header.eyebrow']}
              editable={editable}
              className="text-shpe-gold font-semibold text-sm uppercase tracking-widest"
            />
          </div>
          <Editable
            as="h1"
            contentKey="events.header.heading"
            value={content['events.header.heading']}
            editable={editable}
            className="text-5xl font-black text-white mb-3"
          />
          <Editable
            as="p"
            contentKey="events.header.intro"
            value={content['events.header.intro']}
            editable={editable}
            className="text-gray-300 max-w-xl"
          />
        </div>
      </section>

      {/* ── Events ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <Editable
              as="h2"
              contentKey="events.upcoming.heading"
              value={content['events.upcoming.heading']}
              editable={editable}
              className="text-2xl font-bold text-gray-900 dark:text-white"
            />
          </div>

          {upcoming.length === 0 ? (
            <Editable
              as="p"
              contentKey="events.upcoming.empty"
              value={content['events.upcoming.empty']}
              editable={editable}
              className="text-gray-500 dark:text-gray-400"
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event}>
                  <EventRsvp
                    event={event}
                    viewer={viewer}
                    state={states.get(event.id)}
                    taken={counts.get(event.id) ?? 0}
                  />
                </EventCard>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <div className="flex items-center mt-16 mb-10">
                <div className="h-0.5 w-8 bg-shpe-red mr-3" />
                <Editable
                  as="h2"
                  contentKey="events.past.heading"
                  value={content['events.past.heading']}
                  editable={editable}
                  className="text-2xl font-bold text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Stay Updated ── */}
      <section className="bg-shpe-red py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Editable
            as="h2"
            contentKey="events.updates.heading"
            value={content['events.updates.heading']}
            editable={editable}
            className="text-2xl font-bold text-white mb-3"
          />
          <Editable
            as="p"
            contentKey="events.updates.paragraph"
            value={content['events.updates.paragraph']}
            editable={editable}
            className="text-red-100 mb-6"
          />
          {settings && (
            <a
              href={`mailto:${settings.contactEmail}`}
              className="inline-flex items-center justify-center bg-white text-shpe-red hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all duration-200"
            >
              {settings.contactEmail}
            </a>
          )}
        </div>
      </section>
    </div>
  )
}

function EventRsvp({
  event,
  viewer,
  state,
  taken,
}: {
  event: ClubEvent
  viewer: Viewer
  state?: RsvpState
  taken: number
}) {
  const spotsLeft = event.capacity === null ? null : Math.max(event.capacity - taken, 0)
  const showSpots = spotsLeft !== null && !(viewer === 'member' && state === 'full')
  if (viewer === 'admin' && !showSpots) return null
  return (
    <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
      {showSpots && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {spotsLeft === 0 ? 'Full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
        </p>
      )}
      {viewer === 'member' && <RsvpButton eventId={event.id} state={state ?? 'open'} />}
      {viewer === 'visitor' && spotsLeft !== 0 && (
        <Link
          href="/login"
          className={`inline-block rounded text-sm font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`}
        >
          {'Sign in to RSVP '}
          <span className="sr-only">to {event.title}</span>
        </Link>
      )}
    </div>
  )
}

function EventCard({ event, children }: { event: ClubEvent; children?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex">
      {/* Left accent bar */}
      <div className="w-1.5 bg-shpe-red flex-shrink-0" />
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${eventTypeColor(event.type)}`}
          >
            {event.type}
          </span>
          <div className="text-right">
            <div className="text-gray-700 dark:text-gray-300 text-sm font-medium">{formatEventDate(event.date)}</div>
            {event.time && <div className="text-gray-500 dark:text-gray-400 text-xs">{event.time}</div>}
          </div>
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">{event.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">{event.description}</p>
        <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
          <LocationIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          {event.location}
        </div>
        {children}
      </div>
    </div>
  )
}
