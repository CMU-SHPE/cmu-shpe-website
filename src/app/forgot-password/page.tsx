import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import FocusOnMount from '@/components/focus-on-mount'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import StatusBanner from '@/components/admin/status-banner'
import { requestPasswordReset } from './actions'

export const metadata: Metadata = { title: 'Forgot your password? | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]

export default async function ForgotPasswordPage(props: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await props.searchParams
  // Every submit redirects to this same URL, so a key fresh on each render is what lets a
  // second request remount the notice, move focus to it again and clear any earlier error.
  const renderKey = randomUUID()

  return (
    <AccountShell
      title="Forgot your password?"
      intro={<p>Enter your account email and we&apos;ll send you a link to choose a new password.</p>}
    >
      {sent && (
        <FocusOnMount key={`notice-${renderKey}`} id="request-sent">
          <StatusBanner
            live={false}
            saved="sent"
            errorMessages={{}}
            savedMessage="If an account exists for that email, we've sent a reset link. The email says how long it works."
          />
        </FocusOnMount>
      )}
      <AccountForm
        key={`form-${renderKey}`}
        action={requestPasswordReset}
        fields={fields}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Remembered it?{' '}
        <Link href="/login" className={accountLinkClass}>
          Sign in
        </Link>
      </p>
    </AccountShell>
  )
}
