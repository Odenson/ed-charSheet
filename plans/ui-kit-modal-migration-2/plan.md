---
status: building
---
# Delivery Plan: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Context & learnings

The first kit feature ([ui-kit-modal-keyboard-contract](../ui-kit-modal-keyboard-contract/plan.md), v1.39.0) built `ui/kit/` and migrated ~10 modals. This feature migrates **every remaining hand-rolled modal in one build** (qa-log 09:23), empties `tools/ui-kit-baseline.json` except the non-modal entries (`ui/ed-spells.js` font-size x5, `ui/legend-spent-view.js` font-size x2, `ui/ed-app.js` button-style x1), and finishes the two hooks the kit only stubbed: Ctrl/⌘+Enter for textarea modals and the dirty guard.

Decisions carried from the first feature (D1-D8): Enter = OK (read-only: closes); Escape closes the top modal only; footer `[Cancel] [Primary]`, read-only = ✕ only with no footer button; muted hint on input/confirm modals only ("Enter = OK · Esc = Cancel", or "Ctrl+Enter saves · Esc = Cancel" for textarea modals, text fixed by the kit); tab tones kept (karma on Karma Ritual, heal/green on day-reset); free-text modals ask "Discard unsaved changes?"; short numeric/choice modals (Add Legend, Settings, Karma Ritual) do not. Out of scope: picker/inline-field cleanups (K7, K10) and non-modal cleanups (V5-V8).

New decisions this feature (qa-log 2026-11-20): Tier-1 sign-off for UI-GUIDELINES §7 line "Textarea modals: Enter types a newline; Ctrl/⌘+Enter saves" (09:21); one build (09:23); discard prompt is a **stacked `ed-confirm`** [Keep editing] [Discard], Escape on it returns to editing (09:25); special-modal defaults: picker = Enter activates focused row, conflict/save-key as input/confirm, changelog/homebrew read-only (09:26).

Constraint: UI plumbing only. No game values, rules or schema are touched; existing behaviours (Legend, Karma, day-reset healing, step audit) are preserved.

## Discoveries

- **Kit surface** (docs/MODALS.md §1-§5, `ui/kit/`): `ModalController` (`kind`, `onConfirm`, `canConfirm`, `initialFocus`, `isDirty`/`onDiscardPrompt`, `light`), `modalFrame`, `modalCss`, `buttonCss`, pure `routeKey` in `ui/kit/modal-stack.js`. R12 (Ctrl/⌘+Enter in a textarea -> confirm) and the footer hint variant for `hasTextarea` already exist; the dirty guard is in `ui/kit/modal-controller.js:289` (`requestClose` calls `onDiscardPrompt` when `isDirty()`). MODALS.md §2.3 and §4 say "hook only / no textarea modal on the kit yet"; these lines go stale and must be updated (I9).
- **Baseline** (`tools/ui-kit-baseline.json`) is a two-way ratchet: each migration must lower its own file's entry in the same change or `npm test` fails ("lower the baseline to N"). Files to empty: `ed-add-legend`, `ed-changelog`, `ed-character-picker`, `ed-combat` (button-style 1, dialog-role 1, frame-css 4, keydown 1), `ed-conflict`, `ed-custom-item` (dialog-role 2), `ed-day-reset`, `ed-edit-meta`, `ed-homebrew`, `ed-notes`, `ed-overview` (button-style 1, frame-css 4, keydown 1), `ed-save-key`, `ed-settings`. `ed-spells`, `legend-spent-view`, `ed-app` stay.
- **Light-DOM portals.** `ed-conflict.js:26`, `ed-save-key.js:24` and `ed-settings.js` override `createRenderRoot()` to render into a `<body>` div, so `static styles` (and therefore `modalCss`) do not apply, and the controller's `light` option ("unused so far", MODALS.md §4) is the only kit path for them. The kit's `modalCss` is shadow-scoped. This is the main technical risk (I1).
- **Shared children.** `<ed-add-legend>` is used by both `ed-notes.js:427` and `ed-overview.js:1033`; `<ed-edit-meta>` by `ed-overview.js:1051`; `<ed-custom-item>` by `ed-equipment.js:1074`. Each is a separate component that must own its controller and only dispatch `close`/`confirm` (MODALS.md §8 pattern, as `ed-confirm`): hosts clear state in `@close`.
- **`ed-day-reset`** hosts an embedded `<ed-roll-modal>` (inline, never opens its own controller; MODALS.md §8). Its ✕/OK dispatch `close` directly. Keep that; do not give the embedded roll a controller. Its `.appbtn, .ok` focus lookup (`ed-day-reset.js:88`) must still work.
- **Overview** (`ed-overview.js`, 1057 lines) holds four inline modals (ⓘ info, Legend spent via `legend-spent-view.js`, Karma Ritual at ~1037 with its own `@keydown`, lightbox) plus a `document` keydown at ~602 and a `@keydown` at 235; it also mounts `ed-add-legend` and `ed-edit-meta`. Notes mounts a note/event modal (`ed-notes.js:374`, own `document` keydown at 189), a delete `ed-confirm` (~654) and an inline `@keydown` at ~470. Combat step audit is at `ed-combat.js:1589` with a `document` keydown at 337 and a `button-style` inline style.
- **Transitional R5 rule** (MODALS.md §3): a legacy dialog over a kit modal keeps its own keys. Once nothing is legacy, R5 stays harmless; MODALS.md should drop the "known gap / goes away" note.
- **Testing.** Node cannot load `lit` modules, so only pure logic is unit-testable. Behaviour is verified by the owner on `dev` against a manual checklist (agents never open the preview). `npm test` = `check-imports` + `check-ui-kit` + `node --test`; keep it green.

