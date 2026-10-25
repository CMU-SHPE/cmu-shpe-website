import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass } from '@/components/admin/styles'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'

export const metadata: Metadata = { title: 'Check your inbox | SHPE @ Colorado Mesa University' }

export default function CheckEmailPage() {
  return (
    <AccountShell title="Check your inbox">
      <div role="status" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
        <p>We&apos;ve sent an email to the address you entered. Open it to finish creating your account.</p>
        <p>The confirmation link works for 24 hours. If you don&apos;t see the email in a few minutes, check your spam folder.</p>
        <p>
          <Link href="/join/resend" className={accountLinkClass}>
            Send me a new confirmation link
          </Link>
        </p>
      </div>
    </AccountShell>
  )
}
