import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass, focusRingClass, pageHeadingClass } from '@/components/admin/styles'

export const metadata: Metadata = { title: 'Account deleted | SHPE @ Colorado Mesa University' }

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-20">
      <section className={`mx-auto w-full max-w-lg space-y-3 ${cardClass}`}>
        <h1 className={pageHeadingClass}>Your account has been deleted</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Your account and newsletter choices are gone, and you have been signed out.
        </p>
        <p>
          <Link
            href="/"
            className={`rounded font-medium text-shpe-red underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ${focusRingClass}`}
          >
            Back to the home page
          </Link>
        </p>
      </section>
    </div>
  )
}
