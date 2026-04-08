import Link from 'next/link'

const tiers = [
  {
    name: 'Platinum',
    amount: '$5,000+',
    color: 'border-gray-300 bg-gray-50',
    badge: 'bg-gray-200 text-gray-700',
    logoSize: 'w-52 h-28',
    count: 2,
    benefits: [
      'Premier logo placement on website, banners, and all printed materials',
      'Exclusive 30-minute company presentation at a chapter meeting',
      'Reserved table at the Annual Networking Banquet (4 seats)',
      'Direct access to member resume book',
      'Company spotlight in email newsletter (2×/year)',
      'Social media features (4 posts)',
      'Recognition at all chapter events',
    ],
  },
  {
    name: 'Gold',
    amount: '$2,500+',
    color: 'border-shpe-gold bg-yellow-50',
    badge: 'bg-shpe-gold text-cmu-maroon',
    logoSize: 'w-40 h-24',
    count: 3,
    benefits: [
      'Logo placement on website and event banners',
      'Access to member resume book',
      'Seats at the Annual Networking Banquet (2 seats)',
      'Company spotlight in email newsletter (1×/year)',
      'Social media features (2 posts)',
      'Recognition at chapter events',
    ],
  },
  {
    name: 'Silver',
    amount: '$1,000+',
    color: 'border-gray-300 bg-white',
    badge: 'bg-gray-400 text-white',
    logoSize: 'w-32 h-20',
    count: 3,
    benefits: [
      'Logo placement on website',
      'Recognition at chapter events',
      'Social media feature (1 post)',
      'Access to member resume book',
    ],
  },
  {
    name: 'Bronze',
    amount: '$500+',
    color: 'border-orange-200 bg-orange-50',
    badge: 'bg-orange-300 text-orange-900',
    logoSize: 'w-28 h-16',
    count: 3,
    benefits: [
      'Logo placement on website',
      'Verbal recognition at chapter events',
      'Social media mention',
    ],
  },
]

export default function Sponsors() {
  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Our Partners
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Sponsors</h1>
          <p className="text-gray-300 max-w-xl">
            Our sponsors are the backbone of CMU SHPE. Their investment directly funds
            events, travel to conferences, and professional development resources for our members.
          </p>
        </div>
      </section>

      {/* ── Current Sponsors ── */}
      {tiers.map((tier) => (
        <section key={tier.name} className="py-16 border-b border-gray-100 last:border-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${tier.badge}`}>
                {tier.name}
              </span>
              <span className="text-gray-400 text-sm">{tier.amount}</span>
            </div>
            <div className="flex flex-wrap gap-5">
              {Array.from({ length: tier.count }).map((_, i) => (
                <div
                  key={i}
                  className={`${tier.logoSize} flex items-center justify-center rounded-xl border-2 border-dashed ${tier.color} text-gray-400 text-xs font-medium`}
                >
                  {tier.name} Sponsor
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── Become a Sponsor ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center mb-4">
              <div className="h-0.5 w-8 bg-shpe-red mr-3" />
              <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                Partner With Us
              </span>
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Become a Sponsor</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Investing in CMU SHPE means investing in the next generation of Hispanic
              engineering talent. Our members are driven, ambitious, and ready to make
              an impact in your organization.
            </p>
          </div>

          {/* Tier comparison table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-14">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cmu-maroon text-white">
                  <th className="text-left px-6 py-4 font-semibold">Benefit</th>
                  {tiers.map((t) => (
                    <th key={t.name} className="px-4 py-4 font-semibold text-center">
                      <div>{t.name}</div>
                      <div className="text-gray-300 font-normal text-xs mt-0.5">{t.amount}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  'Logo on website',
                  'Logo on event banners',
                  'Access to resume book',
                  'Social media features',
                  'Newsletter spotlight',
                  'Networking banquet seats',
                  'Company presentation',
                ].map((benefit, i) => (
                  <tr key={benefit} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-3.5 text-gray-700 font-medium">{benefit}</td>
                    {/* Platinum */}
                    <td className="px-4 py-3.5 text-center">
                      <Check />
                    </td>
                    {/* Gold */}
                    <td className="px-4 py-3.5 text-center">
                      {i < 4 ? <Check /> : i === 4 ? <Check /> : i === 5 ? <Partial text="2" /> : <X />}
                    </td>
                    {/* Silver */}
                    <td className="px-4 py-3.5 text-center">
                      {i < 2 ? (i === 0 ? <Check /> : <X />) : i === 2 ? <Check /> : i === 3 ? <Partial text="1" /> : <X />}
                    </td>
                    {/* Bronze */}
                    <td className="px-4 py-3.5 text-center">
                      {i === 0 ? <Check /> : <X />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA */}
          <div className="bg-cmu-maroon rounded-2xl p-10 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">Interested in sponsoring?</h3>
            <p className="text-gray-300 mb-6 max-w-lg mx-auto">
              Reach out to our President or Faculty Advisor for our full sponsorship prospectus
              and to discuss a partnership that works for your organization.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-shpe-gold hover:bg-yellow-400 text-cmu-maroon px-8 py-4 rounded-lg font-bold text-base transition-all duration-200"
            >
              Contact Us About Sponsorship
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function Check() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
      <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

function Partial({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 rounded-full text-yellow-700 text-xs font-bold">
      {text}
    </span>
  )
}

function X() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6">
      <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}
