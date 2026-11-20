# Plan Review: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Summary
The plan is sound. It covers T1-T7, has the Tier-1 sign-off recorded (qa-log 09:21), has no rules dependencies, and its sequencing is valid. There are 0 blockers, 2 major and 3 minor findings, mostly about pinning down grounding gaps before the build.

## Findings
### F1 — I2 — ed-confirm has no cancel-label prop
- **Severity:** major
- **Problem:** The plan hedges ("check ... `confirmLabel`/`cancelLabel` support custom labels"). I checked `ui/ed-confirm.js`. It only has `heading`, `message`, `confirmLabel`, `tone`, `warn` and `disabled`. The Cancel label is fixed, so [Keep editing] [Discard] cannot be built without a change to `ed-confirm`. `ed-confirm` is used app-wide, so the change must default to "Cancel".
- **Fix:** State in I2 that a `cancelLabel` property (default "Cancel") is added to `ed-confirm`. Note it is a Tier-3 additive change. Also note that the `ed-confirm` footer hint reads "Enter = OK" and its initial focus is Cancel (`initialFocus: '[data-cancel]'`). So Enter on the prompt will mean Keep editing. Record that this is the intended default (safe) and add it to the manual checklist.

### F2 — I1 — Stacking layers for settings, conflict and save-key are not mapped
- **Severity:** major
- **Problem:** The portals use z-index 2200 (`ed-settings`, `ed-conflict`) and 2100 (`ed-save-key`). The kit layers are 2000/2100/2150/3000, and `modalFrame` takes a numeric `layer` (default 2000). The plan's fallback is to keep the portals. But `ModalController.dialogEl` with `light: true` queries `document`, so `[data-modal=id]` is only unique if the ids are unique. The preferred approach, moving them into the shadow tree, changes stacking context relative to `ed-confirm` (layer 2100) and modals opened inside child shadow roots. The `ed-app` footprint is the same as today (all three are mounted in `ed-app.js` ~2089-2102), but a conflict raised while another modal is open must still render on top.
- **Fix:** In I1, list the explicit layer per modal (conflict/settings 2200, save-key 2100) and pass `layer` numerically. Add the cases "conflict over an open kit modal" and "ed-confirm over settings" to the owner checklist. Confirm that the kit stack, not z-index alone, decides which modal gets Escape.

### F3 — I3/I5 — "dirty" definition and single-line Enter handling left open
- **Severity:** minor
- **Problem:** I2 requires `isDirty` for Notes, `ed-edit-meta` and `ed-custom-item`, but the snapshot rules are left for the build. The Notes and custom-item single-line input Enter behaviour is also an open question, and R15 on an `input` kind would confirm on Enter in a title field. Ctrl+Enter semantics inside such a textarea modal differ from Enter in the single-line field.
- **Fix:** Fix the default now: `isDirty` compares draft fields to the opened snapshot, and a title input keeps R15 (Enter saves) unless it is a textarea. Say so in I3/I5 and cover it with the pure helper tests in I8.

### F4 — I7 — Dependencies line and keydown check
- **Severity:** minor
- **Problem:** I7 says "I1 not needed; independent", but the sequence puts it third. The document-level keydown at `ed-combat.js:337` is only to be removed after confirming that it serves only the audit modal. That is correct but is left as a risk rather than a step.
- **Fix:** Make "grep and confirm keydown scope" the first step of I7. If it serves other overlays, only the audit branch is dropped and the baseline `keydown` count must still reach 0, so such handling would have to move to kit `data-enter="local"`.

### F5 — I9 — Baseline and docs wording
- **Severity:** minor
- **Problem:** The UI-GUIDELINES §7 footnote (line 121) currently cites only the earlier D1 sign-off. The plan says to "extend" it, and correctly bars any other edit. The changelog item does not say whether a version bump is needed.
- **Fix:** Name the exact footnote text to add (citing qa-log 2026-11-20T09:21:00Z). Say that the changelog follows the existing convention in `data/changelog.json`.
