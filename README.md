# CMU SHPE Website

The public website for the Society of Hispanic Professional Engineers (SHPE) chapter at
Colorado Mesa University, served at [shpecmu.com](https://shpecmu.com).

Built with [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript and
[Tailwind CSS](https://tailwindcss.com). Content lives in [Neon](https://neon.tech) Postgres
through [Drizzle ORM](https://orm.drizzle.team), admin and member sign-in use
[Auth.js](https://authjs.dev), account emails and newsletters are sent with [Resend](https://resend.com),
uploaded images go to [Vercel Blob](https://vercel.com/docs/vercel-blob), and the site is
deployed on [Vercel](https://vercel.com).

## What officers can do

Chapter officers sign in and edit the whole site without touching code:

- **Page text** — the headings and paragraphs on the public pages and in the footer are
  edited in place (see [Editing the site](#editing-the-site)). The SHPE @ CMU title,
  navigation, buttons and form labels stay fixed.
- **Officers and faculty advisor** — add, edit, reorder and remove people, with a
  square-cropped photo.
- **Sponsors** — name, tier, website, logo (with cropping) and the logo tile's background
  color; reorder within a tier.
- **Events** — title, description, location, type, date and optional time. Events move
  from Upcoming to Past on their own, using Denver time.
- **Page lists** — the home page stats and pillars, the SHPE National stats on the About
  page, and the sponsor benefits table.
- **Site settings** — contact email, weekly meeting day, time and location, social links
  (a blank link hides its icon), the contact form's subject options and the chapter's
  mailing address for newsletters.
- **Members** — search member accounts by name or email, see whether each confirmed their
  email and how many newsletters they chose, and delete an account (see
  [Member accounts](#member-accounts)).
- **Newsletter topics** — add, edit, reorder and delete the topics members can choose.
  Deleting a topic removes every member's choice of it.
- **Newsletters** — write a newsletter, pick its topics, preview it, send a test to
  yourself and send it to every confirmed member subscribed to one of those topics, then
  see who it reached (see [Sending a newsletter](#sending-a-newsletter)).
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
   lists, site settings, members, newsletter topics and newsletters.
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

Anyone 13 or older can create a member account to choose which newsletters they want.

- **Sign-up:** `/join` asks for a name, email and password, and sends a confirmation link
  that works for 24 hours. The account can't sign in until the email is confirmed.
  Confirming asks for the password chosen at sign-up, so if someone else signed up with
  the same address later, the owner's click can't activate the account with that person's
  password; a wrong password leaves the link working. Didn't get it? `/join/resend` sends
  a new link. Accounts never confirmed are deleted once they are 7 days old and have no
  unexpired link; there is no scheduled job, so this happens the next time anyone signs
  up or asks for a new link.
- **Signing in:** members use the same **Sign in** page as admins and land on `/account`.
- **`/account`:** change name and password, choose newsletter topics, and **Delete my
  account** (asks for the password and the word DELETE; it removes the account, its
  newsletter choices and its newsletter send and unsubscribe records right away).
- **Forgot password:** `/forgot-password` emails a reset link that works for 1 hour.
  Admins don't get one; the master resets admin passwords from **Admin accounts**.
- **Removing a member:** in the admin, **Members** → **Delete** next to their name. This
  also removes their newsletter choices, newsletter send and unsubscribe records, and
  pending email links.
- **Privacy Policy and Terms of Use** (`/privacy`, `/terms`) are linked from the footer
  and edited in place like other page text. They are required disclosures for member
  accounts: keep them accurate and never blank a section. New sign-ups record the
  Privacy Policy's "Last updated" date as the version they agreed to.
- **Newsletters** go only to confirmed members, from "SHPE @ CMU" at
  `news@<RESEND_EMAIL_DOMAIN>`, one email per member however many of the newsletter's
  topics they chose. Every one ends with the topics it was sent for, an unsubscribe link,
  a link to `/account` and the chapter's mailing address.
- **Unsubscribing:** the link in a newsletter opens `/unsubscribe`, which works without
  signing in. Opening it changes nothing; the member presses **Unsubscribe from** that
  newsletter's topics or **Unsubscribe from all newsletters**, and it takes effect right
  away. Mail apps' own unsubscribe button posts to `/unsubscribe/one-click` (the
  `List-Unsubscribe` header, RFC 8058), which removes that newsletter's topics; a plain
  GET there only redirects to `/unsubscribe`. Links never expire. Each unsubscribe is
  recorded (topic, time, and whether it came from the page or the one-click button) and
  deleted with the account.

### Sending a newsletter

1. **Admin** → **Newsletters** → **New newsletter**. Write the subject and body (plain
   text; blank lines start paragraphs and `https://` links become clickable) and tick the
   topics it is for. Every button saves the draft first; drafts can be reopened, edited
   and deleted from the list.
2. The **Preview** under the form shows the email as members will get it, footer
   included. **Send test to me** emails it to your own admin address with "[Test]" in
   front of the subject and a sample in place of the unsubscribe link.
3. **Review and send…** opens a confirmation page with the subject, topics and exact
   number of recipients. **Send to N people** starts sending. If the count changed since
   the page loaded, nothing is sent and the page asks you to check again.
4. Testing and sending both need the **Mailing address** in **Site settings** (CAN-SPAM
   requires it in every newsletter), plus `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`,
   `AUTH_SECRET` and a valid site URL. Without them the page says what is missing and
   sends nothing.
5. Emails go out in batches of 100. Sending stops after about four minutes per click to
   stay inside Vercel's time limit, and pauses if Resend asks it to slow down. The
   newsletter's page then says part of it is sent: press **Continue sending** (there or
   in the list) until it finishes. Nobody gets it twice.
6. Once sent, the newsletter's page shows who sent it and when, the topics, how many
   emails Resend accepted, failed, have an unknown outcome or were skipped (the member
   unsubscribed or lost confirmation before their turn), and lists everyone it didn't
   reach for certain. A sent newsletter can't be edited or deleted.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Build the site for production (`.next/`) |
| `npm run vercel-build` | Vercel's build: on previews, apply the schema to the preview database, then build |
| `npm start` | Serve the production build locally (`next start`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite ([Vitest](https://vitest.dev) + React Testing Library) |
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
                /terms), /unsubscribe and /unsubscribe/one-click, and the /admin
                pages (including /admin/newsletters), each with their server actions
  components/   Shared UI: Navbar, Footer, ThemeProvider (dark mode), the inline
                editor (editable.tsx), and admin form components
  db/           Drizzle schema, the Neon client, and the seed script with its data
                in seed-data/
  lib/          Queries, validation schemas, auth helpers and other shared logic,
                including newsletter rendering (newsletter-render.ts), sending
                (newsletter-send.ts) and unsubscribe links
                (newsletter-unsubscribe-token.ts)
```

## Testing

```bash
npm test
```

Runs in `.github/workflows/ci.yml` on every push to `main` and every pull request
(lint, test, build).

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

`e2e/newsletters.spec.ts` checks unsubscribe links. Without any setup it checks that
malformed and unknown links show the "This link doesn't work" page, that one-click POSTs
with them are refused (400 and 404), that a GET to `/unsubscribe/one-click` only redirects
to `/unsubscribe`, and runs axe on that page in light and dark mode.

The working-link tests (the form, its axe scans, a one-click POST and the **Unsubscribe
from all newsletters** button) skip unless `E2E_UNSUBSCRIBE_TOKEN` is set.

Preview and local databases are copies of production, so anywhere except production
(`VERCEL_ENV` other than `production`, including when it isn't set) a real send only goes
to confirmed accounts whose address ends in `@resend.dev` (Resend's test inboxes); the
composer and the send confirmation say so, and their recipient counts leave everyone else
out. Test sends to yourself are not restricted. To get a token:

1. On the preview, create an account with an address like
   `delivered+unsubscribe-e2e@resend.dev`, open its confirmation email in the Resend
   dashboard (**Emails**) and follow the link to confirm it.
2. Sign in as that account and choose at least one topic at `/account`.
3. As an admin, send a newsletter to that topic. Only `@resend.dev` accounts receive it.
4. Open that newsletter in the Resend dashboard and copy the `token=` value from its
   unsubscribe link.

A run unsubscribes that account, so each run needs a fresh token (or resubscribe the
account from `/account` first).

```bash
E2E_UNSUBSCRIBE_TOKEN=<token> BASE_URL=https://<preview>.vercel.app npm run test:e2e
```

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

In Resend, turn **click tracking** and **open tracking** off for the sending domain (the
domain's settings page). The Privacy Policy promises we don't track opens or clicks, and
click tracking would send every newsletter link through Resend's tracking redirect.

In Vercel's project settings (**Build and Deployment**), leave **Build Command** without an
override. Vercel then runs `npm run vercel-build`, which preview deployments need to apply
the schema; an override would skip it.

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
