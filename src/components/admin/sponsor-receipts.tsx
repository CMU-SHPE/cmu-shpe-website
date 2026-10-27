import { cardClass, sectionHeadingClass } from '@/components/admin/styles'
import { listReceiptsForSponsor } from '@/lib/receipts'
import SponsorReceiptsPanel, { ADMIN_RECEIPTS_HEADING_ID } from './sponsor-receipts-panel'

export default async function AdminSponsorReceipts({ sponsorId }: { sponsorId: number }) {
  const receipts = await listReceiptsForSponsor(sponsorId)

  return (
    <section className={cardClass} aria-labelledby={ADMIN_RECEIPTS_HEADING_ID}>
      <h2 id={ADMIN_RECEIPTS_HEADING_ID} tabIndex={-1} className={`${sectionHeadingClass} focus:outline-none`}>
        Receipts
      </h2>
      <SponsorReceiptsPanel
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
