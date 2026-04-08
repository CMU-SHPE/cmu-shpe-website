/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Set NEXT_PUBLIC_BASE_PATH to your repo name when deploying to GitHub Pages.
  // e.g. if your site lives at https://username.github.io/cmu-shpe-website
  // set it to '/cmu-shpe-website' in the GitHub Actions workflow.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
}

module.exports = nextConfig
