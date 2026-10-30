-- Brings the live Privacy Policy up to the account recovery release (content.ts defaults of October 30, 2026):
-- the new address held while an email change is pending, the notice to the old address, how long those links
-- and the admin reset link last, and the email change choice. db:seed never overwrites existing site_content
-- rows, so production keeps the old text until this runs. The Terms of Use are unchanged.
--
-- Release order: event date ranges, then UI clarity, then this. It expects the UI clarity release's text, so run
-- scripts/sql/2026-10-30-privacy-ui-clarity.sql with commit=1 first. privacy.collect.items isn't touched by that
-- script, so its expected text is the sponsor portal release's. Run this with the production connection string
-- before merging the account recovery release:
--   psql "$DATABASE_URL" -f scripts/sql/2026-10-30-privacy-account-recovery.sql
--
-- By default it ROLLS BACK, so running it as is changes nothing. Read the check at the end, then commit with:
--   psql -v commit=1 "$DATABASE_URL" -f scripts/sql/2026-10-30-privacy-account-recovery.sql
-- Without it, or with commit=0, it rolls back. Each key ends in one of these states:
--   applied now     the row held the expected text and now holds the new text;
--   already new     an earlier run already applied it (safe to run again: nothing changes);
--   older           the row still holds the text from before the UI clarity release (for privacy.collect.items,
--                   from before the sponsor portal release), so it is left alone. Commit that release's script,
--                   then run this again;
--   changed elsewhere  an officer or another release changed it, so it is left alone. After the COMMIT, work
--                   this release's wording into that section by hand on /privacy. If the key is the date, it
--                   stays as it is, so this never moves a later date backwards;
--   missing         no row: the page shows the new default text already.
-- The "Last updated" date changes last, in the same transaction, and only if every section this script covers
-- is now the new text (applied now, already new or missing). If any section is older or changed elsewhere, the
-- date stays as it was and the check shows "held: older section" or "held: section changed elsewhere". Once you
-- have rewritten such a section by hand, change "Last updated" by hand, last, to October 30, 2026 or to today.
--
-- The backup keeps each row as it was the first time this ran; later runs never overwrite it. It lives in its
-- own schema, backups, because preview builds and db:push treat any unknown table in public as one to drop.
-- Once /privacy shows the right text, remove it with: drop table backups.site_content_policy_account_recovery_20261030;

\set ON_ERROR_STOP on
begin;

create schema if not exists backups;
create table if not exists backups.site_content_policy_account_recovery_20261030 (
  key text primary key,
  value text not null,
  backed_up_at timestamptz not null default now()
);
insert into backups.site_content_policy_account_recovery_20261030 (key, value)
  select key, value from site_content where key in ('privacy.collect.items', 'privacy.use.items', 'privacy.retention.items', 'privacy.choices.items', 'privacy.updated')
  on conflict (key) do nothing;

