# Codebase audit — cmu-shpe-website (2026-07-26)

Audited the whole repo (39 tracked files: Next.js 14 App Router static site, Tailwind,
7 pages, 5 components, 7 data modules under `src/lib`). No test suite, no CI beyond the
GitHub Pages deploy workflow. Headline risk is low-severity — this is a small content
site — but there are two real content/logic defects worth a fix, plus a sizeable chunk
of copy-pasted SVG icon markup across 6+ files that will drift the next time an icon or
brand color changes.

Findings: 7 · bugs 3 · debt 2 · tests 1 · arch 1

---

## [1] Adrian Valencia's officer bio is a copy-pasted photographer bio, not his actual role

**Class:** bugs · **Suggested labels:** `type:bug`, `priority:p2` · **Files:** `src/lib/officers.ts:93-101`

### Problem
In `src/lib/officers.ts`, the `officers` array entry for Adrian Valencia (`role: 'Outreach
Chair'`) has `bio: "Documenting our chapter's events and activities through photography to
share with our members and the community."` — this is word-for-word the bio already used
for Randy Martinez, whose role is `'Photographer'` (line 87). The bio has nothing to do
with outreach and will be published on the live `/officers` page as-is, misrepresenting
what Adrian actually does for the chapter.

### Proposed Solution
Write a real bio for Adrian Valencia reflecting the Outreach Chair role (or leave it
blank if none is available yet — the field is optional in the `Officer` type).

### Acceptance Criteria
- [ ] Adrian Valencia's bio on `/officers` describes outreach responsibilities, not photography
- [ ] No two officers share an identical bio string unless intentional

---

## [2] Sponsor "SGM" is filed under the Gold comment block but carries a Platinum tier value

**Class:** bugs · **Suggested labels:** `type:bug`, `priority:p2` · **Files:** `src/lib/sponsors.ts:28-35`

### Problem
`src/lib/sponsors.ts` groups sponsor entries under section comments (`── Platinum ──`,
`── Gold ──`, etc.). The SGM entry sits directly under the `── Gold ──` comment (line 28)
but its `tier` field is set to `'Platinum'` (line 31), not `'Gold'`. Since the actual
rendering on both the homepage sponsor strip and the `/sponsors` tier table sorts and
groups purely by the `tier` field (not by comment position), SGM is displayed and
benefits-gated as a Platinum sponsor. If Gold was the intended (or contracted) tier, the
site is currently over-crediting SGM's sponsorship level; if Platinum is correct, the
stale comment will mislead the next editor into "fixing" it incorrectly.

### Proposed Solution
Confirm SGM's actual sponsorship tier with whoever manages sponsorships, then either
correct the `tier` value to `'Gold'` or move the entry under the `── Platinum ──` comment
block to match reality.

### Acceptance Criteria
- [ ] SGM's `tier` field and its surrounding comment section agree
- [ ] SGM renders in the correct tier group on `/` and `/sponsors`

---

## [3] Theme toggle icon shows the wrong state on first paint for dark-mode visitors

**Class:** bugs · **Suggested labels:** `type:bug`, `priority:p2` · **Files:** `src/components/ThemeProvider.tsx:17-22`, `src/app/layout.tsx:19-26`

### Problem
`layout.tsx` runs an inline synchronous script that adds the `dark` class straight to
`<html>` from `localStorage` before paint, specifically to avoid a flash of the wrong
*background* theme. But `ThemeProvider` (`src/components/ThemeProvider.tsx:17`) always
initializes its React `theme` state to `'light'` on mount, and only reads `localStorage`
inside a `useEffect` that runs after the first render. `Navbar` reads `theme` from that
context to pick the Sun/Moon icon (`src/components/Navbar.tsx:67,78`). Result: a returning
visitor with dark mode saved sees correct dark backgrounds/colors immediately (driven by
the DOM class), but the theme-toggle icon briefly renders as if the site were in light
mode, then flips right after hydration — a visible, confusing icon flash specifically on
the control whose only job is to show current theme.

### Proposed Solution
Have `ThemeProvider` read the already-applied DOM class (`document.documentElement.classList.contains('dark')`)
synchronously during initial state instead of defaulting to `'light'` and waiting for an
effect — e.g. `useState(() => ...)` with a guarded `typeof document !== 'undefined'` check,
or read `localStorage` directly in the initializer. This keeps the single source of truth
(the inline pre-paint script's decision) consistent with React state from the first render.

### Acceptance Criteria
- [ ] Loading any page with `theme=dark` in `localStorage` shows the Sun icon (dark-mode-active state) immediately, with no post-hydration flip
- [ ] Light-mode visitors see no change in behavior

---

## [4] The same set of social-media/location/checkmark SVG icons is hand-copied across 6+ files

**Class:** debt · **Suggested labels:** `type:chore`, `priority:p2` · **Files:** `src/components/Footer.tsx`, `src/app/contact/page.tsx`, `src/app/officers/page.tsx`, `src/app/about/page.tsx`, `src/app/sponsors/page.tsx`, `src/app/events/page.tsx`, `src/app/page.tsx`

### Problem
The Instagram/LinkedIn/X/YouTube/TikTok/"Presence" icon paths appear as full, identical
inline `<svg>` blocks in both `Footer.tsx` and `contact/page.tsx`'s local `SocialLink`
usages — a complete second copy of the same five-icon set. The LinkedIn icon alone is
duplicated a third time in `officers/page.tsx`. The location-pin icon is duplicated across
`page.tsx` (home), `events/page.tsx`, and `contact/page.tsx`'s `InfoRow`. The checkmark
icon is duplicated between `about/page.tsx`'s values list and `sponsors/page.tsx`'s `Check`
component. None of this logic differs between copies — only the wrapping element changes.
Any future icon fix, a11y attribute addition, or brand tweak to one of these marks means
hunting down every copy by hand, and it's easy to update some but miss others (as already
happened: the Instagram/YouTube/TikTok icon paths in `Footer.tsx` and the `Contact` page
copy are byte-for-byte identical today, but there's nothing enforcing that they stay that
way).

