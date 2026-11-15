# Feature: Edit Gahad trigger (edit-gahad-trigger)

## Summary
Gahad is an Ork racial ability whose per-character "trigger" lives in the
character's `traits[]` (`type: "trigger"`, `relatedTo: {type: "ability", name: "Gahad"}`)
and is shown in the Gahad "i" modal on Overview. Today it can only be changed by
hand-editing character JSON. This feature lets an Ork edit the trigger's summary
and description from the existing "Edit character details" modal.

## Goals / Non-goals
- Goal: for characters whose `meta.race` is Ork, the Edit character details modal shows Gahad trigger Summary and Description fields.
- Goal: edits autosave to the local overlay, mark the sheet dirty and sync on Save, like meta edits.
- Goal: both blank on save removes the trigger trait; an Ork with none gets one created (name "Gahad trigger").
- Non-goal: multiple triggers / add-remove list; editing the trait name.
- Non-goal: any change to Gahad's rules effect, taxonomy, or Overview layout.
- Non-goal: showing the fields for non-Ork characters.

## Guardrail alignment
Touches ui/ed-edit-meta.js, ui/ed-app.js (dispatch handler), store.js (overlay
category). Data flows down / events dispatch up preserved; no engine, taxonomy
or rules/*.json change; character top-level schema shape unchanged (`traits[]`
already exists, shape unchanged), so no Tier-1 sign-off needed. Adding `traits`
to the saved overlay categories is a new overlay key, not a character-file shape
change. All tickets Tier 3. Modal keeps Escape/Enter contract; theme-aware.

## Tickets
### T1 — Store: `traits` overlay category
- **What:** save/apply/clear a `traits` overlay (whole array, like items), included in SAVED_CATEGORIES so hasPendingEdits/reconcileOverlay and the GitHub save cover it; applyEdits applies it on load.
- **Why:** edits must persist, show unsaved state, and sync.
- **Tier:** 3
- **Acceptance criteria:** saving traits sets the dirty indicator; a successful save reconciles it; reload shows the edited trigger; unit tests in store-*.test.js style.
- **Open questions:** none

### T2 — Edit-details modal: Gahad trigger fields (Ork only)
- **What:** when `meta.race === "Ork"`, ed-edit-meta shows Gahad trigger Summary + Description (current values from the linked trait) and includes them in the dispatched event.
- **Why:** the user-facing way to edit the trigger.
- **Tier:** 3
- **Acceptance criteria:** fields hidden for non-Orks; prefilled from the existing trait; Escape closes, Enter confirms; works light and dark; mobile single column.
- **Open questions:** none

### T3 — App handler: apply trigger edit to traits
- **What:** ed-app handles the trigger patch: update the existing Gahad trigger trait's summary/description, create `{name:"Gahad trigger", type:"trigger", relatedTo:{type:"ability",name:"Gahad"}}` if absent, remove it if both blank; persist overlay, mark dirty, re-derive.
- **Why:** UI never mutates state itself; flows through dispatch.
- **Tier:** 3
- **Acceptance criteria:** the three cases above covered by tests; the Gahad "i" modal reflects the edit immediately; other traits untouched.
- **Open questions:** none
