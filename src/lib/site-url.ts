const LOCAL_URL = 'http://localhost:3000'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

function isDeployed(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production' || vercelEnv === 'preview' || env('NODE_ENV') === 'production'
}

// A malformed or plain-http SITE_URL would put tokens in broken or interceptable links,
// so anything but a bare origin fails instead of being repaired.
function parseSiteUrl(value: string, deployed: boolean): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('SITE_URL is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('SITE_URL must be an http(s) URL')
  if (!/^\/+$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error('SITE_URL must be a bare origin, like https://example.com')
  }
  if (deployed && url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('SITE_URL must use https in production')
  }
  return url.origin
}

// Email links must never come from the request Host header, which a client controls.
export function siteUrl(): string {
  const vercelEnv = env('VERCEL_ENV')
  const deployed = isDeployed(vercelEnv)

  const explicit = env('SITE_URL')
  if (explicit) return parseSiteUrl(explicit, deployed)

  const vercelHost =
    vercelEnv === 'production'
      ? env('VERCEL_PROJECT_PRODUCTION_URL')
      : vercelEnv === 'preview'
        ? (env('VERCEL_BRANCH_URL') ?? env('VERCEL_URL'))
        : undefined
  if (vercelHost) return parseSiteUrl(`https://${vercelHost}`, deployed)

  if (deployed) throw new Error('SITE_URL is not set and no Vercel URL is available')

  return LOCAL_URL
}
