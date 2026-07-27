import OfficerAvatar from '@/components/OfficerAvatar'
import config from '@/lib/config'
import { officers, advisor } from '@/lib/officers'
import { LinkedInIcon } from '@/components/icons'

export default function Officers() {
  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Meet the Team
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Chapter Officers</h1>
          <p className="text-gray-300 max-w-xl">
            Our executive board is elected each spring and works year-round to create
            opportunities and community for CMU SHPE members.
          </p>
        </div>
      </section>

      {/* ── Executive Board ── */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-12">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Board 2025–2026</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {officers.map((officer) => (
              <div
                key={officer.name}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center border border-gray-100 dark:border-gray-700 hover:border-shpe-red/30 hover:shadow-md transition-all duration-200"
              >
                <OfficerAvatar name={officer.name} photo={officer.photo} />
                <h3 className="font-bold text-gray-900 dark:text-white text-base mb-0.5">{officer.name}</h3>
                <p className="text-shpe-red font-semibold text-sm mb-2">{officer.role}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">{officer.major}</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">{officer.year}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4">{officer.bio}</p>
                {officer.email && (
                  <a
                    href={`mailto:${officer.email}`}
                    className="text-shpe-red hover:text-red-700 text-xs font-medium transition-colors break-all"
                  >
                    {officer.email}
                  </a>
                )}
                {officer.linkedin && (
                  <a
                    href={officer.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium transition-colors"
                  >
                    <LinkedInIcon className="w-3.5 h-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Faculty Advisor ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty Advisor</h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 max-w-2xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="flex-shrink-0">
              <OfficerAvatar name={advisor.name} photo={advisor.photo} size="lg" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-0.5">{advisor.name}</h3>
              <p className="text-shpe-red font-semibold text-sm mb-1">{advisor.role}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{advisor.department}</p>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">{advisor.bio}</p>
              <a
                href={`mailto:${advisor.email}`}
                className="text-shpe-red hover:text-red-700 text-sm font-medium transition-colors"
              >
                {advisor.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Elections Info ── */}
      <section className="bg-shpe-red py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Interested in Running for Office?</h2>
          <p className="text-red-100 mb-6 max-w-xl mx-auto">
            Officer elections are held each spring semester. Any dues-paying member in good
            academic standing is eligible to run. Leadership experience not required — just
            dedication and a desire to serve.
          </p>
          <p className="text-red-200 text-sm">
            Contact us at{' '}
            <a
              href={`mailto:${config.email}`}
              className="text-white underline hover:text-red-100"
            >
              {config.email}
            </a>{' '}
            to learn more.
          </p>
        </div>
      </section>
    </div>
  )
}
