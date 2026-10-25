import { spawn } from 'node:child_process'

export const SCHEMA_PUSH_TIMEOUT_MS = 120_000

export type BuildSteps = {
  pushSchema: () => Promise<void>
  nextBuild: () => Promise<number>
}

export function shouldPushSchema(vercelEnv: string | undefined) {
  return vercelEnv === 'preview'
}

export class SchemaPushRefusedError extends Error {
  name = 'SchemaPushRefusedError'
}

export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${ms / 1000}s`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

// drizzle-kit's `push` CLI exits 0 when it can't show its data-loss prompt without a TTY,
// so the build would pass on a stale schema. The API reports data loss before writing anything.
export async function pushPreviewSchema(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new SchemaPushRefusedError('DATABASE_URL is not set for this preview')

  const [{ pushSchema }, { neon }, { drizzle }, { sql }, schema] = await Promise.all([
    import('drizzle-kit/api'),
    import('@neondatabase/serverless'),
    import('drizzle-orm/neon-http'),
    import('drizzle-orm'),
    import('../src/db/schema'),
  ])
  const db = drizzle(neon(databaseUrl))
  // drizzle-kit exits with code 1 and no message when introspection fails, so surface connection errors here.
  await db.execute(sql`select 1`)
  const plan = await pushSchema({ ...schema }, db)

  if (plan.hasDataLoss || plan.warnings.length > 0) {
    console.error('Refusing to push: these changes would lose data on the preview database.')
    for (const warning of plan.warnings) console.error(warning)
    for (const statement of plan.statementsToExecute) console.error(`  ${statement}`)
    throw new SchemaPushRefusedError('schema change would lose data; apply it by hand')
  }

  if (plan.statementsToExecute.length === 0) {
    console.log('Preview database schema is up to date.')
    return
  }

  console.log('Applying schema changes to the preview database:')
  for (const statement of plan.statementsToExecute) console.log(`  ${statement}`)
  await plan.apply()
}

export function runNextBuild() {
  return new Promise<number>((resolve) => {
    const child = spawn('next', ['build'], { stdio: 'inherit' })
    child.on('error', (error) => {
      console.error('Could not start next build:', error)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

export const defaultSteps: BuildSteps = {
  pushSchema: () => pushPreviewSchema(process.env.DATABASE_URL),
  nextBuild: runNextBuild,
}

function failureReason(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message
}

export async function runVercelBuild(
  env: Record<string, string | undefined>,
  steps: BuildSteps = defaultSteps,
  timeoutMs = SCHEMA_PUSH_TIMEOUT_MS,
) {
  if (shouldPushSchema(env.VERCEL_ENV)) {
    try {
      await withTimeout(steps.pushSchema(), timeoutMs, 'Preview schema push')
    } catch (error) {
      console.error('PREVIEW SCHEMA PUSH FAILED:', failureReason(error))
      return 1
    }
  }
  return steps.nextBuild()
}
