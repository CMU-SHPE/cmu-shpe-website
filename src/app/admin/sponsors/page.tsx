import Link from 'next/link'
import SponsorLogo from '@/components/SponsorLogo'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import MoveButtons from '@/components/admin/move-buttons'
import EditDetails from '@/components/admin/edit-details'
import SponsorEditForm from '@/components/admin/sponsor-edit-form'
import SponsorFields from '@/components/admin/sponsor-fields'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import { getSponsors } from '@/lib/queries'
import { SPONSOR_TIERS } from '@/lib/sponsor-tiers'
import { createSponsor, deleteSponsor, moveSponsor, updateSponsor } from './actions'

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — the name is required, the website must start with http:// or https://, and a logo path must start with a single / or https://.',
  upload: 'The upload failed — use an image file (JPEG, PNG, WebP, GIF, AVIF or SVG) under 8 MB.',
  svg: "This SVG contains scripts or links and can't be used. Export it as PNG or a plain SVG.",
  missing: 'That sponsor no longer exists.',
  'not-saved': "That change couldn't be saved, so nothing was changed. Refresh the page and try again.",
  storage: "The image couldn't be saved right now — please try again in a minute. Nothing was changed.",
}

export default async function AdminSponsorsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, rows] = await Promise.all([props.searchParams, getSponsors()])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Sponsors</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="add-sponsor-heading">
        <h2 id="add-sponsor-heading" className={sectionHeadingClass}>
          Add sponsor
        </h2>
        <form action={createSponsor} className="mt-4 max-w-md space-y-4">
          <SponsorFields />
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add sponsor
          </SubmitButton>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="current-sponsors-heading">
        <h2 id="current-sponsors-heading" className={sectionHeadingClass}>
          Current sponsors
        </h2>
        {rows.length === 0 && <p className={`mt-2 ${mutedTextClass}`}>No sponsors yet.</p>}
        {SPONSOR_TIERS.map((tier) => {
          const tierRows = rows.filter((sponsor) => sponsor.tier === tier)
          if (tierRows.length === 0) return null
          return (
            <div key={tier} className="mt-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tier}</h3>
              <ul className="mt-3 space-y-3">
                {tierRows.map((sponsor, index) => (
                  <li
                    key={sponsor.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <SponsorLogo
                        name={sponsor.name}
                        logo={sponsor.logoUrl}
                        tier={sponsor.tier}
                        bgColor={sponsor.bgColor}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{sponsor.name}</p>
                        {sponsor.website && (
                          <p className={`break-all ${mutedTextClass}`}>{sponsor.website}</p>
                        )}
                      </div>
                      <Link href={`/admin/sponsors/${sponsor.id}`} className={`${secondaryButtonClass} inline-block`}>
                        {'Details '}
                        <span className="sr-only">for {sponsor.name}</span>
                      </Link>
                      <MoveButtons
                        name={sponsor.name}
                        moveUp={index > 0 ? moveSponsor.bind(null, sponsor.id, 'up') : undefined}
                        moveDown={
                          index < tierRows.length - 1
                            ? moveSponsor.bind(null, sponsor.id, 'down')
                            : undefined
                        }
                      />
                      <form action={deleteSponsor.bind(null, sponsor.id)}>
                        <DeleteButton
                          name={sponsor.name}
                          warning="Anyone linked to this listing loses sponsor access and becomes a supporter, and its receipts and edit history are deleted."
                        />
                      </form>
                    </div>
                    <EditDetails name={sponsor.name}>
                      <SponsorEditForm sponsor={sponsor} action={updateSponsor.bind(null, sponsor.id)} />
                    </EditDetails>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
