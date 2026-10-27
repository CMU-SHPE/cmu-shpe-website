import {
  cardClass,
  focusRingClass,
  mutedTextClass,
  sectionHeadingClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import { formatEventDate } from '@/lib/event-dates'
import { formatFileSize } from '@/lib/receipt-files'
import { listReceiptsForMember } from '@/lib/receipts'

const HEADING_ID = 'sponsor-receipts-heading'

export default async function SponsorReceiptsList({ memberId }: { memberId: number }) {
  const receipts = await listReceiptsForMember(memberId)

  return (
    <section className={`${cardClass} overflow-x-auto`} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className={sectionHeadingClass}>
        Receipts
      </h2>
      {receipts.length === 0 ? (
        <p className={`mt-2 ${mutedTextClass}`}>No receipts have been shared with you yet.</p>
      ) : (
        <table className={`mt-4 ${tableClass}`}>
          <caption className="sr-only">Receipts for your sponsorship, newest first</caption>
          <thead>
            <tr className={tableHeadRowClass}>
              <th scope="col" className="py-2 pr-4 font-medium">Receipt</th>
              <th scope="col" className="py-2 pr-4 font-medium">Date</th>
              <th scope="col" className="py-2 font-medium">Download</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id} className={tableRowClass}>
                <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{receipt.title}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <time dateTime={receipt.receiptDate}>{formatEventDate(receipt.receiptDate)}</time>
                </td>
                <td className="py-3">
                  <a
                    href={`/sponsor/receipts/${receipt.id}`}
                    download
                    className={`rounded font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`}
                  >
                    {'Download '}
                    <span className="sr-only">{receipt.title}</span>
                    {` (PDF, ${formatFileSize(receipt.byteSize)})`}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
