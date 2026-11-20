# Build log: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Run 1 — 2026-11-20 (since 2026-11-20T09:58:45Z)

**Alignment (Phase 0): PASS.**
- Guardrails: I1-I8 Tier 3; I9 UI-GUIDELINES §7 line is Tier 1 with owner sign-off recorded (qa-log 2026-11-20T09:21:00Z). No Tier 2.
- Rules: none (rules.md has no dependencies).
- Open questions: none material (portal approach is a build-time decision, recorded below). review.md F1-F5 all addressed in plan.md.
- Tree: only `plans/ui-kit-modal-migration-2/` untracked (planning files, committed with the feature). Branch `dev`.

## Phase 1 — Spec
`spec.md` written by designer. Plan corrections found: (F1) `ModalController.focusInitial` focuses the enabled primary before `initialFocus`, so `ed-confirm` gets a `focusCancel` option (autofocus on Cancel) in addition to `cancelLabel`; (I1) `ed-save-key` stays light DOM (Safari/iCloud autofill) via `light: true` + `scopeCss()`, conflict/settings move into shadow roots; (I7) `ed-combat.js:331-337` keydown covers only step audit and Clear-log confirm, whole listener removed; baseline `button-style` entries are inline `margin-left:auto` styles, moved to CSS. Owner decision recorded: custom-item prompt confirm label "Close". Conflict footer order follows kit contract (extra before Cancel).

## Phase 2 — Tests
Tester wrote ui/kit/dirty.test.js, ui/kit/scope-css.test.js, updated tools/check-ui-kit.test.js (see test-plan.md). Snapshot taken before dev run.

## Phase 3 — Build (dev)
- Kit: `ui/kit/dirty.js`, `ui/kit/scope-css.js` (new, pure); `modal.js` gains `cancelLabel`/`focusCancel` and `ensureLightStyles()`; `ed-confirm` gains `cancelLabel`/`focusCancel`.
- Migrated to the kit (baseline entry lowered/removed with each): changelog, homebrew, character-picker, settings (own shadow root, layer 2200), conflict (own shadow root, layer 2200, footer [Take theirs] [Cancel] [Keep mine]), save-key (light DOM, `light: true` + `ensureLightStyles()`, real submit button via `form` attr), add-legend, edit-meta (dirty guard), day-reset (heal tone; dirty hook dismisses embedded roll), custom-item (list/form in one frame; dirty hook as back-one-step; prompt confirm label "Close" per owner), notes (4 controllers, discard prompts), overview (info/lightbox/Karma Ritual, inline margin moved to CSS), combat (step audit; document keydown removed).
- Docs: UI-GUIDELINES §7 bullet + footnote (Tier 1, signed off), MODALS.md, UI-CONSISTENCY-REVIEW status lines, GITHUB-SERVERLESS-SAVE wording; changelog `improved` entry.
- Gate: `npm test` green (1471 pass, 0 fail); baseline is exactly the three non-modal entries. No tester test touched. No dispute.

## Phase 3-4 — Build and Dev Lead review
Dev commit a2a5921 (gate green, 1471 pass). Dev Lead review findings (one revision):
- **R1 (blocker):** `ui/kit/modal.js:106` `ensureLightStyles()` has a literal line break inside `.join('...')` (a `'\n'` escape was written as a real newline): SyntaxError. Every module importing `ui/kit/modal.js` (the whole app) would fail to load; Node tests do not import it, so the gate did not catch it. `node --check` fails on it. Fix with a `'\n'` escape and run `node --check` on every `ui/**/*.js`.
- **R2 (minor):** `docs/UI-CONSISTENCY-REVIEW.md` K5 row (line 27) and section still say OPEN; mark fixed like K3/K6/K8/K9.
- Reviewed OK: tester tests byte-identical to snapshot; dirty.js, scope-css.js, ed-confirm, ed-save-key (light DOM), ed-conflict, ed-settings; changelog entry follows convention; baseline = 3 allowed entries.

## Owner handoff

