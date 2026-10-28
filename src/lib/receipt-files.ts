import { z } from 'zod'
import { isRealDate } from './event-dates'
import { requiredText } from './form-fields'

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024
export const MAX_RECEIPT_TITLE_LENGTH = 200
export const MAX_RECEIPT_FILE_NAME_LENGTH = 120

const PDF_MAGIC = Array.from('%PDF-', (character) => character.charCodeAt(0))
const FALLBACK_FILE_NAME = 'receipt.pdf'

// C0/C1 controls plus the bidi overrides and isolates that can make "fdp.exe" render as "exe.pdf".
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

const receiptFields = z.object({
  title: requiredText(MAX_RECEIPT_TITLE_LENGTH),
  receiptDate: z.string().trim().refine(isRealDate),
})

export type ReceiptUpload = {
  title: string
  receiptDate: string
  fileName: string
  content: Uint8Array
}

export type ReceiptUploadProblem = 'details' | 'file' | 'size' | 'type'

export type ReceiptUploadResult = { success: true; data: ReceiptUpload } | { success: false; code: ReceiptUploadProblem }

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, index) => bytes[index] === byte)
}

/** The browser-supplied MIME type is ignored; only the bytes decide whether this is a PDF. */
export async function parseReceiptUpload(formData: FormData): Promise<ReceiptUploadResult> {
  const fields = receiptFields.safeParse({ title: formData.get('title'), receiptDate: formData.get('date') })
  if (!fields.success) return { success: false, code: 'details' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { success: false, code: 'file' }
  if (file.size > MAX_RECEIPT_BYTES) return { success: false, code: 'size' }

  const content = new Uint8Array(await file.arrayBuffer())
  if (content.length === 0) return { success: false, code: 'file' }
  if (content.length > MAX_RECEIPT_BYTES) return { success: false, code: 'size' }
  if (!isPdf(content)) return { success: false, code: 'type' }

  return { success: true, data: { ...fields.data, fileName: receiptFileName(file.name), content } }
}

export function receiptFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(UNSAFE_CHARACTERS, '').trim()
  const stem = base.replace(/\.pdf$/i, '').replace(/^\.+/, '').trim()
  if (!stem) return FALLBACK_FILE_NAME
  const room = MAX_RECEIPT_FILE_NAME_LENGTH - '.pdf'.length
  return `${Array.from(stem).slice(0, room).join('').trimEnd()}.pdf`
}

function rfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * `filename` is a quoted ASCII fallback for old clients, so anything that could end the quoted string or
 * the header is removed; `filename*` carries the real name percent-encoded per RFC 5987.
 */
export function contentDisposition(fileName: string): string {
  const name = receiptFileName(fileName)
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987(name)}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
