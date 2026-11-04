import type { Metadata } from 'next'
import Link from 'next/link'
import { guideLinkClass } from '@/components/help/guide-article'
import { focusRingClass } from '@/components/admin/styles'
import { PUBLIC_GUIDE_PDF } from '@/lib/guides'

export const metadata: Metadata = { title: 'Help | SHPE @ Colorado Mesa University' }

const guides = [
  {
    href: '/help/members',
    title: 'Member guide',
    description:
      'Create an account, confirm your email, choose your newsletters, RSVP to events, unsubscribe or delete your account.',
  },
  {
    href: '/help/sponsors',
    title: 'Sponsor guide',
    description: 'Get access to the sponsor portal, update your company’s listing, RSVP to events and download receipts.',
  },
]

export default function HelpPage() {
  return (
    <div>
      <section className="bg-cmu-maroon py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">Help</h1>
          <p className="text-gray-300">Step-by-step guides to using the SHPE @ CMU website.</p>
        </div>
      </section>
      <section className="bg-white dark:bg-gray-900 py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <ul className="grid gap-6 sm:grid-cols-2">
            {guides.map((guide) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className={`block h-full rounded-xl border border-gray-200 dark:border-gray-700 border-t-4 border-t-shpe-red p-6 shadow-sm transition-shadow hover:shadow-md ${focusRingClass}`}
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{guide.title}</h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{guide.description}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-gray-700 dark:text-gray-300">
            <a href={PUBLIC_GUIDE_PDF} className={guideLinkClass}>
              Download both guides as a PDF
            </a>{' '}
            to print or read offline.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Chapter officers: sign in and choose <strong>Help</strong> in the admin sidebar for the officer guide.
            For anything else, use the{' '}
            <Link href="/contact" className={guideLinkClass}>
              Contact
            </Link>{' '}
            page.
          </p>
        </div>
      </section>
    </div>
  )
}
