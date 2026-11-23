# Build log: improve-attributes

## Run 2026-11-23 (since 2026-11-23T09:58:03Z)
- Alignment: all items Tier 3 (no Tier-1/2 change; no schema change). Rules R1-R7 sourced; R4/R5 carry owner decisions. No outstanding technical questions (non-blocking: finished-creation never-saved drafts cannot Improve until first save; preview Step is natural Step).
- Tree: `docs/RULES-FAQ.md` modified (Q047 by rule-agent) — feature artifact, to be staged by explicit path.
# Build log: improve-attributes
- Build run 1: added engine/attribute-improve.js, ui/attribute-improve-state.js, store.loadCharacter/loadDraftCharacter `savedAttributes`, ed-app baseline plumbing + `_editAttribute` + `.improve` prop, ed-overview `+`/pending badge/undo/confirm modal, docs (ARCHITECTURE, UI-GUIDELINES), changelog line.
- Gate: `npm test` green (2430 pass, 0 fail). No test disputes.
