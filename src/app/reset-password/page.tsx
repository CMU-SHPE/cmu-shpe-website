import type { Metadata } from 'next'
import ResetPasswordView from './reset-password-view'
import { resetMemberPassword } from './actions'

export const metadata: Metadata = { title: 'Choose a new password | SHPE @ Colorado Mesa University' }

export default async function ResetPasswordPage(props: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await props.searchParams
  return <ResetPasswordView token={token} action={resetMemberPassword} />
}
