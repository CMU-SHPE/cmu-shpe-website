import type { Metadata } from 'next'
import Link from 'next/link'
import AccountForm, { type AccountField } from '@/components/member/account-form'
import AccountShell, { accountLinkClass } from '@/components/member/account-shell'
import { MAX_MEMBER_NAME_LENGTH } from '@/lib/member-account'
import { PASSWORD_REQUIREMENTS } from '@/lib/member-accounts'
import { signUp } from './actions'

export const metadata: Metadata = { title: 'Create an account | SHPE @ Colorado Mesa University' }

const fields: AccountField[] = [
  { name: 'name', label: 'Name', type: 'text', autoComplete: 'name', maxLength: MAX_MEMBER_NAME_LENGTH },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: PASSWORD_REQUIREMENTS },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  { name: 'ageConfirmed', label: 'I am 13 or older', type: 'checkbox' },
  {
    name: 'termsAccepted',
    type: 'checkbox',
    label: 'I agree to the Terms of Use and Privacy Policy',
    // Links inside a label make the whole label a mix of click targets, so they sit in the hint.
    hint: (
      <>
        Read the{' '}
        <Link href="/terms" className={accountLinkClass}>
          Terms of Use
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className={accountLinkClass}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
]

export default function JoinPage() {
  return (
    <AccountShell
      title="Create an account"
      intro={
        <p>
          A supporter account lets you choose which SHPE @ CMU newsletters you get. Already have one?{' '}
          <Link href="/login" className={accountLinkClass}>
            Sign in
          </Link>
          .
        </p>
      }
    >
      <AccountForm action={signUp} fields={fields} submitLabel="Create account" pendingLabel="Creating account…" />
    </AccountShell>
  )
}
