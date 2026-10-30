Adrian Valencia's officer bio is a copy-pasted photographer bio, not his actual role

**Labels:** `type:bug`, `priority:p2`  
**Estimated Hours:** 1  
**Issue Type:** Bug

---

## Problem
In `src/lib/officers.ts`, the `officers` array entry for Adrian Valencia (`role: 'Outreach
Chair'`) has `bio: "Documenting our chapter's events and activities through photography to
share with our members and the community."` — this is word-for-word the bio already used
for Randy Martinez, whose role is `'Photographer'` (line 87). The bio has nothing to do
with outreach and is currently published on the live `/officers` page as-is,
misrepresenting what Adrian actually does for the chapter.

## Proposed Solution
Write a real bio for Adrian Valencia reflecting the Outreach Chair role (or leave it
blank if none is available yet — the field is optional in the `Officer` type).

## Acceptance Criteria
- [ ] Adrian Valencia's bio on `/officers` describes outreach responsibilities, not photography
- [ ] No two officers share an identical bio string unless intentional
