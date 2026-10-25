// @vitest-environment node
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  pushSchema: vi.fn(),
  apply: vi.fn(async () => {}),
  nextExitCode: 0,
}))

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('drizzle-kit/api', () => ({ pushSchema: mocks.pushSchema }))
vi.mock('@neondatabase/serverless', () => ({ neon: () => () => {} }))
// The real schema and drizzle-orm take seconds to load cold, enough to time out a test.
vi.mock('../src/db/schema', () => ({ members: {} }))
vi.mock('drizzle-orm', () => ({ sql: () => ({}) }))
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

  it('explains a drizzle-kit exit that happens during the push, and only then', async () => {
    const exitEvents = new EventEmitter()
    const nextBuild = vi.fn(async () => 0)
    const pushSchema = async () => {
      exitEvents.emit('exit', 0)
      exitEvents.emit('exit', 1)
    }
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' }, { pushSchema, nextBuild }, 1000, exitEvents)).toBe(0)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('PREVIEW SCHEMA PUSH FAILED: drizzle-kit exited during the schema push')

    exitEvents.emit('exit', 1)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(exitEvents.listenerCount('exit')).toBe(0)
  })

  it('stops listening for exits after a failed or timed-out push', async () => {
    const exitEvents = new EventEmitter()
    const nextBuild = vi.fn(async () => 0)
    const hang = () => new Promise<void>(() => {})
    expect(await runVercelBuild({ VERCEL_ENV: 'preview' }, { pushSchema: hang, nextBuild }, 10, exitEvents)).toBe(1)
    expect(exitEvents.listenerCount('exit')).toBe(0)
  })

  it('never listens for exits outside previews', async () => {
    const exitEvents = new EventEmitter()
    const on = vi.spyOn(exitEvents, 'on')
    await runVercelBuild({ VERCEL_ENV: 'production' }, undefined, undefined, exitEvents)
    expect(on).not.toHaveBeenCalled()
  })
})
