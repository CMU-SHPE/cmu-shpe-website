import { currentAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { receiptDownloadResponse, receiptStatusResponse } from '@/lib/receipt-response'
import { getReceiptForAdmin } from '@/lib/receipts'

export async function GET(_request: Request, context: { params: Promise<{ id: string; receiptId: string }> }) {
  if (!(await currentAdmin())) return receiptStatusResponse(401)

  const params = await context.params
  const sponsorId = recordId.safeParse(params.id)
  const receiptId = recordId.safeParse(params.receiptId)
  if (!sponsorId.success || !receiptId.success) return receiptStatusResponse(404)

  const receipt = await getReceiptForAdmin(receiptId.data, sponsorId.data)
  return receipt ? receiptDownloadResponse(receipt) : receiptStatusResponse(404)
}
