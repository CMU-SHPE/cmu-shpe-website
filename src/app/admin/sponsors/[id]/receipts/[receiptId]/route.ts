import { currentAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import { privateStatusResponse } from '@/lib/private-response'
import { receiptDownloadResponse } from '@/lib/receipt-response'
import { getReceiptForAdmin } from '@/lib/receipts'

export async function GET(_request: Request, context: { params: Promise<{ id: string; receiptId: string }> }) {
  if (!(await currentAdmin())) return privateStatusResponse(401)

  const params = await context.params
  const sponsorId = recordId.safeParse(params.id)
  const receiptId = recordId.safeParse(params.receiptId)
  if (!sponsorId.success || !receiptId.success) return privateStatusResponse(404)

  const receipt = await getReceiptForAdmin(receiptId.data, sponsorId.data)
  return receipt ? receiptDownloadResponse(receipt) : privateStatusResponse(404)
}
