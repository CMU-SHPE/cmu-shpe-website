# CMU SHPE Website

The public website for the Society of Hispanic Professional Engineers (SHPE) chapter at
Colorado Mesa University, served at [shpecmu.com](https://shpecmu.com).

Built with [Next.js](https://nextjs.org) 14 (App Router), React 18, TypeScript, and
[Tailwind CSS](https://tailwindcss.com), and deployed on [Vercel](https://vercel.com).

## Getting started

Requires Node.js (CI runs on Node 24 — see `.github/workflows/ci.yml`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build the site for production (`.next/`) |
| `npm start` | Serve the production build locally (`next start`) |
| `npm run lint` | Run ESLint (`next lint`) |
| `npm test` | Run the test suite ([Vitest](https://vitest.dev) + React Testing Library) |

## Project structure

```
src/
  app/          Routes (App Router) — one page.tsx per route: /, /about, /contact,
                /events, /officers, /sponsors — plus the root layout and global CSS
  components/   Shared UI: Navbar, Footer, ThemeProvider (dark mode), OfficerAvatar,
                SponsorLogo, and the shared icon set (icons.tsx)
  lib/          Site content and config as typed data — see "Editing content" below
```

## Editing content

Most day-to-day updates (new officers, sponsors, events, or chapter info) don't require
touching any page component — they're data-driven from `src/lib/`:

- `src/lib/officers.ts` — executive board + faculty advisor (name, role, major, bio,
  email, LinkedIn, photo)
- `src/lib/sponsors.ts` — sponsors and their tier (Platinum/Gold/Silver/Bronze)
- `src/lib/events.ts` — event listings shown on the home and events pages
- `src/lib/config.ts` — chapter-wide settings: contact email, meeting time/location,
  social links, and the Formspree endpoint used by the contact form
- `src/lib/about.ts`, `src/lib/home.ts`, `src/lib/nav.ts` — About-page copy, homepage
  stats/pillars, and the main nav links

Officer and sponsor photos go in `public/officers/` and `public/sponsors/` respectively;
reference them from the corresponding `photo`/`logo` field. Both `OfficerAvatar` and
`SponsorLogo` fall back to initials or a placeholder if an image is missing or fails to
load, so a new entry doesn't need a photo to ship.

## Testing

```bash
npm test
```

Runs in `.github/workflows/ci.yml` on every push to `main` and every pull request
(lint, test, build).

## Deployment

The site is deployed on Vercel, connected to this GitHub repository: every push to
`main` deploys to production, and every pull request gets its own preview URL. The
custom domain `shpecmu.com` is configured in the Vercel project settings rather than a
`CNAME` file. `.github/workflows/ci.yml` only runs checks (lint/test/build) — it does
not deploy anything.
