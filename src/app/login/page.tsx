import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { currentAdmin } from '@/lib/admin'
import { currentMember } from '@/lib/member'
import SubmitButton from '@/components/submit-button'
import {
  cardClass,
  focusRingClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/admin/styles'

export const metadata: Metadata = { title: 'Sign in | SHPE @ Colorado Mesa University' }

const ERROR_ID = 'login-error'

const statusMessages = {
  changed: 'Your password was changed — sign in with the new password.',
  confirmed: 'Your email is confirmed — sign in to continue.',
  reset: 'Your password was reset — sign in with the new password.',
} as const

const linkClass = `rounded text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`

function statusMessage(params: Partial<Record<keyof typeof statusMessages, string>>) {
  const key = (Object.keys(statusMessages) as (keyof typeof statusMessages)[]).find((name) => params[name])
  return key ? statusMessages[key] : null
}

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; changed?: string; confirmed?: string; reset?: string }>
}) {
  if (await currentAdmin()) redirect('/admin')
  if (await currentMember()) redirect('/account')

  const { error, ...statusParams } = await props.searchParams
  const status = error ? null : statusMessage(statusParams)
  const fieldErrorProps = error ? { 'aria-invalid': true, 'aria-describedby': ERROR_ID } : {}

  async function login(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: '/login',
      })
    } catch (err) {
      if (err instanceof AuthError) {
        redirect('/login?error=1')
      }
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-20">
      <form action={login} className={`mx-auto w-full max-w-sm space-y-5 ${cardClass}`}>
        <Link
          href="/"
          className={`inline-flex items-center gap-1 rounded text-sm text-gray-500 dark:text-gray-400 hover:text-shpe-red dark:hover:text-shpe-gold ${focusRingClass}`}
        >
          <span aria-hidden="true">&larr;</span> Back to site
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
        {status && (
          <p
            role="status"
            className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-400"
          >
            {status}
          </p>
        )}
        {error && (
          <p
            id={ERROR_ID}
            role="alert"
            className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
          >
            Invalid email or password.
          </p>
        )}
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            {...fieldErrorProps}
          />
        </label>
        <label className={labelClass}>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            {...fieldErrorProps}
          />
        </label>
        <SubmitButton pendingLabel="Signing in…" className={`w-full ${primaryButtonClass}`}>
          Sign in
        </SubmitButton>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li>
            <Link href="/forgot-password" className={linkClass}>
              Forgot password?
            </Link>
          </li>
          <li>
            No account yet?{' '}
            <Link href="/join" className={linkClass}>
              Create an account
            </Link>
          </li>
          <li>
            <Link href="/join/resend" className={linkClass}>
              Didn&apos;t get the confirmation email?
            </Link>
          </li>
        </ul>
      </form>
    </div>
  )
}
