import Link from 'next/link'
import { values, joinReasons, nationalStats } from '@/lib/about'

export default function About() {
  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Who We Are
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">About Our Chapter</h1>
          <p className="text-gray-300 max-w-xl">
            Learn about the CMU SHPE chapter, our mission, and the national organization
            we are proud to be part of.
          </p>
        </div>
      </section>

      {/* ── Chapter Info ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Colorado Mesa University Chapter
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                The SHPE chapter at Colorado Mesa University was founded to bring together
                Hispanic and underrepresented students in STEM disciplines and provide them
                with the tools, resources, and network they need to succeed.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                Located in Grand Junction, Colorado, our chapter serves students from CMU&apos;s
                engineering, computer science, mathematics, and physical sciences programs.
                We are proud to be one of the active SHPE collegiate chapters in the state
                of Colorado.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
                Our members gain access to national SHPE resources, including the annual
                SHPE National Convention — one of the largest gatherings of Hispanic STEM
                professionals and students in the country.
              </p>

              <blockquote className="border-l-4 border-shpe-red pl-6 py-1 mb-8">
                <p className="text-gray-700 dark:text-gray-300 italic text-lg leading-relaxed">
                  &ldquo;Changing lives by empowering the Hispanic community to realize its fullest
                  potential and to impact the world through STEM awareness, access, support,
                  and development.&rdquo;
                </p>
                <cite className="text-gray-400 dark:text-gray-500 text-sm mt-3 block not-italic">
                  — SHPE National Mission
                </cite>
              </blockquote>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <span className="w-1.5 h-6 bg-shpe-red rounded mr-3 flex-shrink-0" />
                  Our Values
                </h3>
                <ul className="space-y-3">
                  {values.map((v) => (
                    <li key={v} className="flex items-start text-gray-600 dark:text-gray-300 text-sm">
                      <svg
                        className="w-4 h-4 text-shpe-red mt-0.5 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {v}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-shpe-red rounded-xl p-6 text-white">
                <h3 className="text-xl font-bold mb-4">Why Join SHPE?</h3>
                <ul className="space-y-2.5">
                  {joinReasons.map((r) => (
                    <li key={r} className="flex items-start text-sm">
                      <svg
                        className="w-4 h-4 text-shpe-gold mt-0.5 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHPE National ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="h-0.5 w-8 bg-shpe-red mr-3" />
              <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                The Bigger Picture
              </span>
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">About SHPE National</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              As a collegiate chapter, we are part of the Society of Hispanic Professional
              Engineers — a national organization with chapters across the United States.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {nationalStats.map((s) => (
              <div
                key={s.label}
                className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center"
              >
                <div className="text-4xl font-black text-shpe-red mb-2">{s.value}</div>
                <div className="font-bold text-gray-900 dark:text-white mb-2">{s.label}</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-cmu-maroon py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get involved?</h2>
          <p className="text-gray-300 mb-8">
            Reach out to learn about membership, upcoming events, and how to join our chapter.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-shpe-red hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200"
            >
              Contact Us
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center border-2 border-shpe-gold text-shpe-gold hover:bg-shpe-gold hover:text-cmu-maroon px-8 py-4 rounded-lg font-semibold transition-all duration-200"
            >
              See Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
