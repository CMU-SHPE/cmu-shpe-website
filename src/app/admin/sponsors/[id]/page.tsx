import Link from 'next/link'
import { notFound } from 'next/navigation'
import SponsorLogo from '@/components/SponsorLogo'
import AdminSponsorReceipts from '@/components/admin/sponsor-receipts'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  sectionHeadingClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import type { SponsorEditorKind } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { SPONSOR_EDITS_SHOWN, getLinkedMembers, getSponsorEdits, getSponsorListing } from '@/lib/sponsor-portal-admin'

const fieldLabels: Record<string, string> = {
  name: 'Name',
  tier: 'Tier',
  website: 'Website',
  description: 'Description',
  logo: 'Logo',
  bgColor: 'Logo background color',
}

function editorLabel(edit: { editorKind: SponsorEditorKind; memberId: number | null; adminId: number | null }) {
  const accountId = edit.editorKind === 'officer' ? edit.adminId : edit.memberId
  return accountId === null ? `${edit.editorKind}, account deleted` : edit.editorKind
}

const editedAt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

const linkClass = `rounded font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`

export default async function AdminSponsorDetailPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const id = recordId.safeParse((await props.params).id)
  if (!id.success) notFound()

  const [listing, linkedMembers, edits] = await Promise.all([
    getSponsorListing(id.data),
    getLinkedMembers(id.data),
    getSponsorEdits(id.data),
  ])
  if (!listing) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sponsors" className={`text-sm ${linkClass}`}>
          <span aria-hidden="true">&larr;</span> All sponsors
        </Link>
        <h1 className={`mt-2 ${pageHeadingClass}`}>{listing.name}</h1>
      </div>

      <section className={cardClass} aria-labelledby="summary-heading">
        <h2 id="summary-heading" className={sectionHeadingClass}>
          Listing
        </h2>
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <SponsorLogo name={listing.name} logo={listing.logoUrl} tier={listing.tier} bgColor={listing.bgColor} />
          <dl className="min-w-0 flex-1 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-gray-900 dark:text-white">Tier</dt>
              <dd className="text-gray-700 dark:text-gray-300">{listing.tier}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-white">Website</dt>
              <dd className="break-all text-gray-700 dark:text-gray-300">{listing.website ?? 'None'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900 dark:text-white">Description</dt>
              <dd className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                {listing.description || 'None'}
              </dd>
            </div>
          </dl>
        </div>
        <p className={`mt-4 ${mutedTextClass}`}>Edit the listing, tier and order on the Sponsors page.</p>
      </section>

      <section className={cardClass} aria-labelledby="members-heading">
        <h2 id="members-heading" className={sectionHeadingClass}>
          Sponsor accounts
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          These people can edit this listing from the sponsor portal. Add or remove them on the{' '}
          <Link href="/admin/members" className={linkClass}>
            Members
          </Link>{' '}
          page.
        </p>
        {linkedMembers.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No one is linked to this listing yet.</p>
        ) : (
          <table className={`mt-4 ${tableClass}`}>
            <caption className="sr-only">Sponsor accounts linked to {listing.name}</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                <th scope="col" className="py-2 pr-4 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {linkedMembers.map((member) => (
                <tr key={member.id} className={tableRowClass}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{member.name}</td>
                  <td className="py-3 pr-4 break-all">{member.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${cardClass} overflow-x-auto`} aria-labelledby="history-heading">
        <h2 id="history-heading" className={sectionHeadingClass}>
          Edit history
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Changes made by sponsors from the sponsor portal and by officers on the Sponsors page, newest first (up
          to {SPONSOR_EDITS_SHOWN}).
        </p>
        {edits.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No one has edited this listing yet.</p>
        ) : (
          <table className={`mt-4 ${tableClass}`}>
            <caption className="sr-only">Edits to {listing.name}, newest first</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">When</th>
                <th scope="col" className="py-2 pr-4 font-medium">Who</th>
                <th scope="col" className="py-2 pr-4 font-medium">Changed</th>
              </tr>
            </thead>
            <tbody>
              {edits.map((edit) => (
                <tr key={edit.id} className={tableRowClass}>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <time dateTime={edit.createdAt.toISOString()}>{editedAt.format(edit.createdAt)}</time>
                  </td>
                  <td className="py-3 pr-4">
                    {edit.editorName} <span className={mutedTextClass}>({editorLabel(edit)})</span>
                  </td>
                  <td className="py-3 pr-4">{edit.fields.map((field) => fieldLabels[field] ?? field).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AdminSponsorReceipts sponsorId={listing.id} />
    </div>
  )
}
