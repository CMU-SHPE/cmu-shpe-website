No robots.txt or sitemap.xml for a public marketing site

**Labels:** `type:feature-enhancement`, `priority:p2`  
**Estimated Hours:** 2  
**Issue Type:** Task

---

## Problem
The site is a public-facing recruiting/marketing page for the chapter (custom domain via
`public/CNAME`, static export via `next.config.js`), but ships no `robots.txt` and no
generated `sitemap.xml`. With `output: 'export'`, Next's `app/sitemap.ts`/`app/robots.ts`
route handlers aren't available at runtime the way they are on a server deployment, but a
static `public/robots.txt` and a build-time-generated `sitemap.xml` are still
straightforward to add and currently missing entirely, which can slow search-engine
discovery of the six routes.

## Proposed Solution
Add a static `public/robots.txt` allowing all crawlers and pointing at the sitemap, plus
either a hand-maintained `public/sitemap.xml` (only 6 routes, low maintenance) or a small
build script that emits one from `src/lib/nav.ts`'s route list.

## Acceptance Criteria
- [ ] `https://shpecmu.com/robots.txt` resolves and references the sitemap
- [ ] `https://shpecmu.com/sitemap.xml` lists all six routes
