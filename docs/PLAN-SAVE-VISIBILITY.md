# Plan: Surface the Save affordance during play (dirty-state visibility)

Make the Save icon (with its unsaved-changes dot) visible whenever the local
browser copy is ahead of the GitHub version — **including during play, outside
Edit mode** — so background changes are never silently un-saveable. Optionally, a
gentle autosave on top (flush-on-hide) as a follow-up.

This file is the plan for owner review. **Nothing implemented yet.**

- **Owner:** repo owner. **Created:** 2026-08-12. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `72fd8fb`. Suite **442** (`npm test`, import check first).

---

## Problem

Every character mutation writes the local **overlay** (localStorage) and sets
`_dirty = true` — including **background, play-time changes** that are not
explicit edits:

- Combat: Strain charged on an attack roll, take-damage / heal, Recovery, the
  Knockdown result, Stand up, blood-charm spend on Initiative.
- Any roll: Karma spend (`ed-edit-karma`).

But the **Save button (and Export, and the Discard/Revert button) render only
inside Edit mode** — `ui/ed-app.js` renders them under
`${this._editMode ? html\`…\` : ''}` (≈ ed-app.js:892). So during play (not Edit
mode):

- the unsaved-changes **dot is invisible** — the player has no signal that the
  local copy has diverged from GitHub, and
- there is **no way to save** without toggling into Edit mode to reveal the icon.

The dirty *tracking* is correct and the overlay keeps the data safe across
reloads on that device; what's missing is the **visible, clickable Save
affordance** when dirtiness arises outside Edit mode. (Single-player / one-device
is the norm, so this visibility gap — not data loss — is the actual pain.)

---

## Scope decision (owner to confirm)

- **Phase 1 — Save visibility (recommended now).** Ungate the Save icon from Edit
  mode so it appears whenever there are unsaved changes. Small, low-risk, solves
  the reported problem.
- **Phase 2 — Gentle autosave (optional, later).** A light autosave so a player
  who forgets to tap Save doesn't lose cross-device freshness / browser-clear
  insurance. **Not** an aggressive timer — see Phase 2 below. Owner decides if it
  is in this update or a separate one.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Show the Save button outside Edit mode | ✅ Tier 3 | A UI affordance change in `ui/ed-app.js`; no invariant touched. Data still flows down / events up; the save path (worker, overlay, conflict flow) is unchanged; theme-aware button already exists. |
| Keep Export / Discard Edit-mode-only | ✅ Tier 3 | Deliberate — exposing a destructive/irreversible control (Discard reloads the branch and drops local play) mid-combat is worse than hiding it. |
| Phase 2 autosave (if taken) | ✅ Tier 3 | Reuses the existing `_doSave({ silent })` path + conflict modal; no new invariants. |

**Tier-1 invariants upheld:** store only inputs (unchanged — the overlay already
holds inputs); data down / events up (the button dispatches into the existing
`_save` path); modal rules unchanged; light + dark (the icon is already themed);
relative fetch paths unchanged.

---

## Phase 1 — Save visibility

**Outcome:** the Save icon + dot appear the moment a change (edit-mode *or*
play-time) dirties the state, and one tap saves — no Edit-mode detour.

- [ ] 1a. **Render the Save button on `_editMode || _dirty`.** Pull the Save
      `<button>` out of the Edit-only block into its own conditional so it shows
      during play once `_dirty` is true. The `.dirty` dot class and
      `_saveTitle()` ("Save to GitHub (unsaved changes)") are already wired — no
      new state. When not dirty and not in Edit mode, it stays hidden (no idle
      clutter).
- [ ] 1b. **Keep Export and Discard/Revert Edit-mode-only.** Export is a
      deliberate backup action; Discard is destructive (reloads the branch,
      drops local play) and must not sit one mis-tap away during a fight. Leave
      both under `${this._editMode …}`.
- [ ] 1c. **Save-key prompt during play is acceptable.** A play-time Save with no
      key in memory opens the existing key modal once; subsequent saves this
      session are silent-capable. No change — just confirm the flow reads well
      outside Edit mode (the key modal is not Edit-gated).
- [ ] 1d. **Conflict flow unchanged.** A play-time manual Save that hits
      `stale_base` surfaces the existing `ed-conflict` modal (rare for a solo
      player — only with a second device). No change.
- [ ] 1e. **Verification.** `npm test` + import check stay green (render-condition
      change, no logic). Manual: trigger a combat change outside Edit mode → the
      Save icon appears with the dot → tap saves → dot clears. Light + dark.

*(No ed-app DOM/Lit unit harness exists; this is a render-condition change, so
Phase 1 is verified by the suite staying green + a manual smoke.)*

## Phase 2 — Gentle autosave (optional)

**Outcome:** a forgetful player doesn't strand unsaved play, without mid-combat
interruptions or commit spam. Only if the owner wants it in this update.

- [ ] 2a. **Flush on leave (highest value).** Save the pending overlay on
      `visibilitychange`→hidden and `pagehide` (tab away, close, mobile
      background) — the natural moment work would otherwise be stranded.
- [ ] 2b. **Long idle debounce + max-wait cap.** After a configurable idle gap
      (default long, e.g. ~15–30 s) with no further changes, autosave; cap the
      max wait so a continuous fight still saves periodically. Coalesces many
      rapid ticks into one commit (git-diff friendly).
- [ ] 2c. **Key-gated + silent.** Autosave fires **only when the save key is
      already in memory** (never pops the key prompt mid-play); failures are
      silent (keep the dot dirty, retry next trigger) — never a toast.
- [ ] 2d. **Non-interrupting conflicts.** A *silent* autosave that hits
      `stale_base` does **not** pop the modal; it keeps the dot dirty and defers
      the conflict to the next explicit Save. (Rare for a solo player, but keeps
      play uninterrupted.)
- [ ] 2e. **Setting.** An on/off toggle (default on) + interval; off = pure
      manual (Phase 1). `data/changelog.json` entry.

---

## Notes / decisions to confirm

- **Q1 — scope:** Phase 1 only in this update, or Phase 1 + Phase 2 together?
- **Q2 — resting visibility:** Save icon hidden when clean (shows only when
  dirty), or always visible with the dot only when dirty? Plan assumes
  **hidden-when-clean** (less idle clutter); say if you'd rather it always show.
- **Q3 — Phase 2 interval / default** (only if Phase 2 is in): idle gap + max-wait
  values, and whether flush-on-hide alone is enough for a solo player (it may be —
  the overlay already covers reloads, so flush-on-hide covers the leave case).

---

## Guardrail re-check (before landing)

- [ ] No Tier-1 invariant changed (store-only-inputs, data-down/events-up, pure
      engine, schema shapes) — Save-button visibility is a Tier-3 UI affordance.
- [ ] Works in light and dark mode; the Save/dot icon already themed.
- [ ] Any modal reachable from a play-time Save (key prompt, conflict) still
      Escape-closes / Enter-confirms.
- [ ] Asset/fetch paths relative; no root-absolute.
