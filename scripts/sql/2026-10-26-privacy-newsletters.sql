-- Brings the live Privacy Policy up to the newsletter release (content.ts defaults of October 26, 2026).
-- db:seed never overwrites existing site_content rows, so production keeps the old text until this runs.
--
-- Run with the production connection string after the code deploys and before the first newsletter goes out:
--   psql "$DATABASE_URL" -f scripts/sql/2026-10-26-privacy-newsletters.sql
--
-- By default it ROLLS BACK, so running or pasting it as is changes nothing. Read the check at the end:
-- every key should show applied = t. Then change the last line to COMMIT and run the file again.
-- A key with applied = f was edited by an officer (or has no row) and is left alone: right after the
-- COMMIT, rewrite that section by hand on /privacy, because the new "Last updated" date is already live.
-- privacy.updated is in the same transaction, so the date and the text change together.
-- Running it again after a COMMIT stops at the backup table, which then exists, and changes nothing.

\set ON_ERROR_STOP on
begin;

create table site_content_backup_20261026_privacy as
  select * from site_content where key in ('privacy.updated', 'privacy.collect.items', 'privacy.use.items', 'privacy.processors.items', 'privacy.retention.items', 'privacy.choices.items');

\echo 'privacy.updated: expect UPDATE 1'
update site_content set value = 'October 26, 2026'
where key = 'privacy.updated' and value = 'October 24, 2026';

\echo 'privacy.collect.items: expect UPDATE 1'
update site_content set value = 'Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
Which newsletters we sent or tried to send to your account, and whether each one went out.
When you unsubscribed, from which topic, and whether you used the link in the email or your email app’s unsubscribe button.
In the future, the club events you RSVP to.
Short-lived records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts (the email address involved and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.'
where key = 'privacy.collect.items' and value = 'Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
In the future, the club events you RSVP to.
Short-lived records of sign-in, sign-up and password reset attempts (the email address entered and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.';

\echo 'privacy.use.items: expect UPDATE 1'
update site_content set value = 'To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events and track RSVPs, once that feature launches.
To answer messages you send us.
To protect the site from spam and abuse.'
where key = 'privacy.use.items' and value = 'To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those.
To plan club events and track RSVPs, once that feature launches.
To answer messages you send us.
To protect the site from spam and abuse.';

\echo 'privacy.processors.items: expect UPDATE 1'
update site_content set value = 'Vercel hosts the website and handles every request you make to it.
Neon hosts our database, which stores your account.
Resend processes and delivers our emails, including newsletters. Click and open tracking are turned off, so we don’t know whether you open a newsletter or click its links.
Formspree delivers messages sent through the contact form.'
where key = 'privacy.processors.items' and value = 'Vercel hosts the website and handles every request you make to it.
Neon hosts our database, which stores your account.
Resend delivers our emails.
Formspree delivers messages sent through the contact form.';

\echo 'privacy.retention.items: expect UPDATE 1'
update site_content set value = 'Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.'
where key = 'privacy.retention.items' and value = 'Your account and newsletter choices: until you delete your account.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.';

\echo 'privacy.choices.items: expect UPDATE 1'
update site_content set value = 'Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.'
where key = 'privacy.choices.items' and value = 'Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account and newsletter choices are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.';

\echo 'Every row below must show applied = t before you COMMIT.'
select k.key, coalesce(s.value = k.expected, false) as applied
from (values
  ('privacy.updated', 'October 26, 2026'),
  ('privacy.collect.items', 'Your name and email address, when you create an account.
Your password in scrambled (hashed) form. We never store or see the password itself.
When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.
Which newsletter topics you choose to receive.
Which newsletters we sent or tried to send to your account, and whether each one went out.
When you unsubscribed, from which topic, and whether you used the link in the email or your email app’s unsubscribe button.
In the future, the club events you RSVP to.
Short-lived records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts (the email address involved and your IP address), used to stop abuse.
Whatever you type into the contact form, when you send us a message.'),
  ('privacy.use.items', 'To create your account, keep it secure and sign you in.
To send the emails your account needs: confirming your address, password resets and security notices.
To send the newsletters you choose, and only those. They come from “SHPE @ CMU” at our news@ address, and only once you have confirmed your email address.
To keep a record of what we sent you and of your unsubscribes, so we stop sending a topic as soon as you leave it.
To plan club events and track RSVPs, once that feature launches.
To answer messages you send us.
To protect the site from spam and abuse.'),
  ('privacy.processors.items', 'Vercel hosts the website and handles every request you make to it.
Neon hosts our database, which stores your account.
Resend processes and delivers our emails, including newsletters. Click and open tracking are turned off, so we don’t know whether you open a newsletter or click its links.
Formspree delivers messages sent through the contact form.'),
  ('privacy.retention.items', 'Your account and newsletter choices, the record of which newsletters were sent to you and whether each went out, and the record of when you unsubscribed from which topic: until you delete your account, then removed with it.
Accounts whose email address is never confirmed: kept for 7 days, or until the last confirmation link we sent expires if that is later, then deleted automatically during later sign-up or new confirmation link requests.
Records of sign-in, sign-up, email confirmation, new confirmation link and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up, email confirmation, new confirmation link or password-reset activity.
Server logs of failed or blocked sign-in attempts (the email address entered and your IP address) and of blocked sign-up, email confirmation, new confirmation link and password reset requests (your IP address): kept for a limited time by our host, Vercel, then deleted.
Email confirmation links stop working after 24 hours, and password reset links after 1 hour.'),
  ('privacy.choices.items', 'Every newsletter has an unsubscribe link that works without signing in. It removes you right away, from that newsletter’s topics or from all of them. Your email app’s built-in unsubscribe button works too.
Change which newsletters you receive at any time from your account page.
Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account, newsletter choices and newsletter records are removed right away.
Ask us for a copy of your information, or to correct it, using the contact details below.')
) as k(key, expected)
left join site_content s on s.key = k.key
order by k.key;

rollback;
