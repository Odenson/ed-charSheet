# Build log: update-notes-edit

## Run 1 — 2026-11-27 (since 2026-11-26T21:13:29Z)

### Phase 0 — Alignment
- **Guardrails:** I1, I2, I4 Tier 3. I3 Tier 1 (MODALS.md §5 D5 exception), owner sign-off recorded at qa-log 2026-11-27T21:25:00Z. No Tier-2 items. Pass.
- **Rules:** `rules.md` records no Earthdawn rules apply. Pass.
- **Open questions:** none in plan.md or review.md (F1, F2 accepted and folded in). Pass.
- **Tree:** clean apart from the untracked feature folder `plans/update-notes-edit/` (belongs to this feature; committed with it).
- `plan.md` status → `building`.

### Build (feature-dev, mode: build)
- **I1:** `ui/ed-notes.js` drops the `editMode` property; "+ Add note" always rendered; one `.cards` layout (the `.cards.read` styles became the default, ≤720px override kept); single empty message. `ui/ed-app.js`: removed `.editMode` from `<ed-notes>` only (`<ed-combat>` untouched).
- **I4 helper:** new pure `ui/notes-state.js` (`upsertNote`, `removeNote`), used by `_saveNote` and the `note` branch of `_confirmDelete`.
- **I2:** card = `.ncard` container with `.nread` (`role="button"`, padding, fills card) and sibling `.nicons` (✎/✕, `stopPropagation`); `.nread` keydown ignores non-self targets. Focus ring via `.ncard:has(.nread:focus-visible)`. Icons opacity-revealed on hover/focus-within/focus-visible, always on under `(hover: none)` with `.nread` right padding 3.5rem.
- **I3 (Tier 1, signed off qa-log 2026-11-27T21:25:00Z):** popup body gains `.nfoot` row (Delete `btn danger`, Edit `btn`); `_popupEdit()` closes without restoring focus and opens the note modal with the `.nread` trigger. Delete stacks `<ed-confirm>`; on confirm the popup closes (no focus restore) and `_focusAddAfterUpdate` sends focus to "+ Add note" on the next `model` update (also for card ✕). Defensive close in `updated` when the popup's note is gone; `_expTrigger` cleared on close and character switch. No `ui/kit/` change.
- **I4 docs:** UI-GUIDELINES italic note after the tab notes; MODALS §5 "Notes full-note popup exception"; PLAN-NOTES-TAB Phase D note line amended; changelog `unreleased` summary + `improved` entry.
- **Gate:** `npm test` green — 2588 tests, 0 fail (incl. pretest import lint and check-ui-kit; ed-notes at 0). Tester tests untouched; no disputes.

### Phase 4 — Dev Lead review (run 1)
- Commit 6c2cc6d reviewed against spec.md and plan I1–I4: clean, no revision needed.
- Golden rule: ed-notes still only dispatches `ed-edit-notes`; new `ui/notes-state.js` is pure (no DOM/lit). No stored derived values, no schema change.
- Tier 1 (I3): popup stays `kind: 'info'`, Edit/Delete in a `.nfoot` body row; `git diff --stat HEAD~1 HEAD -- ui/kit` empty. Matches sign-off qa-log 2026-11-27T21:25:00Z.
- Tester's tests byte-identical to snapshot; `npm test` 2588 pass / 0 fail.
- Nit (accepted, no change): `.ncard:focus-within` also reveals icons after a mouse click on the card (focus stays on `.nread`); harmless, consistent with the Overview `.info` pattern.

### Phase 5 — Doc sync (design-agent)
- Applied D1: ARCHITECTURE.md §8 lists `ui/notes-state.js`.
- Applied D2: ARCHITECTURE.md §8 `ed-notes.js` comment updated.
- Applied D3: plan.md → `status: implemented`, `shipped: unreleased`.
- **Deferred (Tier 1, owner decision):** UI-GUIDELINES §4 tab-table row `| Notes | Running character history / log over time |` undersells the shipped tab. Proposed: `| Notes | Running character record in four sub-views: Notes (free-form cards, editable outside edit mode), History (dated timeline), Legend (earned/spent), and the device-local roll Log |`. Predates B-004; not applied without sign-off.

### Phase 6 — Ship / owner handoff
- Gate: `npm test` 2588 pass / 0 fail. Tester's tests unchanged vs snapshot. Local `dev` not behind `origin/dev`.
- Pushed to `dev` (no PR). Feature commit 6c2cc6d + doc-sync commit.

#### GUARDRAILS PR checklist
- [x] Tiers classified: I1/I2/I4 Tier 3; I3 Tier 1 with sign-off qa-log 2026-11-27T21:25:00Z.
- [x] No Tier-2 (taxonomy) change; `rules/*.json` and EFFECT-TAXONOMY untouched.
- [x] Data down / events up: same `ed-edit-notes` event and payload; engine untouched.
- [x] Store only inputs: notes shape unchanged; nothing derived stored.
- [x] Schema shapes and version tags unchanged.
- [x] Modals on `ui/kit/` (no kit file changed); Escape closes top modal; check-ui-kit 0 for ed-notes.
- [x] Theme: only existing `light-dark()` variables and `--fs-*` sizes.
- [x] Docs updated: UI-GUIDELINES note, MODALS.md §5 exception, ARCHITECTURE §8, PLAN-NOTES-TAB, changelog.
- [ ] Deferred for owner: UI-GUIDELINES §4 Notes table row (Tier 1) — see Phase 5.

#### Manual UI verification (owner, on `dev`)
Check each in light and dark, desktop width and ≤720px, plus touch emulation (`hover: none`):
1. Edit mode OFF → Notes tab → Notes: "+ Add note" visible; add a note → saved, character marked dirty.
2. Toggle edit mode on/off: cards look identical (square, bottom fade on desktop; free height, no fade ≤720px).
3. Delete all notes: empty state says "No notes yet — add NPCs…", no edit-mode hint.
4. Desktop: ✎/✕ hidden until hover; Tab onto a card shows a full, unclipped focus ring and the icons; mouse click shows no ring.
5. Touch emulation: ✎/✕ always visible top-right, never covering note text.
6. Click ✎ or ✕ (or Enter on them): popup never opens. Click anywhere else on the card (edges too), or Enter/Space on the focused card: popup opens.
7. Popup shows Delete and Edit. Edit → note modal pre-filled; Save updates; focus returns to the card. Cancel also returns focus to the card.
8. Popup Delete → confirm on top. Cancel / Escape → back to the popup, focus on Delete.
9. Popup Delete → Confirm → note gone, no popup left, focus on "+ Add note" (ring only when using keyboard).
10. Card ✕ → Confirm → focus on "+ Add note".
11. Enter on the popup (not on a button) closes it; Escape closes only the top modal.
12. History, Legend and Log sub-views behave as before; Overview fit unaffected (no Overview change).
