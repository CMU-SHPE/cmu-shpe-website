import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubmitButton from '@/components/submit-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import type { NewsletterRecipientStatus } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import {
  bannerParams,
  describeRecipientResult,
  formatSendTime,
  getNewsletter,
  getNewsletterRecipients,
  getTopicsWithConfirmedSubscriberCounts,
  newsletterErrorMessages,
  newsletterProgressMessages,
  previewSiteUrl,
  splitTopicNames,
  type NewsletterDetail,
  type NewsletterRecipientRow,
} from '@/lib/newsletter-admin'
import { renderNewsletter } from '@/lib/newsletter-render'
import { testAudienceOnly } from '@/lib/newsletter-audience'
import { getSiteSettings } from '@/lib/queries'
import Composer from '../composer'
import { continueSending, reviewNewsletter, saveNewsletter, sendTestNewsletter } from '../actions'

// Server actions take their time limit from the page they are posted to.
export const maxDuration = 300

type SearchParams = Record<string, string | string[] | undefined>

const backLinkClass = `rounded text-sm font-medium text-shpe-red dark:text-shpe-gold ${focusRingClass}`

function isProblem(row: NewsletterRecipientRow) {
  return row.status === 'failed'
}

function tally(rows: NewsletterRecipientRow[]) {
  const counts: Record<NewsletterRecipientStatus | 'unknown', number> = {
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    unknown: 0,
  }
  for (const row of rows) {
    if (row.status === 'failed' && row.errorCode === 'unknown_outcome') counts.unknown += 1
    else counts[row.status] += 1
  }
  return counts
}

function resultClass(row: NewsletterRecipientRow) {
  if (row.status === 'sent') return ''
  if (row.status === 'failed') {
    return row.errorCode === 'unknown_outcome'
      ? 'font-semibold text-amber-800 dark:text-amber-300'
      : 'font-semibold text-red-700 dark:text-red-400'
  }
  return 'text-gray-600 dark:text-gray-400'
}

async function draftView(newsletter: NewsletterDetail, searchParams: SearchParams) {
  const admin = await requireAdmin()
  const [topics, settings] = await Promise.all([getTopicsWithConfirmedSubscriberCounts(), getSiteSettings()])
  const { saved, tested, error } = bannerParams(searchParams)

  return (
    <div className="space-y-6">
      <Link href="/admin/newsletters" className={backLinkClass}>
        ← All newsletters
      </Link>
      <h1 className={pageHeadingClass}>Edit draft</h1>
      <StatusBanner
        saved={saved ?? tested}
        error={error}
        errorMessages={newsletterErrorMessages}
        savedMessage={tested ? `Draft saved and a test sent to ${admin.user.email}.` : 'Draft saved.'}
      />
      <Composer
        draft={{ subject: newsletter.subject, body: newsletter.body, topicIds: newsletter.topicIds }}
        topics={topics}
        mailingAddress={settings?.mailingAddress ?? ''}
        siteUrl={previewSiteUrl()}
        adminEmail={admin.user.email ?? 'your email'}
        testAudienceOnly={testAudienceOnly()}
        save={saveNewsletter.bind(null, newsletter.id)}
        sendTest={sendTestNewsletter.bind(null, newsletter.id)}
        review={reviewNewsletter.bind(null, newsletter.id)}
      />
    </div>
  )
}