-- current is the UI clarity release's text, except privacy.collect.items, which is the sponsor portal release's;
-- older is the release before each of those.
create temp table policy_text (key text primary key, new_value text not null, current_value text not null, older_value text) on commit drop;
insert into policy_text (key, new_value, current_value, older_value) values
  ('privacy.collect.items', $txt$Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
If you ask to change your email address, the new address, until you confirm it.
Which newsletter topics you choose to receive.
Which newsletters we sent or tried to send to your account, and whether each one went out.
When you unsubscribed, from which topic, and whether you used the link in the email or your email app’s unsubscribe button.
The club events you RSVP to, and when you RSVPed.
If you are a sponsor contact: which sponsor listing your account is linked to, and a record of each change you make to that listing (your name at the time, when, and which parts you changed).
For sponsors, the receipts for their sponsorship (PDF files) that club officers upload. These are stored privately in our database, not in public file storage.
Short-lived records of sign-in, sign-up, email confirmation, new confirmation link, password reset and email change attempts (the email address involved and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.$txt$, $txt$Your name and email address, when you create an account.
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
Whatever you type into the contact form, when you send us a message.$txt$),
  ('privacy.use.items', $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices. When you change your email address, we email a confirmation link to the new address and, once it changes, a notice to the old address showing only the first letter and domain of the new one.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events. Club officers see the name and email address of everyone who RSVPed to an event and can download that list as a spreadsheet (CSV) to run the event.
To run the sponsor portal. Club officers can give a confirmed account access by linking it to a sponsor’s listing. Linked accounts can edit that listing’s name, website, description, logo and logo background color, which appear publicly on our Sponsors page, and can download that sponsor’s receipts. Only club officers and the accounts linked to a listing can view its receipts.
To show club officers who changed a sponsor listing, whether a sponsor contact or a club officer, what they changed and when.
To answer messages you send us.
To protect the site from spam and abuse.$txt$, $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events. Club officers see the name and email address of everyone who RSVPed to an event and can download that list as a spreadsheet (CSV) to run the event.
To run the sponsor portal. Club officers can give a confirmed account access by linking it to a sponsor’s listing. Linked accounts can edit that listing’s name, website, description, logo and logo background color, which appear publicly on our Sponsors page, and can download that sponsor’s receipts. Only club officers and the accounts linked to a listing can view its receipts.
To show club officers who changed a sponsor listing, whether a sponsor contact or a club officer, what they changed and when.
To answer messages you send us.
To protect the site from spam and abuse.$txt$, $txt$To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events. Club officers see the name and email address of everyone who RSVPed to an event and can download that list as a spreadsheet (CSV) to run the event.
To run the sponsor portal. Club officers can give a confirmed account access by linking it to a sponsor’s listing. Linked accounts can edit that listing’s name, website, description, logo and logo background color, which appear publicly on our Sponsors page, and can download that sponsor’s receipts. Only club officers and the accounts linked to a listing can view its receipts.
To show club officers who changed a sponsor listing and when.
To answer messages you send us.
To protect the site from spam and abuse.$txt$),
  ('privacy.retention.items', $txt$Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link, password reset and email change attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link, password-reset or email-change activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation and email change links stop working after 24 hours, and password reset links after 1 hour (30 minutes for site admins).
A new email address you asked to change to: until you confirm it, make a newer request or delete your account. If its link expires unused, it is deleted the next time anyone asks to change an email address.
Your RSVPs: until you cancel them, the event is deleted, or you delete your account.
Records of changes to a sponsor listing, whether made by a sponsor contact or a club officer: kept with the listing, including the editor’s name as it was at the time even after that account is deleted, and deleted together with the listing.
Sponsor receipts: kept until club officers delete them, and deleted together with the sponsor listing.$txt$, $txt$Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.
Your RSVPs: until you cancel them, the event is deleted, or you delete your account.
Records of changes to a sponsor listing, whether made by a sponsor contact or a club officer: kept with the listing, including the editor’s name as it was at the time even after that account is deleted, and deleted together with the listing.
Sponsor receipts: kept until club officers delete them, and deleted together with the sponsor listing.$txt$, $txt$Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.
Your RSVPs: until you cancel them, the event is deleted, or you delete your account.
Records of changes to a sponsor listing: kept with the listing, including the editor’s name as it was at the time even after that account is deleted, and deleted together with the listing.
Sponsor receipts: kept until club officers delete them, and deleted together with the sponsor listing.$txt$),
  ('privacy.choices.items', $txt$Cancel an RSVP to an upcoming event from the events page or your account page.
If you have sponsor portal access and no longer want it, ask us and we will unlink your account.
Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Change your email address from your account page. Nothing changes until you confirm the new address, and we tell your old address when it does.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records, event RSVPs and any sponsor portal access are removed right away. If you edited a sponsor listing, its edit history keeps your name as it was at the time.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$, $txt$Cancel an RSVP to an upcoming event from the events page or your account page.
If you have sponsor portal access and no longer want it, ask us and we will unlink your account.
Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records, event RSVPs and any sponsor portal access are removed right away. If you edited a sponsor listing, its edit history keeps your name as it was at the time.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$, $txt$Cancel an RSVP to an upcoming event from the events page or your account page.
If you have sponsor portal access and no longer want it, ask us and we will unlink your account.
Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.$txt$),
  ('privacy.updated', $txt$October 30, 2026$txt$, $txt$October 29, 2026$txt$, $txt$October 27, 2026$txt$);

create temp table policy_applied_now (key text primary key) on commit drop;

\echo 'Sections: INSERT 0 n = n sections applied now (see the check)'
with updated as (
  update site_content s set value = t.new_value
  from policy_text t
  where s.key = t.key and t.key not like '%.updated' and s.value = t.current_value
  returning s.key
)
insert into policy_applied_now select key from updated;

\echo 'Last updated date: INSERT 0 n = n dates applied now (see the check)'
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

\echo 'Each key must show applied now or already new. Fix any key changed elsewhere by hand after COMMIT, then the date.'
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
        else 'held: section changed elsewhere'
      end
    when s.value = t.older_value then 'older'
    else 'changed elsewhere'
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
