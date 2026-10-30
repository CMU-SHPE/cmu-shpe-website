Theme toggle icon shows the wrong state on first paint for dark-mode visitors

**Labels:** `type:bug`, `priority:p2`  
**Estimated Hours:** 2  
**Issue Type:** Bug

---

## Problem
`layout.tsx` runs an inline synchronous script that adds the `dark` class straight to
`<html>` from `localStorage` before paint, specifically to avoid a flash of the wrong
*background* theme. But `ThemeProvider` (`src/components/ThemeProvider.tsx:17`) always
initializes its React `theme` state to `'light'` on mount, and only reads `localStorage`
inside a `useEffect` that runs after the first render. `Navbar` reads `theme` from that
context to pick the Sun/Moon icon (`src/components/Navbar.tsx:67,78`). Result: a returning
visitor with dark mode saved sees correct dark backgrounds/colors immediately (driven by
the DOM class), but the theme-toggle icon briefly renders as if the site were in light
mode, then flips right after hydration — a visible, confusing icon flash specifically on
the control whose only job is to show current theme.

## Proposed Solution
Have `ThemeProvider` read the already-applied DOM class (`document.documentElement.classList.contains('dark')`)
synchronously during initial state instead of defaulting to `'light'` and waiting for an
effect — e.g. `useState(() => ...)` with a guarded `typeof document !== 'undefined'` check,
or read `localStorage` directly in the initializer. This keeps the single source of truth
(the inline pre-paint script's decision) consistent with React state from the first render.

## Acceptance Criteria
- [ ] Loading any page with `theme=dark` in `localStorage` shows the Sun icon (dark-mode-active state) immediately, with no post-hydration flip
- [ ] Light-mode visitors see no change in behavior
