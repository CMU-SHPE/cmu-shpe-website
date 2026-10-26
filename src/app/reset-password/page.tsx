import type { Metadata } from 'next'
import Link from 'next/link'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { cardClass } from '@/components/admin/styles'
import { PASSWORD_REQUIREMENTS } from '@/lib/member-accounts'
import { memberTokenParam } from '@/lib/member-tokens'
import { resetMemberPassword } from './actions'

export const metadata: Metadata = { title: 'Choose a new password | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [
  { name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', hint: PASSWORD_REQUIREMENTS },
  { name: 'confirmPassword', label: 'Confirm new password', type: 'password', autoComplete: 'new-password' },
]

const newLink = (
  <Link href="/forgot-password" className={accountLinkClass}>
    Send me a new reset link
  </Link>
)

/** Like email confirmation, opening the link never uses the token; submitting the form does. */
export default async function ResetPasswordPage(props: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await props.searchParams
  const validToken = memberTokenParam.safeParse(token).success ? token : null

  if (!validToken) {
    return (
      <AccountShell title="This link doesn't work">
        <div role="alert" className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass}`}>
          <p>This reset link has expired, was already used, or was copied incompletely.</p>
          <p>{newLink}</p>
        </div>
      </AccountShell>
    )
  }

  return (
    <AccountShell
      title="Choose a new password"
      intro={<p>Choosing a new password signs you out on every other device.</p>}
    >
      <AccountForm
        action={resetMemberPassword}
        fields={fields}
        hidden={{ token: validToken }}
        submitLabel="Save new password"
        pendingLabel="Saving…"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300">Link not working? {newLink}</p>
    </AccountShell>
  )
}
