import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'

export const TEST_EMAIL_SUFFIX = '@resend.dev'

/**
 * Preview and local databases are copies of production with a working Resend key, so a send from
 * anywhere but production would reach real members. Outside production only Resend's test inboxes
 * count as audience; a missing VERCEL_ENV counts as not production, so the guard fails safe.
 */
export function testAudienceOnly(): boolean {
  return process.env.VERCEL_ENV?.trim() !== 'production'
}

/** Every audience query uses this, so the confirmed count matches who is actually sent to. */
export function audienceEmailCondition(email: SQLWrapper): SQL {
  return testAudienceOnly() ? sql`lower(${email}) like ${`%${TEST_EMAIL_SUFFIX}`}` : sql`true`
}
