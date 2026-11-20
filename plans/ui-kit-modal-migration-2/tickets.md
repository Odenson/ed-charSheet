# Feature: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Summary
Second half of the UI-kit rollout ([ui-kit-modal-keyboard-contract](../ui-kit-modal-keyboard-contract/plan.md), shipped v1.39.0). Migrates every modal still hand-rolled to `ui/kit/` (shared frame, buttons, one keyboard contract), wires Ctrl/⌘+Enter save and the discard-changes prompt for free-text modals, and empties the `tools/ui-kit-baseline.json` allowlist except the non-modal entries.

## Goals / Non-goals
- Goal: all listed modals use `ModalController` + `modalFrame`/`buttonCss`; Enter = OK, Escape closes top only, Cancel/Primary footer, hint, tab tones kept (decisions D1–D8 from the first feature).
- Goal: Ctrl/⌘+Enter saves in textarea modals; discard prompt (stacked `ed-confirm`) on Notes note/event, custom item, Edit character details.
- Goal: baseline shrinks to Spells font-size ×5, legend-spent-view font-size ×2, ed-app button-style ×1.
- Non-goal: picker/inline-field cleanups (K7, K10) and non-modal cleanups (V5–V8): a later feature.

## Guardrail alignment
Touches UI-GUIDELINES §7 (Tier 1), MODALS.md, GUARDRAILS (none), baseline JSON. Sign-off for §7 line recorded in qa-log (2026-11-20T09:21:00Z). Engine/data/schema untouched.

## Tickets
### T1 — Overview modals on the kit
- **What:** Overview info, Edit character details (free-text, Ctrl+Enter, discard prompt), Legend spent, Karma Ritual (input, tone karma, Cancel added), lightbox (read-only).
- **Tier:** 3 (UI-GUIDELINES conformance preserved)
- **Acceptance:** no `ui/ed-overview.js` baseline entries; Escape/Enter per contract; focus returns to trigger.

### T2 — Notes modals
- **What:** Notes note/event add/edit (textarea, Ctrl+Enter saves, hint, discard prompt) and delete confirm.
- **Tier:** 3
- **Acceptance:** "+ add note" saves via Ctrl/⌘+Enter; Enter types newline; dirty Escape asks to discard.

### T3 — Combat step audit
- **What:** Step audit modal read-only (✕ only, Enter closes); "Escape closes" hint removed.
- **Tier:** 3

### T4 — Form/input modals
- **What:** `ed-add-legend`, `ed-edit-meta`, `ed-custom-item` (free-text, discard prompt), `ed-day-reset` (green tone), `ed-settings`, `ed-save-key`, `ed-conflict` as input/confirm kinds.
- **Tier:** 3

### T5 — Picker and read-only system modals
- **What:** `ed-character-picker` (picker kind, Enter activates focused row), `ed-changelog` and `ed-homebrew` (read-only).
- **Tier:** 3

### T6 — Discard-changes prompt wiring
- **What:** Host-side `isDirty` + `onDiscardPrompt` opening a stacked `ed-confirm` [Keep editing] [Discard]; Escape on it returns to editing.
- **Tier:** 3

### T7 — Docs, baseline and check
- **What:** UI-GUIDELINES §7 gets "Textarea modals: Enter types a newline; Ctrl/⌘+Enter saves" (**Tier 1, signed off, qa-log 2026-11-20T09:21:00Z**); MODALS.md §2/§4/§10 updated; baseline reduced; `check-ui-kit` still green; changelog `improved` entry.
- **Tier:** 1 for the §7 line (signed off); 3 otherwise.
