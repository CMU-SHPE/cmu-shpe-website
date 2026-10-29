import type { Metadata } from 'next'
import Link from 'next/link'
import { cardClass, mutedTextClass, pageHeadingClass } from '@/components/admin/styles'
import { GuideBody, GuideContents, guideLinkClass } from '@/components/help/guide-article'
import { requireAdmin } from '@/lib/admin'
import { OFFICER_HANDBOOK_PDF, loadGuide } from '@/lib/guides'

export const metadata: Metadata = { title: 'Help | Admin' }

export default async function AdminHelpPage() {
  await requireAdmin()
  const guide = await loadGuide('officers')

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageHeadingClass}>{guide.title}</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          <a href={OFFICER_HANDBOOK_PDF} className={guideLinkClass}>
            Download the officer handbook (PDF)
          </a>
          <span aria-hidden="true"> · </span>
          <Link href="/help" className={guideLinkClass}>
            Member and sponsor guides
          </Link>
        </p>
      </div>
      <GuideContents guide={guide} id="officer-guide-contents" />
      <section className={cardClass} aria-label={guide.title}>
        <GuideBody guide={guide} />
      </section>
    </div>
  )
}
