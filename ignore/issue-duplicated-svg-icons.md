The same set of social-media/location/checkmark SVG icons is hand-copied across 6+ files

**Labels:** `type:chore`, `priority:p2`  
**Estimated Hours:** 4  
**Issue Type:** Task

---

## Problem
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

## Proposed Solution
Extract a small `src/components/icons.tsx` (or similar) exporting named icon components
(`InstagramIcon`, `LinkedInIcon`, `LocationIcon`, `CheckIcon`, etc.) and swap every inline
copy for an import. Optionally also extract the repeated `SocialLink`-shaped anchor
wrapper used in both `Footer.tsx` and `contact/page.tsx` into one shared component driven
by `config.social`.

## Acceptance Criteria
- [ ] Each icon's SVG markup exists in exactly one place in the codebase
- [ ] Visual output on Footer, Contact, Officers, About, Sponsors, Events, and Home pages is unchanged
