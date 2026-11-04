import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { currentAdmin } from '@/lib/admin'
import { PRIVATE_HEADERS } from '@/lib/guide-print'
import { OFFICER_HANDBOOK_FILE } from '@/lib/guides'

export async function GET() {
  if (!(await currentAdmin())) return new Response('Unauthorized', { status: 401, headers: PRIVATE_HEADERS })

  const file = await stat(OFFICER_HANDBOOK_FILE).catch(() => null)
  if (!file?.isFile()) return new Response('Not found', { status: 404, headers: PRIVATE_HEADERS })

  return new Response(Readable.toWeb(createReadStream(OFFICER_HANDBOOK_FILE)) as ReadableStream<Uint8Array>, {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="officer-handbook.pdf"',
      'Content-Length': String(file.size),
    },
  })
}
