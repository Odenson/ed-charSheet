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
