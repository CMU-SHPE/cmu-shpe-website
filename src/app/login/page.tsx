import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { currentAdmin } from '@/lib/admin'
import SubmitButton from '@/components/submit-button'
import { cardClass, inputClass, labelClass, primaryButtonClass } from '@/components/admin/styles'

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; changed?: string }>
}) {
  if (await currentAdmin()) redirect('/admin')

  const { error, changed } = await props.searchParams

  async function login(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: '/admin',
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-shpe-red dark:hover:text-shpe-gold"
        >
          <span aria-hidden="true">&larr;</span> Back to site
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin sign in</h1>
        {changed && !error && (
          <p
            role="status"
            className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-400"
          >
            Your password was changed — sign in with the new password.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
          >
            Invalid email or password.
          </p>
        )}
        <label className={labelClass}>
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className={labelClass}>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <SubmitButton pendingLabel="Signing in…" className={`w-full ${primaryButtonClass}`}>
          Sign in
        </SubmitButton>
      </form>
    </div>
  )
}