## Guardrail classification

| Item | Tier | Note |
|---|---|---|
| I1-I8 | 3 | Conform to UI-GUIDELINES §7 and the kit; no layout/contract re-decision |
| I9 (UI-GUIDELINES §7 Ctrl/⌘+Enter line) | **1** | **Owner sign-off recorded**: qa-log 2026-11-20T09:21:00Z. Quote it in the PR. |
| I9 (MODALS.md, baseline, changelog) | 3 | |
| Engine / data / `rules/*.json` / taxonomy | untouched | Tier 2 not triggered |

Any other edit to UI-GUIDELINES.md is out of sign-off and must not be made. Footer and hint wording come from the kit and must not be overridden.

## Rules dependencies

None (`rules.md`: no Earthdawn rule dependencies). If an item appears to touch a game value, stop; that would be NEEDS_RULES.

## Implementation items

### I1 — Kit support for portal modals and the discard flow (kit-side groundwork)
- **Covers tickets:** T4, T6
- **Rules:** none
- **Tier:** 3
- **What:** (a) Decide and prove how `ed-settings`, `ed-save-key`, `ed-conflict` use `modalFrame`/`modalCss`. Preferred: drop the `createRenderRoot()` portal override so they render in a normal shadow root (`static styles = [modalCss, ...]`), since `ed-confirm` already works as a shadow child with fixed overlay at layer 2100. Fallback: keep the portal and inject `modalCss` via an adopted stylesheet with `light: true` on the controller. (b) Define the shared discard-prompt pattern for T6 (see I2) so all four free-text modals use it identically. (c) Any kit change must remain lit-free in `modal-controller.js`/`modal-stack.js` and get unit tests.
- **Where:** `ui/ed-settings.js`, `ui/ed-save-key.js`, `ui/ed-conflict.js` (read), `ui/kit/modal.js`, `ui/kit/modal-controller.js`.
- **Approach:** Check why the portal was chosen (comment: "always sits above everything"); fixed-position overlay at the modal's layer inside the `ed-app` shadow tree should achieve it, confirm no ancestor has a `transform`/`contain`. Check nothing queries `.edc-portal`/`.edk-*`/`.eds-*` (grep found no external `querySelector`). Record the chosen approach in the build log.
- **Dependencies:** none (first).
- **Acceptance criteria:** approach chosen and exercised by I5; light/dark theming and layer order unchanged.
- **Layers (F2):** today `ed-settings` and `ed-conflict` use z-index 2200 and `ed-save-key` 2100. Pass `layer` numerically to `modalFrame`: conflict 2200, settings 2200, save-key 2100 (kit layers are 2000/2100/2150/3000; `layer` accepts any number). All three are mounted in `ed-app.js` ~2089-2102, so footprint is unchanged. Confirm the kit stack (not z-index alone) decides which modal receives Escape. If the portal is kept (`light: true`), `ModalController.dialogEl` queries `document`, so `data-modal` ids must be unique.
- **Owner checklist additions:** "conflict raised over an open kit modal renders on top"; "ed-confirm over settings renders on top and takes Escape first".
- **Risks / unknowns:** these three modals may be raised above other overlays (e.g. conflict during a save while another modal is open). Layer values must preserve today's stacking order; moving into the shadow tree changes stacking context relative to `ed-confirm` (2100) and modals in child shadow roots, so exercise both cases.

