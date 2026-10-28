'use client'

import { useActionState, useState } from 'react'
import DeleteButton from '@/components/admin/delete-button'
import SubmitButton from '@/components/submit-button'
import {
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  primaryButtonClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import {
  deleteSponsorReceipt,
  uploadSponsorReceipt,
  type ReceiptActionResult,
} from '@/app/admin/sponsors/[id]/receipts/actions'
import { formatEventDate } from '@/lib/event-dates'
import { MAX_RECEIPT_TITLE_LENGTH, formatFileSize } from '@/lib/receipt-files'

export type AdminReceipt = {
  id: number
  title: string
  receiptDate: string
  fileName: string
  byteSize: number
  uploadedBy: string | null
}

const receiptMessages: Record<ReceiptActionResult['status'], string> = {
  uploaded: 'Receipt uploaded. The sponsor can download it from their portal.',
  deleted: 'Receipt deleted.',
  details: 'Enter a title (up to 200 characters) and a real date.',
  file: 'Choose a PDF file to upload.',
  size: 'That file is larger than 4 MB. Upload a smaller PDF.',
  type: 'That file is not a PDF. Only PDF receipts can be uploaded.',
  'missing-listing': 'This sponsor listing no longer exists.',
  'missing-receipt': 'That receipt no longer exists.',
}

const FAILED = new Set<ReceiptActionResult['status']>(['details', 'file', 'size', 'type', 'missing-listing', 'missing-receipt'])

const HINT_ID = 'receipt-file-hint'

type UploadState = ReceiptActionResult & { title?: string; date?: string }

function textField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export default function SponsorReceiptsPanel({
  headingId,
  sponsorId,
  receipts,
}: {
  headingId: string
  sponsorId: number
  receipts: AdminReceipt[]
}) {
  const [deleteResult, setDeleteResult] = useState<ReceiptActionResult | null>(null)
  // React resets the form after every submission, so a refused upload hands the typed title and date
  // back as the fields' defaults instead of making the admin retype them.
  const [uploadResult, uploadAction] = useActionState(
    async (previous: UploadState | null, formData: FormData): Promise<UploadState> => {
      setDeleteResult(null)
      const outcome = await uploadSponsorReceipt(sponsorId, previous, formData)
      if (outcome.status === 'uploaded') return outcome
      return { ...outcome, title: textField(formData, 'title'), date: textField(formData, 'date') }
    },
    null,
  )
  const result = deleteResult ?? uploadResult
  const failed = result ? FAILED.has(result.status) : false
  const invalidFile = uploadResult && !deleteResult && ['file', 'size', 'type'].includes(uploadResult.status)
  const invalidDetails = uploadResult?.status === 'details' && !deleteResult

  async function remove(receipt: AdminReceipt) {
    setDeleteResult(await deleteSponsorReceipt(sponsorId, receipt.id))
    // The deleted row and its focused button disappear, so focus goes back to the section.
    document.getElementById(headingId)?.focus()
  }

  return (
    <>
      <p
        role="status"
        className={`mt-1 text-sm ${failed ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-400'}`}
      >
        {result ? receiptMessages[result.status] : ''}
      </p>

      {receipts.length === 0 ? (
        <p className={`mt-2 ${mutedTextClass}`}>No receipts uploaded for this sponsor yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className={tableClass}>
            <caption className="sr-only">Receipts shared with this sponsor, newest first</caption>
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className="py-2 pr-4 font-medium">Receipt</th>
                <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                <th scope="col" className="py-2 pr-4 font-medium">File</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className={tableRowClass}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                    {receipt.title}
                    {receipt.uploadedBy && (
                      <span className={`block font-normal ${mutedTextClass}`}>Uploaded by {receipt.uploadedBy}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <time dateTime={receipt.receiptDate}>{formatEventDate(receipt.receiptDate)}</time>
                  </td>
                  <td className="py-3 pr-4">
                    <a
                      href={`/admin/sponsors/${sponsorId}/receipts/${receipt.id}`}
                      download
                      className={`rounded break-all font-medium text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`}
                    >
                      {receipt.fileName}
                    </a>
                    <span className={`block ${mutedTextClass}`}>{formatFileSize(receipt.byteSize)}</span>
                  </td>
                  <td className="py-3 text-right align-top">
                    <form action={() => remove(receipt)}>
                      <DeleteButton name={receipt.title} warning="The sponsor will no longer be able to download it." />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={uploadAction} className="mt-6 max-w-md space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Upload a receipt</h3>
        <label className={labelClass}>
          Title
          <input
            name="title"
            required
            maxLength={MAX_RECEIPT_TITLE_LENGTH}
            defaultValue={uploadResult?.title}
            className={inputClass}
            aria-invalid={invalidDetails || undefined}
          />
        </label>
        <label className={labelClass}>
          Receipt date
          <input
            name="date"
            type="date"
            required
            defaultValue={uploadResult?.date}
            className={inputClass}
            aria-invalid={invalidDetails || undefined}
          />
        </label>
        <label className={labelClass}>
          PDF file
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,.pdf"
            aria-describedby={HINT_ID}
            aria-invalid={invalidFile || undefined}
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:px-3 file:py-1 file:text-sm file:text-gray-800 dark:file:text-gray-100`}
          />
        </label>
        <p id={HINT_ID} className={`-mt-2 ${mutedTextClass}`}>
          PDF only, up to 4 MB.
        </p>
        <SubmitButton pendingLabel="Uploading…" className={primaryButtonClass}>
          Upload receipt
        </SubmitButton>
      </form>
    </>
  )
}
