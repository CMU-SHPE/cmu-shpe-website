import { cardClass, sectionHeadingClass } from '@/components/admin/styles'
import { listReceiptsForSponsor } from '@/lib/receipts'
import SponsorReceiptsPanel from './sponsor-receipts-panel'

const HEADING_ID = 'admin-receipts-heading'

export default async function AdminSponsorReceipts({ sponsorId }: { sponsorId: number }) {
  const receipts = await listReceiptsForSponsor(sponsorId)

  return (
    <section className={cardClass} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1} className={`${sectionHeadingClass} focus:outline-none`}>
        Receipts
      </h2>
      <SponsorReceiptsPanel
        headingId={HEADING_ID}
        sponsorId={sponsorId}
        receipts={receipts.map(({ id, title, receiptDate, fileName, byteSize, uploadedBy }) => ({
          id,
          title,
          receiptDate,
          fileName,
          byteSize,
          uploadedBy,
        }))}
      />
    </section>
  )
}