### I2 — Discard-changes prompt wiring
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3
- **What:** Each free-text modal host supplies `isDirty()` (draft differs from the opened snapshot) and `onDiscardPrompt()` which opens a stacked `<ed-confirm>` titled "Discard unsaved changes?" with buttons [Keep editing] [Discard]. Keep editing (or Escape on the prompt) closes only the prompt and returns focus to the edit field; Discard closes the prompt then the modal via `ctl.close()` (unguarded).
- **Where:** helpers in each host; a tiny pure `isDirty(snapshot, draft)` helper (lit-free, unit-tested in I8). Reuse `ed-confirm` and **add a `cancelLabel` property (default "Cancel") to `ui/ed-confirm.js`**. Verified: it currently only has `heading`, `message`, `confirmLabel`, `tone`, `warn`, `disabled`, so the Cancel label is fixed. This is a Tier-3 additive change; the default keeps every existing app-wide use unchanged.
- **Dirty definition (default, F3):** `isDirty` compares the current draft fields to a snapshot taken when the modal opened; false after a successful save.
- **Enter/focus note (F1):** `ed-confirm`'s footer hint reads "Enter = OK" and its initial focus is Cancel (`initialFocus: '[data-cancel]'`), so Enter on the discard prompt means Keep editing. This is the intended safe default; add to the manual checklist.
- **Approach:** `ed-confirm` is on the kit stack so it sits on top and Escape closes only it (R-rules). The host modal must not also close: `ed-confirm` dispatches `close` for cancel, which the host maps to "Keep editing". Dirty is false after a successful save.
- **Dependencies:** I1 (pattern); applied in I3, I4, I6.
- **Acceptance criteria:** dirty Escape/✕/backdrop/Cancel asks; clean closes straight away; Escape on the prompt returns to editing; Discard drops edits.
- **Risks / unknowns:** focus return from the prompt to the textarea (the underlying modal's `refocus()` may be needed since `ed-confirm` returns focus to its trigger, which is the element focused when the prompt opened).

### I3 — Notes modals (T2)
- **Covers tickets:** T2, T6
- **Rules:** none
- **Tier:** 3
- **What:** Note/event add/edit modal as `kind: 'input'` with `hasTextarea`, `[Cancel] [Save]`, hint "Ctrl+Enter saves · Esc = Cancel", Ctrl/⌘+Enter saves, plain Enter types a newline, textarea focused on open, discard prompt (I2). Delete-note confirm stays an `ed-confirm` (already kit). Remove the `document` keydown (~189) and the inline `@keydown` at ~470 only if redundant with the contract; keep any Enter handling that belongs to a title `<input>` (mark `data-enter="local"` where it must keep its own Enter).
- **Where:** `ui/ed-notes.js`; baseline: remove `ui/ed-notes.js`.
- **Approach:** `ModalController` + `modalFrame({ hasTextarea: true, primary })`; `onConfirm` runs existing save path (dispatch up unchanged). Mounts `ed-add-legend` unchanged (I4).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** "+ add note" saves via Ctrl/⌘+Enter; Enter types newline; dirty Escape asks to discard; focus returns to trigger; no `ui/ed-notes.js` baseline entry.
- **Decision (F3):** a single-line title `<input>` keeps R15 (Enter saves) since it is not a textarea; Ctrl/⌘+Enter saves from the textarea; Enter inside the textarea types a newline. Mark `data-enter="local"` only on a field that must own its Enter. `isDirty` per I2's snapshot rule, covered by I8 helper tests.
- **Risks / unknowns:** none beyond the above.

### I4 — Overview modals (T1) and shared Legend/meta forms
- **Covers tickets:** T1, T4
- **Rules:** none
- **Tier:** 3
- **What:** In `ed-overview.js`: ⓘ info (`info`), Legend spent (`info`; the view in `legend-spent-view.js` keeps its font-size baseline and is not touched beyond mounting), lightbox (`info`, read-only, ✕ only), Karma Ritual (`input`, `karma` tone primary, Cancel added, no discard prompt per D3). Remove the `document` keydown (~602), the Karma `@keydown` (~1037) and the inline button style. In `ed-edit-meta.js`: Edit character details (`input`, textarea, Ctrl+Enter, discard prompt). In `ed-add-legend.js`: `input`, short numeric, no discard prompt.
- **Where:** `ui/ed-overview.js`, `ui/ed-edit-meta.js`, `ui/ed-add-legend.js`, `tools/ui-kit-baseline.json`.
- **Approach:** one controller per modal in `ed-overview` (shadow root shared; the frame stamps `data-modal` so several controllers coexist); open with `this._ctl.opened(e.currentTarget)`; every close through the controller. Child components own their controllers and dispatch `close`. Check whether `ed-edit-meta` has a single-line Gahad trigger input that needs `data-enter="local"`.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** no Overview/edit-meta/add-legend baseline entries; Escape/Enter per contract; focus returns to the trigger; Karma Ritual shows [Cancel] [Karma-tone primary].
- **Risks / unknowns:** Overview is large; do the edits as isolated hunks. The info modal may render a template title (`label` required).

### I5 — Form/input and system modals: settings, save-key, conflict, day-reset, custom item
- **Covers tickets:** T4, T6
- **Rules:** none
- **Tier:** 3
- **What:** `ed-settings` (`input`, `[Cancel] [Save]`, no discard prompt, keep existing form validation/disabled state), `ed-save-key` (`input`), `ed-conflict` (`confirm`: "Keep mine" primary, "Take theirs" as `extra`, Cancel; Enter = Keep mine as today per UI-GUIDELINES §8), `ed-day-reset` (`confirm`/`input`, `heal` (green) tone primary, embedded roll preserved), `ed-custom-item` (`input`, free-text, discard prompt; two `role="dialog"` occurrences, so check both views/steps).
- **Where:** the five files; `tools/ui-kit-baseline.json`.
- **Approach:** per I1's portal decision. Settings contains Discord webhook fields (a `<form>` submit today): use `primary: { type: 'submit', form }` or `onConfirm`, and mark any Enter-owning field `data-enter="local"`. The conflict modal's Take theirs is a non-primary button (R13: Enter on it clicks it).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** the five files have no baseline entries; Enter on Conflict = Keep mine; Escape = no action taken (UI-GUIDELINES §8); day-reset keeps healing behaviour and green primary; custom-item discards ask.
- **Risks / unknowns:** custom-item is 653 lines with a builder; confirm which fields count as "dirty" (any field differs from the opened state). The day-reset embedded roll keeps `.dm` markup, so `frame-css` counts there must reach 0 without touching it (it is in `ed-roll-modal`, not in `ed-day-reset`).

### I6 — Picker and read-only system modals (T5)
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** `ed-character-picker` (`kind: 'picker'`, ✕ only, Enter activates the focused row, Enter in the search box does nothing); `ed-changelog` and `ed-homebrew` (`info`, ✕ only, Enter closes).
- **Where:** `ui/ed-character-picker.js` (may use `ui/picker.js` helpers), `ui/ed-changelog.js`, `ui/ed-homebrew.js`.
- **Approach:** both read-only ones are opened from the footer in `ed-app.js:2139`; capture the trigger on open. Row buttons are non-primary buttons so R13 passes Enter to them natively.
- **Dependencies:** I1.
- **Acceptance criteria:** baseline entries removed; Enter on a row loads it; Escape closes; footer ⓘ links return focus.
- **Risks / unknowns:** a picker with no focused row on open: initial focus falls to the first control in `.mbody` (the search box, by kit order); acceptable per defaults.

### I7 — Combat step audit (T3)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Step audit modal -> `info` (✕ only; Enter closes); remove the "Escape closes" hint text; remove its `document` keydown (`ed-combat.js:337`), `role="dialog"` and inline button style.
- **Where:** `ui/ed-combat.js` (~337, ~1589), baseline: remove `ui/ed-combat.js`.
- **Approach:** **Step 1: grep and confirm the scope of the `document` keydown at `ed-combat.js:337`.** If it serves other overlays, drop only the audit branch; the baseline `keydown` count must still reach 0, so any remaining handling moves to kit `data-enter="local"`. The audit content stays unchanged (it displays engine output; no calculation here).
- **Dependencies:** none on I1's portal decision (the audit is a shadow-root modal), but it is sequenced after I1/I2 as a low-risk kit validation.
- **Acceptance criteria:** no `ed-combat.js` baseline entry; Enter closes the audit instead of re-clicking its trigger; existing `ed-confirm`s in Combat unaffected.
- **Risks / unknowns:** the keydown may also cover another combat overlay; grep before removing.

### I8 — Tests for any new pure logic
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3
- **What:** unit tests for any new lit-free helper (dirty comparison) and for kit changes from I1; keep `ui/kit/modal-controller.test.js` and `modal-stack.test.js` green; add a controller test that the dirty guard blocks `requestClose()` but not `close()` if not already covered.
- **Where:** `ui/kit/*.test.js`, new `ui/*.test.js` for helpers (no lit imports).
- **Dependencies:** I1-I2.
- **Acceptance criteria:** `npm test` green.

### I9 — Docs, baseline and changelog (T7)
- **Covers tickets:** T7
- **Rules:** none
- **Tier:** 1 for the UI-GUIDELINES §7 line (signed off, qa-log 2026-11-20T09:21:00Z); 3 otherwise.
- **What:** (a) `docs/UI-GUIDELINES.md` §7 add exactly one bullet "Textarea modals: Enter types a newline; Ctrl/⌘+Enter saves" and extend the §7 amendment footnote (line ~121, currently citing only the earlier D1 sign-off) by appending a citation of "owner sign-off, qa-log 2026-11-20T09:21:00Z (ui-kit-modal-migration-2)". No other UI-GUIDELINES edit. (b) `docs/MODALS.md`: §2 item 3 (drop "no textarea modal is on the kit yet"), §3 transitional foreign-dialog note, §4 dirty guard ("Hook only so far" -> wired) and `light` option, §10 (empty "Not yet on the kit", or replace with the remaining non-modal items), §12 baseline description. (c) `tools/ui-kit-baseline.json` reduced to `ed-app` button-style 1, `ed-spells` font-size 5, `legend-spent-view` font-size 2. (d) `data/changelog.json` entry of type `improved` (follow the existing entry format and version/bump convention already used in `data/changelog.json`; do not invent a new convention). (e) check docs/UI-CONSISTENCY-REVIEW.md for status lines to update if it tracks migration state.
- **Where:** as listed.
- **Dependencies:** all other items (baseline lowers with each migration; do not batch at the end or intermediate `npm test` fails).
- **Acceptance criteria:** `npm test` (including `check-ui-kit`) green; baseline matches the three allowed entries; docs no longer say these modals are legacy; the "Owner verification script" is copied into `build-log.md` and the final report with every `<recipe>` and `<list from I7 grep>` placeholder filled in from the code.
- **Risks / unknowns:** none beyond the stale-doc sweep.

## Sequencing

1. **I1** - settle the portal/frame approach and discard pattern before touching hosts.
2. **I2** (pattern + tiny helper/tests via I8) - needed by every free-text modal.
3. **I7**, **I6** - small, low-risk, validate the kit on pure read-only/picker cases.
4. **I3** (Notes: the headline Ctrl+Enter case), **I4** (Overview + shared children), **I5** (system/form modals; highest layout risk).
5. **I9** - docs, changelog and final baseline check; but each of I3-I7 lowers its own baseline entry in the same change.
6. Run `npm test`; owner then verifies on `dev` by running the **Owner verification script** below (risk tests V1-V3 first, then the general sweep), recording each result.

## Owner verification script (post-build, on `dev`)

Mandatory handoff. The Dev Lead copies this section **verbatim** into `build-log.md` and into the final "UI test requirements" report, and fills in any `<recipe>` placeholder from the code (for example how to force a save conflict) before handing over. The owner steps through it, ticks Pass/Fail, and writes a note for every Fail (what happened, which theme, which viewport). Run each case in **light and dark** mode unless stated. A Fail on any V1-V3 case blocks `/release-feature` until fixed and retested.

Result key: `P` pass, `F` fail, `-` not run. Add a note for every `F`.

### V1 — Portal modals: styling, stacking, Escape order (risk 1)

| # | Steps | Expected | Light | Dark | Notes |
|---|---|---|---|---|---|
| V1.1 | Open **Settings** from the app. | Frame looks like every other kit modal (title, ✕, `[Cancel] [Save]`, muted hint). Not unstyled, not clipped. | | | |
| V1.2 | In Settings, press Escape. | Settings closes. Focus returns to the control that opened it. | | | |
| V1.3 | Open Settings, then Enter. | Saves and closes (or validates, if a field is invalid). | | | |
| V1.4 | Open the **Save-key** modal (`<recipe>`). | Kit styling; `[Cancel] [Primary]`; Escape closes. | | | |
| V1.5 | Open Settings, then trigger something that opens an `ed-confirm` over it. | The confirm renders **on top** of Settings. Escape closes **only the confirm**; Settings stays open. A second Escape closes Settings. | | | |
| V1.6 | Open any kit modal (for example a roll or Notes), then force a **save conflict** (`<recipe>`). | The conflict modal renders **on top** of the open modal, fully visible and clickable. | | | |
| V1.7 | In the conflict modal, press Escape. | Nothing is saved or discarded; the conflict modal closes; the modal beneath is intact. | | | |
| V1.8 | Force the conflict again; press Enter. | **Keep mine** runs (UI-GUIDELINES §8). Tab to **Take theirs**, press Enter: it runs that, not Keep mine. | | | |
| V1.9 | Open the roll modal, then raise the conflict or Settings (if reachable). | The roll modal (top layer) still wins stacking as it does today. | | | |
| V1.10 | Resize to mobile width; open Settings and the conflict modal. | Both fit, scroll inside the modal, no horizontal page scroll. | | | |

### V2 — Discard prompt and focus (risk 2)

Run on **Notes** (add note), **Edit character details**, and **custom item** (three modals; record each).

| # | Steps | Expected | Notes / Edit details / Custom item | Notes |
|---|---|---|---|---|
| V2.1 | Open the modal, type text in a field, press **Escape**. | A stacked prompt "Discard unsaved changes?" with `[Keep editing] [Discard]`. The edit modal stays visible beneath. | | |
| V2.2 | On the prompt, press **Escape**. | Prompt closes only. Edit modal still open, **text intact**, focus back in the field you were editing (you can keep typing immediately). | | |
| V2.3 | Press Escape again, then press **Enter** on the prompt. | Enter = **Keep editing** (Cancel is focused). Text intact, nothing lost. | | |
| V2.4 | Trigger the prompt, click **Discard**. | Prompt and modal close; the draft is gone; reopening starts clean. Focus returns to the original trigger. | | |
| V2.5 | Same, but use the ✕ and a backdrop click instead of Escape. | Both ask the same prompt when dirty. | | |
| V2.6 | Open, change nothing, press Escape. | Closes straight away, **no prompt**. | | |
| V2.7 | Type text, **save**, reopen, press Escape. | No prompt (dirty is false after save, and the reopened snapshot is clean). | | |
| V2.8 | Type text, then type it back to the original value, press Escape. | No prompt (draft equals the opened snapshot). | | |
| V2.9 | Notes: with the cursor in the textarea, press **Enter**, then **Ctrl/⌘+Enter**. | Enter types a newline. Ctrl/⌘+Enter saves. Single-line title field: Enter saves. | | |
| V2.10 | Short modals (**Add Legend**, **Settings**, **Karma Ritual**): type, press Escape. | Close with **no** prompt (D3). | | |

### V3 — Keydown handlers removed: nothing regressed (risk 3)

| # | Steps | Expected | Light | Dark | Notes |
|---|---|---|---|---|---|
| V3.1 | **Combat**: open the step audit. | `info` kind: ✕ only, no "Escape closes" text. Enter closes it and does **not** re-click the button behind. Escape closes it. | | | |
| V3.2 | Combat: with **no** modal open, use every keyboard shortcut or Enter/Escape behaviour Combat had before (Dev Lead lists them from the grep in I7). | Each still works exactly as before. | | | |
| V3.3 | Combat: open each other overlay or confirm Combat has (`<list from I7 grep>`). | Each still closes on Escape and confirms on Enter. | | | |
| V3.4 | **Overview**: open ⓘ info, Legend spent, lightbox, Karma Ritual, Edit character details, Add Legend. | Each closes on Escape; read-only ones close on Enter; Karma Ritual shows `[Cancel] [Karma-tone primary]`, Enter commits. | | | |
| V3.5 | Overview: with no modal open, press Escape and Enter. | No stray action (no trigger re-clicked, nothing closes or opens). | | | |
| V3.6 | **Notes**: with no modal open, press Escape and Enter, then open and close the note modal and delete confirm. | Same: no stray action; both modals follow the contract. | | | |
| V3.7 | Open a modal, close it, open it again 3 times in a row. | Keys work every time (no duplicate or leaked handlers). | | | |

### General sweep (after V1-V3)

| # | Check | Result | Notes |
|---|---|---|---|
| G1 | Overview still fits the desktop viewport with no vertical scroll, light and dark. | | |
| G2 | Mobile fold: every changed modal usable at phone width. | | |
| G3 | Every migrated modal returns focus to its trigger on close. | | |
| G4 | Picker (`ed-character-picker`): Enter on a focused row loads it; Enter in the search box does nothing; Escape closes. | | |
| G5 | Changelog and Homebrew (footer ⓘ): ✕ only, Enter and Escape close. | | |
| G6 | Day-reset: green primary, embedded roll works, healing result unchanged. | | |
| G7 | Existing `ed-confirm`s elsewhere (for example delete) still say "Cancel" and behave as before. | | |
| G8 | Browser console shows no new errors during any of the above. | | |

Bugs found are logged in `build-log.md` under "Owner test results" with the case id, so a fix run can target them.

## Open questions

- Whether `ed-settings` / `ed-save-key` / `ed-conflict` should stay portals (I1); the plan prefers shadow roots, to be confirmed by the build, not a user question.
- Stacking order for system modals relative to the roll modal (layer 3000); preserve today's z-index.
- Notes/custom-item single-line inputs inside textarea modals: Enter behaviour (resolved: single-line inputs keep R15, Enter saves; textarea types a newline; `data-enter="local"` only where a field must own Enter).

## Review responses

- **F1** (ed-confirm cancel label): fixed. I2 adds `cancelLabel` (default "Cancel"), notes Enter = Keep editing default, checklist item.
- **F2** (stacking layers): fixed. I1 lists explicit layers (2200/2200/2100) and the two added checklist cases.
- **F3** (dirty / single-line Enter): fixed. Defaults fixed in I2 and I3; open question updated below.
- **F4** (I7 keydown check): fixed. Grep-and-confirm is now step 1; dependencies line clarified.
- **F5** (I9 wording): fixed. Footnote text and changelog convention named.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
