import { describe, expect, it } from 'vitest'
import { checkTestDatabaseEnv } from './test-database-env'

const LOCAL_DB = 'postgres://postgres:postgres@db.localtest.me:5432/main'
const LOCAL_PROXY = 'http://127.0.0.1:4444/sql'

describe('checkTestDatabaseEnv', () => {
  it('skips the database tests when neither variable is set', () => {
    expect(checkTestDatabaseEnv(undefined, undefined)).toBe(false)
  })

  it.each([
    [LOCAL_DB, LOCAL_PROXY],
    ['postgres://u:p@localhost:55440/main', 'http://localhost:4444/sql'],
    ['postgres://u:p@127.0.0.1/main', LOCAL_PROXY],
  ])('runs them against local containers (%s via %s)', (url, endpoint) => {
    expect(checkTestDatabaseEnv(url, endpoint)).toBe(true)
  })

  it.each([
    [LOCAL_DB, undefined],
    [undefined, LOCAL_PROXY],
  ])('refuses only one of the two variables', (url, endpoint) => {
    expect(() => checkTestDatabaseEnv(url, endpoint)).toThrow(/both/)
  })

  it.each([
    'postgres://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require',
    'postgres://u:p@db.localtest.me.evil.example/main',
    'not a url',
  ])('refuses a database that is not local: %s', (url) => {
    expect(() => checkTestDatabaseEnv(url, LOCAL_PROXY)).toThrow(/TEST_DATABASE_URL/)
  })

  it.each(['https://ep-cool-name-123456.us-east-2.aws.neon.tech/sql', 'http://db.localtest.me:4444/sql'])(
    'refuses a proxy that is not on this machine: %s',
    (endpoint) => {
      expect(() => checkTestDatabaseEnv(LOCAL_DB, endpoint)).toThrow(/TEST_NEON_FETCH_ENDPOINT/)
    },
  )
})
