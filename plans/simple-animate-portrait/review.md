# Plan Review: Simple animated portrait (simple-animate-portrait)

## Summary
The plan is sound: all items are Tier 3, no rules are used, every ticket is covered and the sequencing is valid. Grounding checks out (ed-app L301/2440/2693/2881, ed-overview L80-84/247-249/275, the ed-settings switch CSS all exist). 3 minor findings, 0 blockers, 0 major.

## Findings
### F1 — I4/I5 — Reduce-motion handled in two places
- **Severity:** minor
- **Problem:** I4 says the CSS media query "ensures embers are not mounted", but CSS cannot prevent a Lit template from mounting an element. I5 separately stops the loop on reduce-motion inside the element. The responsibilities overlap and the I4 wording is not achievable.
- **Fix:** State that I4's media query only disables the drift animation, and that I5's element owns the reduce-motion check (it renders nothing and runs no rAF). Optionally also gate mounting in the overview with matchMedia.

### F2 — I4 — Avatar wrapper styling and the existing `.avatar` rules
- **Severity:** minor
- **Problem:** `.avatar` CSS (L84) puts border, radius, size, and `display:none` on the img, and `.avatar.ph` (L249) is a separate div. Adding a wrapper without specifying which element keeps the border and size risks a doubled border or a layout change in `.head`. The plan notes the risk but does not decide.
- **Fix:** Specify that the wrapper owns size, radius, overflow and display (none on desktop, block/inline-flex at the mobile breakpoint). The img fills it at 100% with the border moved to the wrapper, or the wrapper is rendered only when `animEmbers` is on. Verify the `.avatar.ph` placeholder branch is untouched.

### F3 — I3 — Reduce-motion hint read once
- **Severity:** minor
- **Problem:** The media query is read only in `connectedCallback`, so the hint will not update if the OS setting changes while the modal is open. This is acceptable but unstated.
- **Fix:** Note it as an accepted limitation, or add a change listener. UI-only checks (focus ring on the hidden-input switch, both themes, mobile avatar layout, ember legibility) should be listed explicitly as owner manual verification, since node:test cannot cover them.
