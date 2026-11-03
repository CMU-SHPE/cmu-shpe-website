import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass } from '@/components/admin/styles'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { findEmailChange } from '@/lib/member-email-change'
import { confirmEmailChangeFromLink } from './actions'

export const metadata: Metadata = { title: 'Confirm your new email | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [
  { name: 'password', label: 'Current password', type: 'password', autoComplete: 'current-password' },
]

const accountLink = (
  <Link href="/account" className={accountLinkClass}>
    Go to your account
  </Link>
)

/**
 * Mail scanners open links in incoming email, so only the form's POST uses the token. The account's
 * own email stays off this page, since the link may have reached someone else's inbox.
 */
export default async function ConfirmEmailChangePage(props: {
  searchParams: Promise<{ token?: string; invalid?: string; 'in-use'?: string }>
}) {
  const params = await props.searchParams

  if (params['in-use']) {
    return (
      <AccountShell title="This email address can't be used">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>
            That address already belongs to another account, so your email address hasn&apos;t changed. Sign in with
            your current email address to choose a different one.
          </p>
          <p>{accountLink}</p>
        </div>
      </AccountShell>
    )
  }

  const pending = !params.invalid && params.token ? await findEmailChange(params.token) : null
  if (!pending || !params.token) {
    return (
      <AccountShell title="This link doesn't work">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>
            This email change link has expired, was already used, was replaced by a newer request, or was copied
            incompletely.
          </p>
          <p>{accountLink}</p>
        </div>
      </AccountShell>
    )
  }

  return (
    <AccountShell
      title="Confirm your new email"
      intro={
        <>
          <p>
            Enter your current password to make <strong>{pending.newEmail}</strong> the email address for your SHPE @
            CMU account. You&apos;ll be signed out everywhere and can then sign in with the new address.
          </p>
          <p>If you didn&apos;t ask for this, close this page. Nothing will change.</p>
        </>
      }
    >
      <AccountForm
        action={confirmEmailChangeFromLink}
        fields={fields}
        hidden={{ token: params.token }}
        submitLabel="Confirm my new email"
        pendingLabel="Confirming…"
      />
    </AccountShell>
  )
}
