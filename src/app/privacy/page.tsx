import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LegalBody,
  LegalContact,
  LegalHeader,
  LegalList,
  LegalParagraph,
  LegalSection,
  legalLinkClass,
} from '@/components/legal'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { getSiteContentWithDefaults, getSiteSettings } from '@/lib/queries'

export const metadata: Metadata = { title: 'Privacy Policy | SHPE @ Colorado Mesa University' }

export default async function Privacy() {
  const [content, admin, settings] = await Promise.all([
    getSiteContentWithDefaults(contentKeysFor('privacy')),
    currentAdmin(),
    getSiteSettings(),
  ])
  const editable = Boolean(admin)
  const props = { content, editable }

  return (
    <div>
      <LegalHeader headingKey="privacy.header.heading" updatedKey="privacy.updated" {...props} />
      <LegalBody>
        <LegalParagraph contentKey="privacy.intro" {...props} />

        <LegalSection headingKey="privacy.collect.heading" {...props}>
          <LegalList contentKey="privacy.collect.items" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.use.heading" {...props}>
          <LegalList contentKey="privacy.use.items" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.processors.heading" {...props}>
          <LegalParagraph contentKey="privacy.processors.intro" {...props} />
          <LegalList contentKey="privacy.processors.items" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.cookies.heading" {...props}>
          <LegalParagraph contentKey="privacy.cookies.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.retention.heading" {...props}>
          <LegalList contentKey="privacy.retention.items" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.choices.heading" {...props}>
          <LegalList contentKey="privacy.choices.items" {...props} />
          <p>
            <Link href="/account" className={legalLinkClass}>
              Go to your account
            </Link>
          </p>
        </LegalSection>

        <LegalSection headingKey="privacy.children.heading" {...props}>
          <LegalParagraph contentKey="privacy.children.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.changes.heading" {...props}>
          <LegalParagraph contentKey="privacy.changes.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="privacy.contact.heading" {...props}>
          <LegalParagraph contentKey="privacy.contact.body" {...props} />
          <LegalContact contactEmail={settings?.contactEmail} />
        </LegalSection>
      </LegalBody>
    </div>
  )
}
