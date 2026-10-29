# User guides

`officers.md`, `members.md` and `sponsors.md` are the only copy of the user guides; every other
format is generated from them, so edit the Markdown and nothing else. At request time
`src/lib/guides.ts` renders them (raw HTML is shown as text and `<!-- -->` comments are dropped)
for the public pages `/help`, `/help/members` and `/help/sponsors`, for `/admin/help` behind the
admin sign-in, and for two print pages without navigation that exist only to make PDFs:
`/help/print/public` (member and sponsor guides) and `/admin/help/print` (officer guide, admins
only). Screenshots are referenced as `/help/img/<guide>/<slug>.png` and live in `public/help/img/`;
`docs/guides/screenshots.json` lists each one with the page, account and state it shows. A missing
image only shows its alt text. The public PDF is `public/help/shpe-website-guide.pdf`; the officer
handbook is `docs/guides/pdf/officer-handbook.pdf` and is served only to signed-in admins from
`/admin/help/handbook.pdf` (never put it in `public/`). After changing a guide or the screens it
describes, deploy a preview and run `npm run help:screenshots` and then `npm run help:pdf` against
it (each script's header lists the variables it needs), check the images and PDFs, and commit them
with the Markdown change.
