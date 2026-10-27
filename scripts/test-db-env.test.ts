// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { UnsafeTestDatabaseError, localTestDatabase } from './test-db-env'

const local = {
  DATABASE_URL: 'postgres://postgres:postgres@db.localtest.me:5432/main',
  TEST_DB_FETCH_ENDPOINT: 'http://127.0.0.1:49152/sql',
}

describe('localTestDatabase', () => {
  it('accepts the docker database behind a loopback proxy', () => {
    expect(localTestDatabase(local)).toEqual({
      databaseUrl: local.DATABASE_URL,
      fetchEndpoint: local.TEST_DB_FETCH_ENDPOINT,
    })
  })

  it('refuses a hosted database', () => {
    const env = { ...local, DATABASE_URL: 'postgres://user:pw@ep-cool-name-123.us-east-2.aws.neon.tech/neondb' }
    expect(() => localTestDatabase(env)).toThrow(UnsafeTestDatabaseError)
  })

  it('refuses a proxy endpoint that is not on this machine', () => {
    const env = { ...local, TEST_DB_FETCH_ENDPOINT: 'https://ep-cool-name-123.us-east-2.aws.neon.tech/sql' }
    expect(() => localTestDatabase(env)).toThrow(UnsafeTestDatabaseError)
  })

  it('refuses to run without either variable or with a malformed URL', () => {
    expect(() => localTestDatabase({ DATABASE_URL: local.DATABASE_URL })).toThrow(UnsafeTestDatabaseError)
    expect(() => localTestDatabase({ TEST_DB_FETCH_ENDPOINT: local.TEST_DB_FETCH_ENDPOINT })).toThrow(
      UnsafeTestDatabaseError,
    )
    expect(() => localTestDatabase({ ...local, DATABASE_URL: 'not a url' })).toThrow(UnsafeTestDatabaseError)
  })
})
