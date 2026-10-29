import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass } from '@/components/admin/styles'
import AccountForm from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { memberTokenParam } from '@/lib/member-tokens'
import { confirmEmailChangeFromLink } from './actions'

export const metadata: Metadata = { title: 'Confirm your new email | SHPE @ Colorado Mesa University' }

const accountLink = (
  <Link href="/account" className={accountLinkClass}>
    Go to your account
  </Link>
)

/** Mail scanners open links in incoming email, so only the form's POST uses the token. */
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

  const validToken = !params.invalid && memberTokenParam.safeParse(params.token).success ? params.token : null
  if (!validToken) {
    return (
      <AccountShell title="This link doesn't work">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>
            This email change link has expired, was already used, was replaced by a newer request, or was copied
            incompletely. Your email address hasn&apos;t changed.
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
        <p>
          Confirm that this is the new email address for your SHPE @ CMU account. You&apos;ll be signed out
          everywhere and can then sign in with the new address.
        </p>
      }
    >
      <AccountForm
        action={confirmEmailChangeFromLink}
        fields={[]}
        hidden={{ token: validToken }}
        submitLabel="Confirm my new email"
        pendingLabel="Confirming…"
      />
    </AccountShell>
  )
}
