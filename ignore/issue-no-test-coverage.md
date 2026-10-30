No test coverage for any stateful logic (theme persistence, form submission states, image fallback)

**Labels:** `type:chore`, `priority:p2`  
**Estimated Hours:** 8  
**Issue Type:** Task

---

## Problem
There is no test framework configured at all (`package.json` has no `test` script, no
Jest/Vitest/RTL/Playwright dependency). Several components carry non-trivial branching
logic that a future edit could silently break with no signal: `ThemeProvider`'s
init/toggle/persist cycle, `Contact`'s `idle → loading → success/error` state machine
including its retry path, and the `onError` image-fallback-to-placeholder logic shared by
`OfficerAvatar` and `SponsorLogo`. None of this is exercised by anything beyond manual
clicking.

## Proposed Solution
Add Vitest + React Testing Library (lighter weight than Jest for a Next 14 App Router
project) and cover at minimum: theme toggle persists to `localStorage` and updates the
`dark` class; the contact form transitions through its states and shows the fallback email
on error; `OfficerAvatar`/`SponsorLogo` fall back to initials/placeholder on image error.

## Acceptance Criteria
- [ ] `npm test` runs a suite covering the three areas above
- [ ] CI (or at least a documented local command) runs the suite before deploy
