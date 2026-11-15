---
status: implemented
shipped: unreleased
---
# Delivery Plan: Edit Gahad trigger (edit-gahad-trigger)

## Context & learnings
Gahad is an Ork racial ability. A character's own trigger is a `traits[]` entry
(`type: "trigger"`, `relatedTo: {type:"ability", name:"Gahad"}`) shown in the Gahad
"i" modal on Overview, and today it can only be changed by hand-editing JSON.
The owner decided (qa-log.md):
- Any Ork character (Gahad is racial) edits it in the existing "Edit character details" modal.
- Both `summary` and `description` are exposed; the trait `name` is not editable.
- The trigger stays in `traits[]`, and `traits` becomes a new saved overlay category.
- There is a single trigger. Blank summary and description on save deletes the trait. An Ork with none gets one created, named "Gahad trigger".
- The trigger may be changed at any time. This is not a house rule, it is left to the user (rules.md R2).
- Non-goals: multiple triggers, editing the trait name, any change to Gahad's rules effect, the taxonomy or the Overview layout, and showing the fields to non-Orks.

## Discoveries
- `ui/ed-edit-meta.js`: modal driven by a `FIELDS` array. `_save` builds a meta `patch` and dispatches `ed-edit-meta` (bubbles, composed), then closes. Escape is a document keydown. Enter confirms via the form submit. The form is a 2-column grid collapsing to 1 column at 480px, with `.field.wide` for textareas. It takes only a `meta` property.
- `ui/ed-overview.js:1051` renders `<ed-edit-meta .meta=${meta}>`. `_traitsFor(abilityName)` (line 639) and `_abilityModalBody` (line 647) already render linked traits from `this.model.traits` in the Gahad modal.
- `ui/ed-app.js`: `_editMeta(patch)` (line 566) merges the patch into `this._character.meta`, calls `saveMetaEdits`, `_markDirty()` and `this._model = this._derive()`. `_editNotes` (line 1129) is the whole-array precedent. Listeners are registered around line 401 and 459.
- `store.js`: `saveItemEdits` and `saveNotesEdits` store whole arrays. `SAVED_CATEGORIES` is at line 504 and is used by `hasPendingEdits` and `reconcileOverlay`. `applyEdits` is at line 533. `deriveModel` already exposes `traits: character.traits ?? []` (line 1777). `forSave` passes unknown top-level keys through, so `traits` rides the GitHub save with no worker change.
- `meta.race` is the string `"Ork"` in data/characters/{kolon,chakka,test-char}.json. The existing trigger traits there are named e.g. "Gahad - Cats" and have only `summary`. Existing names must therefore be preserved on edit.
- Test pattern: `store-notes.test.js` (in-memory localStorage stub, `applyEdits`/`hasPendingEdits`/`reconcileOverlay` round-trip).
- Gotcha: `ed-app._editMeta` spreads the whole patch into `character.meta`. Trigger fields must therefore NOT ride the meta patch, or they would leak into `meta`.

## Guardrail classification
All items are Tier 3. The change adds a field set to an existing modal, one new overlay key, and edits to `traits[]` entries whose shape is unchanged.
- Data flows down and events dispatch up. The modal dispatches and ed-app mutates.
- The engine, taxonomy and `rules/*.json` are untouched.
- The character top-level schema shape is unchanged and the schema tag stays `ed-character/2`.
- The overlay key is local persistence, not a character-file shape.
- The trigger is a raw input and nothing derived is stored.
- The modal keeps Escape-closes and Enter-confirms, and is theme-aware via `light-dark()` tokens.

No Tier-1 sign-off is needed.

## Rules dependencies
- R1 (ANSWERED): a gahad trigger is a player-authored roleplay note. Free text is appropriate and there is no mechanical effect. Used by I2 and I3.
- R2 (decision recorded 2026-11-15): the trigger is editable at any time. The single-trigger scope is a simplification, not a rule. Used by I2 and I3.
- R3 (FAQ-HIT): the Gahad effect in the rules is correct and unchanged. Not used.
- No open NEEDS_RULES.

