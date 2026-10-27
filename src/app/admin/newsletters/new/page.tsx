import Link from 'next/link'
import StatusBanner from '@/components/admin/status-banner'
import { focusRingClass, pageHeadingClass } from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import {
  bannerParams,
  getTopicsWithConfirmedSubscriberCounts,
  newsletterErrorMessages,
  previewSiteUrl,
} from '@/lib/newsletter-admin'
import { testAudienceOnly } from '@/lib/newsletter-audience'
import { getSiteSettings } from '@/lib/queries'
import Composer from '../composer'
import { reviewNewsletter, saveNewsletter, sendTestNewsletter } from '../actions'

export default async function NewNewsletterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdmin()
  const [searchParams, topics, settings] = await Promise.all([
    props.searchParams,
    getTopicsWithConfirmedSubscriberCounts(),
    getSiteSettings(),
  ])
  const { error } = bannerParams(searchParams)

  return (
    <div className="space-y-6">
      <Link href="/admin/newsletters" className={`rounded text-sm font-medium text-shpe-red dark:text-shpe-gold ${focusRingClass}`}>
        ← All newsletters
      </Link>
      <h1 className={pageHeadingClass}>New newsletter</h1>
      <StatusBanner error={error} errorMessages={newsletterErrorMessages} />
      <Composer
        draft={{ subject: '', body: '', topicIds: [] }}
        topics={topics}
        mailingAddress={settings?.mailingAddress ?? ''}
        siteUrl={previewSiteUrl()}
        adminEmail={admin.user.email ?? 'your email'}
        testAudienceOnly={testAudienceOnly()}
        save={saveNewsletter.bind(null, null)}
        sendTest={sendTestNewsletter.bind(null, null)}
        review={reviewNewsletter.bind(null, null)}
      />
    </div>
  )
}
