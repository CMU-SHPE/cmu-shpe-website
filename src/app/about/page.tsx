import Link from 'next/link'
import Editable, { EditableList } from '@/components/editable'
import { CheckIcon } from '@/components/icons'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { getNationalStats, getSiteContent } from '@/lib/queries'

export default async function About() {
  const [content, admin, nationalStats] = await Promise.all([
    getSiteContent(contentKeysFor('about')),
    currentAdmin(),
    getNationalStats(),
  ])
  const editable = Boolean(admin)

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <Editable
              as="span"
              contentKey="about.header.eyebrow"
              value={content['about.header.eyebrow']}
              editable={editable}
              className="text-shpe-gold font-semibold text-sm uppercase tracking-widest"
            />
          </div>
          <Editable
            as="h1"
            contentKey="about.header.heading"
            value={content['about.header.heading']}
            editable={editable}
            className="text-5xl font-black text-white mb-3"
          />
          <Editable
            as="p"
            contentKey="about.header.intro"
            value={content['about.header.intro']}
            editable={editable}
            className="text-gray-300 max-w-xl"
          />
        </div>
      </section>

      {/* ── Chapter Info ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Editable
                as="h2"
                contentKey="about.chapter.heading"
                value={content['about.chapter.heading']}
                editable={editable}
                className="text-3xl font-bold text-gray-900 dark:text-white mb-6"
              />
              <Editable
                as="p"
                contentKey="about.chapter.paragraph1"
                value={content['about.chapter.paragraph1']}
                editable={editable}
                className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4"
              />
              <Editable
                as="p"
                contentKey="about.chapter.paragraph2"
                value={content['about.chapter.paragraph2']}
                editable={editable}
                className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4"
              />
              <Editable
                as="p"
                contentKey="about.chapter.paragraph3"
                value={content['about.chapter.paragraph3']}
                editable={editable}
                className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8"
              />

              <blockquote className="border-l-4 border-shpe-red pl-6 py-1 mb-8">
                <Editable
                  as="p"
                  contentKey="about.quote.text"
                  value={content['about.quote.text']}
                  editable={editable}
                  className="text-gray-700 dark:text-gray-300 italic text-lg leading-relaxed"
                />
                <Editable
                  as="cite"
                  contentKey="about.quote.cite"
                  value={content['about.quote.cite']}
                  editable={editable}
                  className="text-gray-400 dark:text-gray-500 text-sm mt-3 block not-italic"
                />
              </blockquote>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                <Editable
                  as="h3"
                  contentKey="about.values.heading"
                  value={content['about.values.heading']}
                  editable={editable}
                  className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center"
                  leading={<span className="w-1.5 h-6 bg-shpe-red rounded mr-3 flex-shrink-0" />}
                />
                <EditableList
                  contentKey="about.values.items"
                  value={content['about.values.items']}
                  editable={editable}
                  className="space-y-3"
                  editorClassName="space-y-3 text-gray-600 dark:text-gray-300 text-sm"
                  renderItem={(v) => (
                    <li className="flex items-start text-gray-600 dark:text-gray-300 text-sm">
                      <CheckIcon className="w-4 h-4 text-shpe-red mt-0.5 mr-2 flex-shrink-0" />
                      {v}
                    </li>
                  )}
                />
              </div>

              <div className="bg-shpe-red rounded-xl p-6 text-white">
                <Editable
                  as="h3"
                  contentKey="about.joinReasons.heading"
                  value={content['about.joinReasons.heading']}
                  editable={editable}
                  className="text-xl font-bold mb-4"
                />
                <EditableList
                  contentKey="about.joinReasons.items"
                  value={content['about.joinReasons.items']}
                  editable={editable}
                  className="space-y-2.5"
                  editorClassName="space-y-2.5 text-sm"
                  renderItem={(r) => (
                    <li className="flex items-start text-sm">
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
                  )}
                />
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
              <Editable
                as="span"
                contentKey="about.national.eyebrow"
                value={content['about.national.eyebrow']}
                editable={editable}
                className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
              />
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <Editable
              as="h2"
              contentKey="about.national.heading"
              value={content['about.national.heading']}
              editable={editable}
              className="text-3xl font-bold text-gray-900 dark:text-white mb-4"
            />
            <Editable
              as="p"
              contentKey="about.national.intro"
              value={content['about.national.intro']}
              editable={editable}
              className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {nationalStats.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center"
              >
                <div className="text-4xl font-black text-shpe-red mb-2">{s.value}</div>
                <div className="font-bold text-gray-900 dark:text-white mb-2">{s.label}</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-cmu-maroon py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Editable
            as="h2"
            contentKey="about.cta.heading"
            value={content['about.cta.heading']}
            editable={editable}
            className="text-3xl font-bold text-white mb-4"
          />
          <Editable
            as="p"
            contentKey="about.cta.paragraph"
            value={content['about.cta.paragraph']}
            editable={editable}
            className="text-gray-300 mb-8"
          />
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
