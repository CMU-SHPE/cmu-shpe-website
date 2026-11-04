const GUIDE_SOURCES = ['./docs/guides/*.md']

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // The guides are read from disk when a page is requested, so the server functions need the files.
  outputFileTracingIncludes: {
    '/help/members': GUIDE_SOURCES,
    '/help/sponsors': GUIDE_SOURCES,
    '/help/print/public': GUIDE_SOURCES,
    '/admin/help': GUIDE_SOURCES,
    '/admin/help/print': GUIDE_SOURCES,
    '/admin/help/handbook.pdf': ['./docs/guides/pdf/*.pdf'],
  },
}

module.exports = nextConfig
