import Link from 'next/link'
import { GuideBody, GuideContents } from '@/components/help/guide-article'
import { PUBLIC_GUIDE_PDF, type RenderedGuide } from '@/lib/guides'

export default function PublicGuidePage({ guide }: { guide: RenderedGuide }) {
  return (
    <div>
      <section className="bg-cmu-maroon py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">{guide.title}</h1>
          <p className="text-gray-300 text-sm">
            <Link href="/help" className="rounded underline hover:text-shpe-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-shpe-gold">
              All guides
            </Link>
            <span aria-hidden="true"> · </span>
            <a href={PUBLIC_GUIDE_PDF} className="rounded underline hover:text-shpe-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-shpe-gold">
              Download the guides as a PDF
            </a>
          </p>
        </div>
      </section>
      <section className="bg-white dark:bg-gray-900 py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <GuideContents guide={guide} id="guide-contents" />
          <GuideBody guide={guide} />
        </div>
      </section>
    </div>
  )
}
