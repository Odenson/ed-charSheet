# Tech Spec: Edit Gahad trigger (edit-gahad-trigger)

## Overview
Ork characters get Gahad trigger Summary and Description fields in the existing "Edit character details" modal (`ui/ed-edit-meta.js`). On save the modal dispatches a separate `ed-edit-gahad-trigger` event (not part of the meta patch). `ed-app` applies it with a pure helper in `store.js` that updates, creates or removes the Gahad trigger entry in `traits[]`. `traits` becomes a new whole-array saved overlay category.

## Guardrail alignment
- All Tier 3 (new data in an existing shape, a new overlay key, in-guideline modal fields). No Tier-1 sign-off needed. No engine, taxonomy or `rules/*.json` change; schema tag stays `ed-character/2`.
- Data down: Overview passes `.gahadTrigger` to the modal. Events up: the modal only dispatches, and `ed-app` mutates and persists.
- The engine stays pure and untouched. `applyGahadTrigger` and `gahadTriggerChanged` are DOM-free helpers in `store.js`.
- Only inputs are stored (the trait's summary/description). No derived values, so no placeholder pills are involved.
- No Tier-1 item found that the plan missed.

## Design
### Data / types
- New overlay key `edits.traits`: the whole `traits[]` array.
- Trigger trait shape is unchanged: `{name, type:"trigger", relatedTo:{type:"ability", name:"Gahad"}, summary?, description?}`. A created trait is named `"Gahad trigger"`. Blank fields are omitted, never written as `""`.

### Modules & functions
- `store.js`
  - `export function saveTraitsEdits(traits, id)`: mirrors `saveNotesEdits` (line 467), setting `edits.traits = traits`.
  - Add `'traits'` to `SAVED_CATEGORIES` (line 504).
  - In `applyEdits` (line 533), next to the notes line 585: `if (edits.traits) next = { ...next, traits: edits.traits };`.
  - `export function applyGahadTrigger(traits, {summary, description})` returns a new array. Both inputs are trimmed, and undefined is treated as `""`. The match is the first trait with `type==='trigger'` and `relatedTo.type==='ability'` and `relatedTo.name==='Gahad'`.
    - Match and both blank: remove only that trait.
    - No match and both blank: return a copy, creating nothing.
    - Match: replace it with `{...trait, summary, description}`, omitting blank keys and keeping `name`, `type` and `relatedTo`. Other keys on the trait are preserved.
    - No match and at least one non-blank: append a new `"Gahad trigger"` trait.
    - Other traits are untouched and order is preserved. A code comment notes that only the first match is edited.
  - `export function gahadTriggerChanged(prefill, {summary, description})` returns true if either field differs after trimming both sides and treating undefined or a null prefill as `""`.
- `ui/ed-app.js`
  - Add `saveTraitsEdits` and `applyGahadTrigger` to the store import on line 3.
  - Near line 401: `this.addEventListener('ed-edit-gahad-trigger', (e) => this._editGahadTrigger(e.detail));`
  - Add `_editGahadTrigger(patch)`, modelled on `_editNotes` (line 1129). Guard on `this._character` and on `patch` being an object. Then:
    1. `traits = applyGahadTrigger(this._character.traits ?? [], patch)`
    2. `this._character = {...this._character, traits}`
    3. `saveTraitsEdits(traits, this._characterId)`
    4. `this._markDirty()`
    5. `this._model = this._derive()`
- `ui/ed-edit-meta.js`
  - Add the property `gahadTrigger: {attribute:false}`, holding `{summary, description}` or null.
  - Import `gahadTriggerChanged` from `../store.js`.
  - When `this.meta?.race === 'Ork'`, render a "Gahad trigger" group after the FIELDS loop and before the hint. The group has a Summary `<input name="gahadSummary">` and a Description `<textarea name="gahadDescription" rows=3>`, both `.field.wide`, both prefilled. Add a hint: "Shown in the Gahad info on the Overview. Leave both blank to remove it."
  - `_save`: the `FIELDS` loop and `ed-edit-meta` dispatch stay unchanged, so the trigger values never enter the meta patch. After that, if Ork and `gahadTriggerChanged(this.gahadTrigger, {summary: form.elements.gahadSummary.value, description: form.elements.gahadDescription.value})`, dispatch `ed-edit-gahad-trigger` (bubbles, composed) with the raw values. Then close.
  - Update the header comment.
- `ui/ed-overview.js` (around line 1051): `<ed-edit-meta .meta=${meta} .gahadTrigger=${this._traitsFor('Gahad').find((t) => t.type === 'trigger') ?? null}>`. This uses the same first-match rule as the helper.
- `ARCHITECTURE.md` §7.1 (line ~343): add `traits` to the overlay categories mention.
- `data/changelog.json`: add the Unreleased entry.

### UI / behavior
- The fields show only for `meta.race === "Ork"` (confirmed in `rules/races.json`). Non-Orks see the modal unchanged.
- It is the same modal and form, so Escape closes, Enter confirms (form submit; Enter in a textarea inserts a newline), light and dark come from the existing tokens, and the grid folds to 1 column at 480px. The modal scrolls internally (`max-height: 88vh`), so Overview viewport fit is unaffected.
- On save, the Gahad "i" modal on Overview reflects the change immediately (via `_derive`). The dirty indicator turns on only when the trigger actually changed.

### Rules
| Rule | Value | Source |
|---|---|---|
| Gahad trigger is a player-authored roleplay note, with free text and no mechanical effect | Both fields are free text. No engine effect is added. | R1 (RULES-FAQ Q032; RB players guide pp. 49-50) |
| The trigger may be edited at any time (not a house rule) | No locking, no confirmation. Scope is a single trigger. | R2 (owner decision 2026-11-15) |
| The Gahad effect in `rules/races.json` is correct and unchanged | No change to rules data. | R3 (FAQ-HIT) |

### Edge cases & invariants
- Trigger fields never appear in `meta`, and `meta` never gains `gahadSummary` or `gahadDescription` keys.
- An unchanged form (including a whitespace-only difference, or an absent summary/description against `""`) dispatches no `ed-edit-gahad-trigger` event.
- A null prefill with both fields blank is unchanged, so no trait is created.
- Existing names such as "Gahad - Cats" are preserved on edit.
- With more than one Gahad trigger trait, only the first is edited or removed.
- A non-Gahad trait or a non-trigger trait linked to Gahad is never touched.
- `applyGahadTrigger` does not mutate its input array or its trait objects.
- Reload keeps the edit through the overlay. A successful GitHub save runs `reconcileOverlay` and clears `traits`. `forSave` already passes `traits` through.

## Testability notes
- New `store-traits.test.js` (node:test, in-memory localStorage stub, in the `store-notes.test.js` style):
  - `saveTraitsEdits` makes `hasPendingEdits` true. `reconcileOverlay()` clears it. `applyEdits` yields the edited traits.
  - `applyGahadTrigger`: update, create (default name "Gahad trigger"), remove, both-blank-with-no-trait, a non-Gahad trait left alone, name preservation, blank keys omitted, and no input mutation.
  - `gahadTriggerChanged`: identical, whitespace-only difference, undefined vs `""`, null prefill with blank inputs, and a real change.
- Manual verification by the owner (there is no ed-app or Lit harness):
  - Ork vs non-Ork visibility.
  - Prefill.
  - Escape and Enter in the modal.
  - Light and dark themes.
  - Mobile single column.
  - The Gahad "i" modal updates after saving.
  - Dirty dot, reload persistence, and the GitHub save reconcile.
  - The Overview viewport fit.

## Changelog entry
{"type": "added", "text": "Orks can now edit their Gahad trigger (summary and description) from the Edit character details modal."}

## Out of scope
- Multiple triggers or an add/remove list.
- Editing the trait name.
- Any change to Gahad's rules effect, the taxonomy or the Overview layout.
- Showing the fields to non-Ork characters.
- Any change to the worker.
