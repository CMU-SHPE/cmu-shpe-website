import { LocationIcon } from '@/components/icons'
import type { ClubEvent } from '@/db/schema'
import { formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { eventTypeColor } from '@/lib/event-types'
import { getEvents, getSiteContent, getSiteSettings } from '@/lib/queries'

export default async function Events() {
  const [settings, events, content] = await Promise.all([
    getSiteSettings(),
    getEvents(),
    getSiteContent(['events.upcoming.heading', 'events.upcoming.empty', 'events.past.heading']),
  ])
  const { upcoming, past } = splitEvents(events, todayInDenver(new Date()))

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Stay in the Loop
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Events</h1>
          <p className="text-gray-300 max-w-xl">
            From workshops and networking nights to community service and conferences —
            there is always something happening with CMU SHPE.
          </p>
        </div>
      </section>

      {/* ── Events ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{content['events.upcoming.heading']}</h2>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{content['events.upcoming.empty']}</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <div className="flex items-center mt-16 mb-10">
                <div className="h-0.5 w-8 bg-shpe-red mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{content['events.past.heading']}</h2>
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
          <h2 className="text-2xl font-bold text-white mb-3">Never Miss an Event</h2>
          <p className="text-red-100 mb-6">
            Follow us on social media or reach out to be added to our mailing list.
          </p>
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

function EventCard({ event }: { event: ClubEvent }) {
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
            {event.time && <div className="text-gray-400 dark:text-gray-500 text-xs">{event.time}</div>}
          </div>
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">{event.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">{event.description}</p>
        <div className="flex items-center text-gray-400 dark:text-gray-500 text-xs">
          <LocationIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          {event.location}
        </div>
      </div>
    </div>
  )
}
