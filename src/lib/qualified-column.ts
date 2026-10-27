import { getTableName, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/**
 * Drizzle drops table names from columns inside sql`` selection fields when the select has no
 * joins, so a correlated subquery there would compare "topic_id" = "id" against its own table.
 * Every column in such a subquery goes through this to stay "table"."column".
 */
export function qualified(column: PgColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`
}
