import SubmitButton from '@/components/submit-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/admin-account'
import { WINDOW_MINUTES } from '@/lib/login-throttle'
import { changePassword } from './actions'

const errorMessages: Record<string, string> = {
  invalid: 'Please enter your current password.',
  password: `New passwords must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} bytes. Accented letters and emoji count as 2 to 4 bytes each.`,
  mismatch: 'The new password and its confirmation do not match.',
  same: 'Choose a new password that is different from your current one.',
  current: 'Your current password is incorrect.',
  throttled: `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`,
}

export default async function AccountPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const session = await requireAdmin()
  const { saved, error } = await props.searchParams

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Change password</h1>

      <StatusBanner
        saved={saved}
        error={error}
        errorMessages={errorMessages}
        savedMessage="Password changed. Any other devices signed in to this account have been signed out."
      />

      <section className={cardClass} aria-labelledby="change-password-heading">
        <h2 id="change-password-heading" className={sectionHeadingClass}>
          Your password
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Changing your password keeps you signed in here and signs you out everywhere else.
        </p>
        <form action={changePassword} className="mt-4 max-w-md space-y-4">
          <input type="email" name="username" value={session.user.email ?? ''} autoComplete="username" readOnly hidden />
          <label className={labelClass}>
            Current password
            <input
              name="currentPassword"
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            New password ({MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_BYTES} characters)
            <input
              name="newPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_BYTES}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_BYTES}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <SubmitButton pendingLabel="Changing…" className={primaryButtonClass}>
            Change password
          </SubmitButton>
        </form>
      </section>
    </div>
  )
}