## Implementation items
### I1 — Store: `traits` overlay category + pure trigger helper
- **Covers tickets:** T1 (and the pure logic for T3)
- **Rules:** R2
- **Tier:** 3
- **What:**
  1. Add `saveTraitsEdits(traits, id)`, which stores the whole array as `edits.traits`.
  2. Add `'traits'` to `SAVED_CATEGORIES`.
  3. In `applyEdits`, add `if (edits.traits) next = { ...next, traits: edits.traits }`.
  4. Add and export a pure helper `applyGahadTrigger(traits, { summary, description })` that returns a new array.
  5. Add and export a pure `gahadTriggerChanged(prefill, {summary, description})` (trim both sides, undefined as `""`) used by I2 for the no-spurious-dirty check.
- **Where:** `store.js` (next to `saveNotesEdits`, `SAVED_CATEGORIES` and `applyEdits`). `applyGahadTrigger` stays DOM-free.
- **Approach:** The helper trims both inputs and finds the first trait with `type === 'trigger'` and `relatedTo.type === 'ability'` and `relatedTo.name === 'Gahad'`.
  - Both blank and a trait exists: remove only that trait.
  - Both blank and none exists: return the traits unchanged (a new array is fine, but do not create an empty trait).
  - Trait exists: replace it with `{...trait, summary, description}`. Keep `name`, `type` and `relatedTo`, and omit blank keys rather than writing `""`.
  - None exists and at least one value is non-blank: append `{name:"Gahad trigger", type:"trigger", relatedTo:{type:"ability", name:"Gahad"}, summary?, description?}`.
  - Other traits are untouched and order is preserved.
- **Dependencies:** none
- **Acceptance criteria:**
  - `saveTraitsEdits` makes `hasPendingEdits` true.
  - `reconcileOverlay()` clears it.
  - `applyEdits` yields the edited traits on reload.
  - New `store-traits.test.js`, in the `store-notes.test.js` style, covers the save, apply and reconcile round-trip.
  - It covers `gahadTriggerChanged`: identical, whitespace-only difference, undefined vs `""`, null prefill with blank inputs (unchanged), and a real change.
  - It also covers the helper for update, create, remove, both-blank-with-no-trait, a non-Gahad trait left alone, and name preservation.
- **Risks / unknowns:** More than one existing Gahad trigger trait. The helper edits only the first, the Q&A scope is a single trigger, and the others are left untouched. This is noted in a code comment.

### I2 — Edit-details modal: Ork-only Gahad trigger fields
- **Covers tickets:** T2
- **Rules:** R1, R2
- **Tier:** 3
- **What:**
  1. Add `gahadTrigger: {attribute:false}` (the current `{summary, description}` or null) to `EdEditMeta`.
  2. When `meta.race === 'Ork'`, render a "Gahad trigger" group after Background, with a Summary text input (wide) and a Description textarea (wide).
  3. Prefill both from `gahadTrigger`.
  4. On save, if the race is Ork and either field differs from its prefilled value (compared after normalisation: trim both sides and treat `undefined`/missing as `""`), dispatch a separate `ed-edit-gahad-trigger` event with `{summary, description}`, in addition to the unchanged `ed-edit-meta` patch.
- **Where:** `ui/ed-edit-meta.js` and `ui/ed-overview.js` (around line 1051). Overview passes `.gahadTrigger=${first linked Gahad trigger trait from this.model.traits, or null}`. Reuse `_traitsFor('Gahad')` filtered to `type === 'trigger'`, so it matches the helper's first-match rule.
- **Approach:**
  - The trigger inputs get names that are not in `FIELDS` (e.g. `gahadSummary`, `gahadDescription`), so the existing meta patch loop is unchanged and nothing leaks into `meta`.
  - Add a short hint, e.g. "Gahad trigger: shown in the Gahad info on the Overview. Leave both blank to remove it."
  - The fields go inside the existing form, so Enter-confirm, Escape, the theme tokens and the 1-column mobile fold are inherited.
  - Update the header comment.
  - Normalisation: export a pure `gahadTriggerChanged(prefill, {summary, description})` from `store.js` (next to `applyGahadTrigger`) that trims both sides and treats undefined as `""`. The modal calls it, so a whitespace-only edit or a trait lacking `summary`/`description` never dispatches a spurious event. Unit-tested in `store-traits.test.js` (see I1 criteria).
  - Textarea Enter inserts a newline, which is already how the Description and Background fields behave.