### GUARDRAILS PR checklist (results)
- [x] No Tier-1 invariant changed (only UI-GUIDELINES §7 Ctrl/⌘+Enter line and footnote; owner sign-off qa-log 2026-11-20T09:21:00Z). Data-down/dispatch-up kept; engine, data, schema untouched.
- [ ] Overview still fits the desktop viewport with no vertical scroll: owner verifies (G1).
- [x] Derived values: none added or changed.
- [ ] Light and dark; modals Escape-close/Enter-confirm: owner verifies (V1-V3, sweep).
- [x] Modals use `ui/kit/`; `check-ui-kit` passes; baseline = ed-app button-style 1, ed-spells font-size 5, legend-spent-view font-size 2.
- [x] No taxonomy change (Tier 2 N/A).
- [x] Asset/fetch paths unchanged (relative).

### Deferred doc edits (Tier 1, owner's call)
UI-GUIDELINES §7 does not mention the discard prompt (decision D3); it lives in MODALS.md §4 only. Adding it to §7 would be a Tier-1 edit.

### Doc sync applied (Phase 5)
ARCHITECTURE kit file list; UI-CONSISTENCY-REVIEW (U1 portal note, V8 items, M4 partly fixed); MODALS.md §3 wording, §5 lightbox/Karma widths, §8 child-modal pattern. Plan frontmatter `status: implemented`, `shipped: unreleased`.

## Owner verification script (post-build, on `dev`) — recipes filled

Mandatory handoff. The owner steps through it, ticks Pass/Fail, and writes a note for every Fail (what happened, which theme, which viewport). The owner steps through it, ticks Pass/Fail, and writes a note for every Fail (what happened, which theme, which viewport). Run each case in **light and dark** mode unless stated. A Fail on any V1-V3 case blocks `/release-feature` until fixed and retested.

Result key: `P` pass, `F` fail, `-` not run. Add a note for every `F`.

### V1 — Portal modals: styling, stacking, Escape order (risk 1)

| # | Steps | Expected | Light | Dark | Notes |
|---|---|---|---|---|---|
| V1.1 | Open **Settings** from the app. | Frame looks like every other kit modal (title, ✕, `[Cancel] [Save]`, muted hint). Not unstyled, not clipped. | | | |
| V1.2 | In Settings, press Escape. | Settings closes. Focus returns to the control that opened it. | | | |
| V1.3 | Open Settings, then Enter. | Saves and closes (or validates, if a field is invalid). | | | |
| V1.4 | Open the **Save-key** modal: reload the page, make any edit, press the header **Save** button (the key is memory-only). Console shortcut: `document.querySelector('ed-app')._keyPrompt = true`. | Kit styling; `[Cancel] [Primary]`; Escape closes. | | | |
| V1.5 | Open Settings, then trigger something that opens an `ed-confirm` over it. | The confirm renders **on top** of Settings. Escape closes **only the confirm**; Settings stays open. A second Escape closes Settings. | | | |
| V1.6 | Open any kit modal (for example a roll or Notes), then force a **save conflict** (real: same character open in two tabs with a save key; save in tab A, then edit and save in stale tab B. Console, no worker: `document.querySelector('ed-app')._conflict = { sha: 'test', silent: false }`; with the console shortcut use only Escape/Cancel, since Keep mine / Take theirs act for real). | The conflict modal renders **on top** of the open modal, fully visible and clickable. | | | |
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
| V3.2 | Combat: with **no** modal open, use every keyboard shortcut or Enter/Escape behaviour Combat had before (there are none: Combat has no keyboard shortcuts beyond native button activation; the only key listener was Escape for the step audit and the Clear-log confirm). | Each still works exactly as before. | | | |
| V3.3 | Combat: open each other overlay or confirm Combat has (step audit via the Attack/Damage ⓘ buttons; Clear the Combat log? confirm; Drink potion? confirm; Take damage modal; roll modal; Reset-the-day button opens day-reset). | Each still closes on Escape and confirms on Enter. | | | |
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

Notes for the owner: V1.5 needs a path that opens an `ed-confirm` over Settings; none exists today, so mark it `-` if unreachable (an `ed-confirm` at layer 2100 would render beneath Settings at 2200 but still get Escape first via the kit stack). The custom-item discard prompt uses the confirm label **Close** (not Discard) by owner decision, so in V2.4 click Close for that modal. Conflict footer order is `[Take theirs] [Cancel] [Keep mine]`. Also check password-manager autofill still offers to save/fill on the Save-key modal (V1.4).
