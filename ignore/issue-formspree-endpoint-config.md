Formspree endpoint is hardcoded in the Contact page component with a stale setup comment

**Labels:** `type:chore`, `priority:p2`  
**Estimated Hours:** 1  
**Issue Type:** Task

---

## Problem
`handleSubmit` in `contact/page.tsx` posts directly to a hardcoded
`https://formspree.io/f/mwvwddro` URL, with a leftover comment above it ("Replace
YOUR_FORM_ID with your Formspree form ID. Sign up for free at https://formspree.io to get
one.") describing a setup step that has already been completed — the ID is filled in.
Every other piece of chapter-specific configuration (contact email, meeting time/location,
social links) lives in `src/lib/config.ts`; the Formspree endpoint is the one exception,
buried inside a page component instead.

## Proposed Solution
Move the Formspree endpoint into `src/lib/config.ts` alongside the other contact settings
and remove the stale setup comment now that the ID is populated.

## Acceptance Criteria
- [ ] Formspree URL is read from `src/lib/config.ts`, not hardcoded in the component
- [ ] No leftover "replace YOUR_FORM_ID" instructional comment remains in shipped code
