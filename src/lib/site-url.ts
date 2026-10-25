const LOCAL_URL = 'http://localhost:3000'

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

// Email links must never come from the request Host header, which a client controls.
export function siteUrl(): string {
  const explicit = env('SITE_URL')
  if (explicit) return withoutTrailingSlash(explicit)

  const vercelEnv = env('VERCEL_ENV')
  const vercelHost =
    vercelEnv === 'production'
      ? env('VERCEL_PROJECT_PRODUCTION_URL')
      : vercelEnv === 'preview'
        ? (env('VERCEL_BRANCH_URL') ?? env('VERCEL_URL'))
        : undefined
  if (vercelHost) return withoutTrailingSlash(`https://${vercelHost}`)

  const deployed = vercelEnv === 'production' || vercelEnv === 'preview' || env('NODE_ENV') === 'production'
  if (deployed) throw new Error('SITE_URL is not set and no Vercel URL is available')

  return LOCAL_URL
}
