import { PRIVATE_HEADERS } from '@/lib/private-response'
import { contentDisposition } from '@/lib/receipt-files'

export function receiptDownloadResponse(receipt: { fileName: string; content: Uint8Array }): Response {
  return new Response(Buffer.from(receipt.content), {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(receipt.fileName),
      'Content-Length': String(receipt.content.length),
    },
  })
}