async function sentView(newsletter: NewsletterDetail, searchParams: SearchParams) {
  const recipients = await getNewsletterRecipients(newsletter.id)
  const counts = tally(recipients)
  const { sent, progress, error } = bannerParams(searchParams)
  const topicNames = splitTopicNames(newsletter.topicNames)
  const deletedAccounts = Math.max(0, (newsletter.recipientCount ?? 0) - recipients.length)
  const problems = recipients.filter(isProblem)
  const sending = newsletter.status === 'sending'
  const preview = renderNewsletter({
    subject: newsletter.subject,
    body: newsletter.body,
    topicNames,
    mailingAddress: newsletter.mailingAddress ?? '',
    siteUrl: newsletter.siteUrl ?? '',
    unsubscribe: { sample: true },
  })

  const summary: [string, number][] = [
    ['Sent', counts.sent],
    ['Failed', counts.failed],
    ['Unknown outcome', counts.unknown],
    ['Skipped (unsubscribed or unconfirmed before their turn)', counts.skipped],
    ['Not sent yet', counts.pending + counts.sending],
    ['Accounts deleted since sending started', deletedAccounts],
  ]

  return (
    <div className="space-y-6">
      <Link href="/admin/newsletters" className={backLinkClass}>
        ← All newsletters
      </Link>
      <h1 className={pageHeadingClass}>{newsletter.subject}</h1>

      <StatusBanner error={error} errorMessages={newsletterErrorMessages} />
      {sent && !error && (
        <p
          role="status"
          className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-400"
        >
          Sending finished: {counts.sent} accepted by the email service.{' '}
          {counts.failed + counts.unknown > 0
            ? `${counts.failed + counts.unknown} did not go through for certain — see the list below.`
            : 'None failed.'}
        </p>
      )}
      {progress && sending && Object.hasOwn(newsletterProgressMessages, progress) && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          {newsletterProgressMessages[progress]}
        </p>
      )}

      <section className={cardClass} aria-labelledby="summary-heading">
        <h2 id="summary-heading" className={sectionHeadingClass}>
          {sending ? 'Sending in progress' : 'Summary'}
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-gray-700 dark:text-gray-300">{sending ? 'Started' : 'Sent'}</dt>
          <dd className="text-gray-900 dark:text-white">
            {formatSendTime(sending ? newsletter.sendStartedAt : newsletter.sentAt)}
          </dd>
          <dt className="font-medium text-gray-700 dark:text-gray-300">Sent by</dt>
          <dd className="text-gray-900 dark:text-white">{newsletter.sentByName ?? '—'}</dd>
          <dt className="font-medium text-gray-700 dark:text-gray-300">Topics</dt>
          <dd className="text-gray-900 dark:text-white">{topicNames.join(', ')}</dd>
          <dt className="font-medium text-gray-700 dark:text-gray-300">Recipients when sending started</dt>
          <dd className="text-gray-900 dark:text-white">{newsletter.recipientCount ?? 0}</dd>
          {summary.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="font-medium text-gray-700 dark:text-gray-300">{label}</dt>
              <dd className="text-gray-900 dark:text-white">{value}</dd>
            </Fragment>
          ))}
        </dl>
        {sending && (
          <form action={continueSending.bind(null, newsletter.id)} className="mt-4">
            <SubmitButton pendingLabel="Sending…" className={primaryButtonClass}>
              Continue sending
            </SubmitButton>
          </form>
        )}
      </section>

      {problems.length > 0 && (
        <section className={cardClass} aria-labelledby="problems-heading">
          <h2 id="problems-heading" className="text-lg font-semibold text-red-700 dark:text-red-400">
            Not delivered for certain ({problems.length})
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {problems.map((row) => (
              <li key={row.id}>
                <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>{' '}
                <span className="break-all">&lt;{row.email}&gt;</span>: {describeRecipientResult(row.status, row.errorCode)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${cardClass} overflow-x-auto`} aria-labelledby="recipients-heading">
        <h2 id="recipients-heading" className={sectionHeadingClass}>
          Recipients
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>Members who have since deleted their account are not listed.</p>
        {recipients.length === 0 ? (
          <p className={`mt-3 ${mutedTextClass}`}>No recipients to show.</p>
        ) : (
          <table className={`mt-3 ${tableClass}`}>
            <caption className="sr-only">Recipients and what happened to each email, problems first</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                <th scope="col" className="py-2 pr-4 font-medium">Email</th>
                <th scope="col" className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.name}</td>
                  <td className="py-2 pr-4 break-all">{row.email}</td>
                  <td className={`py-2 ${resultClass(row)}`}>{describeRecipientResult(row.status, row.errorCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={cardClass} aria-labelledby="sent-preview-heading">
        <h2 id="sent-preview-heading" className={sectionHeadingClass}>
          What was sent
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>Each recipient’s copy had their own unsubscribe link.</p>
        <iframe
          sandbox=""
          srcDoc={preview.html}
          title="Newsletter preview"
          className="mt-3 h-[32rem] w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
        />
      </section>
    </div>
  )
}

export default async function NewsletterPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  await requireAdmin()
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams])
  const parsed = recordId.safeParse(id)
  if (!parsed.success) notFound()
  const newsletter = await getNewsletter(parsed.data)
  if (!newsletter) notFound()

  return newsletter.status === 'draft' ? draftView(newsletter, searchParams) : sentView(newsletter, searchParams)
}
