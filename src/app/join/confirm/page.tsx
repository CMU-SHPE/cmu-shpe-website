import type { Metadata } from 'next'
import Link from 'next/link'
import SubmitButton from '@/components/submit-button'
import { cardClass, primaryButtonClass } from '@/components/admin/styles'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { memberTokenParam } from '@/lib/member-tokens'
import { confirmMemberEmail } from './actions'

export const metadata: Metadata = { title: 'Confirm your email | SHPE @ Colorado Mesa University' }

/**
 * Opening the link only shows a button. Mail scanners fetch links in incoming email, so
 * the token is used up by the button's POST, never by the GET.
 */
export default async function ConfirmEmailPage(props: {
  searchParams: Promise<{ token?: string; invalid?: string }>
}) {
  const { token, invalid } = await props.searchParams
  const validToken = !invalid && memberTokenParam.safeParse(token).success ? token : null

  if (!validToken) {
    return (
      <AccountShell title="This link doesn't work">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>This confirmation link has expired, was already used, or was copied incompletely.</p>
          <p>
            <Link href="/join/resend" className={accountLinkClass}>
              Send me a new confirmation link
            </Link>
          </p>
        </div>
      </AccountShell>
    )
  }

  return (
    <AccountShell
      title="Confirm your email"
      intro={<p>One more step: confirm this is your email address to finish creating your account.</p>}
    >
      <form action={confirmMemberEmail} className={cardClass}>
        <input type="hidden" name="token" value={validToken} />
        <SubmitButton pendingLabel="Confirming…" className={`w-full ${primaryButtonClass}`}>
          Confirm my email
        </SubmitButton>
      </form>
    </AccountShell>
  )
}
