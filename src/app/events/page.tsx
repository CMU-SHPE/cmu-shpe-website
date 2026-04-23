import config from '@/lib/config'
import { events, typeColors } from '@/lib/events'

export default function Events() {
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
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">All Events</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex"
              >
                {/* Left accent bar */}
                <div className="w-1.5 bg-shpe-red flex-shrink-0" />
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[event.type]}`}
                    >
                      {event.type}
                    </span>
                    <div className="text-right">
                      <div className="text-gray-700 text-sm font-medium">{event.date}</div>
                      {event.time && <div className="text-gray-400 text-xs">{event.time}</div>}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{event.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{event.description}</p>
                  <div className="flex items-center text-gray-400 text-xs">
                    <svg
                      className="w-3.5 h-3.5 mr-1.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {event.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stay Updated ── */}
      <section className="bg-shpe-red py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Never Miss an Event</h2>
          <p className="text-red-100 mb-6">
            Follow us on social media or reach out to be added to our mailing list.
          </p>
          <a
            href={`mailto:${config.email}`}
            className="inline-flex items-center justify-center bg-white text-shpe-red hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all duration-200"
          >
            {config.email}
          </a>
        </div>
      </section>
    </div>
  )
}