- **Dependencies:** I3 handles the new event. The race check uses the `"Ork"` string as in the data and the ticket.
- **Acceptance criteria:**
  - Fields are hidden for non-Orks.
  - Fields are prefilled from the existing trait.
  - Escape closes, Enter confirms, and the modal works in light and dark.
  - Mobile is a single column.
  - An unchanged trigger dispatches no trigger event (no spurious dirty).
- **Risks / unknowns:** The Overview must still fit the desktop viewport. The modal scrolls internally (`max-height: 88vh; overflow:auto`), so Overview is unaffected. Verify the taller modal manually. Race spelling: Q&A says "Orc" but data and ticket use "Ork". Use `=== 'Ork'` and confirm against races.json when building.

### I3 — App handler: apply trigger edit to traits
- **Covers tickets:** T3
- **Rules:** R2
- **Tier:** 3
- **What:** `ed-app` listens for `ed-edit-gahad-trigger` and runs `_editGahadTrigger({summary, description})`.
  1. Compute `traits = applyGahadTrigger(this._character.traits ?? [], patch)`.
  2. Set `this._character = {...this._character, traits}`.
  3. Call `saveTraitsEdits(traits, this._characterId)`.
  4. Call `this._markDirty()`.
  5. Call `this._model = this._derive()`, so the Gahad "i" modal reflects the edit immediately.
- **Where:** `ui/ed-app.js` (import `saveTraitsEdits` and `applyGahadTrigger` at line 3, add a listener near line 401, add the handler near `_editMeta`).
- **Approach:** Mirror `_editNotes`: guard on `this._character` and the patch shape, with no UI-side mutation. The helper has no DOM dependency, so it can live in store.js and be unit-tested.
- **Dependencies:** I1 only. (I2 depends on I3 for the event handler, not the reverse.)
- **Acceptance criteria:**
  - Update, create (named "Gahad trigger") and remove (both blank) are each covered by I1's helper tests.
  - The Gahad modal updates on save without a reload.
  - The dirty indicator turns on.
  - Other traits are unchanged.
  - A reload keeps the edit via the overlay.
  - A successful GitHub save reconciles the `traits` overlay.
- **Risks / unknowns:** `_character` and the overlay must stay in sync. The same path as `_editNotes` is reused, so the risk is low. There is no existing ed-app unit-test harness, so the handler is verified manually and the logic is covered in I1.

### I4 — Docs and changelog
- **Covers tickets:** T1 to T3 (documentation)
- **Rules:** none
- **Tier:** 3
- **What:**
  1. Add the `traits` overlay category to wherever ARCHITECTURE.md lists the saved overlay categories and documents traits.
  2. Add an Unreleased entry to `data/changelog.json`, following the existing entries' format.
- **Where:** `ARCHITECTURE.md` and `data/changelog.json`.
- **Approach:** Match the recent "docs(changelog): add unreleased entries" convention.
- **Dependencies:** I1 to I3.
- **Acceptance criteria:** the docs mention the `traits` category and the changelog has a user-facing Unreleased line.
- **Risks / unknowns:** none.

## Sequencing
1. I1 first: it has no UI dependency, is fully unit-testable, and gives I2 and I3 their API.
2. I3 second: depends on I1 only; the handler and event wiring.
3. I2 third: depends on I1 (helpers) and I3 (event receiver); the UI that dispatches the event.
4. I4 last.

## Review responses
- F1 (I3 circular dependency): fixed. I3 now depends on I1 only; Sequencing states the I1 -> I3 -> I2 chain.
- F2 (unchanged-comparison normalisation): fixed. Added pure `gahadTriggerChanged` in I1 (trim, undefined as `""`), used by I2, with unit tests.

## Open questions
- Which race string should the check use, `"Ork"` or also `"Orc"`? Non-blocking: the data and ticket use `"Ork"`. Confirm at build time against `rules/races.json`.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
