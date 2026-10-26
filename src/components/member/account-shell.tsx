import Link from 'next/link'
import { focusRingClass } from '@/components/admin/styles'

export const accountLinkClass = `rounded text-shpe-red dark:text-shpe-gold underline hover:no-underline ${focusRingClass}`

export default function AccountShell({
  title,
  intro,
  children,
}: {
  title: string
  intro?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-20">
      <div className="mx-auto w-full max-w-md space-y-5">
        <Link
          href="/"
          className={`inline-flex items-center gap-1 rounded text-sm text-gray-500 dark:text-gray-400 hover:text-shpe-red dark:hover:text-shpe-gold ${focusRingClass}`}
        >
          <span aria-hidden="true">&larr;</span> Back to site
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {intro && <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">{intro}</div>}
        {children}
      </div>
    </div>
  )
}
