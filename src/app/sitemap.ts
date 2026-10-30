import type { MetadataRoute } from 'next'
import { navLinks } from '@/lib/nav'
import { siteUrl } from '@/lib/site-url'

// SITE_URL and the Vercel URLs are only known at runtime, not at build time.
export const dynamic = 'force-dynamic'

const PUBLIC_PATHS = [...navLinks.map((link) => link.href), '/join', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return PUBLIC_PATHS.map((path) => ({ url: path === '/' ? base : `${base}${path}` }))
}
