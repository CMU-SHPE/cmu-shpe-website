# CMU SHPE Website

The public website for the Society of Hispanic Professional Engineers (SHPE) chapter at
Colorado Mesa University, served at [shpecmu.com](https://shpecmu.com).

Built with [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript and
[Tailwind CSS](https://tailwindcss.com). Content lives in [Neon](https://neon.tech) Postgres
through [Drizzle ORM](https://orm.drizzle.team), admin and member sign-in use
[Auth.js](https://authjs.dev), account emails are sent with [Resend](https://resend.com),
uploaded images go to [Vercel Blob](https://vercel.com/docs/vercel-blob), and the site is
deployed on [Vercel](https://vercel.com).

## What officers can do

Chapter officers sign in and edit the whole site without touching code:

- **Page text** — the headings and paragraphs on the public pages and in the footer are
  edited in place (see [Editing the site](#editing-the-site)). The SHPE @ CMU title,
  navigation, buttons and form labels stay fixed.
- **Officers and faculty advisor** — add, edit, reorder and remove people, with a
  square-cropped photo.
- **Sponsors** — name, tier, website, description, logo (with cropping) and the logo
  tile's background color; reorder within a tier. Each sponsor's **Details** page shows
  the accounts linked to it, their edit history and its receipts (see
  [Sponsor portal](#sponsor-portal)).
- **Events** — title, description, location, type, date, optional time and optional
  capacity. Events move from Upcoming to Past on their own, using Denver time. Each event
  shows its RSVP count, the attendee list (name and email) and a CSV download of it.
- **Page lists** — the home page stats and pillars, the SHPE National stats on the About
  page, and the sponsor benefits table.
- **Site settings** — contact email, weekly meeting day, time and location, social links
  (a blank link hides its icon), the contact form's subject options and the chapter's
  mailing address for newsletters.
- **Members** — search member accounts by name or email, see whether each confirmed their
  email, how many newsletters they chose and which sponsor listing they are linked to,
  give a confirmed member sponsor access or take it away, and delete an account (see
  [Member accounts](#member-accounts)).
- **Newsletter topics** — add, edit, reorder and delete the topics members can choose.
  Deleting a topic removes every member's choice of it.
- **Admin accounts** — the master admin creates and removes the other admin accounts, and
  can allow individual admins to create accounts too. Those admins can only add regular
  admins and see the account list by name and role; email addresses, deleting accounts,
  resetting passwords and changing permissions stay with the master. The master's list
  also shows who created each account (— for the original master account, accounts made
  before this was recorded, or when the creator has since been deleted).

## Getting started

Requires Node.js 24 (the version CI runs — see `.github/workflows/ci.yml`) and a Neon
Postgres database. `npm run db:push` fails on Node 20.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. Every variable is described in [`.env.example`](.env.example):
`DATABASE_URL`, `AUTH_SECRET`, `MASTER_EMAIL`, `MASTER_PASSWORD`,
`BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` (plus
`AUTH_TRUST_HOST` for `npm start` on localhost). Without the Resend variables the site
runs but sends no account emails: sign-up shows an error, while new confirmation links and
password resets only log the failure and still tell the visitor to check their email.
`SITE_URL` is optional
locally: links in emails use `http://localhost:3000` under `npm run dev`, and a local
`npm start` needs it set (for example `SITE_URL=http://localhost:3000`).

### First-time database setup

```bash
npm run db:push
npm run db:seed
```

`db:push` creates the tables. `db:seed` fills them with the site's current content and
creates the master admin from `MASTER_EMAIL` and `MASTER_PASSWORD` (12+ characters). It is
safe to run again: it never overwrites text an officer has edited, only fills tables that
are still empty, and only creates the master admin while no admin exists.

`drizzle/` holds the generated SQL for the current schema so changes can be reviewed.
After editing `src/db/schema.ts`, run `npm run db:generate` and commit the new file with
the schema change, then apply it with `npm run db:push`.

### Recovering the master account

If the master admin forgets their password or loses access to their email, someone with
the database connection string puts the new values in `.env.local`, with the password in
single quotes so characters such as `#` are kept (the password itself can't contain `'`):

```
MASTER_EMAIL=new-master@example.com
MASTER_PASSWORD='the new password'
```

then runs:

```bash
npm run db:reset-master
```

It moves the master account to `MASTER_EMAIL`, sets its password to `MASTER_PASSWORD`,
clears the failed sign-ins recorded against both emails and signs out every existing
master session. It reports the new password's length; if that doesn't match what you
typed, fix the quoting and run it again. Variables already set in the shell take
precedence over `.env.local`. Other admins are left alone; the master resets their
passwords from **Admin accounts**.

### Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in at
[http://localhost:3000/login](http://localhost:3000/login).

The local site uses whichever database `DATABASE_URL` points at. With the production
connection string, edits made locally change the live site.

## Editing the site

1. Open any page and choose **Sign in** in the footer (or go to `/login`).
2. While signed in, click any heading or paragraph to edit it in place, then choose
   **Save changes** (or **Discard**). Lists such as the About page values take one item
   per line. The Privacy Policy and Terms of Use pages are required disclosures for member
   accounts: edit them to keep them accurate, but never blank a section.
3. Choose **Admin** in the top bar for everything else: officers, sponsors, events, page
   lists, site settings, members and newsletter topics.
4. Choose **Change password** in the admin sidebar to change your own password. The master
   admin can reset another admin's password from **Admin accounts** and share it with them
   directly. Either change signs that account out on every other device.
5. **Admin accounts** appears in the sidebar for the master and for any admin the master has
   allowed to create accounts. The master turns that on or off per admin with the **Can
   create accounts** button next to their name; the change applies on that admin's next
   page load. Every new account starts as a regular admin without the permission.

Images uploaded in the admin are stored in Vercel Blob. Fields that take an image also
accept a path to a file in `public/` (for example `/officers/jeff.jpg`) or an `https://`
link. Officers without a photo show their initials.

## Member accounts

Anyone 13 or older can create a member account to choose which newsletters they want and
to RSVP to events.

- **Sign-up:** `/join` asks for a name, email and password, and sends a confirmation link
  that works for 24 hours. The account can't sign in until the email is confirmed.
  Confirming asks for the password chosen at sign-up, so if someone else signed up with
  the same address later, the owner's click can't activate the account with that person's
  password; a wrong password leaves the link working. Didn't get it? `/join/resend` sends
  a new link. Accounts never confirmed are deleted once they are 7 days old and have no
  unexpired link; there is no scheduled job, so this happens the next time anyone signs
  up or asks for a new link.
- **Signing in:** members use the same **Sign in** page as admins and land on `/account`;
  sponsors land on `/sponsor` instead.
- **`/account`:** change name and password, choose newsletter topics, see and cancel
  upcoming RSVPs, and **Delete my account** (asks for the password and the word DELETE;
  it removes the account, its newsletter choices and its RSVPs right away). Sponsors also
  get a **Sponsor portal** link here.
- **RSVPs:** any signed-in member with a confirmed email can RSVP to an upcoming event on
  `/events` and cancel before it happens. See [Sponsor portal](#sponsor-portal) for
  capacity and the attendee CSV.
- **Forgot password:** `/forgot-password` emails a reset link that works for 1 hour.
  Admins don't get one; the master resets admin passwords from **Admin accounts**.
- **Removing a member:** in the admin, **Members** → **Delete** next to their name. This
  also removes their newsletter choices, RSVPs and pending email links. Any sponsor listing
  edits they made stay in that listing's history under the name they had at the time,
  marked "(account deleted)".
- **Privacy Policy and Terms of Use** (`/privacy`, `/terms`) are linked from the footer
  and edited in place like other page text. They are required disclosures for member
  accounts: keep them accurate and never blank a section. New sign-ups record the
  Privacy Policy's "Last updated" date as the version they agreed to.
- **Newsletters aren't sent yet.** Members' topic choices are saved for when sending is
  added, and sending will require the **Mailing address** in **Site settings** (CAN-SPAM).

## Sponsor portal

Sponsors are member accounts linked to a sponsor listing. A listing can have several
linked accounts; an account can be linked to one listing.

- **Giving access:** the sponsor's contact creates a normal member account at `/join` and
  confirms their email. An admin then opens **Members**, picks the listing next to their
  name and chooses **Make sponsor**. Unconfirmed accounts can't be linked. **Change
  listing** moves a sponsor to another listing and **Remove sponsor access** makes them a
  supporter again. Deleting a listing removes sponsor access from everyone linked to it
  (the confirmation says so) and deletes its receipts and edit history.
- **`/sponsor`:** sponsors edit their own listing's name, website, description, logo (by
  uploading and cropping; they can't paste an image link) and logo background color.
  Changes are live on `/sponsors` straight away. Tier and order stay with admins. The page
  also lists upcoming events with RSVP buttons, the sponsor's RSVPs and their receipts.
  The listing is always the one the signed-in account is linked to, decided on the server.
  Admins who open `/sponsor` see a preview where they can edit the page's text. Search
  engines are asked not to index it.
- **Edit history:** every save that changes something records who made it (their name at
  the time), when and which fields changed. Admins see it on the listing's **Details**
  page, newest first. A deleted account's entries stay, marked "(account deleted)".
- **Receipts:** admins upload PDF receipts (title, date, file up to 4 MB, checked to really
  be a PDF) on the listing's **Details** page and can delete them. They are stored in the
  database, not in Vercel Blob, so they are never at a public URL. Only admins and the
  accounts linked to that listing can download them, and every download is sent as a
  private, uncached attachment.
- **RSVPs and capacity:** an event's optional capacity is enforced when the RSVP is saved,
  so two people can't take the last place at once. Full events show **Full**; capped
  events show how many spots are left. RSVPs are only possible for upcoming events.
- **Attendee CSV:** **Events** → an event's attendees → download a CSV of name, email and
  RSVP time (UTC). Cells that a spreadsheet would read as a formula are escaped. The file
  holds members' personal information: keep it to the people running the event.

### Production steps for stage 3

- **Schema:** apply the new columns and tables (`members.sponsor_id`, `events.capacity`,
  `sponsors.description`, `event_rsvps`, `sponsor_edits`, `sponsor_receipts`) to production
  with `npm run db:push` *before* merging, as described under
  [Preview databases](#preview-databases).
- **Policy text:** `npm run db:seed` never overwrites `site_content` rows that already exist,
  so production keeps its current Privacy Policy and Terms of Use until they are updated
  by hand. Either an admin edits them in place on `/privacy` and `/terms`, or someone
  deliberately writes the new defaults from `src/db/seed-data/content.ts` into those rows.
  The keys that changed are `privacy.updated`, `privacy.collect.items`,
  `privacy.use.items`, `privacy.retention.items`, `privacy.choices.items`, `terms.updated`
  and `terms.use.items`. Update `privacy.updated` last: new sign-ups record it as the
  policy version they agreed to.
- **Sponsor portal text:** the `sponsor.*` keys are new, so the portal shows their defaults
  until an admin edits them; running `npm run db:seed` also stores them.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build the site for production (`.next/`) |
| `npm run vercel-build` | Vercel's build: on previews, apply the schema to the preview database, then build |
| `npm start` | Serve the production build locally (`next start`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite ([Vitest](https://vitest.dev) + React Testing Library) |
| `npm run test:db` | Run the database tests against a throwaway Postgres in Docker (see [Database tests](#database-tests)) |
| `npm run test:e2e` | Run the [Playwright](https://playwright.dev) smoke tests against a preview deployment (see [Testing](#testing)) |
| `npm run db:push` | Create or update the database tables from `src/db/schema.ts` |
| `npm run db:generate` | Generate SQL migration files from the schema into `drizzle/` |
| `npm run db:seed` | Seed the database with the site's content and the master admin |
| `npm run db:reset-master` | Move the master account to `MASTER_EMAIL` and reset its password |

## Project structure

```
src/
  app/          Routes (App Router): the public pages, /login, the member pages
                (/join, /account, /forgot-password, /reset-password, /privacy,
                /terms), the sponsor portal (/sponsor, with receipt downloads at
                /sponsor/receipts/[id]), and the /admin pages, each with their
                server actions
  components/   Shared UI: Navbar, Footer, ThemeProvider (dark mode), the inline
                editor (editable.tsx), admin form components, and the RSVP (rsvp/)
                and sponsor portal (sponsor/) components
  db/           Drizzle schema, the Neon client, and the seed script with its data
                in seed-data/
  lib/          Queries, validation schemas, auth helpers and other shared logic
```

## Testing

```bash
npm test
```

Runs in `.github/workflows/ci.yml` on every push to `main` and every pull request
(lint, test, build).

### Database tests

```bash
npm run test:db
```

Runs the `*.db.test.ts` files against a real Postgres 17 so queries, `db.batch`
transactions and locking behave as they do in production. It needs Docker and nothing
else: no `.env.local`, no Neon account. The script starts a throwaway Postgres and a
[local Neon HTTP proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) (so the
production `@neondatabase/serverless` driver runs unchanged), applies the committed
`drizzle/` migrations, adds a few rows, then brings the schema up to date with the same
push a preview build runs. Both containers are removed afterwards, even if a test fails.
The tests refuse to run against anything but that local database. `npm test` skips these
files and never needs Docker; pass a path to run one file, e.g.
`npm run test:db -- src/db/harness.db.test.ts`.

### Preview smoke tests

`e2e/` holds Playwright tests for sign-up, the resend-confirmation and forgot-password
forms (which must answer known and unknown addresses alike), broken confirmation and
reset links, the signed-out redirects from `/account` and `/admin`, the Privacy and Terms
links, and an axe WCAG 2.1 AA scan of each account page in light and dark mode. They run
by hand against a **preview** deployment, never in CI and never against production: the
config refuses any URL that isn't a Vercel preview or localhost. They create unconfirmed
accounts for `delivered+…@resend.dev` (Resend's test inbox), which are deleted like any
other unconfirmed account once they are 7 days old.

```bash
npx playwright install chromium   # once
BASE_URL=https://<preview>.vercel.app VERCEL_BYPASS=<protection bypass secret> npm run test:e2e
```

`VERCEL_BYPASS` is only needed when the preview has Deployment Protection on; it is sent
as `x-vercel-protection-bypass` to the preview's own origin only.

## Deployment

The site is deployed on Vercel, connected to this GitHub repository: every push to
`main` deploys to production, and every pull request gets its own preview URL. The
custom domain `shpecmu.com` is configured in the Vercel project settings rather than a
`CNAME` file. `.github/workflows/ci.yml` only runs checks (lint/test/build) — it does
not deploy anything.

The Vercel project needs `DATABASE_URL`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`,
`RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` (the verified Resend domain emails are sent
from). Links in emails use the deployment's own URL; set `SITE_URL` (an `https://`
address) only for Production, and only if that URL should differ from the project's
production domain. `MASTER_EMAIL` and `MASTER_PASSWORD` are only read by
`npm run db:seed` and `npm run db:reset-master`.

### Preview databases

Neon's preview branching is enabled on the database's Vercel connection (Deployments
Configuration → **Preview**, with **Resource must be active before deployment** on). Each
git branch's previews share one Neon branch, `preview/<git-branch>`: a copy of
production's data taken at that branch's first preview, so editing a preview never
changes the live site.

- **Images:** previews upload to production's Blob store and never delete images, because
  their copied rows still point at production's images. Images uploaded from previews
  are left behind.
- **Sign-in:** Preview must have its own `AUTH_SECRET`. A preview's copy can hold an old
  password hash, and a session signed with production's secret would be accepted by
  production.
- **Schema changes:** Vercel runs `npm run vercel-build` instead of `build`. On preview
  deployments it applies `src/db/schema.ts` to that preview's Neon branch before building.
  If a change would delete data already in the preview's tables, or drizzle-kit can't
  tell a rename from a drop-and-create, nothing is applied and the preview build fails;
  apply that change to the preview branch by hand. Production and local builds never
  touch the schema: apply production changes yourself with `npm run db:push` against
  production's connection string *before* merging to `main`, because the new code
  queries the new columns as soon as it deploys. Give every table a single-column primary
  key; for a join table use a serial `id` plus a unique index on the pair, not a composite
  primary key. The preview push can't read composite primary keys back, so every later
  preview build would fail.
- **Cleanup:** `.github/workflows/preview-db-cleanup.yml` deletes a pull request's Neon
  branch when it closes. It needs a `NEON_PROJECT_ID` repository variable and a
  `NEON_API_KEY` repository secret. GitHub doesn't run it for a pull request closed
  while it has merge conflicts; delete that branch by running the workflow by hand
  (Actions → **Clean up preview database** → **Run workflow**, or
  `gh workflow run preview-db-cleanup.yml -f branch=preview/<git-branch>`), or from the
  Neon console's **Branches** page. When nothing matches, the run shows a warning and lists
  every branch in the Neon project. The free Neon plan allows 10 branches per project.
