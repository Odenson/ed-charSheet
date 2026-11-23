# Build log: improve-attributes

## Run 2026-11-23 (since 2026-11-23T09:58:03Z)
- Alignment: all items Tier 3 (no Tier-1/2 change; no schema change). Rules R1-R7 sourced; R4/R5 carry owner decisions. No outstanding technical questions (non-blocking: finished-creation never-saved drafts cannot Improve until first save; preview Step is natural Step).
- Tree: `docs/RULES-FAQ.md` modified (Q047 by rule-agent) — feature artifact, to be staged by explicit path.
# Build log: improve-attributes
- Build run 1: added engine/attribute-improve.js, ui/attribute-improve-state.js, store.loadCharacter/loadDraftCharacter `savedAttributes`, ed-app baseline plumbing + `_editAttribute` + `.improve` prop, ed-overview `+`/pending badge/undo/confirm modal, docs (ARCHITECTURE, UI-GUIDELINES), changelog line.
- Gate: `npm test` green (2430 pass, 0 fail). No test disputes.
- Phase 4 review: clean (no revision). Tester tests byte-identical to snapshot. Gate: npm test 2430 pass / 0 fail.
- Doc sync: applied D1+D2 (ARCHITECTURE.md §4.1). D3 (modal inventory) not needed. No Tier-1/2 edits deferred.

## Owner handoff — PR checklist (GUARDRAILS.md)
- [x] No Tier-1 invariant changed (no schema change; `increases` already in ed-character/2; data-down/dispatch-up kept via `ed-edit-attribute`; engine pure)
- [x] No taxonomy change (Tier 2 n/a)
- [x] Only inputs stored (`increases`); Value/Step derived
- [x] Relative paths; no hardcoded colours added (theme tokens)
- [x] `npm test` green (2430/0)
- [ ] Owner UI verification (below)

### Manual UI verification
1. Open a finished (non-creation) saved character, enter edit mode: each Overview attribute tile shows a small `+` on its name line; read mode shows none.
2. Click `+` on one: modal shows Value/Step before→after, Cost, Legend after, training days/silver/weeks, rested-and-healthy note. Escape closes; Enter confirms.
3. Confirm: Value/Step and dependents (defences, health, talent steps) update; Legend available drops by 800 (1st). Tile shows "+1" badge and ↺; every other `+` is disabled with a reason tooltip; save dot is dirty.
4. ↺ undo: restores value and Legend, re-enables all `+`, dirty dot clears if nothing else pending.
5. Save, then improve the same attribute again (1,300), then a 3rd (2,100); a 4th shows no `+` (cap). With too little Legend the `+` is disabled.
6. Reload with an unsaved improvement: still pending. Discard: resets.
7. A character in creation or an unsaved draft: no improve `+` (creation -/+ unchanged).
8. Light and dark mode; mobile fold; Overview fits desktop viewport with no vertical scroll at the narrowest desktop width (the `+`/badge share the name line with item-modifier badges).
