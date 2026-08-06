Sponsor "SGM" is filed under the Gold comment block but carries a Platinum tier value

**Labels:** `type:bug`, `priority:p2`  
**Estimated Hours:** 1  
**Issue Type:** Bug

---

## Problem
`src/lib/sponsors.ts` groups sponsor entries under section comments (`── Platinum ──`,
`── Gold ──`, etc.). The SGM entry sits directly under the `── Gold ──` comment (line 28)
but its `tier` field is set to `'Platinum'` (line 31), not `'Gold'`. Since the actual
rendering on both the homepage sponsor strip and the `/sponsors` tier table sorts and
groups purely by the `tier` field (not by comment position), SGM is displayed and
benefits-gated as a Platinum sponsor. If Gold was the intended (or contracted) tier, the
site is currently over-crediting SGM's sponsorship level; if Platinum is correct, the
stale comment will mislead the next editor into "fixing" it incorrectly.

## Proposed Solution
Confirm SGM's actual sponsorship tier with whoever manages sponsorships, then either
correct the `tier` value to `'Gold'` or move the entry under the `── Platinum ──` comment
block to match reality.

## Acceptance Criteria
- [ ] SGM's `tier` field and its surrounding comment section agree
- [ ] SGM renders in the correct tier group on `/` and `/sponsors`
