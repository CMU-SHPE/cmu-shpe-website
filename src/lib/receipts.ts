import { DrizzleQueryError, and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins, members, sponsorReceipts } from '@/db/schema'
import type { ReceiptUpload } from '@/lib/receipt-files'

const FOREIGN_KEY_VIOLATION = '23503'

// Every list query picks these columns explicitly so the file itself never leaves the database with them.
const listColumns = {
  id: sponsorReceipts.id,
  title: sponsorReceipts.title,
  receiptDate: sponsorReceipts.receiptDate,
  fileName: sponsorReceipts.fileName,
  byteSize: sponsorReceipts.byteSize,
  createdAt: sponsorReceipts.createdAt,
}

const downloadColumns = {
  id: sponsorReceipts.id,
  fileName: sponsorReceipts.fileName,
  byteSize: sponsorReceipts.byteSize,
  content: sponsorReceipts.content,
}

function isForeignKeyViolation(error: unknown) {
  const cause = error instanceof DrizzleQueryError ? error.cause : error
  return (cause as { code?: unknown } | undefined)?.code === FOREIGN_KEY_VIOLATION
}

export type UploadReceiptResult = { ok: true; id: number } | { ok: false; reason: 'missing-listing' }

export async function uploadReceipt(
  adminId: number,
  sponsorId: number,
  upload: ReceiptUpload,
): Promise<UploadReceiptResult> {
  try {
    const [inserted] = await getDb()
      .insert(sponsorReceipts)
      .values({
        sponsorId,
        title: upload.title,
        receiptDate: upload.receiptDate,
        fileName: upload.fileName,
        byteSize: upload.content.length,
        content: upload.content,
        uploadedBy: adminId,
      })
      .returning({ id: sponsorReceipts.id })
    return { ok: true, id: inserted.id }
  } catch (error) {
    if (isForeignKeyViolation(error)) return { ok: false, reason: 'missing-listing' }
    throw error
  }
}

export async function deleteReceipt(receiptId: number, sponsorId: number): Promise<boolean> {
  const deleted = await getDb()
    .delete(sponsorReceipts)
    .where(and(eq(sponsorReceipts.id, receiptId), eq(sponsorReceipts.sponsorId, sponsorId)))
    .returning({ id: sponsorReceipts.id })
  return deleted.length > 0
}

export async function listReceiptsForSponsor(sponsorId: number) {
  return getDb()
    .select({ ...listColumns, uploadedBy: admins.name })
    .from(sponsorReceipts)
    .leftJoin(admins, eq(admins.id, sponsorReceipts.uploadedBy))
    .where(eq(sponsorReceipts.sponsorId, sponsorId))
    .orderBy(desc(sponsorReceipts.receiptDate), desc(sponsorReceipts.id))
}

/** The listing comes from the member's own row, so a sponsor can only ever see their listing's receipts. */
export async function listReceiptsForMember(memberId: number) {
  return getDb()
    .select(listColumns)
    .from(sponsorReceipts)
    .innerJoin(
      members,
      and(eq(members.sponsorId, sponsorReceipts.sponsorId), eq(members.id, memberId), eq(members.role, 'sponsor')),
    )
    .orderBy(desc(sponsorReceipts.receiptDate), desc(sponsorReceipts.id))
}

/** Null for a missing receipt and for another listing's alike, so callers answer both with the same 404. */
export async function getReceiptForMember(memberId: number, receiptId: number) {
  const [receipt] = await getDb()
    .select(downloadColumns)
    .from(sponsorReceipts)
    .innerJoin(
      members,
      and(eq(members.sponsorId, sponsorReceipts.sponsorId), eq(members.id, memberId), eq(members.role, 'sponsor')),
    )
    .where(eq(sponsorReceipts.id, receiptId))
    .limit(1)
  return receipt ?? null
}

export async function getReceiptForAdmin(receiptId: number, sponsorId: number) {
  const [receipt] = await getDb()
    .select(downloadColumns)
    .from(sponsorReceipts)
    .where(and(eq(sponsorReceipts.id, receiptId), eq(sponsorReceipts.sponsorId, sponsorId)))
    .limit(1)
  return receipt ?? null
}
