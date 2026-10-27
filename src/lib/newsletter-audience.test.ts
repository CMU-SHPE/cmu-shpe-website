import { PgDialect } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audienceEmailCondition, testAudienceOnly } from './newsletter-audience'

afterEach(() => {
  vi.unstubAllEnvs()
})

function render(value: ReturnType<typeof audienceEmailCondition>) {
  return new PgDialect().sqlToQuery(value)
}

describe('audienceEmailCondition', () => {
  it('leaves the production audience unrestricted', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(testAudienceOnly()).toBe(false)
    expect(render(audienceEmailCondition(sql`m.email`))).toMatchObject({ sql: 'true', params: [] })
  })

  it.each([
    ['preview', 'preview'],
    ['development', 'development'],
    ['empty', ''],
    ['a padded or differently cased value', ' Production '],
  ])('restricts to @resend.dev addresses, whatever their case, when VERCEL_ENV is %s', (_, value) => {
    vi.stubEnv('VERCEL_ENV', value)
    expect(testAudienceOnly()).toBe(true)
    expect(render(audienceEmailCondition(sql`m.email`))).toMatchObject({
      sql: 'lower(m.email) like $1',
      params: ['%@resend.dev'],
    })
  })

  it('restricts when VERCEL_ENV is not set at all, so a misconfigured deployment fails safe', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    expect(process.env.VERCEL_ENV).toBeUndefined()
    expect(testAudienceOnly()).toBe(true)
  })
})
