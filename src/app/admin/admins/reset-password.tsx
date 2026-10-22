import SubmitButton from '@/components/submit-button'
import {
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  primaryButtonClass,
} from '@/components/admin/styles'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/admin-account'
import { resetAdminPassword } from './actions'

export const linkClass = `rounded text-sm font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`

export default function ResetPassword({ id, name, email }: { id: number; name: string; email: string }) {
  return (
    <details className="text-left">
      <summary className={`cursor-pointer ${linkClass}`}>
        {'Reset password '}
        <span className="sr-only">for {name}</span>
      </summary>
      <form action={resetAdminPassword.bind(null, id)} className="mt-3 w-64 space-y-3">
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <p className={mutedTextClass}>Share the new password with them directly — there is no email.</p>
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
        <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
          {'Set new password '}
          <span className="sr-only">for {name}</span>
        </SubmitButton>
      </form>
    </details>
  )
}
