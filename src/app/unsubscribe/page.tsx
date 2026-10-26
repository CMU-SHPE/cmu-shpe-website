import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass } from '@/components/admin/styles'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { resolveUnsubscribeToken } from '@/lib/newsletter-unsubscribe'
import { listTopics } from './topic-list'
import UnsubscribeForms from './unsubscribe-forms'

// The token is in the URL, so it must not leak to other sites through the Referer header.
export const metadata: Metadata = {
  title: 'Unsubscribe | SHPE @ CMU',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/**
 * Opening the link only shows forms. Mail scanners fetch links in incoming email, so nothing
 * changes until a form is posted (or a mail provider uses the separate one-click endpoint).
 */
export default async function UnsubscribePage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams
  const target = typeof token === 'string' ? await resolveUnsubscribeToken(token) : null

  if (!target || typeof token !== 'string') {
    return (
      <AccountShell title="This link doesn't work">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>This unsubscribe link is not valid. It may have been copied incompletely.</p>
          <p>
            You can also manage your newsletters from{' '}
            <Link href="/account" className={accountLinkClass}>
              your account
            </Link>
            .
          </p>
        </div>
      </AccountShell>
    )
  }

  const inScope = target.subscribedInScope.map((topic) => topic.name)
  const others = target.otherSubscriptions.map((topic) => topic.name)
  const sentFor = listTopics(target.newsletterTopicNames)

  return (
    <AccountShell
      title="Unsubscribe from SHPE @ CMU newsletters"
      intro={<p>For the account {target.maskedEmail}.</p>}
    >
      {inScope.length === 0 && (
        <p role="status" className={`text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          {others.length === 0
            ? 'You’re already unsubscribed from all SHPE @ CMU newsletters.'
            : `You’re already unsubscribed from ${sentFor || 'the topics this email was sent for'}.`}
        </p>
      )}
      <UnsubscribeForms token={token} inScope={inScope} others={others} />
      <p className="text-sm text-gray-600 dark:text-gray-300">
        To choose topics instead,{' '}
        <Link href="/account" className={accountLinkClass}>
          manage your newsletters
        </Link>{' '}
        after signing in.
      </p>
    </AccountShell>
  )
}
