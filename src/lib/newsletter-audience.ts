import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export const PREVIEW_TEST_EMAIL_SUFFIX = '@resend.dev'

/**
 * Preview databases are copies of production and previews have a working Resend key, so a send
 * from a preview would reach real members. There, only Resend's test inboxes count as audience.
 */
export function previewAudienceOnly(): boolean {
  return process.env.VERCEL_ENV?.trim() === 'preview'
}

/** Every audience query uses this, so the confirmed count matches who is actually sent to. */
export function audienceEmailCondition(email: SQLWrapper): SQL {
  return previewAudienceOnly() ? sql`lower(${email}) like ${`%${PREVIEW_TEST_EMAIL_SUFFIX}`}` : sql`true`
}
