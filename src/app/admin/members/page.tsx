import Link from 'next/link'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  dangerButtonClass,
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  secondaryButtonClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import type { MemberRole } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import {
  MAX_MEMBER_SEARCH_LENGTH,
  MEMBERS_PAGE_SIZE,
  listMembers,
  listSponsorOptions,
  memberListParams,
} from '@/lib/member-admin'
import { deleteMember, linkMemberToSponsor, removeSponsorAccess } from './actions'

const errorMessages: Record<string, string> = {
  invalid: 'That request was not valid. Please try again.',
  missing: 'That member no longer exists.',
  link: 'That member could not be linked. They must have confirmed their email, and the sponsor listing must still exist.',
}

const savedMessages: Record<string, string> = {
  deleted: 'Member deleted.',
  sponsor: 'Sponsor access saved.',
  supporter: 'Sponsor access removed.',
}

const roleLabels: Record<MemberRole, string> = { supporter: 'Supporter', sponsor: 'Sponsor' }

const joinedDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const pageLinkClass = `${secondaryButtonClass} inline-block`

const selectClass =
  'max-w-[12rem] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent'

function pageHref(q: string, page: number) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/admin/members?${query}` : '/admin/members'
}

export default async function AdminMembersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const searchParams = await props.searchParams
  const { q, page } = memberListParams.parse(searchParams)
  const [{ rows, hasNext }, sponsorOptions] = await Promise.all([listMembers({ q, page }), listSponsorOptions()])
  const saved =
    typeof searchParams.saved === 'string' && Object.hasOwn(savedMessages, searchParams.saved)
      ? searchParams.saved
      : undefined
  const error = typeof searchParams.error === 'string' ? searchParams.error : undefined
  const caption = q ? `Members matching “${q}”, page ${page}` : `Members, newest first, page ${page}`

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Members</h1>

      <StatusBanner
        saved={saved}
        error={error}
        errorMessages={errorMessages}
        savedMessage={saved ? savedMessages[saved] : undefined}
      />

      <section className={cardClass}>
        <form method="get" action="/admin/members" role="search" aria-label="Members" className="flex max-w-xl flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="member-search" className={labelClass}>
              Search by name or email
            </label>
            <input
              id="member-search"
              name="q"
              type="search"
              maxLength={MAX_MEMBER_SEARCH_LENGTH}
              defaultValue={q}
              className={inputClass}
            />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Search
          </button>
          {q && (
            <Link href="/admin/members" className={`rounded text-sm font-medium text-shpe-red dark:text-shpe-gold ${focusRingClass}`}>
              Clear search
            </Link>
          )}
        </form>
      </section>

      <section className={`${cardClass} overflow-x-auto`}>
        {rows.length === 0 ? (
          <p className={mutedTextClass}>
            {q ? 'No members match that search.' : page > 1 ? 'No members on this page.' : 'No one has signed up yet.'}
          </p>
        ) : (
          <table className={tableClass}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                <th scope="col" className="py-2 pr-4 font-medium">Email</th>
                <th scope="col" className="py-2 pr-4 font-medium">Role</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sponsor listing</th>
                <th scope="col" className="py-2 pr-4 font-medium">Email confirmed</th>
                <th scope="col" className="py-2 pr-4 font-medium">Joined</th>
                <th scope="col" className="py-2 pr-4 font-medium">Newsletter topics</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id} className={tableRowClass}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{member.name}</td>
                  <td className="py-3 pr-4 break-all">{member.email}</td>
                  <td className="py-3 pr-4">{roleLabels[member.role]}</td>
                  <td className="py-3 pr-4">{member.role === 'sponsor' ? (member.sponsorName ?? '—') : '—'}</td>
                  <td className="py-3 pr-4">{member.emailConfirmedAt ? 'Yes' : 'No'}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <time dateTime={member.createdAt.toISOString()}>{joinedDate.format(member.createdAt)}</time>
                  </td>
                  <td className="py-3 pr-4">{member.topicCount}</td>
                  <td className="py-3 text-right align-top">
                    <div className="flex flex-col items-end gap-2">
                      {member.emailConfirmedAt && sponsorOptions.length > 0 && (
                        <SponsorAccessForm member={member} sponsorOptions={sponsorOptions} />
                      )}
                      {member.role === 'sponsor' && (
                        <form action={removeSponsorAccess.bind(null, member.id)}>
                          <SubmitButton pendingLabel="Removing…" className={dangerButtonClass}>
                            {'Remove sponsor access '}
                            <span className="sr-only">for {member.name}</span>
                          </SubmitButton>
                        </form>
                      )}
                      <form action={deleteMember.bind(null, member.id)}>
                        <DeleteButton
                          name={member.name}
                          warning="Their account, sign-in links and newsletter choices are removed."
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(page > 1 || hasNext) && (
          <nav aria-label="Member pages" className="mt-4 flex items-center gap-3">
            {page > 1 && (
              <Link href={pageHref(q, page - 1)} className={pageLinkClass}>
                Previous page
              </Link>
            )}
            <span className={mutedTextClass}>Page {page}</span>
            {hasNext && (
              <Link href={pageHref(q, page + 1)} className={pageLinkClass}>
                Next page
              </Link>
            )}
          </nav>
        )}
        <p className={`mt-4 ${mutedTextClass}`}>Showing up to {MEMBERS_PAGE_SIZE} members per page.</p>
      </section>
    </div>
  )
}

function SponsorAccessForm({
  member,
  sponsorOptions,
}: {
  member: { id: number; name: string; role: MemberRole; sponsorId: number | null }
  sponsorOptions: { id: number; name: string }[]
}) {
  const isSponsor = member.role === 'sponsor'
  const selectId = `member-${member.id}-sponsor`
  return (
    <form action={linkMemberToSponsor.bind(null, member.id)} className="flex flex-wrap items-center justify-end gap-2">
      <label htmlFor={selectId} className="sr-only">
        Sponsor listing for {member.name}
      </label>
      <select
        id={selectId}
        name="sponsorId"
        required
        defaultValue={isSponsor && member.sponsorId ? String(member.sponsorId) : ''}
        className={selectClass}
      >
        <option value="" disabled>
          Choose a listing
        </option>
        {sponsorOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <SubmitButton pendingLabel="Saving…" className={secondaryButtonClass}>
        {isSponsor ? 'Change listing ' : 'Make sponsor '}
        <span className="sr-only">for {member.name}</span>
      </SubmitButton>
    </form>
  )
}
