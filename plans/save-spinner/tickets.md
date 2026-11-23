# Feature: Save spinner (save-spinner)

## Summary
A manual Save to GitHub can take 2–3 s with no visible feedback (only the icon disables and its tooltip changes). Add a dismissible kit-based overlay with a spinner and "Saving to GitHub…" shown while a manual save is in flight, closing itself when the save succeeds, fails, or hands off to the conflict modal.

## Goals / Non-goals
- Goal: visible in-progress indicator for manual Saves (incl. draft first-save, portrait upload, custom items/skills commits — everything inside `_doSave`).
- Goal: honor the modal contract: Escape/backdrop/OK dismisses the overlay only; the save continues.
- Non-goal: showing it for silent autosave / flush-on-hide saves.
- Non-goal: minimum display time; changing the existing saved/error toasts; changing the save worker, overlay, or conflict flow.

## Guardrail alignment
Touches `ui/ed-app.js` and a new modal component under `ui/` using `ui/kit/` (UI-GUIDELINES §7, MODALS.md). All tickets Tier 3; Tier-1 Escape rule is preserved by choosing the dismissible variant (qa-log 2026-11-23, second entry). No Tier-1 sign-off needed; no Tier-2 changes. Spinner animation must be theme-aware, two font weights, relative paths; respect `prefers-reduced-motion`.

## Tickets
### T1 — Saving overlay component
- **What:** New kit-based `info`-kind modal component (e.g. `ed-saving`) showing a CSS spinner and "Saving to GitHub…"; dismiss via Escape/backdrop/✕/Enter (close only); announces via `role="status"`/aria-live.
- **Why:** gives feedback during the 2–3 s save.
- **Tier:** 3
- **Acceptance criteria:** uses `ui/kit/` (UI-kit check passes); Escape/Enter close it; focus moves in and returns to trigger; light + dark; spinner stops animating under reduced motion (static indicator); no hardcoded colors.
- **Open questions:** none

### T2 — Wire overlay to manual saves
- **What:** In `ed-app.js`, mount the overlay when a non-silent `_doSave` sets `_saving`, and unmount on completion/failure or when the conflict modal opens; user dismissal does not cancel the save; no overlay for silent saves. Must not collide with the key prompt, rename-draft modal, or conflict modal (only shown once actually posting).
- **Why:** puts T1 on the right code path without touching save logic.
- **Tier:** 3
- **Acceptance criteria:** manual Save shows overlay until success/error/conflict; silent autosave/flush never shows it; dismissing early leaves the save running and the saved/error toast still appears; no stuck overlay on any exit path (incl. early returns, draft rename clash, unauthorized key).
- **Open questions:** none

### T3 — Tests and docs
- **What:** Pure-logic tests for the show/hide decision (extract a small pure helper if needed) ; UI-GUIDELINES/MODALS entries; `data/changelog.json` entry.
- **Tier:** 3
- **Acceptance criteria:** `npm test` green incl. UI-kit check; docs list the new modal in MODALS §8.
- **Open questions:** none
