// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { PgDialect } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'
import { escapeLikePattern, memberDeletion, memberListParams, memberSearchCondition } from './member-admin'

const db = drizzle(neon('postgresql://user:password@localhost/unused'), { schema })
const dialect = new PgDialect()

describe('memberListParams', () => {
  it('reads a search and page number', () => {
    expect(memberListParams.parse({ q: '  ana ', page: '3' })).toEqual({ q: 'ana', page: 3 })
  })

  it('defaults a missing search and page', () => {
    expect(memberListParams.parse({})).toEqual({ q: '', page: 1 })
  })

  it('uses the first value when a param repeats', () => {
    expect(memberListParams.parse({ q: ['ana', 'bob'], page: ['2', '9'] })).toEqual({ q: 'ana', page: 2 })
  })

  it.each([['0'], ['-1'], ['1.5'], ['abc'], ['100000']])('falls back to page 1 for %j', (page) => {
    expect(memberListParams.parse({ page }).page).toBe(1)
  })

  it('drops a search longer than the cap instead of running it', () => {
    expect(memberListParams.parse({ q: 'a'.repeat(101) }).q).toBe('')
    expect(memberListParams.parse({ q: 'a'.repeat(100) }).q).toHaveLength(100)
  })
})

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLikePattern('50%_off\\')).toBe('50\\%\\_off\\\\')
    expect(escapeLikePattern('ana@example.com')).toBe('ana@example.com')
  })
})

describe('memberSearchCondition', () => {
  it('matches name or email case-insensitively with wildcards escaped', () => {
    const query = dialect.sqlToQuery(memberSearchCondition('a_b%')!)
    expect(query.sql).toBe('("members"."name" ilike $1 or "members"."email" ilike $2)')
    expect(query.params).toEqual(['%a\\_b\\%%', '%a\\_b\\%%'])
  })

  it('applies no filter for an empty search', () => {
    expect(memberSearchCondition('')).toBeUndefined()
  })
})

describe('memberDeletion', () => {
  it('clears throttle and login records by the member email before deleting the member', () => {
    const statements = memberDeletion(db, 42).map((query) => query.toSQL())
    expect(statements.map((statement) => statement.sql)).toEqual([
      'delete from "request_throttle" where "request_throttle"."email" in (select "email" from "members" where "members"."id" = $1)',
      'delete from "login_attempts" where "login_attempts"."email" in (select "email" from "members" where "members"."id" = $1)',
      'delete from "members" where "members"."id" = $1 returning "id"',
    ])
    expect(statements.map((statement) => statement.params)).toEqual([[42], [42], [42]])
  })
})
