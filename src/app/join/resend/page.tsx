import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import FocusOnMount from '@/components/focus-on-mount'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import StatusBanner from '@/components/admin/status-banner'
import { resendConfirmation } from './actions'

export const metadata: Metadata = { title: 'Resend confirmation email | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]

export default async function ResendConfirmationPage(props: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await props.searchParams
  // Every submit redirects to this same URL, so a key fresh on each render is what lets a
  // second request remount the notice, move focus to it again and clear any earlier error.
  const renderKey = randomUUID()

  return (
    <AccountShell
      title="Resend confirmation email"
      intro={<p>Enter the email you signed up with and we&apos;ll send a new confirmation link. Older links stop working.</p>}
    >
      {sent && (
        <FocusOnMount key={`notice-${renderKey}`} id="request-sent">
          <StatusBanner
            live={false}
            saved="sent"
            errorMessages={{}}
            savedMessage="If an unconfirmed account exists for that email, we've sent a new confirmation link. It works for 24 hours."
          />
        </FocusOnMount>
      )}
      <AccountForm
        key={`form-${renderKey}`}
        action={resendConfirmation}
        fields={fields}
        submitLabel="Send a new link"
        pendingLabel="Sending…"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Already confirmed?{' '}
        <Link href="/login" className={accountLinkClass}>
          Sign in
        </Link>
      </p>
    </AccountShell>
  )
}
