import Link from 'next/link'
import SponsorLogo from '@/components/SponsorLogo'
import { sponsors, tierOrder } from '@/lib/sponsors'
import { events, typeColors } from '@/lib/events'
import { stats, pillars } from '@/lib/home'

export default function Home() {
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
              <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
                Colorado Mesa University
              </span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-white leading-none mb-6">
              <span className="text-shpe-red">SHPE</span>{' '}
              <span className="text-shpe-gold">@</span> CMU
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 font-light mb-3">
              Society of Hispanic Professional Engineers
            </p>
            <p className="text-base text-gray-400 mb-10 max-w-xl leading-relaxed">
              Empowering the next generation of Hispanic STEM leaders through community,
              professional development, and academic excellence at Colorado Mesa University.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/contact"
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
              <div key={s.label}>
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
                <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                  Our Mission
                </span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Building the Future of Hispanic Engineering
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                The CMU SHPE chapter brings together Hispanic and underrepresented STEM students
                in Grand Junction, providing the tools, resources, and network needed to thrive
                in engineering and science careers.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
                Through professional development events, industry networking, and community
                service, our members grow into the engineers and scientists who will shape
                tomorrow&apos;s world.
              </p>
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
                  key={p.title}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-shpe-red/30 transition-colors duration-200"
                >
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{p.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{p.desc}</p>
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
              <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                What&apos;s Coming Up
              </span>
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Upcoming Events</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {events.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="h-1.5 bg-shpe-red" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[event.type]}`}
                    >
                      {event.type}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">{event.date}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">{event.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-5">{event.description}</p>
                  <div className="flex items-center text-gray-400 dark:text-gray-500 text-xs">
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
              <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                Our Partners
              </span>
              <div className="h-0.5 w-8 bg-shpe-gold ml-3" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Sponsors & Partners</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm">
              Our generous sponsors make our programs and events possible. We are grateful for
              their commitment to developing Hispanic STEM talent.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-5 mb-10">
            {[...sponsors]
              .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
              .map((sponsor) => (
                <SponsorLogo
                  key={sponsor.name + sponsor.logo}
                  name={sponsor.name}
                  logo={sponsor.logo}
                  tier={sponsor.tier}
                  website={sponsor.website}
                  bgColor={sponsor.bgColor}
                  size={sponsor.size}
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
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Join SHPE?</h2>
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Become part of a community that will help you grow as an engineer, expand your
            network, and make a lasting impact. All STEM students are welcome.
          </p>
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
