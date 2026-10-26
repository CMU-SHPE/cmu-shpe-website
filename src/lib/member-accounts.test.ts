import { describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'
import { parseEmailRequest, parsePasswordReset, parseSignUp, purgeStaleUnconfirmedMembers, safeValues } from './member-accounts'

const strongPassword = 'correct horse battery'

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

function signUp(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    name: '  Mia Member ',
    email: ' Mia@Example.com ',
    password: strongPassword,
    confirmPassword: strongPassword,
    ageConfirmed: 'on',
    termsAccepted: 'on',
    ...overrides,
  }
  return form(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Record<string, string>)
}

describe('parseSignUp', () => {
  it('trims the name and lowercases the email', () => {
    expect(parseSignUp(signUp())).toEqual({
      success: true,
      data: {
        name: 'Mia Member',
        email: 'mia@example.com',
        password: strongPassword,
        confirmPassword: strongPassword,
        ageConfirmed: 'on',
        termsAccepted: 'on',
      },
    })
  })

  it('requires the age checkbox and the terms checkbox', () => {
    expect(parseSignUp(signUp({ ageConfirmed: undefined }))).toMatchObject({
      success: false,
      errors: { ageConfirmed: expect.stringContaining('13 or older') },
    })
    expect(parseSignUp(signUp({ ageConfirmed: 'true' })).success).toBe(false)
    expect(parseSignUp(signUp({ termsAccepted: undefined }))).toMatchObject({
      success: false,
      errors: { termsAccepted: expect.any(String) },
    })
  })

  it('rejects passwords under 12 characters or over 72 bytes', () => {
    const short = 'a'.repeat(11)
    expect(parseSignUp(signUp({ password: short, confirmPassword: short }))).toMatchObject({
      success: false,
      errors: { password: expect.stringContaining('12') },
    })
    const tooManyBytes = 'é'.repeat(37)
    expect(new TextEncoder().encode(tooManyBytes).length).toBe(74)
    expect(parseSignUp(signUp({ password: tooManyBytes, confirmPassword: tooManyBytes })).success).toBe(false)
    const exactly72 = 'a'.repeat(72)
    expect(parseSignUp(signUp({ password: exactly72, confirmPassword: exactly72 })).success).toBe(true)
  })

  it('rejects names with line breaks or control characters, and empty or long names', () => {
    for (const name of ['Mia\nMember', 'Mia\r\nBcc: x@y.z', 'Mia\u0000', 'Mia\u2028Member', 'Mia\u2029Member', '   ', 'a'.repeat(101)]) {
      expect(parseSignUp(signUp({ name }))).toMatchObject({ success: false, errors: { name: expect.any(String) } })
    }
    expect(parseSignUp(signUp({ name: 'a'.repeat(100) })).success).toBe(true)
  })

  it('requires matching passwords and a valid email', () => {
    expect(parseSignUp(signUp({ confirmPassword: 'something else entirely' }))).toMatchObject({
      success: false,
      errors: { confirmPassword: expect.any(String) },
    })
    expect(parseSignUp(signUp({ email: 'not-an-email' }))).toMatchObject({
      success: false,
      errors: { email: expect.any(String) },
    })
  })
})

describe('parseEmailRequest and parsePasswordReset', () => {
  it('lowercases the email', () => {
    expect(parseEmailRequest(form({ email: 'Mia@Example.com' }))).toEqual({ success: true, data: { email: 'mia@example.com' } })
  })

  it('needs a well-formed token and matching passwords', () => {
    const token = 'A'.repeat(43)
    expect(parsePasswordReset(form({ token, password: strongPassword, confirmPassword: strongPassword })).success).toBe(true)
    expect(parsePasswordReset(form({ token: 'nope', password: strongPassword, confirmPassword: strongPassword }))).toMatchObject({
      success: false,
      errors: { token: expect.any(String) },
    })
    expect(parsePasswordReset(form({ token, password: strongPassword, confirmPassword: 'different' })).success).toBe(false)
  })
})

describe('safeValues', () => {
  it('keeps only the named text fields, never passwords', () => {
    const formData = signUp()
    expect(safeValues(formData, ['name', 'email'])).toEqual({ name: '  Mia Member ', email: ' Mia@Example.com ' })
  })
})

describe('purgeStaleUnconfirmedMembers', () => {
  it('deletes only unconfirmed accounts past 7 days with no unexpired confirmation link', () => {
    const db = drizzle(neon('postgresql://user:pass@localhost.invalid/db'), { schema })
    const { sql, params } = purgeStaleUnconfirmedMembers(db).toSQL()
    expect(sql).toBe(
      'delete from "members" where ("members"."email_confirmed_at" is null and "members"."created_at" < now() - make_interval(days => $1) and not exists (select "id" from "member_tokens" where ("member_tokens"."member_id" = "members"."id" and "member_tokens"."purpose" = $2 and "member_tokens"."expires_at" > now())))',
    )
    expect(params).toEqual([7, 'confirm_email'])
  })
})
