# Brief: Save spinner (save-spinner)
## What & why
Manual Save to GitHub takes 2-3 s with no visible feedback. Add a dismissible kit `info` modal (spinner + "Saving to GitHub…") shown while a manual `_doSave` is in flight. It auto-closes on success, error or conflict. Dismissing hides it only; the save continues. Never shown for silent autosave/flush.
## Tickets & tiers
- T1 Saving overlay component — Tier 3 — n/a
- T2 Wire overlay to manual saves — Tier 3 — n/a
- T3 Tests and docs — Tier 3 — n/a
(Tier-1 Escape rule preserved by the dismissible variant; qa-log 2026-11-23.)
## Items
- I1 — pure helper `showSavingOverlay({saving,dismissed,handoff})` + tests — ui/saving-overlay-state.js(+.test.js) — T2, T3 — none
- I2 — `ed-saving` kit modal (info, layer 2150, ack OK, `opened(null)`, reduced-motion) — ui/ed-saving.js — T1 — none
- I3 — wire into `_doSave`: set `_savingManual` after `_saving = true` when `!silent`; clear in `finally`; render `<ed-saving>` (hidden while `_conflict`/`_renameDraft`; `_savingManual`/`_savingDismissed` are `state: true`) — ui/ed-app.js — T2 — none
- I4 — docs (MODALS §5/§8, UI-GUIDELINES §7) + changelog unreleased — docs/MODALS.md (§5, §7 trigger-gone note, §8), docs/UI-GUIDELINES.md, data/changelog.json — T3 — none
## Rules
No Earthdawn rules used (rules.md).
## Owner decisions
- 2026-11-23: modal spinner (not pill/icon).
- 2026-11-23: dismissible; Escape/backdrop/OK hides, save continues.
- 2026-11-23: manual saves only; closes on success/error/conflict; toasts unchanged; no minimum display time.
## Constraints & gotchas
- `_saving` is also set by other paths (ed-app.js ~L1941, L2021); gate on a dedicated manual flag, not `_saving`.
- Key-prompt return in `_doSave` precedes `_saving = true`, so no collision; draft rename clash and conflict both pass through `finally`.
- Conflict keep-mine calls `_doSave` again, so the overlay legitimately reappears.
- Copy `ui/ed-creation-guide.js` for structure; UI-kit check (tools/check-ui-kit.mjs) must stay at baseline: no keydown/frame-css/hardcoded font-size.
- First `prefers-reduced-motion` use in repo; theme via `light-dark()`; weights 400/500.
- Focus (decided): the Save button is disabled when the overlay opens, so no trigger is captured; focus falls to `<body>` on close (MODALS §7 note). The overlay must not steal focus from conflict/rename modals.
- Fast saves flash the modal (no minimum display time, owner decision); accepted.
