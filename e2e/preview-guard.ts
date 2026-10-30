import type { FullConfig } from '@playwright/test'

/**
 * The one check that keeps e2e runs off production. The specs sign up accounts, send real email
 * and, in the journeys, create topics, sponsors and events and send a newsletter, so they may only
 * run against localhost or a preview deployment of this project.
 *
 * Production also answers on *.vercel.app hosts (the git-main alias and every production
 * deployment's own URL), so a host's shape can't prove it is a preview. Vercel's API can: every
 * non-local host is looked up there with VERCEL_TOKEN before any test starts, and only a
 * deployment of this project whose target is preview passes.
 */

const PROJECT = 'cmu-shpe-website'
const TEAM = 'shpecmu'
const VERCEL_API = 'https://api.vercel.com'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const PRODUCTION_HOSTS = new Set(['shpecmu.com', 'www.shpecmu.com', `${PROJECT}-git-main-${TEAM}.vercel.app`])
const DEPLOYMENT_HOST = new RegExp(`^${PROJECT}-[a-z0-9-]+-${TEAM}\\.vercel\\.app$`)

/** Set by the global setup once Vercel has confirmed the origin is a preview; workers inherit it. */
export const VERIFIED_ORIGIN_ENV = 'E2E_VERIFIED_PREVIEW_ORIGIN'

function refuse(action: string, host: string, reason: string) {
  return new Error(`Refusing to ${action} on ${host}: ${reason}`)
}

function isLocal(url: URL) {
  return LOCAL_HOSTS.has(url.hostname)
}

/** Checks the host's shape only, with no network request; returns the origin to test against. */
export function previewOrigin(baseURL: string | undefined, action = 'run e2e'): string {
  if (!baseURL) throw new Error(`Set BASE_URL to a preview deployment URL, e.g. BASE_URL=https://${PROJECT}-<hash>-${TEAM}.vercel.app`)
  const url = new URL(baseURL)
  if (isLocal(url)) return url.origin
  if (PRODUCTION_HOSTS.has(url.hostname)) throw refuse(action, url.hostname, 'it is the production site')
  if (url.protocol !== 'https:' || !DEPLOYMENT_HOST.test(url.hostname)) {
    throw refuse(action, url.hostname, `only localhost or an https://${PROJECT}-…-${TEAM}.vercel.app preview`)
  }
  return url.origin
}

type DeploymentLookup = { name?: unknown; target?: unknown }

/** Asks Vercel which deployment the host serves and refuses anything that isn't one of this project's previews. */
export async function verifyPreviewTarget(
  baseURL: string | undefined,
  { token = process.env.VERCEL_TOKEN, fetchImpl = fetch }: { token?: string; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const origin = previewOrigin(baseURL)
  const url = new URL(origin)
  if (isLocal(url)) return origin
  const host = url.hostname
  if (!token?.trim()) throw refuse('run e2e', host, 'set VERCEL_TOKEN so Vercel can confirm it is a preview deployment')

  let response: Response
  try {
    response = await fetchImpl(`${VERCEL_API}/v13/deployments/${encodeURIComponent(host)}?slug=${TEAM}`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    })
  } catch (error) {
    throw refuse('run e2e', host, `the Vercel API could not be reached (${error instanceof Error ? error.message : String(error)})`)
  }
  if (!response.ok) throw refuse('run e2e', host, `the Vercel API answered ${response.status} when asked which deployment it is`)

  const deployment = (await response.json()) as DeploymentLookup
  if (deployment.name !== PROJECT) throw refuse('run e2e', host, `it is not a ${PROJECT} deployment`)
  if (deployment.target !== null && deployment.target !== 'preview') {
    throw refuse('run e2e', host, `Vercel reports its target as ${String(deployment.target)}, not preview`)
  }
  return origin
}

/** For the specs: re-checks the host, and refuses a non-local one the global setup did not verify. */
export function assertPreviewTarget(baseURL: string | undefined, action: string) {
  const origin = previewOrigin(baseURL, action)
  if (isLocal(new URL(origin))) return
  if (process.env[VERIFIED_ORIGIN_ENV] !== origin) {
    throw refuse(action, new URL(origin).hostname, 'Vercel has not confirmed it is a preview (e2e/preview-guard.ts global setup did not run for it)')
  }
}

export default async function globalSetup(config: FullConfig) {
  for (const project of config.projects) {
    process.env[VERIFIED_ORIGIN_ENV] = await verifyPreviewTarget(project.use.baseURL)
  }
}
