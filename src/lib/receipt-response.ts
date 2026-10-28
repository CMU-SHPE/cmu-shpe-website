import { contentDisposition } from '@/lib/receipt-files'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

export function receiptStatusResponse(status: 401 | 404): Response {
  return new Response(status === 401 ? 'Unauthorized' : 'Not found', { status, headers: PRIVATE_HEADERS })
}

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
