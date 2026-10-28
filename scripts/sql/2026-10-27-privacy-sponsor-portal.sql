-- Brings the live Privacy Policy and Terms of Use up to the sponsor portal release (content.ts defaults of
-- October 27, 2026): RSVPs, the attendee CSV club officers download, sponsor accounts linked to a listing, the
-- listing edit log (which keeps the editor's name after their account is deleted) and sponsor receipts.
-- db:seed never overwrites existing site_content rows, so production keeps the old text until this runs.
--
-- It expects the newsletter release's text, so run scripts/sql/2026-10-26-privacy-newsletters.sql with commit=1
-- first. Run this with the production connection string before merging the sponsor portal:
--   psql "$DATABASE_URL" -f scripts/sql/2026-10-27-privacy-sponsor-portal.sql
--
-- By default it ROLLS BACK, so running it as is changes nothing. Read the check at the end, then commit with:
--   psql -v commit=1 "$DATABASE_URL" -f scripts/sql/2026-10-27-privacy-sponsor-portal.sql
-- Without it, or with commit=0, it rolls back. Each key ends in one of these states:
--   applied now     the row held the newsletter release's text and now holds the new text;
--   already new     an earlier run already applied it (safe to run again: nothing changes);
--   older           the row still holds the text from before the newsletter release, so it is left alone.
--                   Commit 2026-10-26-privacy-newsletters.sql, then run this again;
--   officer-edited  an officer changed that section, so it is left alone. After the COMMIT, rewrite it by hand
--                   on /privacy or /terms, then change that page's "Last updated" to October 27, 2026 by hand, last;
--   missing         no row: the page shows the new default text already.
-- The "Last updated" dates change last, in the same transaction, and only for a page whose every section is now
-- the new text (applied now, already new or missing). If any section of that page is older or officer-edited,
-- its date stays as it was and the check shows "held: older section" or "held: officer-edited section".
-- The backup keeps each row as it was the first time this ran; later runs never overwrite it. It lives in its
-- own schema, backups, because preview builds and db:push treat any unknown table in public as one to drop.
-- Once /privacy and /terms show the right text, remove it with: drop table backups.site_content_policy_20261027;

\set ON_ERROR_STOP on
begin;

create schema if not exists backups;
create table if not exists backups.site_content_policy_20261027 (
  key text primary key,
  value text not null,
  backed_up_at timestamptz not null default now()
);
insert into backups.site_content_policy_20261027 (key, value)
  select key, value from site_content where key in ('privacy.collect.items', 'privacy.use.items', 'privacy.retention.items', 'privacy.choices.items', 'terms.use.items', 'privacy.updated', 'terms.updated')
  on conflict (key) do nothing;

-- current is the newsletter release's text (what production holds once 2026-10-26 has run); older is the text
-- from before it, where that differs.
create temp table policy_text (key text primary key, new_value text not null, current_value text not null, older_value text) on commit drop;
insert into policy_text (key, new_value, current_value, older_value) values
  ('privacy.collect.items', $txt$Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
Which newsletters we sent or tried to send to your account, and whether each one went out.
When you unsubscribed, from which topic, and whether you used the link in the email or your email app’s unsubscribe button.
The club events you RSVP to, and when you RSVPed.
If you are a sponsor contact: which sponsor listing your account is linked to, and a record of each change you make to that listing (your name at the time, when, and which parts you changed).
For sponsors, the receipts for their sponsorship (PDF files) that club officers upload. These are stored privately in our database, not in public file storage.
Short-lived records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts (the email address involved and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.$txt$, $txt$Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
Which newsletters we sent or tried to send to your account, and whether each one went out.
When you unsubscribed, from which topic, and whether you used the link in the email or your email app’s unsubscribe button.
In the future, the club events you RSVP to.
Short-lived records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts (the email address involved and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.$txt$, $txt$Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
In the future, the club events you RSVP to.
Short-lived records of sign-in, sign-up and password reset attempts (the email address entered and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.$txt$),
  ('privacy.use.items', $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events. Club officers see the name and email address of everyone who RSVPed to an event and can download that list as a spreadsheet (CSV) to run the event.
To run the sponsor portal. Club officers can give a confirmed account access by linking it to a sponsor’s listing. Linked accounts can edit that listing’s name, website, description, logo and logo background color, which appear publicly on our Sponsors page, and can download that sponsor’s receipts. Only club officers and the accounts linked to a listing can view its receipts.
To show club officers who changed a sponsor listing and when.
To answer messages you send us.
To protect the site from spam and abuse.$txt$, $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events and track RSVPs, once that feature launches.
To answer messages you send us.
To protect the site from spam and abuse.$txt$, $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those.
To plan club events and track RSVPs, once that feature launches.
To answer messages you send us.
To protect the site from spam and abuse.$txt$),
  ('privacy.retention.items', $txt$Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.
Your RSVPs: until you cancel them, the event is deleted, or you delete your account.
Records of changes to a sponsor listing: kept with the listing, including the editor’s name as it was at the time even after that account is deleted, and deleted together with the listing.
Sponsor receipts: kept until club officers delete them, and deleted together with the sponsor listing.$txt$, $txt$Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.$txt$, $txt$Your account and newsletter choices: until you delete your account.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.$txt$),
  ('privacy.choices.items', $txt$Cancel an RSVP to an upcoming event from the events page or your account page.
If you have sponsor portal access and no longer want it, ask us and we will unlink your account.
Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$, $txt$Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$, $txt$Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account and newsletter choices are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$),
  ('terms.use.items', $txt$Pretend to be someone else, or create accounts for other people without their permission.
Try to get into accounts or parts of the site that aren’t yours.
Send spam, or flood the site with automated requests.
Interfere with the site, or use it for anything illegal or harassing.
Use sponsor portal access for anything other than keeping your own organization’s listing accurate, or share receipts or event information from it with people who shouldn’t have them.$txt$, $txt$Pretend to be someone else, or create accounts for other people without their permission.
Try to get into accounts or parts of the site that aren’t yours.
Send spam, or flood the site with automated requests.
Interfere with the site, or use it for anything illegal or harassing.$txt$, null),
  ('privacy.updated', $txt$October 27, 2026$txt$, $txt$October 26, 2026$txt$, $txt$October 24, 2026$txt$),
  ('terms.updated', $txt$October 27, 2026$txt$, $txt$October 24, 2026$txt$, null);

create temp table policy_applied_now (key text primary key) on commit drop;

\echo 'Sections: INSERT 0 n = n sections applied now (see the check)'
with updated as (
  update site_content s set value = t.new_value
  from policy_text t
  where s.key = t.key and t.key not like '%.updated' and s.value = t.current_value
  returning s.key
)
insert into policy_applied_now select key from updated;

\echo 'Last updated dates: INSERT 0 n = n dates applied now (see the check)'
with updated as (
  update site_content s set value = t.new_value
  from policy_text t
  where s.key = t.key and t.key like '%.updated' and s.value = t.current_value
    and not exists (
      select 1 from site_content section
      join policy_text p on p.key = section.key
      where p.key not like '%.updated' and split_part(p.key, '.', 1) = split_part(t.key, '.', 1)
        and section.value <> p.new_value
    )
  returning s.key
)
insert into policy_applied_now select key from updated;

\echo 'Each key must show applied now or already new. Fix any officer-edited key by hand after COMMIT, then its date.'
select t.key,
  case
    when a.key is not null then 'applied now'
    when s.key is null then 'missing'
    when s.value = t.new_value then 'already new'
    when t.key like '%.updated' and s.value = t.current_value then
      case
        when exists (
          select 1 from site_content section
          join policy_text p on p.key = section.key
          where p.key not like '%.updated' and split_part(p.key, '.', 1) = split_part(t.key, '.', 1)
            and section.value = p.older_value
        ) then 'held: older section'
        else 'held: officer-edited section'
      end
    when s.value = t.older_value then 'older'
    else 'officer-edited'
  end as state
from policy_text t
left join site_content s on s.key = t.key
left join policy_applied_now a on a.key = t.key
order by t.key like '%.updated', t.key;

\if :{?commit}
\else
  \set commit 0
\endif
\if :commit
  commit;
\else
  rollback;
\endif
