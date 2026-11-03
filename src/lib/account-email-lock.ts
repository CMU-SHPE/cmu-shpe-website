import { sql } from 'drizzle-orm'

/**
 * Sign-in prefers an admin row over a member row, so an address held by both locks the member
 * out. Every write that puts an address into admins or members runs this first, in the same
 * batch as its check against the other table. The mode conflicts with itself, so those writers
 * queue up and each check sees what the previous one committed; reads and sign-ins don't wait.
 */
export const lockAccountEmails = sql`lock table admins in share row exclusive mode`
