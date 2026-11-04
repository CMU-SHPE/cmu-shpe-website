# Officer guide

This guide is for SHPE @ CMU chapter officers who look after the website at
[shpecmu.com](https://shpecmu.com). Each section is one task, with the exact buttons to press.
You don't need any technical knowledge.

While you are signed in, this guide is always under **Help** in the admin sidebar. Members and
sponsors have their own guides at [shpecmu.com/help](/help).

## Signing in and passwords

### How to sign in

1. Scroll to the bottom of any page and choose **Sign in** in the footer.
2. Enter your **Email** and **Password**.
3. Choose **Sign in**.

You land on the admin **Dashboard**. While you are signed in, the top bar shows your name, an
**Admin** link that brings you back here, and **Sign out**.

![The Sign in page with the Email and Password fields and the Sign in button](/help/img/officers/sign-in.png)

If you see "Invalid email or password. Can't sign in? Reset your password.", check both and try
again, or choose **Reset your password** (see [If you forget your password](#if-you-forget-your-password)).
After five wrong tries from the same place, the site stops letting you sign in from there for up
to 15 minutes. Resetting your password by email lifts that wait straight away.

![The admin dashboard with the sidebar listing every admin section](/help/img/officers/dashboard.png)

### How to change your password

1. Choose **Change password** in the admin sidebar.
2. Enter your **Current password**.
3. Enter a **New password** of 12 to 72 characters, then type it again in **Confirm new password**.
4. Choose **Change password**.

You stay signed in on this device and are signed out everywhere else.

![The Change password page with the three password fields](/help/img/officers/change-password.png)

### If you forget your password

Every officer, the master admin included, can reset their own password by email:

1. On the sign-in page, choose **Forgot password?**
2. Enter your admin **Email** and choose **Send reset link**.
3. Open the email and choose the link. It works for 30 minutes, once.
4. Enter a **New password**, type it again in **Confirm new password**, and choose **Save new
   password**.

You are signed out on every other device, and any sign-in wait on your account is cleared.

If you can't get into that email account:

- **Most officers:** ask the master admin (usually the chapter president) to set a new password
  for you. They share it with you directly, and you can change it afterwards with **Change password**.
- **The master admin:** ask the chapter's technical helper (see
  [Handing over the master admin account](#handing-over-the-master-admin-account)).

## Editing page text

Almost every heading and paragraph on the public pages, and in the footer, can be changed right
on the page. The SHPE @ CMU title, the navigation, buttons and form labels stay fixed.

### How to edit text on a page

1. Sign in, then open the page you want to change (for example **About**).
2. Click the heading or paragraph. It becomes editable, and the pointer shows "Click to edit".
3. Type your changes.
4. Choose **Save changes** to publish them, or **Discard** to undo them.

Changes are live for everyone as soon as you save.

![A paragraph on the home page being edited, with the Save changes and Discard buttons below it](/help/img/officers/edit-page-text.png)

Tips:

- In lists such as the values on the About page, each line is one item. Press Enter to start a
  new item.
- In one-line text such as headings, Enter does nothing; just keep typing.
- If the save fails, you see "Could not save — check your connection and try again." Your text
  stays in place so you can try again.

## Events

Events appear on the **Events** page. They move from upcoming to past on their own the day after
they end, using Colorado (Mountain) time.

### How to add an event

1. Choose **Events** in the admin sidebar.
2. Under **Add event**, fill in **Title**, **Description**, **Location** and **Type** (Networking,
   Workshop, Social, Academic, Community, Panel or Conference).
3. Set the **Start date**.
4. For an event that lasts more than one day, also set the **End date (optional)**. Leave it blank
   for a one-day event.
5. To show times, choose **Add time slot** and fill in **From** and **To** (the days it covers),
   **Start time** and **End time**. Add one slot for each set of days with different times.
6. If places are limited, enter a **Capacity (optional)**. Leave it blank for no limit.
7. Choose **Add event**.

For example, a conference from Oct 10 to Oct 12, 2026 that runs 6 PM to 8 PM on the first two
days and 7 PM to 8 PM on the last day needs a **Start date** of Oct 10 and an **End date
(optional)** of Oct 12, plus two time slots: Oct 10–11, 6 PM – 8 PM, and Oct 12, 7 PM – 8 PM.
The Events page then shows "Oct 10–12, 2026" with both time slots underneath.

Time slots are optional. Without any, you can type the time as you want it shown in **Time
(optional)**, for example "6:00 PM – 9:00 PM", or leave it blank to show only the dates.

![The Add event form with the start date, end date and time slot fields](/help/img/officers/add-event.png)

### How to change or delete an event

1. Choose **Events** in the admin sidebar and find the event under **Upcoming events** or
   **Past events**.
2. To change it, choose **Edit** under the event, make your changes and choose **Save changes**.
3. To remove it, choose **Delete** and confirm with **OK**. The confirmation says how many RSVPs
   are removed with it, for example "This also removes its 12 RSVPs.", or "It has no RSVPs to
   remove." This can't be undone.

### How capacity works

- Members can RSVP until the event is full. Two people can never take the last place at the
  same time.
- You can't lower the capacity below the number of people who already RSVPed. If you try, nothing
  is saved and the form says, for example, "This event already has 12 RSVPs, so the capacity can't
  be lower than 12."
- On the Events page, capped events show how many spots are left, and full events show **Full**.
- RSVPs are only possible for upcoming events.

### How to see who RSVPed

1. Choose **Events** in the admin sidebar.
2. Each event shows its RSVP count (for example "12 / 40 RSVPs" when the capacity is 40).
3. Choose **Attendees** next to the count to see everyone's name, email and when they RSVPed.

![The events list with an event's RSVP count and Attendees link](/help/img/officers/event-list.png)

### How to download the attendee list

1. Open the event's **Attendees** page (see above).
2. Choose **Download CSV**. The button only appears once at least one person has RSVPed.
3. Open the file in Excel or Google Sheets.

The file lists each person's name, email and RSVP time, followed by the event's start date, end
date and times. RSVP times are in Mountain time, the same as on the attendees page, and end with
MDT or MST.

The list holds members' personal information. Share it only with the people running the event,
and delete it when the event is over.

![The attendees page with the Download CSV button](/help/img/officers/event-attendees.png)

## Officers and faculty advisor

Choose **Officers** in the admin sidebar. The page has two lists: **Executive board** and
**Faculty advisors**. People appear on the public Officers page in the same order.

### How to add an officer

1. Under **Add officer**, fill in **Name**, **Role** (for example "President"), **Major**, **Year**
   and **Bio**.
2. Optionally add **Email (optional)** and **LinkedIn profile URL (optional)**.
3. To add a photo, choose **Upload photo (optional)** and pick an image. In the **Frame this
   photo** window, drag and use **Zoom** to centre the face, then choose **Use this framing**.
4. Choose **Add officer**.

Officers without a photo show their initials. A faculty advisor works the same way under **Add
faculty advisor**, with **Department** instead of major and year.

![The Officers page with the move, Delete and Edit buttons for one officer](/help/img/officers/officers.png)

### How to change, reorder or remove someone

- **Change:** choose **Edit** under their name, make your changes and choose **Save changes**.
  To fix the framing of an existing photo, click the photo preview.
- **Reorder:** use the **↑** and **↓** buttons next to their name.
- **Remove:** choose **Delete** and confirm with **OK**.

## Sponsors

Choose **Sponsors** in the admin sidebar. Listings are grouped by tier: Platinum, Gold, Silver
and Bronze.

### How to add a sponsor listing

1. Under **Add sponsor**, fill in **Name** and choose a **Tier**.
2. Optionally add **Website (optional)** and **Description (optional)**.
3. To add a logo, choose **Upload logo (optional)**, pick a shape, frame the logo and choose
   **Use this framing**.
4. Pick a **Logo background color** that makes the logo easy to read.
5. Choose **Add sponsor**.

![The Sponsors page with the Details button for one sponsor](/help/img/officers/sponsors.png)

### How to edit, reorder or remove a listing

- **Edit:** choose **Edit** under the listing, change it and choose **Save changes**.
- **Reorder within a tier:** use **↑** and **↓**.
- **Remove:** choose **Delete** and confirm with **OK**. Everyone linked to the listing loses
  sponsor access and becomes a supporter, and the listing's receipts and edit history are deleted.

### If someone else saved the listing while you were editing

A sponsor can edit their own listing from the sponsor portal at the same time as you. If you both
change the same field, your save is refused so it can't overwrite theirs, and you see "Someone
else changed this listing while you were editing, so nothing was saved." Under it, the notice lists
each field you both changed with its saved version. The form still has what you typed: check it,
and choose **Save changes** again to replace the saved version. If you changed different fields,
both edits are kept and nothing is refused.

If the notice says "This page was out of date, so nothing was saved.", check the form and save again.
If it says your logo change wasn't kept, choose your logo again before saving.

### How to give a sponsor access to the sponsor portal

A sponsor's contact can edit their own listing, RSVP to events and download receipts from the
sponsor portal. To give them access:

1. Ask the contact to create an account at [shpecmu.com/join](/join) and confirm their email.
   They can follow the [Sponsor guide](/help/sponsors).
2. Choose **Members** in the admin sidebar and search for their name or email.
3. Check that **Email confirmed** says **Yes**.
4. In their row, pick the listing from **Choose a listing**, then choose **Make sponsor**.

If **Make sponsor** is greyed out, the line under it says why: "Available once this member
confirms their email.", or "Add a sponsor listing on the Sponsors page first." when no listing
exists yet.

You see "Sponsor access saved." Their **Role** changes to **Sponsor**, and the next time they sign
in they land on the sponsor portal. A listing can have several sponsor accounts, but each account
can be linked to only one listing.

![The Members page with the listing menu, Make sponsor and Remove sponsor access buttons](/help/img/officers/members.png)

### How to move a sponsor to another listing

1. Choose **Members** and find the sponsor.
2. Pick the new listing from the menu in their row and choose **Change listing**.

### How to remove sponsor access

1. Choose **Members** and find the sponsor.
2. Choose **Remove sponsor access**.

You see "Sponsor access removed." They keep their member account as a supporter.

### How to see a listing's accounts, edit history and receipts

1. Choose **Sponsors** in the admin sidebar.
2. Choose **Details** next to the listing.

The page shows:

- **Sponsor accounts:** the people linked to this listing.
- **Edit history:** every change made by sponsors from the sponsor portal and by officers on the
  Sponsors page, newest first (up to 100): when, who, and which fields changed. Each name is
  followed by "(sponsor)" or "(officer)". If that person's account has since been deleted, it says
  "(sponsor, account deleted)" or "(officer, account deleted)".
- **Receipts:** the receipts shared with this sponsor.

![A sponsor's Details page with Sponsor accounts, Edit history and the Upload a receipt form](/help/img/officers/sponsor-details.png)

### How to upload a receipt

1. Open the listing's **Details** page (see above).
2. Under **Upload a receipt**, enter a **Title** and the **Receipt date**.
3. Under **PDF file**, choose the receipt. It must be a PDF of up to 4 MB.
4. Choose **Upload receipt**.

You see "Receipt uploaded. The sponsor can download it from their portal." Receipts are private:
only officers and the accounts linked to that listing can download them.

To remove a receipt, choose **Delete** next to it and confirm with **OK**. The sponsor can no
longer download it.

## Page lists and stats

Choose **Page lists** in the admin sidebar to edit the lists that appear on the public pages:

- **Home page stats:** the numbers in the red band under the home page title. Each has a
  **Value** (such as "25+") and a **Label**.
- **Home page pillars:** the cards next to the mission on the home page, each with an
  **Icon (emoji)**, **Title** and **Description**.
- **SHPE National stats:** the cards in the About SHPE National section of the About page.
- **Sponsor benefits table:** the rows of the tier comparison table on the Sponsors page. For each
  tier, **Shows** can be **Included (check)**, **Not included (X)** or **Short text**.

For any item:

- **Change it:** edit the fields and choose **Save**.
- **Reorder it:** use **↑** and **↓**.
- **Remove it:** choose **Delete** and confirm with **OK**.
- **Add one:** fill in the empty fields at the bottom of the list and choose the add button
  (**Add stat**, **Add pillar**, **Add national stat** or **Add benefit**).

![The Home page stats list on the Page lists page](/help/img/officers/page-lists.png)

## Photo gallery

Choose **Photo gallery** in the admin sidebar to manage the photos shown in the gallery on the
home page. With no photos, the home page has no gallery. The gallery's small title and heading are
page text: edit them on the home page (see [Editing page text](#editing-page-text)).

### How to add a photo

1. Under **Add photo**, choose **Upload photo** and pick an image file (JPEG, PNG, WebP, GIF, AVIF
   or SVG) under 8 MB. In the **Frame this photo** window, drag and use **Zoom** until it looks
   right, then choose **Use this framing**. The home page shows the photo in that shape.
2. Fill in **Description for screen readers**: say what the photo shows, for visitors who can't
   see it, for example "Eight members holding the chapter banner at the SHPE National Convention".
   This is required.
3. Optionally add a **Caption (optional)**, shown under the photo.
4. Choose **Add photo**.

![The Add photo form on the Photo gallery page](/help/img/officers/gallery.png)

### How to change, reorder or remove a photo

Photos appear on the home page in the order of the **Photos** list.

- **Change:** choose **Edit** under the photo, make your changes and choose **Save changes**.
- **Reorder:** use **↑** and **↓**.
- **Remove:** choose **Delete** and confirm with **OK**.

## Site settings

Choose **Site settings** in the admin sidebar. When you are done, choose **Save settings** at the
bottom.

- **Contact and meetings:** **Contact email**, **Meeting day**, **Meeting time** and **Meeting
  location**. These appear in the footer and on the Contact, Events and Officers pages.
- **Mailing address:** see below.
- **Social links:** **Instagram**, **LinkedIn**, **X (Twitter)**, **YouTube**, **TikTok** and
  **MavLife**. Each must be a full link that starts with http:// or https://. Leave a link blank to hide its icon.
- **Contact form subjects:** the choices in the Contact form's subject menu, one per line in
  **Subject options (one per line)**.

Messages sent with the Contact page's form go to the chapter inbox the technical helper set up for
the form, not to the **Contact email** above, so changing that field doesn't change where they
arrive. If they stop arriving, contact the technical helper. Visitors who send many messages in a
short time are asked to wait a few minutes or use the contact email instead.

![The Site settings page with the Mailing address field](/help/img/officers/site-settings.png)

### The newsletter mailing address, and why it is required

A US law about commercial email, CAN-SPAM, requires every newsletter to include a real postal
address for the sender. The site adds the chapter's **Mailing address** to the bottom of every
newsletter, and it won't send or test a newsletter until the address is filled in.

Use an address where the chapter can receive mail, such as the department office or the student
organization mailbox. Ask your faculty advisor if you are not sure which one to use. Keep it up
to date when the chapter's address changes.

## Members

Choose **Members** in the admin sidebar to see everyone who has created an account, newest first,
50 per page. Use **Search by name or email** and **Search** to find someone, and **Clear search**
to see everyone again.

The table shows each member's **Role** (Supporter or Sponsor), **Sponsor listing**, **Email
confirmed**, the date they **Joined**, and how many **Newsletter topics** they chose.

### What "confirmed" means

When someone signs up, the site emails them a link. **Email confirmed** says **Yes** once they
have opened that link and entered their password. Until then:

- they can't sign in, RSVP or get newsletters;
- they can't be made a sponsor.

Accounts that are never confirmed are deleted automatically after 7 days. If someone says they
never got the email, send them to [shpecmu.com/join/resend](/join/resend) for a new link.

### How to delete a member

1. Choose **Members** and find the person.
2. Choose **Delete** in their row and confirm with **OK**.

The confirmation says "Delete" and their name, then: "This removes their account, email
confirmation and password reset links, newsletter choices, records of the newsletters sent to them
and of their unsubscribes, their event RSVPs (they come off attendee lists), and any sponsor portal
access. Sponsor listings, receipts and edit history stay, and the edit history keeps their name.
This can't be undone." Afterwards, a sponsor listing's edit history shows their name followed by
"(sponsor, account deleted)".

## Newsletter topics

Members choose which topics they want to hear about. Each newsletter is sent to the topics you
pick for it.

1. Choose **Newsletter topics** in the admin sidebar.
2. To add one, fill in **Name** and **Description (optional)** under **Add topic**, then choose
   **Add topic**.
3. To rename one, edit its fields and choose **Save**.
4. Use **↑** and **↓** to set the order members see them in.
5. To delete one, choose **Delete** and confirm with **OK**.

Each topic shows how many members subscribe to it. When you delete a topic, the confirmation says
how many members (confirmed or not) have chosen it, or "No members have chosen it yet." Deleting it
removes every member's choice of it, and they stop getting newsletters about it.

![The Newsletter topics page with a topic's subscriber count and the Add topic form](/help/img/officers/topics.png)

## Newsletters

Before your first newsletter, fill in the **Mailing address** in **Site settings** (see
[Site settings](#site-settings)) and add at least one topic.

### How to write a newsletter

1. Choose **Newsletters** in the admin sidebar, then **New newsletter**.
2. Enter a **Subject** and the **Body**. The body is plain text: leave a blank line between
   paragraphs. Links starting with https:// become clickable.
3. Under **Topics (who gets it)**, tick every topic it is for. Each topic shows how many confirmed
   subscribers it has.
4. Choose **Save draft** to keep working on it later.

The unsubscribe link and the mailing address are added at the bottom for you. Every button saves
the draft first. Drafts are listed under **Drafts** on the Newsletters page: choose a draft's
subject to open it again, or **Delete** to remove it.

![The newsletter form with a subject, body, topics and the Preview below](/help/img/officers/compose-newsletter.png)

### How to preview it and send yourself a test

- The **Preview** under the form shows the email exactly as members will get it, including the
  footer. It updates as you type.
- Choose **Send test to me** to get a copy in your own inbox. Its subject starts with "[Test]", and
  the unsubscribe link is replaced by a sample.

### How to send a newsletter

1. Open the draft and choose **Review and send…**.
2. Check the subject, the topics and the number of people it will go to. Members who chose more
   than one of the topics get only one copy.
3. Choose **Send to** followed by the number of people (for example **Send to 42 people**), or
   **Cancel** to go back.

Sending can't be undone, and a sent newsletter can't be edited or deleted. If the number of
recipients changed while the page was open, nothing is sent and the page asks you to check the new
number and confirm again.

![The Send newsletter page with the number of recipients and the Send to button](/help/img/officers/send-newsletter.png)

If the page says newsletters can't be sent, it explains what is missing. The mailing address is
something you can fix in **Site settings**. Anything about email settings, the site address or the
secret key needs the chapter's technical helper.

### If sending stops partway

Large lists go out in batches. After a few minutes the site pauses, and the newsletter's page says
part of it is sent. Choose **Continue sending** (on that page or on the Newsletters list) until it
finishes. Nobody gets it twice.

### After sending: who it reached

Choose the newsletter's subject under **Sent newsletters** to see:

- when it was sent, who sent it and the topics;
- how many emails were **Sent**, **Failed**, had an **Unknown outcome**, or were skipped because the
  member unsubscribed or lost confirmation before their turn;
- a list of everyone it didn't reach for certain, under **Not delivered for certain**;
- every recipient and what happened to their email.

![A sent newsletter's Summary with the sent, failed and skipped counts](/help/img/officers/newsletter-results.png)

### What members see, and how they unsubscribe

Each member gets one email from "SHPE @ CMU". At the bottom it says which topics they are getting
it for, followed by an **Unsubscribe** link, a **Manage your newsletters** link to their account,
and the chapter's mailing address.

- **Unsubscribe** opens a page where they can stop the topics this email was sent for, or every
  newsletter. Nothing changes until they press a button, and it works without signing in.
- Many email apps also show their own unsubscribe button. That removes the topics the newsletter
  was sent for.
- **Manage your newsletters** lets them pick topics again from their account.

Unsubscribing takes effect right away. Members can subscribe again at any time from their account.

## Admin accounts

**Admin accounts** appears in the sidebar for the master admin and for any admin the master has
allowed to create accounts.

### How to create an admin account

1. Choose **Admin accounts** in the admin sidebar.
2. Under **Create admin**, enter their **Name**, **Email** and a **Password** of 12 to 72 characters.
3. Choose **Create account**.
4. Give them the email and password in person or in a private message. The site doesn't send an
   invitation. Ask them to change the password with **Change password** after they first sign in.

Every new account starts as a regular admin that can edit the site but can't create accounts.

Each email address can belong to only one account, admin or member. If the address is already
used, you see "An account with that email already exists." Use a different address for the admin
account, or have the person delete their member account first.

![The Admin accounts page with the Can create accounts button and the Create admin form](/help/img/officers/admin-accounts.png)

### The "Can create accounts" permission (master admin only)

The master admin can let another admin create accounts too:

1. Choose **Admin accounts**.
2. Next to their name, choose **Can create accounts**. The button shows **· On** or **· Off**.

The change applies the next time they load a page. Admins with this permission can only add
regular admins and see the list of names and roles. Email addresses, deleting accounts, resetting
passwords and changing permissions stay with the master.

The master's list also shows who created each account.

### How to reset another admin's password (master admin only)

1. Choose **Admin accounts**.
2. Next to their name, choose **Reset password**.
3. Enter a **New password (12–72 characters)** and type it again in **Confirm new password**.
4. Choose **Set new password**.
5. Give them the new password directly; the site doesn't email it. They are signed out everywhere.

Admins who can still open their email can also reset their own password with **Forgot
password?** (see [If you forget your password](#if-you-forget-your-password)).

### How to remove an admin (master admin only)

Choose **Delete** next to their name and confirm with **OK**. The master account itself can't be
deleted, reset or changed here.

## Privacy Policy and Terms of Use

The **Privacy** and **Terms** links in the footer open the chapter's Privacy Policy and Terms of
Use. Members agree to them when they sign up, so they must stay accurate. Edit them in place like
any other page text (see [Editing page text](#editing-page-text)), but never leave a section empty.

### When to change "Last updated"

Each page shows a **Last updated:** date near the top, which you edit like other text.

- Change it whenever you change what the policy says, such as what you collect, why, who helps
  handle it, or how long it is kept. Fixing a typo doesn't need a new date.
- Change the date **last**, after all the other edits on that page are saved. New sign-ups record
  the Privacy Policy's date as the version they agreed to.
- If you aren't sure whether a change matters, ask your faculty advisor before saving it.

![The top of the Privacy Policy with the Last updated date](/help/img/officers/privacy-last-updated.png)

## Handing over to next year's officers

Do this together with the incoming officers before the old ones leave.

### Checklist

1. **New admin accounts:** whoever can create accounts creates one for each incoming officer (see
   [How to create an admin account](#how-to-create-an-admin-account)).
2. **Officers page:** update the **Executive board** on the **Officers** page with the new names,
   roles and photos, and remove the people who are leaving.
3. **Site settings:** check the contact email, meeting day, time and location, social links and
   mailing address.
4. **Sponsors:** check that each sponsor contact still works with the chapter. Remove sponsor
   access from people who have left their company.
5. **Old admin accounts:** once the new officers can sign in, the master admin deletes the accounts
   of officers who have left.
6. **Share this guide:** point the new officers to **Help** in the admin sidebar.

### Handing over the master admin account

The master admin account can't be moved to someone else from inside the site. It needs the
chapter's technical helper: the person who looks after the website's code and hosting. If you
don't know who that is, ask your faculty advisor or the previous master admin.

1. The outgoing master tells the technical helper who the new master is and which email address
   they will use. It must not already belong to a member account.
2. The technical helper moves the master account to that email and sets a temporary password.
   Everyone signed in to the old master account is signed out.
3. The helper gives the new master the temporary password in person or in a private message.
4. The new master signs in and changes the password straight away with **Change password**.

The same steps work if the master admin loses access to their email. A master who only forgot
their password can use **Forgot password?** instead (see
[If you forget your password](#if-you-forget-your-password)). Other admin accounts are not affected.

### If you are stuck

For anything this guide doesn't cover, such as the website being down, emails not arriving, or an
error message that mentions settings, contact the chapter's technical helper.
