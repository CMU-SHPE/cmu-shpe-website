// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_FILE_NAME_LENGTH,
  contentDisposition,
  isPdf,
  parseReceiptUpload,
  receiptFileName,
} from './receipt-files'

function pdfBytes(size = 64) {
  const bytes = new Uint8Array(size)
  bytes.set(Buffer.from('%PDF-1.7\n'))
  return bytes
}

function uploadForm(overrides: { title?: string; date?: string; file?: File | string | null } = {}) {
  const form = new FormData()
  form.set('title', overrides.title ?? 'Gold sponsorship 2026')
  form.set('date', overrides.date ?? '2026-09-01')
  const file = overrides.file === undefined ? new File([pdfBytes()], 'receipt.pdf', { type: 'application/pdf' }) : overrides.file
  if (file !== null) form.set('file', file)
  return form
}

describe('isPdf', () => {
  it('looks for %PDF- at the very start', () => {
    expect(isPdf(pdfBytes())).toBe(true)
    expect(isPdf(Buffer.from('%PDF-'))).toBe(true)
    expect(isPdf(Buffer.from('%PDF'))).toBe(false)
    expect(isPdf(Buffer.from(' %PDF-1.7'))).toBe(false)
    expect(isPdf(Buffer.from('%pdf-1.7'))).toBe(false)
    expect(isPdf(new Uint8Array())).toBe(false)
  })
})

