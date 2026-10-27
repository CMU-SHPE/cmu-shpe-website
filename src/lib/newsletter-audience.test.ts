import { PgDialect } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audienceEmailCondition, previewAudienceOnly } from './newsletter-audience'

afterEach(() => {
  vi.unstubAllEnvs()
})

function render(value: ReturnType<typeof audienceEmailCondition>) {
  return new PgDialect().sqlToQuery(value)
}

describe('audienceEmailCondition', () => {
  it('restricts a preview deployment to @resend.dev addresses, whatever their case', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(previewAudienceOnly()).toBe(true)
    expect(render(audienceEmailCondition(sql`m.email`))).toMatchObject({ sql: 'lower(m.email) like $1', params: ['%@resend.dev'] })
  })

  it.each(['production', 'development', ''])('adds no restriction when VERCEL_ENV is %j', (value) => {
    vi.stubEnv('VERCEL_ENV', value)
    expect(previewAudienceOnly()).toBe(false)
    expect(render(audienceEmailCondition(sql`m.email`))).toMatchObject({ sql: 'true', params: [] })
  })
})
