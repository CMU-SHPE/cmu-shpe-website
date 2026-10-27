import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import SubmitButton from '@/components/submit-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import {
  bannerParams,
  countNewsletterAudience,
  getNewsletter,
  newsletterErrorMessages,
  previewSiteUrl,
} from '@/lib/newsletter-admin'
import { testAudienceOnly } from '@/lib/newsletter-audience'
import { TEST_AUDIENCE_NOTICE } from '@/lib/newsletter-limits'
import { newsletterSubject, renderNewsletter } from '@/lib/newsletter-render'
import { loadSendSnapshot } from '@/lib/newsletter-send'
import { sendNewsletter } from '../../actions'

// Server actions take their time limit from the page they are posted to.
export const maxDuration = 300

function people(count: number) {
  return count === 1 ? '1 person' : `${count.toLocaleString('en-US')} people`
}

export default async function ConfirmSendPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams])
  const parsed = recordId.safeParse(id)
  if (!parsed.success) notFound()
  const newsletter = await getNewsletter(parsed.data)
  if (!newsletter) notFound()
  if (newsletter.status !== 'draft') redirect(`/admin/newsletters/${newsletter.id}`)

  const [audience, ready] = await Promise.all([countNewsletterAudience(newsletter.topicIds), loadSendSnapshot()])
  const { error } = bannerParams(searchParams)
  const blocker = ready.ok ? null : ready.blocker
  const incomplete = !newsletter.subject.trim() || !newsletter.body.trim() || newsletter.topicIds.length === 0
  const canSend = !blocker && !incomplete && audience > 0
  const preview = renderNewsletter({
    subject: newsletter.subject,
    body: newsletter.body,
    topicNames: newsletter.currentTopicNames,
    mailingAddress: ready.ok ? ready.snapshot.mailingAddress : '',
    siteUrl: ready.ok ? ready.snapshot.siteUrl : previewSiteUrl(),
    unsubscribe: { sample: true },
  })

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/newsletters/${newsletter.id}`}
        className={`rounded text-sm font-medium text-shpe-red dark:text-shpe-gold ${focusRingClass}`}
      >
        ← Back to editing
      </Link>
      <h1 className={pageHeadingClass}>Send newsletter</h1>

      <StatusBanner error={error ?? blocker ?? (incomplete ? 'incomplete' : undefined)} errorMessages={newsletterErrorMessages} />

      {testAudienceOnly() && (
        <p
          role="note"
          className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-200"
        >
          {TEST_AUDIENCE_NOTICE}
        </p>
      )}

      {blocker === 'no_mailing_address' && (
        <p className="text-sm">
          <Link href="/admin/settings" className={`font-semibold text-shpe-red dark:text-shpe-gold underline rounded ${focusRingClass}`}>
            Go to Site settings to add the mailing address
          </Link>
        </p>
      )}

      <section className={`${cardClass} space-y-3`} aria-labelledby="confirm-heading">
        <h2 id="confirm-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          {audience === 0 ? 'No one to send to' : `This will email ${people(audience)} now`}
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-gray-700 dark:text-gray-300">Subject</dt>
          <dd className="text-gray-900 dark:text-white">{newsletterSubject(newsletter.subject) || '(no subject)'}</dd>
          <dt className="font-medium text-gray-700 dark:text-gray-300">Topics</dt>
          <dd className="text-gray-900 dark:text-white">{newsletter.currentTopicNames.join(', ') || '(none)'}</dd>
          <dt className="font-medium text-gray-700 dark:text-gray-300">Recipients</dt>
          <dd className="text-gray-900 dark:text-white">
            {people(audience)}: confirmed members subscribed to at least one of these topics, one email each
          </dd>
        </dl>
        <p className={mutedTextClass}>
          Sending can’t be undone or edited afterwards. Large lists go out in batches; if the page stops partway, you can
          continue from the newsletter’s page without anyone getting it twice.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {canSend && (
            <form action={sendNewsletter.bind(null, newsletter.id)}>
              <input type="hidden" name="expectedCount" value={audience} />
              <input type="hidden" name="reviewedAt" value={newsletter.updatedAt.toISOString()} />
              <SubmitButton pendingLabel="Sending…" className={primaryButtonClass}>
                Send to {people(audience)}
              </SubmitButton>
            </form>
          )}
          <Link href={`/admin/newsletters/${newsletter.id}`} className={`${secondaryButtonClass} inline-block`}>
            Cancel
          </Link>
        </div>
      </section>

      <section className={cardClass} aria-labelledby="confirm-preview-heading">
        <h2 id="confirm-preview-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          What will be sent
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>Each recipient’s copy has their own unsubscribe link.</p>
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
