import Link from 'next/link'
import Editable from '@/components/editable'
import SponsorLogo from '@/components/SponsorLogo'
import { CheckIcon } from '@/components/icons'
import { currentAdmin } from '@/lib/admin'
import { BENEFIT_COLUMNS, parseBenefitCell } from '@/lib/benefit-cells'
import { type ContentKeyWithPrefix, contentKeysFor } from '@/lib/content-keys'
import { getSiteContent, getSponsorBenefits, getSponsors } from '@/lib/queries'
import type { Tier } from '@/lib/sponsor-tiers'

const tierMeta: {
  name: Tier
  amountKey: ContentKeyWithPrefix<'sponsors'>
  badge: string
}[] = [
  {
    name: 'Platinum',
    amountKey: 'sponsors.tier.platinum.amount',
    badge: 'bg-gray-200 text-gray-700'
  },
  {
    name: 'Gold',
    amountKey: 'sponsors.tier.gold.amount',
    badge: 'bg-shpe-gold text-cmu-maroon'
  },
  {
    name: 'Silver',
    amountKey: 'sponsors.tier.silver.amount',
    badge: 'bg-gray-400 text-white'
  },
  {
    name: 'Bronze',
    amountKey: 'sponsors.tier.bronze.amount',
    badge: 'bg-orange-300 text-orange-900'
  },
]

export default async function Sponsors() {
  const [content, admin, sponsors, benefits] = await Promise.all([
    getSiteContent(contentKeysFor('sponsors')),
    currentAdmin(),
    getSponsors(),
    getSponsorBenefits(),
  ])
  const editable = Boolean(admin)
  const byTier = (tier: Tier) => sponsors.filter((s) => s.tier === tier)

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <Editable
              as="span"
              contentKey="sponsors.header.eyebrow"
              value={content['sponsors.header.eyebrow']}
              editable={editable}
              className="text-shpe-gold font-semibold text-sm uppercase tracking-widest"
            />
          </div>
          <Editable
            as="h1"
            contentKey="sponsors.header.heading"
            value={content['sponsors.header.heading']}
            editable={editable}
            className="text-5xl font-black text-white mb-3"
          />
          <Editable
            as="p"
            contentKey="sponsors.header.intro"
            value={content['sponsors.header.intro']}
            editable={editable}
            className="text-gray-300 max-w-xl"
          />
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
                <span className="text-gray-400 dark:text-gray-500 text-sm">{content[tier.amountKey]}</span>
              </div>
              <div className="flex flex-wrap gap-5">
                {tierSponsors.map((sponsor) => (
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
              <Editable
                as="span"
                contentKey="sponsors.become.eyebrow"
                value={content['sponsors.become.eyebrow']}
                editable={editable}
                className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
              />
              <div className="h-0.5 w-8 bg-shpe-red ml-3" />
            </div>
            <Editable
              as="h2"
              contentKey="sponsors.become.heading"
              value={content['sponsors.become.heading']}
              editable={editable}
              className="text-4xl font-bold text-gray-900 dark:text-white mb-4"
            />
            <Editable
              as="p"
              contentKey="sponsors.become.intro"
              value={content['sponsors.become.intro']}
              editable={editable}
              className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto"
            />
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
                      <Editable
                        as="div"
                        contentKey={t.amountKey}
                        value={content[t.amountKey]}
                        editable={editable}
                        className="text-gray-300 font-normal text-xs mt-0.5"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {benefits.map((benefit, i) => (
                  <tr key={benefit.id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                    <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">{benefit.label}</td>
                    {tierMeta.map((t) => (
                      <td key={t.name} className="px-4 py-3.5 text-center">
                        <BenefitCell value={benefit[BENEFIT_COLUMNS[t.name]]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA */}
          <div className="bg-cmu-maroon rounded-2xl p-10 text-center">
            <Editable
              as="h3"
              contentKey="sponsors.cta.heading"
              value={content['sponsors.cta.heading']}
              editable={editable}
              className="text-2xl font-bold text-white mb-3"
            />
            <Editable
              as="p"
              contentKey="sponsors.cta.paragraph"
              value={content['sponsors.cta.paragraph']}
              editable={editable}
              className="text-gray-300 mb-6 max-w-lg mx-auto"
            />
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

function BenefitCell({ value }: { value: string }) {
  const cell = parseBenefitCell(value)
  if (cell.kind === 'yes') return <Check />
  if (cell.kind === 'no') return <X />
  return <Partial text={cell.text} />
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
