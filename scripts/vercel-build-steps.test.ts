// @vitest-environment node
import { EventEmitter } from 'node:events'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  pushSchema: vi.fn(),
  apply: vi.fn(async () => {}),
  nextExitCode: 0,
}))

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('drizzle-kit/api', () => ({ pushSchema: mocks.pushSchema }))
vi.mock('@neondatabase/serverless', () => ({ neon: () => () => {} }))
vi.mock('drizzle-orm/neon-http', () => ({ drizzle: () => ({ execute: async () => ({ rows: [] }) }) }))

import { runVercelBuild, shouldPushSchema } from './vercel-build-steps'

function plan(overrides: Record<string, unknown> = {}) {
  return {
    hasDataLoss: false,
    warnings: [],
    statementsToExecute: ['CREATE TABLE "members" ()'],
    apply: mocks.apply,
    ...overrides,
  }
}

// The preview path imports these on first use; loading them here keeps that cold start
// out of the first preview test's time limit when the whole suite runs in parallel.
beforeAll(async () => {
  await Promise.all([import('../src/db/schema'), import('drizzle-orm')])
}, 30_000)

beforeEach(() => {
  mocks.nextExitCode = 0
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', mocks.nextExitCode))
    return child
  })
  mocks.pushSchema.mockResolvedValue(plan())
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@example.invalid/db')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('shouldPushSchema', () => {
  it('pushes only for exactly "preview"', () => {
    expect(shouldPushSchema('preview')).toBe(true)
    for (const vercelEnv of ['production', 'development', undefined, '', 'Preview', ' preview']) {
      expect(shouldPushSchema(vercelEnv)).toBe(false)
    }
  })
})

describe('runVercelBuild', () => {
  it.each(['production', 'development', undefined])(
    'runs only next build when VERCEL_ENV is %s, never drizzle-kit',
    async (vercelEnv) => {
      expect(await runVercelBuild({ VERCEL_ENV: vercelEnv })).toBe(0)
      expect(mocks.pushSchema).not.toHaveBeenCalled()
      expect(mocks.spawn).toHaveBeenCalledTimes(1)
      expect(mocks.spawn).toHaveBeenCalledWith('next', ['build'], { stdio: 'inherit' })
    },
  )

  it('returns next build exit code', async () => {
    mocks.nextExitCode = 2
    expect(await runVercelBuild({ VERCEL_ENV: 'production' })).toBe(2)
  })

  it('applies an additive preview change, then builds', async () => {
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(0)
    expect(mocks.apply).toHaveBeenCalledTimes(1)
    expect(mocks.spawn).toHaveBeenCalledTimes(1)
    expect(mocks.apply.mock.invocationCallOrder[0]).toBeLessThan(mocks.spawn.mock.invocationCallOrder[0])
  })

  it('skips apply when the preview schema is already up to date', async () => {
    mocks.pushSchema.mockResolvedValue(plan({ statementsToExecute: [] }))
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(0)
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('fails without writing or building when the change would lose data', async () => {
    mocks.pushSchema.mockResolvedValue(
      plan({ hasDataLoss: true, warnings: ["You're about to delete legacy table with 5 items"] }),
    )
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(1)
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('fails when drizzle-kit has warnings even without flagging data loss', async () => {
    mocks.pushSchema.mockResolvedValue(plan({ warnings: ['something to confirm'] }))
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(1)
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('fails when drizzle-kit needs a rename decision it cannot prompt for', async () => {
    mocks.pushSchema.mockRejectedValue(new Error('Interactive prompts require a TTY terminal'))
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(1)
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('fails loudly instead of skipping when the preview has no DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '')
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' })).toBe(1)
    expect(mocks.pushSchema).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('fails instead of hanging when the push never finishes', async () => {
    const nextBuild = vi.fn(async () => 0)
    const pushSchema = () => new Promise<void>(() => {})
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' }, { pushSchema, nextBuild }, 10)).toBe(1)
    expect(nextBuild).not.toHaveBeenCalled()
  })
})
