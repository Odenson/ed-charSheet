# Build log: simple-animate-portrait

## Build run 1
- I1 ui/portrait-anim.js; I2 ed-app prefs/persist/data down; I3 ed-settings Portrait animation section; I4 ed-overview drift + avatar-wrap; I5 ui/ed-portrait-embers.js; I6 UI-GUIDELINES 8a, ARCHITECTURE file list, changelog.
- Gate: npm test green (2534 pass, 0 fail). No test disputes.
- Owner manual checks outstanding (themes, mobile avatar, no-scroll, reduce-motion).
- **Phases:** spec (designer), 22 tests in `ui/portrait-anim.test.js` (tester; unchanged by dev, verified vs snapshot), build commit 3c5f55f (dev), Dev Lead review clean (no revision), doc sync: no edits needed (design-agent). No NEEDS_TESTER/HUMAN/RULES.
- **Unrelated working-tree item (not staged):** `plans/uplift-talents-with-arm/`.
- **Gate:** `npm test` 2534 pass / 0 fail.

## Owner handoff — GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (device-wide localStorage prefs; ed-app only persister; data down / events up)
- [ ] Overview still fits desktop viewport, no vertical scroll — owner to verify (drift scales inside overflow:hidden frame)
- [x] No derived values touched
- [ ] Light and dark mode — owner to verify; Escape/Enter on Settings unchanged (kit)
- [x] Modals use ui/kit/ (check-ui-kit passes in `npm test`)
- [x] Taxonomy: N/A
- [x] Asset/fetch paths: none added
- Deferred Tier-1/2 doc edits: none.

## Manual UI verification (owner, on dev)
Settings → Portrait animation (Slow drift, Embers); desktop Overview portrait; mobile header avatar; light + dark; OS reduce-motion.
