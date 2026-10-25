import Link from 'next/link'
import Editable, { EditableList } from '@/components/editable'
import { focusRingClass } from '@/components/admin/styles'
import type { InlineContentKey } from '@/lib/content-keys'

export const legalLinkClass = `font-medium text-shpe-red underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded ${focusRingClass}`

export function LegalHeader({
  headingKey,
  updatedKey,
  content,
  editable,
}: {
  headingKey: InlineContentKey
  updatedKey: InlineContentKey
  content: Record<string, string>
  editable: boolean
}) {
  const updated = content[updatedKey]
  return (
    <section className="bg-cmu-maroon py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Editable
          as="h1"
          contentKey={headingKey}
          value={content[headingKey]}
          editable={editable}
          className="text-4xl sm:text-5xl font-black text-white mb-3"
        />
        {(editable || updated) && (
          <Editable
            as="p"
            contentKey={updatedKey}
            value={updated}
            editable={editable}
            className="text-gray-300 text-sm"
            leading={<span className="mr-1">Last updated:</span>}
          />
        )}
      </div>
    </section>
  )
}

export function LegalBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 py-14">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export function LegalSection({
  headingKey,
  content,
  editable,
  children,
}: {
  headingKey: InlineContentKey
  content: Record<string, string>
  editable: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <Editable
        as="h2"
        contentKey={headingKey}
        value={content[headingKey]}
        editable={editable}
        className="text-2xl font-bold text-gray-900 dark:text-white"
      />
      {children}
    </div>
  )
}

export function LegalParagraph({
  contentKey,
  content,
  editable,
}: {
  contentKey: InlineContentKey
  content: Record<string, string>
  editable: boolean
}) {
  return <Editable as="p" contentKey={contentKey} value={content[contentKey]} editable={editable} className="" />
}

export function LegalList({
  contentKey,
  content,
  editable,
}: {
  contentKey: InlineContentKey
  content: Record<string, string>
  editable: boolean
}) {
  return (
    <EditableList
      contentKey={contentKey}
      value={content[contentKey]}
      editable={editable}
      className="list-disc pl-6 space-y-2"
      editorClassName="space-y-2"
      renderItem={(item) => <li>{item}</li>}
    />
  )
}

export function LegalContact({ contactEmail }: { contactEmail: string | undefined }) {
  if (contactEmail) {
    return (
      <p>
        <a href={`mailto:${contactEmail}`} className={legalLinkClass}>
          {contactEmail}
        </a>
      </p>
    )
  }
  return (
    <p>
      Use our{' '}
      <Link href="/contact" className={legalLinkClass}>
        contact page
      </Link>
      .
    </p>
  )
}
