import type { Metadata } from 'next'
import Link from 'next/link'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { cardClass } from '@/components/admin/styles'
import { requestPasswordReset } from './actions'

export const metadata: Metadata = { title: 'Forgot your password? | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]

export default async function ForgotPasswordPage(props: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await props.searchParams

  return (
    <AccountShell
      title="Forgot your password?"
      intro={
        <>
          <p>Enter your account email and we&apos;ll send you a link to choose a new password.</p>
          <p>Site admins: ask the master admin to reset your password.</p>
        </>
      }
    >
      {sent && (
        <p role="status" className={`text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          If an account exists for that email, we&apos;ve sent a reset link. It works for 1 hour.
        </p>
      )}
      <AccountForm action={requestPasswordReset} fields={fields} submitLabel="Send reset link" pendingLabel="Sending…" />
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Remembered it?{' '}
        <Link href="/login" className={accountLinkClass}>
          Sign in
        </Link>
      </p>
    </AccountShell>
  )
}
