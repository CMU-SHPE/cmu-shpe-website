'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { parseReceiptUpload, type ReceiptUploadProblem } from '@/lib/receipt-files'
import { deleteReceipt, uploadReceipt } from '@/lib/receipts'

export type ReceiptActionResult = {
  status: 'uploaded' | 'deleted' | 'missing-listing' | 'missing-receipt' | ReceiptUploadProblem
}

// Bound to the listing id and used with useActionState, so the previous result comes before the form.
export async function uploadSponsorReceipt(
  sponsorId: unknown,
  _previous: unknown,
  formData: FormData,
): Promise<ReceiptActionResult> {
  const admin = await requireAdmin()
  const listing = recordId.safeParse(sponsorId)
  if (!listing.success) return { status: 'missing-listing' }
  if (!(formData instanceof FormData)) return { status: 'file' }

  const parsed = await parseReceiptUpload(formData)
  if (!parsed.success) return { status: parsed.code }

  const result = await uploadReceipt(Number(admin.user.id), listing.data, parsed.data)
  if (!result.ok) return { status: result.reason }

  revalidatePath(`/admin/sponsors/${listing.data}`)
  return { status: 'uploaded' }
}

export async function deleteSponsorReceipt(sponsorId: unknown, receiptId: unknown): Promise<ReceiptActionResult> {
  await requireAdmin()
  const listing = recordId.safeParse(sponsorId)
  const receipt = recordId.safeParse(receiptId)
  if (!listing.success || !receipt.success) return { status: 'missing-receipt' }

  const deleted = await deleteReceipt(receipt.data, listing.data)
  revalidatePath(`/admin/sponsors/${listing.data}`)
  return { status: deleted ? 'deleted' : 'missing-receipt' }
}
