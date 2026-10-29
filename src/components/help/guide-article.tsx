import { focusRingClass } from '@/components/admin/styles'
import type { RenderedGuide } from '@/lib/guides'

export const guideLinkClass = `font-medium text-shpe-red underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded ${focusRingClass}`

const contentClass = [
  'text-gray-700 dark:text-gray-300 leading-relaxed',
  '[&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:border-b [&_h2]:border-gray-200 dark:[&_h2]:border-gray-700 [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-white',
  '[&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-cmu-maroon dark:[&_h3]:text-shpe-gold',
  '[&_h4]:mt-6 [&_h4]:font-semibold [&_h4]:text-gray-900 dark:[&_h4]:text-white',
  '[&_p]:mt-4 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2',
  '[&_strong]:font-semibold [&_strong]:text-gray-900 dark:[&_strong]:text-white',
  '[&_a]:rounded [&_a]:font-medium [&_a]:text-shpe-red [&_a]:underline hover:[&_a]:text-red-700 dark:[&_a]:text-red-400 dark:hover:[&_a]:text-red-300',
  '[&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-cmu-maroon dark:[&_a:focus-visible]:ring-shpe-gold',
  '[&_img]:mt-4 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-200 dark:[&_img]:border-gray-700 [&_img]:text-sm [&_img]:italic [&_img]:text-gray-600 dark:[&_img]:text-gray-400',
  '[&_code]:rounded [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1',
].join(' ')

export function GuideContents({ guide, id }: { guide: RenderedGuide; id: string }) {
  if (guide.toc.length === 0) return null
  return (
    <nav aria-labelledby={id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-5 text-sm">
      <p id={id} className="font-semibold text-gray-900 dark:text-white">
        Contents
      </p>
      <ul className="mt-3 space-y-1.5">
        {guide.toc.map((entry) => (
          <li key={entry.id} className={entry.depth === 3 ? 'pl-4' : 'font-medium'}>
            <a href={`#${entry.id}`} className={guideLinkClass}>
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** The HTML comes from the guide Markdown in this repository, rendered with raw HTML escaped. */
export function GuideBody({ guide }: { guide: RenderedGuide }) {
  return <div className={contentClass} dangerouslySetInnerHTML={{ __html: guide.html }} />
}
