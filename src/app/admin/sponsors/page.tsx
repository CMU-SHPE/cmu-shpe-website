import Link from 'next/link'
import ImageCropField from '@/components/image-crop-field'
import SponsorLogo from '@/components/SponsorLogo'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import MoveButtons from '@/components/admin/move-buttons'
import EditDetails from '@/components/admin/edit-details'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import type { Sponsor } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { DEFAULT_LOGO_BACKGROUND } from '@/lib/colors'
import { HTTP_URL_INPUT, IMAGE_SOURCE_INPUT } from '@/lib/form-fields'
import { getSponsors } from '@/lib/queries'
import { LOGO_FIELD_NAMES, MAX_SPONSOR_DESCRIPTION_LENGTH } from '@/lib/sponsor-schema'
import { SPONSOR_TIERS } from '@/lib/sponsor-tiers'
import { createSponsor, deleteSponsor, moveSponsor, updateSponsor } from './actions'

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — the name is required, the website must start with http:// or https://, and a logo path must start with a single / or https://.',
  upload: 'The upload failed — use an image file (JPEG, PNG, WebP, GIF, AVIF or SVG) under 8 MB.',
  svg: "This SVG contains scripts or links and can't be used. Export it as PNG or a plain SVG.",
  missing: 'That sponsor no longer exists.',
  storage: "The image couldn't be saved right now — please try again in a minute. Nothing was changed.",
}

const logoHelp =
  'Trim and straighten the logo — pick a shape, then drag, zoom and rotate. Logos are scaled to fit their tile, so the whole framed area stays visible.'

function SponsorFields({ sponsor }: { sponsor?: Sponsor }) {
  return (
    <>
      <label className={labelClass}>
        Name
        <input name="name" required maxLength={200} defaultValue={sponsor?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Tier
        <select name="tier" defaultValue={sponsor?.tier ?? SPONSOR_TIERS[0]} className={inputClass}>
          {SPONSOR_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Website (optional)
        <input
          name="website"
          type="url"
          maxLength={500}
          {...HTTP_URL_INPUT}
          defaultValue={sponsor?.website ?? ''}
          placeholder="https://…"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Description (optional)
        <textarea
          name="description"
          rows={4}
          maxLength={MAX_SPONSOR_DESCRIPTION_LENGTH}
          defaultValue={sponsor?.description ?? ''}
          className={inputClass}
        />
      </label>
      <ImageCropField
        names={LOGO_FIELD_NAMES}
        subject="logo"
        helpText={logoHelp}
        uploadLabel="Upload logo (optional)"
        replaceLabel="Replace logo"
        previewClassName="max-h-28 w-full object-contain p-2"
        existing={
          sponsor && {
            imageUrl: sponsor.logoUrl,
            originalUrl: sponsor.logoOriginalUrl,
            crop: sponsor.logoCrop,
          }
        }
      />
      <label className={labelClass}>
        Logo path or URL (optional — ignored when you upload a file)
        <input
          name="logoUrl"
          maxLength={500}
          {...IMAGE_SOURCE_INPUT}
          defaultValue={sponsor?.logoUrl ?? ''}
          placeholder="/sponsors/logo.png or https://…"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Logo background color
        <input
          name="bgColor"
          type="color"
          defaultValue={sponsor?.bgColor ?? DEFAULT_LOGO_BACKGROUND}
          className={`mt-1 block h-10 w-20 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 ${focusRingClass}`}
        />
      </label>
    </>
  )
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
                      <form
                        action={updateSponsor.bind(null, sponsor.id)}
                        className="mt-4 max-w-md space-y-4"
                      >
                        <SponsorFields sponsor={sponsor} />
                        <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                          Save changes
                        </SubmitButton>
                      </form>
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