describe('parseReceiptUpload', () => {
  it('accepts a PDF with a title and real date', async () => {
    const result = await parseReceiptUpload(uploadForm({ title: '  Gold  ' }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toMatchObject({ title: 'Gold', receiptDate: '2026-09-01', fileName: 'receipt.pdf' })
    expect(Buffer.compare(Buffer.from(result.data.content), Buffer.from(pdfBytes()))).toBe(0)
  })

  it('accepts exactly the maximum size and refuses one byte more', async () => {
    const atLimit = new File([pdfBytes(MAX_RECEIPT_BYTES)], 'big.pdf')
    expect((await parseReceiptUpload(uploadForm({ file: atLimit }))).success).toBe(true)

    const over = new File([pdfBytes(MAX_RECEIPT_BYTES + 1)], 'big.pdf')
    expect(await parseReceiptUpload(uploadForm({ file: over }))).toEqual({ success: false, code: 'size' })
  })

  it('judges the bytes, not the claimed type or extension', async () => {
    const html = new File(['<html><script>alert(1)</script>'], 'receipt.pdf', { type: 'application/pdf' })
    expect(await parseReceiptUpload(uploadForm({ file: html }))).toEqual({ success: false, code: 'type' })

    const unlabelled = new File([pdfBytes()], 'scan', { type: 'application/octet-stream' })
    const result = await parseReceiptUpload(uploadForm({ file: unlabelled }))
    expect(result.success && result.data.fileName).toBe('scan.pdf')
  })

  it('requires a non-empty file', async () => {
    expect(await parseReceiptUpload(uploadForm({ file: null }))).toEqual({ success: false, code: 'file' })
    expect(await parseReceiptUpload(uploadForm({ file: 'not a file' }))).toEqual({ success: false, code: 'file' })
    expect(await parseReceiptUpload(uploadForm({ file: new File([], 'empty.pdf') }))).toEqual({
      success: false,
      code: 'file',
    })
  })

  it('requires a title of at most 200 characters and a real date', async () => {
    for (const form of [
      uploadForm({ title: '   ' }),
      uploadForm({ title: 'x'.repeat(201) }),
      uploadForm({ date: '2026-02-30' }),
      uploadForm({ date: 'September 1' }),
      uploadForm({ date: '' }),
    ]) {
      expect(await parseReceiptUpload(form)).toEqual({ success: false, code: 'details' })
    }
    expect((await parseReceiptUpload(uploadForm({ title: 'x'.repeat(200) }))).success).toBe(true)
  })
})

describe('receiptFileName', () => {
  it('keeps an ordinary name and makes sure it ends in .pdf', () => {
    expect(receiptFileName('Gold 2026.pdf')).toBe('Gold 2026.pdf')
    expect(receiptFileName('Gold 2026.PDF')).toBe('Gold 2026.pdf')
    expect(receiptFileName('invoice')).toBe('invoice.pdf')
    expect(receiptFileName('payload.exe')).toBe('payload.exe.pdf')
    expect(receiptFileName('Recibo de patrocinio — año 2026.pdf')).toBe('Recibo de patrocinio — año 2026.pdf')
  })

  it('drops any path', () => {
    expect(receiptFileName('../../etc/passwd')).toBe('passwd.pdf')
    expect(receiptFileName('C:\\Users\\me\\receipt.pdf')).toBe('receipt.pdf')
    expect(receiptFileName('/tmp/')).toBe('receipt.pdf')
  })

  it('strips control and direction-override characters', () => {
    expect(receiptFileName('evil\r\nSet-Cookie: x=1.pdf')).toBe('evilSet-Cookie: x=1.pdf')
    expect(receiptFileName('a\u0000b\u007f\u0085c.pdf')).toBe('abc.pdf')
    expect(receiptFileName('invoice\u202Efdp.exe')).toBe('invoicefdp.exe.pdf')
  })

  it('falls back to receipt.pdf when nothing usable is left', () => {
    for (const name of ['', '   ', '.pdf', '...', '\r\n', '..']) {
      expect(receiptFileName(name), JSON.stringify(name)).toBe('receipt.pdf')
    }
    expect(receiptFileName('.hidden.pdf')).toBe('hidden.pdf')
  })

  it('caps the name at 120 characters without splitting a character', () => {
    expect(receiptFileName(`${'a'.repeat(300)}.pdf`)).toBe(`${'a'.repeat(MAX_RECEIPT_FILE_NAME_LENGTH - 4)}.pdf`)
    const emoji = receiptFileName(`${'😀'.repeat(200)}.pdf`)
    expect(Array.from(emoji)).toHaveLength(MAX_RECEIPT_FILE_NAME_LENGTH)
    expect(emoji).toBe(`${'😀'.repeat(MAX_RECEIPT_FILE_NAME_LENGTH - 4)}.pdf`)
  })
})

describe('contentDisposition', () => {
  it('sends an attachment with an ASCII fallback and the UTF-8 name', () => {
    expect(contentDisposition('receipt.pdf')).toBe(`attachment; filename="receipt.pdf"; filename*=UTF-8''receipt.pdf`)
    expect(contentDisposition('Recibo año 2026.pdf')).toBe(
      `attachment; filename="Recibo ano 2026.pdf"; filename*=UTF-8''Recibo%20a%C3%B1o%202026.pdf`,
    )
    expect(contentDisposition('收据.pdf')).toBe(`attachment; filename="__.pdf"; filename*=UTF-8''%E6%94%B6%E6%8D%AE.pdf`)
  })

  it('cannot be broken out of by a hostile name', () => {
    const header = contentDisposition('a"; filename=evil.html\r\nX-Injected: 1 \'(c)*.pdf')
    expect(header).not.toMatch(/[\r\n\\]/)
    const fallback = /filename="([^"]*)"/.exec(header)?.[1]
    expect(fallback).toBe('a; filename=evil.htmlX-Injected: 1 \'(c)*.pdf')
    expect(header).toMatch(/; filename\*=UTF-8''[A-Za-z0-9%!#$&+\-.^_`|~]+$/)
    expect(header.split('"')).toHaveLength(3)
  })

  it('reduces a path to its last segment', () => {
    expect(contentDisposition('../../secret.pdf')).toBe(`attachment; filename="secret.pdf"; filename*=UTF-8''secret.pdf`)
  })
})
