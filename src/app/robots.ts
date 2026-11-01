import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Rules match by prefix, so /sponsor alone would also hide the public /sponsors page.
const PRIVATE_PATHS = [
  '/admin',
  '/account',
  '/sponsor$',
  '/sponsor/',
  '/login',
  '/unsubscribe',
  '/forgot-password',
  '/reset-password',
  '/join/',
  '/api/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
