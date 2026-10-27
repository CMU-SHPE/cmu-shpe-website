import { recordId } from '@/lib/form-fields'
import { currentMember } from '@/lib/member'
import { receiptDownloadResponse, receiptStatusResponse } from '@/lib/receipt-response'
import { getReceiptForMember } from '@/lib/receipts'

// A 401 rather than a redirect to /login, so an expired session never saves the sign-in page as a PDF.
// Every other refusal is the same 404, so receipt ids of other listings can't be probed.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await currentMember()
  if (!member) return receiptStatusResponse(401)

  const id = recordId.safeParse((await context.params).id)
  if (!id.success) return receiptStatusResponse(404)

  const receipt = await getReceiptForMember(Number(member.user.id), id.data)
  return receipt ? receiptDownloadResponse(receipt) : receiptStatusResponse(404)
}
