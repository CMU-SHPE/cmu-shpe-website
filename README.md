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

Newsletters only reach `@resend.dev` test inboxes unless `VERCEL_ENV=production`. A
`.env.local` pulled from Vercel's production environment (`vercel env pull`) contains
`VERCEL_ENV=production`, which turns that guard off locally and would email real members;
delete that line from `.env.local`.

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

If the master admin forgets their password, they reset it by email like any admin: **Forgot
password?** on the sign-in page. If they have also lost access to that email, someone with
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
4. Choose **Change password** in the admin sidebar to change your own password. Forgot it?
   Choose **Forgot password?** on the sign-in page and enter your admin email: the link it
   sends works for 30 minutes, once. This works for every admin, the master included. The
   master admin can also reset another admin's password from **Admin accounts** and share it
   with them directly. Every change signs that account out on every other device, and a reset
   by email also clears any sign-in lockout on it.
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
- **`/account`:** change name, email and password, choose newsletter topics, see and cancel
  upcoming RSVPs, and **Delete my account** (asks for the password and the word DELETE;
  it removes the account, its newsletter choices, its newsletter send and unsubscribe
  records and its RSVPs right away). Sponsors also get a **Sponsor portal** link here.
- **RSVPs:** any signed-in member with a confirmed email can RSVP to an upcoming event on
  `/events` and cancel before it happens. See [Sponsor portal](#sponsor-portal) for
  capacity and the attendee CSV.
- **Forgot password:** `/forgot-password` emails a reset link that works for 1 hour, once.
  The same page serves admins: an admin's email gets a link to `/reset-password/admin` that
  works for 30 minutes. The page answers the same way whether or not the address has an
  account. Member and admin links are stored separately, so neither can reset the other kind
  of account.
- **Changing email:** **Change email** on `/account` asks for the new address and the current
  password, then emails a confirmation link to the new address that works for 24 hours, once.
  Nothing changes until it is used, and a newer request cancels the older link. Confirming
  re-checks that no admin or other member has the address (an unconfirmed sign-up holding it
  is deleted), changes the email, signs the member out everywhere and tells the old address
  (showing the new one as `n***@domain`, with the club's contact email). The account keeps
  its id, so RSVPs, newsletter choices, the sponsor link and old unsubscribe links all keep
  working. The form says the same thing whether or not the new address is taken; a taken
  address only shows up when the link is used.
- **Removing a member:** in the admin, **Members** → **Delete** next to their name. This
  also removes their newsletter choices, newsletter send and unsubscribe records, RSVPs and
  pending email links. Any sponsor listing edits they made stay in that listing's history
  under the name they had at the time, marked "(account deleted)".
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

Do these in order, all *before* merging to `main`, because the new code queries the new
columns and shows the new policy as soon as it deploys.

1. **Backup:** take a backup of the production database.
2. **Schema:** apply the new columns and tables (`members.sponsor_id`, `events.capacity`,
   `sponsors.description`, `event_rsvps`, `sponsor_edits`, `sponsor_receipts`, reviewed in
   `drizzle/0005_lovely_annihilus.sql`; it only adds) to production with `npm run db:push`,
   as described under [Preview databases](#preview-databases).
3. **Policy text (required):** run `scripts/sql/2026-10-27-privacy-sponsor-portal.sql` as
   described under
   [Releasing a change to the Privacy Policy or Terms](#releasing-a-change-to-the-privacy-policy-or-terms):
   once without `-v commit=1`, check that every key shows `applied now` or `already new`,
   then again with `-v commit=1`. It updates `privacy.collect.items`, `privacy.use.items`,
   `privacy.retention.items`, `privacy.choices.items` and `terms.use.items`, then the two
   "Last updated" dates. A page's date only moves once every section of that page holds
   the new text. It expects the newsletter release's text: if any key shows `older`, commit
   `2026-10-26-privacy-newsletters.sql` first and run this one again. A section shown as
   `officer-edited` is left alone and holds back its page's date (`held: officer-edited
   section`): after the COMMIT, rewrite that section by hand on `/privacy` or `/terms`,
   then change that page's **Last updated** to October 27, 2026 by hand, last.

The `sponsor.*` text keys are new, so the portal shows their defaults until an admin edits
them; running `npm run db:seed` also stores them.

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
                /terms), /unsubscribe and /unsubscribe/one-click, the sponsor portal
                (/sponsor, with receipt downloads at /sponsor/receipts/[id]), and the
                /admin pages (including /admin/newsletters), each with their server
                actions
  components/   Shared UI: Navbar, Footer, ThemeProvider (dark mode), the inline
                editor (editable.tsx), admin form components, and the RSVP (rsvp/)
                and sponsor portal (sponsor/) components
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

### Database tests

```bash
npm run test:db
```

Runs the `*.db.test.ts` and `*.pg.test.ts(x)` files against a real Postgres 17 so
queries, `db.batch` transactions and locking behave as they do in production; the
newsletter `*.pg.test` files run every query under both `VERCEL_ENV=production` and
`VERCEL_ENV=preview`. It needs Docker and nothing else: no `.env.local`, no Neon account.
`scripts/test-db.sh` starts a throwaway Postgres, reachable only from a
[local Neon HTTP proxy](https://github.com/TimoWilhelm/local-neon-http-proxy) that listens
on 127.0.0.1 on a free port Docker picks (so the production `@neondatabase/serverless`
driver runs unchanged and overlapping runs don't collide), applies the committed
`drizzle/` migrations, adds a few rows, then brings the schema up to date with the same
push a preview build runs. Both containers are removed afterwards, even if a test fails.
The tests refuse to run against anything but that local database: they truncate every
table. `npm test` skips these files and never needs Docker; pass a path to run one file,
e.g. `npm run test:db -- src/db/harness.db.test.ts`.

### Preview smoke tests

`e2e/` holds Playwright tests that run by hand against a **preview** deployment or a local
server, never in CI. They sign up accounts and send real email, so `e2e/preview-guard.ts`
refuses to start on anything else, before any request reaches `BASE_URL`:

- `localhost` and `127.0.0.1` run only the read-only tests by default. **A local server uses
  whatever `DATABASE_URL` says, which can be production**, so every spec that writes skips
  there and says why. Set `E2E_LOCAL_DATABASE_IS_DISPOSABLE=1` only when the local database
  is one you can afford to lose; with production's connection string, it would create
  records and send a newsletter on production.
- `shpecmu.com`, `www.shpecmu.com` and the `cmu-shpe-website-git-main-shpecmu.vercel.app`
  alias are refused outright, as is any host that isn't an
  `https://cmu-shpe-website-…-shpecmu.vercel.app` deployment of this project.
- Every other host, branch alias or deployment URL, is looked up in the Vercel API with
  `VERCEL_TOKEN` before the first test, and refused unless Vercel says it is a preview
  of `cmu-shpe-website`. Production deployment URLs look just like preview ones, so this
  lookup is what tells them apart. No token, an error or an unknown host also refuses.

The config, every spec (through `e2e/fixtures.ts`) and each write in the journey specs
use that one check.

```bash
npx playwright install chromium   # once
BASE_URL=https://<preview>.vercel.app VERCEL_TOKEN=<token> VERCEL_BYPASS=<protection bypass secret> npm run test:e2e
```

`VERCEL_TOKEN` is sent only to `api.vercel.com`, and only to read the deployment's target.
`VERCEL_BYPASS` is only needed when the preview has Deployment Protection on; it is sent
as `x-vercel-protection-bypass` to the preview's own origin only. A spec whose own
variables are missing skips instead of failing.

On a local server, every spec here except `sponsor-portal.spec.ts` and the broken-link tests in
`newsletters.spec.ts` also needs `E2E_LOCAL_DATABASE_IS_DISPOSABLE=1`.

| Spec | Needs, besides `BASE_URL` | Creates or changes |
| --- | --- | --- |
| `members.spec.ts`: sign-up, the resend-confirmation and forgot-password forms (which must answer known and unknown addresses alike), broken confirmation and reset links, signed-out redirects from `/account` and `/admin`, the Privacy and Terms links, and axe WCAG 2.1 AA scans in light and dark mode | nothing | Unconfirmed accounts for `delivered+…@resend.dev` (Resend's test inbox), and their confirmation and reset emails. Like any unconfirmed account, they are deleted by a later sign-up once they are 7 days old. |
| `newsletters.spec.ts`: unsubscribe links (below) | `E2E_UNSUBSCRIBE_TOKEN` for the working-link tests | Nothing without the token. With it, unsubscribes that token's account from all of its topics. |
| `sponsor-portal.spec.ts`: signed-out visitors are sent to `/login` from `/sponsor` and `/admin/sponsors/1`, and get no receipt PDF or attendee CSV | nothing | Nothing; read-only. |
| `newsletter-journey.spec.ts`: an admin adds a topic, a member signs up, confirms by email and opts in, a real newsletter goes to that topic, and the member unsubscribes on the page and by one-click POST | `RESEND_API_KEY` (read-only, to fetch the emails; sent only to `api.resend.com`), `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Creates a topic, a confirmed member and a newsletter, and sends that newsletter (only `@resend.dev` inboxes receive it off production). The topic and the member are deleted at the end; the newsletter row stays, and its delivery records go with the member. If Site settings has no mailing address, it fills one in and leaves it. |
| `sponsor-journey.spec.ts`: two members sign up and confirm, the admin links one to a new sponsor listing and uploads a receipt, the sponsor edits the listing and downloads the receipt, the other member is kept out, and an RSVP fills and frees a capacity-1 event before the admin exports its attendees | `RESEND_API_KEY`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Creates two confirmed members, a sponsor listing with an edit-history entry and a 3.9 MB receipt PDF, and an event with RSVPs. Cleanup deletes the listing (its receipts and history go with it), the event (with its RSVPs) and both members, and fails the run listing anything it couldn't remove. The receipt file itself stays in Blob storage. |

`e2e/newsletters.spec.ts` checks unsubscribe links. Without any setup it checks that
malformed and unknown links show the "This link doesn't work" page, that one-click POSTs
with them are refused (400 and 404), that a GET to `/unsubscribe/one-click` only redirects
to `/unsubscribe`, and runs axe on that page in light and dark mode.

The working-link tests (the form, its axe scans, a one-click POST and the **Unsubscribe
from all newsletters** button) skip unless `E2E_UNSUBSCRIBE_TOKEN` is set.

Preview and local databases are copies of production, so anywhere except production
(`VERCEL_ENV` other than `production`, including when it isn't set) a real send only goes
to confirmed accounts whose address ends in `@resend.dev` (Resend's test inboxes), even
when it continues a send that production started and the database copy still holds;
everyone else is skipped. The composer and the send confirmation say so, and their
recipient counts leave everyone else out. Test sends to yourself are not restricted. Every
other email (confirmation, password reset, email change and security notices) follows the
same rule: outside production `sendEmail` skips any address not ending in `@resend.dev`,
logging `EMAIL SKIPPED` without the address, and the flow carries on as if it had sent. To get a token:

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
E2E_UNSUBSCRIBE_TOKEN=<token> BASE_URL=https://<preview>.vercel.app VERCEL_TOKEN=<token> npm run test:e2e
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

### Releasing a change to the Privacy Policy or Terms

New default text in `src/db/seed-data/content.ts` never reaches production on its own:
`db:seed` doesn't overwrite rows that already exist. Ship it with a SQL file in
`scripts/sql/` (for the newsletter release, `2026-10-26-privacy-newsletters.sql`; for the
sponsor portal, `2026-10-27-privacy-sponsor-portal.sql`, which needs the newsletter one
committed first). Run it
with the production connection string after the code deploys and before the first
newsletter goes out. It backs the old rows up, only replaces text still matching the old
default, and rolls back unless run with `-v commit=1`: run it once without, check the
report at the end, then run `psql -v commit=1 "$DATABASE_URL" -f <file>`. The comments at
the top explain each step. The fallback is editing the text in
place on `/privacy` (or `/terms`), changing **Last updated** last, because new sign-ups
record that date as the version they agreed to.

The backup goes in a separate `backups` schema, never in `public`: preview builds and
`db:push` see any table in `public` that isn't in `src/db/schema.ts` as one to drop, and the
preview push refuses to drop data, so every later preview build would fail. Both only
look at `public`, since neither sets a schema filter and drizzle-kit defaults to `public`. Once `/privacy`
shows the right text, drop the backup table
(`drop table backups.site_content_privacy_20261026;`). Drop the whole schema only if
nothing else lives in it.

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
