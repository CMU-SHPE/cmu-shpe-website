import Link from 'next/link'
import SponsorLogo from '@/components/SponsorLogo'
import { sponsors, type Tier } from '@/lib/sponsors'
import { CheckIcon } from '@/components/icons'

const tierMeta: {
  name: Tier
  amount?: string
  badge: string
}[] = [
  {
    name: 'Platinum',
    // amount: 'This is the description',
    badge: 'bg-gray-200 text-gray-700'
  },
  {
    name: 'Gold',
    // amount: '$2,500+',
    badge: 'bg-shpe-gold text-cmu-maroon'
  },
  {
    name: 'Silver',
    // amount: '$1,000+',
    badge: 'bg-gray-400 text-white'
  },
  {
    name: 'Bronze',
    // amount: '$500+',
    badge: 'bg-orange-300 text-orange-900'
  },
]

// true = ✓, false = ✗, number = partial count
type Cell = boolean | number

const benefits: { label: string; tiers: [Cell, Cell, Cell, Cell] }[] = [
  //                                       Platinum  Gold     Silver   Bronze
  { label: 'Logo on website',              tiers: [true,  true,  true,  true]  },
  // { label: 'Access to resume book',        tiers: [true,  true,  true,  false] },
  { label: 'Social media features',        tiers: [true,  true,  1,     false] },
  // { label: 'Networking banquet seats',     tiers: [true,  2,     false, false] },
  { label: 'Logo on event banners',        tiers: [true,  true,  false, false] },
  { label: 'Newsletter spotlight',         tiers: [true,  true,  false, false] },
  { label: 'Company presentation',         tiers: [true,  false, false, false] },
]

export default function Sponsors() {
  const byTier = (tier: Tier) => sponsors.filter((s) => s.tier === tier)

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
      {tierMeta.map((tier) => {
        const tierSponsors = byTier(tier.name)
        if (tierSponsors.length === 0) return null
        return (
          <section key={tier.name} className="py-16 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3 mb-8">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${tier.badge}`}>
                  {tier.name}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-sm">{tier.amount}</span>
              </div>
              <div className="flex flex-wrap gap-5">
                {tierSponsors.map((sponsor) => (
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
            </div>
          </section>
        )
      })}

      {/* ── Become a Sponsor ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center mb-4">
              <div className="h-0.5 w-8 bg-shpe-red mr-3" />
              <span className="text-shpe-red font-semibold text-sm uppercase tracking-wider">
                Partner With Us
              </span>
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Become a Sponsor</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Investing in CMU SHPE means investing in the next generation of Hispanic
              engineering talent. Our members are driven, ambitious, and ready to make
              an impact in your organization.
            </p>
          </div>

          {/* Tier comparison table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-14">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cmu-maroon text-white">
                  <th className="text-left px-6 py-4 font-semibold">Benefit</th>
                  {tierMeta.map((t) => (
                    <th key={t.name} className="px-4 py-4 font-semibold text-center">
                      <div>{t.name}</div>
                      <div className="text-gray-300 font-normal text-xs mt-0.5">{t.amount}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {benefits.map((benefit, i) => (
                  <tr key={benefit.label} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                    <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">{benefit.label}</td>
                    {benefit.tiers.map((cell, j) => (
                      <td key={j} className="px-4 py-3.5 text-center">
                        {cell === true ? <Check /> : cell === false ? <X /> : <Partial text={String(cell)} />}
                      </td>
                    ))}
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
    <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/40 rounded-full">
      <CheckIcon className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
    </span>
  )
}

function Partial({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 dark:bg-yellow-900/40 rounded-full text-yellow-700 dark:text-yellow-400 text-xs font-bold">
      {text}
    </span>
  )
}

function X() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6">
      <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}
