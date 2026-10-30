import Link from 'next/link'
import Editable from '@/components/editable'
import SponsorLogo from '@/components/SponsorLogo'
import { LocationIcon } from '@/components/icons'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { eventTypeColor } from '@/lib/event-types'
import { getEvents, getHomePillars, getHomeStats, getSiteContent, getSponsors } from '@/lib/queries'

export default async function Home() {
  const [content, admin, stats, pillars, sponsors, events] = await Promise.all([
    getSiteContent([...contentKeysFor('home'), 'events.upcoming.empty']),
    currentAdmin(),
    getHomeStats(),
    getHomePillars(),
    getSponsors(),
    getEvents(),
  ])
  const editable = Boolean(admin)
  const upcomingEvents = splitEvents(events, todayInDenver(new Date())).upcoming.slice(0, 3)

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative bg-cmu-maroon overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cmu-maroon via-[#6b0018] to-[#3a000e]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-shpe-red/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-shpe-gold/10 rounded-full translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-40">
          <div className="max-w-3xl">
            <div className="flex items-center mb-6">
              <div className="h-0.5 w-10 bg-shpe-gold mr-4" />
              <Editable
                as="span"
                contentKey="home.hero.eyebrow"
                value={content['home.hero.eyebrow']}
                editable={editable}
                className="text-shpe-gold font-semibold text-sm uppercase tracking-widest"
              />
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-white leading-none mb-6">
              <span className="text-shpe-red-on-maroon">SHPE</span>{' '}
              <span className="text-shpe-gold">@</span> CMU
            </h1>
            <Editable
              as="p"
              contentKey="home.hero.subtitle"
              value={content['home.hero.subtitle']}
              editable={editable}
              className="text-xl md:text-2xl text-gray-200 font-light mb-3"
            />
            <Editable
              as="p"
              contentKey="home.hero.intro"
              value={content['home.hero.intro']}
              editable={editable}
              className="text-base text-gray-400 mb-10 max-w-xl leading-relaxed"
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/join"
                className="inline-flex items-center justify-center bg-shpe-red hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 shadow-lg hover:-translate-y-0.5"
              >
                Join SHPE
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center border-2 border-shpe-gold text-shpe-gold hover:bg-shpe-gold hover:text-cmu-maroon px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-shpe-red">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.id}>
                <div className="text-4xl font-black text-white">{s.value}</div>
                <div className="text-red-200 text-sm font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center mb-4">
                <div className="h-0.5 w-8 bg-shpe-red mr-3" />
                <Editable
                  as="span"
                  contentKey="home.mission.eyebrow"
                  value={content['home.mission.eyebrow']}
                  editable={editable}
                  className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
                />
              </div>
              <Editable
                as="h2"
                contentKey="home.mission.heading"
                value={content['home.mission.heading']}
                editable={editable}
                className="text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
              />
              <Editable
                as="p"
                contentKey="home.mission.paragraph1"
                value={content['home.mission.paragraph1']}
                editable={editable}
                className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4"
              />
              <Editable
                as="p"
                contentKey="home.mission.paragraph2"
                value={content['home.mission.paragraph2']}
                editable={editable}
                className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8"
              />
              <Link
                href="/about"
                className="inline-flex items-center text-shpe-red font-semibold hover:text-red-700 transition-colors duration-200"
              >
                Learn about our chapter
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {pillars.map((p) => (
                <div
                  key={p.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-shpe-red/30 transition-colors duration-200"
                >
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{p.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="h-0.5 w-8 bg-shpe-red mr-3" />
              <Editable
                as="span"
                contentKey="home.events.eyebrow"
                value={content['home.events.eyebrow']}
                editable={editable}
                className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
              />
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <Editable
              as="h2"
              contentKey="home.events.heading"
              value={content['home.events.heading']}
              editable={editable}
              className="text-4xl font-bold text-gray-900 dark:text-white"
            />
          </div>

          {upcomingEvents.length === 0 ? (
            <Editable
              as="p"
              contentKey="events.upcoming.empty"
              value={content['events.upcoming.empty']}
              editable={editable}
              className="text-center text-gray-500 dark:text-gray-400 mb-10"
            />
          ) : (
            <div className="grid md:grid-cols-3 gap-8 mb-10">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  <div className="h-1.5 bg-shpe-red" />
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${eventTypeColor(event.type)}`}
                      >
                        {event.type}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{formatEventDate(event.date)}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">{event.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-5">{event.description}</p>
                    <div className="flex items-center text-gray-400 dark:text-gray-500 text-xs">
                      <LocationIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                      {event.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              href="/events"
              className="inline-flex items-center justify-center border-2 border-shpe-red text-shpe-red hover:bg-shpe-red hover:text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200"
            >
              View All Events
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sponsors Preview ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
              <Editable
                as="span"
                contentKey="home.sponsors.eyebrow"
                value={content['home.sponsors.eyebrow']}
                editable={editable}
                className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
              />
              <div className="h-0.5 w-8 bg-shpe-gold ml-3" />
            </div>
            <Editable
              as="h2"
              contentKey="home.sponsors.heading"
              value={content['home.sponsors.heading']}
              editable={editable}
              className="text-4xl font-bold text-gray-900 dark:text-white mb-3"
            />
            <Editable
              as="p"
              contentKey="home.sponsors.intro"
              value={content['home.sponsors.intro']}
              editable={editable}
              className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm"
            />
          </div>

          <div className="flex flex-wrap justify-center items-center gap-5 mb-10">
            {sponsors.map((sponsor) => (
              <SponsorLogo
                key={sponsor.id}
                name={sponsor.name}
                logo={sponsor.logoUrl}
                tier={sponsor.tier}
                website={sponsor.website}
                bgColor={sponsor.bgColor}
              />
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/sponsors"
              className="inline-flex items-center justify-center bg-shpe-gold hover:bg-yellow-400 text-cmu-maroon px-6 py-3 rounded-lg font-semibold transition-all duration-200"
            >
              Become a Sponsor
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-gradient-to-r from-cmu-maroon to-[#6b0018] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Editable
            as="h2"
            contentKey="home.cta.heading"
            value={content['home.cta.heading']}
            editable={editable}
            className="text-4xl font-bold text-white mb-4"
          />
          <Editable
            as="p"
            contentKey="home.cta.paragraph"
            value={content['home.cta.paragraph']}
            editable={editable}
            className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto"
          />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-shpe-red hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 shadow-lg"
            >
              Get Involved
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center border-2 border-white text-white hover:bg-white hover:text-cmu-maroon px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200"
            >
              See Upcoming Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
