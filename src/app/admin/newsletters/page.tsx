import Link from 'next/link'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import {
  bannerParams,
  formatSendTime,
  listNewsletters,
  newsletterErrorMessages,
  splitTopicNames,
  type NewsletterListRow,
} from '@/lib/newsletter-admin'
import { continueSending, deleteNewsletterDraft } from './actions'

// Server actions take their time limit from the page they are posted to.
export const maxDuration = 300

const linkClass = `rounded font-medium text-shpe-red dark:text-shpe-gold underline ${focusRingClass}`

function Results({ row }: { row: NewsletterListRow }) {
  return (
    <ul className="space-y-0.5">
      <li>{row.sentCount} sent</li>
      {row.failedCount > 0 && <li className="font-semibold text-red-700 dark:text-red-400">{row.failedCount} failed</li>}
      {row.unknownCount > 0 && (
        <li className="font-semibold text-amber-800 dark:text-amber-300">{row.unknownCount} unknown outcome</li>
      )}
      {row.skippedCount > 0 && <li>{row.skippedCount} skipped</li>}
      {row.remainingCount > 0 && <li>{row.remainingCount} not sent yet</li>}
    </ul>
  )
}

export default async function AdminNewslettersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const [searchParams, rows] = await Promise.all([props.searchParams, listNewsletters()])
  const { error, deleted } = bannerParams(searchParams)
  const drafts = rows.filter((row) => row.status === 'draft')
  const history = rows.filter((row) => row.status !== 'draft')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Newsletters</h1>
        <Link href="/admin/newsletters/new" className={`${primaryButtonClass} inline-block`}>
          New newsletter
        </Link>
      </div>

      <StatusBanner saved={deleted} error={error} errorMessages={newsletterErrorMessages} savedMessage="Draft deleted." />

      <section className={cardClass} aria-labelledby="drafts-heading">
        <h2 id="drafts-heading" className={sectionHeadingClass}>
          Drafts
        </h2>
        {drafts.length === 0 ? (
          <p className={`mt-2 ${mutedTextClass}`}>No drafts.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
            {drafts.map((draft) => {
              const name = draft.subject || 'Untitled draft'
              return (
                <li key={draft.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/newsletters/${draft.id}`} className={linkClass}>
                      {name}
                    </Link>
                    <p className={mutedTextClass}>
                      {draft.draftTopicNames ? `Topics: ${draft.draftTopicNames}` : 'No topics chosen'} · Last saved{' '}
                      {formatSendTime(draft.updatedAt)}
                    </p>
                  </div>
                  <form action={deleteNewsletterDraft.bind(null, draft.id)}>
                    <DeleteButton name={name} />
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={`${cardClass} overflow-x-auto`} aria-labelledby="history-heading">
        <h2 id="history-heading" className={sectionHeadingClass}>
          Sent newsletters
        </h2>
        {history.length === 0 ? (
          <p className={`mt-2 ${mutedTextClass}`}>Nothing has been sent yet.</p>
        ) : (
          <table className={`mt-3 ${tableClass}`}>
            <caption className="sr-only">Sent newsletters, newest first</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">Subject</th>
                <th scope="col" className="py-2 pr-4 font-medium">Topics</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sent</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sent by</th>
                <th scope="col" className="py-2 pr-4 font-medium">Recipients</th>
                <th scope="col" className="py-2 font-medium">Results</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className={`${tableRowClass} align-top`}>
                  <td className="py-3 pr-4">
                    <Link href={`/admin/newsletters/${row.id}`} className={linkClass}>
                      {row.subject}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{splitTopicNames(row.topicNames).join(', ')}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {row.status === 'sending' ? (
                      <span className="font-semibold text-amber-800 dark:text-amber-300">Sending…</span>
                    ) : (
                      formatSendTime(row.sentAt)
                    )}
                  </td>
                  <td className="py-3 pr-4">{row.sentByName ?? '—'}</td>
                  <td className="py-3 pr-4">{row.recipientCount ?? 0}</td>
                  <td className="py-3">
                    <Results row={row} />
                    {row.status === 'sending' && (
                      <form action={continueSending.bind(null, row.id)} className="mt-2">
                        <SubmitButton pendingLabel="Sending…" className={secondaryButtonClass}>
                          Continue sending<span className="sr-only">: {row.subject}</span>
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
