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

export const metadata: Metadata = { title: 'Terms of Use | SHPE @ Colorado Mesa University' }

export default async function Terms() {
  const [content, admin, settings] = await Promise.all([
    getSiteContentWithDefaults(contentKeysFor('terms')),
    currentAdmin(),
    getSiteSettings(),
  ])
  const editable = Boolean(admin)
  const props = { content, editable }

  return (
    <div>
      <LegalHeader headingKey="terms.header.heading" updatedKey="terms.updated" {...props} />
      <LegalBody>
        <LegalParagraph contentKey="terms.intro" {...props} />

        <LegalSection headingKey="terms.accounts.heading" {...props}>
          <LegalParagraph contentKey="terms.accounts.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="terms.use.heading" {...props}>
          <LegalParagraph contentKey="terms.use.intro" {...props} />
          <LegalList contentKey="terms.use.items" {...props} />
        </LegalSection>

        <LegalSection headingKey="terms.termination.heading" {...props}>
          <LegalParagraph contentKey="terms.termination.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="terms.warranty.heading" {...props}>
          <LegalParagraph contentKey="terms.warranty.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="terms.changes.heading" {...props}>
          <LegalParagraph contentKey="terms.changes.body" {...props} />
        </LegalSection>

        <LegalSection headingKey="terms.contact.heading" {...props}>
          <LegalParagraph contentKey="terms.contact.body" {...props} />
          <LegalContact contactEmail={settings?.contactEmail} />
        </LegalSection>

        <p>
          How we handle your information is covered by our{' '}
          <Link href="/privacy" className={legalLinkClass}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalBody>
    </div>
  )
}
