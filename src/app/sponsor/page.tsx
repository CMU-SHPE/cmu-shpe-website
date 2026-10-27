import type { Metadata } from 'next'
import Link from 'next/link'
import Editable from '@/components/editable'
import { LocationIcon } from '@/components/icons'
import StatusBanner from '@/components/admin/status-banner'
import ListingForm from '@/components/sponsor/listing-form'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { formatEventDate, splitEvents, todayInDenver } from '@/lib/event-dates'
import { getEvents, getSiteContentWithDefaults } from '@/lib/queries'
import { requireSponsor } from '@/lib/sponsor-portal'
import { updateListing } from './actions'

export const metadata: Metadata = {
  title: 'Sponsor portal | SHPE @ Colorado Mesa University',
  robots: { index: false, follow: false },
}

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — the name is required, the website must start with http:// or https://, and the description must be 1000 characters or fewer.',
  upload: 'The upload failed — use an image file (JPEG, PNG, WebP, GIF, AVIF or SVG) under 8 MB.',
  storage: "The logo couldn't be saved right now — please try again in a minute. Nothing was changed.",
  missing: 'Your account is no longer linked to a sponsor listing, so nothing was changed.',
}

const savedMessages: Record<string, string> = {
  listing: 'Your listing was saved.',
  unchanged: 'Nothing changed, so there was nothing to save.',
}

const linkClass = `rounded font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`

export default async function SponsorPortalPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const admin = await currentAdmin()
  const access = admin ? null : await requireSponsor()
  const editable = Boolean(admin)

  const [{ saved, error }, content, events] = await Promise.all([
    props.searchParams,
    getSiteContentWithDefaults(contentKeysFor('sponsor')),
    getEvents(),
  ])
  const { upcoming } = splitEvents(events, todayInDenver(new Date()))
  const knownSaved = saved && Object.hasOwn(savedMessages, saved) ? saved : undefined

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Editable
            as="h1"
            contentKey="sponsor.header.heading"
            value={content['sponsor.header.heading']}
            editable={editable}
            className={pageHeadingClass}
          />
          {access && <p className={`mt-1 ${mutedTextClass}`}>Signed in as {access.member.user.email}</p>}
          <Editable
            as="p"
            contentKey="sponsor.header.intro"
            value={content['sponsor.header.intro']}
            editable={editable}
            className="mt-3 text-gray-700 dark:text-gray-300"
          />
        </div>

        {admin && (
          <p
            role="note"
            className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-300"
          >
            You’re previewing the sponsor portal as an admin. Sponsors see a form to edit their own listing here, along
            with RSVP buttons, their RSVPs and their receipts. You can edit the text on this page. To give someone
            access, link them to a listing on the{' '}
            <Link href="/admin/members" className={linkClass}>
              Members
            </Link>{' '}
            page.
          </p>
        )}

        {access && (
          <StatusBanner
            saved={knownSaved}
            error={error}
            errorMessages={errorMessages}
            savedMessage={knownSaved ? savedMessages[knownSaved] : undefined}
          />
        )}

        <section className={cardClass} aria-labelledby="listing-heading">
          <div id="listing-heading">
            <Editable
              as="h2"
              contentKey="sponsor.listing.heading"
              value={content['sponsor.listing.heading']}
              editable={editable}
              className={sectionHeadingClass}
            />
          </div>
          <Editable
            as="p"
            contentKey="sponsor.listing.intro"
            value={content['sponsor.listing.intro']}
            editable={editable}
            className={`mt-1 ${mutedTextClass}`}
          />
          {access ? (
            <ListingForm listing={access.listing} action={updateListing} />
          ) : (
            <p className={`mt-4 ${mutedTextClass}`}>The sponsor’s listing form appears here.</p>
          )}
        </section>

        <section className={cardClass} aria-labelledby="events-heading">
          <div id="events-heading">
            <Editable
              as="h2"
              contentKey="sponsor.events.heading"
              value={content['sponsor.events.heading']}
              editable={editable}
              className={sectionHeadingClass}
            />
          </div>
          {upcoming.length === 0 ? (
            <Editable
              as="p"
              contentKey="sponsor.events.empty"
              value={content['sponsor.events.empty']}
              editable={editable}
              className={`mt-2 ${mutedTextClass}`}
            />
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
              {upcoming.map((event) => (
                <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white">{event.title}</h3>
                    <p className={mutedTextClass}>
                      <time dateTime={event.date}>{formatEventDate(event.date)}</time>
                      {event.time && ` · ${event.time}`}
                    </p>
                    <p className={`flex items-center gap-1 ${mutedTextClass}`}>
                      <span aria-hidden="true">
                        <LocationIcon className="h-4 w-4 shrink-0" />
                      </span>
                      {event.location}
                    </p>
                  </div>
                  {/* rsvp slot */}
                </li>
              ))}
            </ul>
          )}
        </section>

        {access ? (
          <>
            {/* my-rsvps slot */}
            {/* receipts slot */}
          </>
        ) : (
          <>
            <section className={cardClass} aria-labelledby="rsvps-preview-heading">
              <h2 id="rsvps-preview-heading" className={sectionHeadingClass}>
                My RSVPs
              </h2>
              <p className={`mt-1 ${mutedTextClass}`}>Sponsors see the events they’ve RSVPed to here.</p>
            </section>
            <section className={cardClass} aria-labelledby="receipts-preview-heading">
              <h2 id="receipts-preview-heading" className={sectionHeadingClass}>
                Receipts
              </h2>
              <p className={`mt-1 ${mutedTextClass}`}>Sponsors download the receipts uploaded to their listing here.</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