### Proposed Solution
Extract a small `src/components/icons.tsx` (or similar) exporting named icon components
(`InstagramIcon`, `LinkedInIcon`, `LocationIcon`, `CheckIcon`, etc.) and swap every inline
copy for an import. Optionally also extract the repeated `SocialLink`-shaped anchor
wrapper used in both `Footer.tsx` and `contact/page.tsx` into one shared component driven
by `config.social`.

### Acceptance Criteria
- [ ] Each icon's SVG markup exists in exactly one place in the codebase
- [ ] Visual output on Footer, Contact, Officers, About, Sponsors, Events, and Home pages is unchanged

---

## [5] Formspree endpoint is hardcoded in the Contact page component with a stale setup comment

**Class:** debt · **Suggested labels:** `type:chore`, `priority:p2` · **Files:** `src/app/contact/page.tsx:28-34`

### Problem
`handleSubmit` in `contact/page.tsx` posts directly to a hardcoded
`https://formspree.io/f/mwvwddro` URL, with a leftover comment above it ("Replace
YOUR_FORM_ID with your Formspree form ID. Sign up for free at https://formspree.io to get
one.") describing a setup step that has already been completed — the ID is filled in.
Every other piece of chapter-specific configuration (contact email, meeting time/location,
social links) lives in `src/lib/config.ts`; the Formspree endpoint is the one exception,
buried inside a page component instead.

### Proposed Solution
Move the Formspree endpoint into `src/lib/config.ts` alongside the other contact settings
and remove the stale setup comment now that the ID is populated.

### Acceptance Criteria
- [ ] Formspree URL is read from `src/lib/config.ts`, not hardcoded in the component
- [ ] No leftover "replace YOUR_FORM_ID" instructional comment remains in shipped code

---

## [6] No test coverage for any stateful logic (theme persistence, form submission states, image fallback)

**Class:** tests · **Suggested labels:** `type:chore`, `priority:p2` · **Files:** `src/components/ThemeProvider.tsx`, `src/app/contact/page.tsx`, `src/components/OfficerAvatar.tsx`, `src/components/SponsorLogo.tsx`, `package.json`

### Problem
There is no test framework configured at all (`package.json` has no `test` script, no
Jest/Vitest/RTL/Playwright dependency). Several components carry non-trivial branching
logic that a future edit could silently break with no signal: `ThemeProvider`'s
init/toggle/persist cycle (compounded by finding [3] above), `Contact`'s
`idle → loading → success/error` state machine including its retry path, and the
`onError` image-fallback-to-placeholder logic shared by `OfficerAvatar` and `SponsorLogo`.
None of this is exercised by anything beyond manual clicking.

### Proposed Solution
Add Vitest + React Testing Library (lighter weight than Jest for a Next 14 App Router
project) and cover at minimum: theme toggle persists to `localStorage` and updates the
`dark` class; the contact form transitions through its states and shows the fallback email
on error; `OfficerAvatar`/`SponsorLogo` fall back to initials/placeholder on image error.

### Acceptance Criteria
- [ ] `npm test` runs a suite covering the three areas above
- [ ] CI (or at least a documented local command) runs the suite before deploy

---

## [7] No `robots.txt` or `sitemap.xml` for a public marketing site

**Class:** arch · **Suggested labels:** `type:feature-enhancement`, `priority:p2` · **Files:** `public/`, `next.config.js`

### Problem
The site is a public-facing recruiting/marketing page for the chapter (custom domain via
`public/CNAME`, static export via `next.config.js`), but ships no `robots.txt` and no
generated `sitemap.xml`. With `output: 'export'`, Next's `app/sitemap.ts`/`app/robots.ts`
route handlers aren't available at runtime the way they are on a server deployment, but a
static `public/robots.txt` and a build-time-generated `sitemap.xml` are still
straightforward to add and currently missing entirely, which can slow search-engine
discovery of the six routes.

### Proposed Solution
Add a static `public/robots.txt` allowing all crawlers and pointing at the sitemap, plus
either a hand-maintained `public/sitemap.xml` (only 6 routes, low maintenance) or a small
build script that emits one from `src/lib/nav.ts`'s route list.

### Acceptance Criteria
- [ ] `https://shpecmu.com/robots.txt` resolves and references the sitemap
- [ ] `https://shpecmu.com/sitemap.xml` lists all six routes

---

## Not filed

- **Contact form Formspree ID is "hardcoded" / exposed client-side** — considered as a
  potential secret-leak bug, but Formspree form IDs are meant to be embedded in
  client-side code (they're not credentials; Formspree's own quickstart tells you to paste
  the endpoint straight into your HTML/JS). Folded the hardcoding concern into [5] as a
  config-location debt item instead of a security bug.
- **`jgms.png` sponsor logo is ~239KB** — large for a static logo but `images.unoptimized`
  is intentional (static export), traffic is low, and it's a one-time asset; not worth a
  ticket on its own.
