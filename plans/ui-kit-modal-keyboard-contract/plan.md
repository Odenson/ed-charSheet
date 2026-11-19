---
status: building
---
# Delivery Plan: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Context & learnings

**Problem.** Each modal copies its own Escape/Enter handling: 18 `ui/` files add
their own `document.addEventListener('keydown', …)`. All of these listeners sit on
the same `document` node, so `stopPropagation()` in one cannot stop the others.
The results:
- one Escape closes a whole stack of modals (K1);
- Enter re-clicks the dice button behind the roll modal, which re-dispatches
  `ed-roll` (new `rollId`, early Discord flush, possible second Strain charge) (K2);
- Enter only works if the right element has focus (K3);
- the Spells learn modal confirms under the roll modal (K4);
- read-only modals each do something different on Enter (K6).

Only 3 of about 20 hosts use the shared `ModalController` (M1). Visual drift comes
from the same copying: nine primary-button styles, modal titles off the type scale,
mixed footers and hints (V1–V4). The source analysis is
[docs/UI-CONSISTENCY-REVIEW.md](../../docs/UI-CONSISTENCY-REVIEW.md) (U1, K/M/V
findings, per-modal tables, migrated-modal checklist).

**Goal.** One implementation of the modal keyboard and focus contract, in a small
in-repo kit (`ui/kit/`), enforced by `tools/check-ui-kit.mjs` in `npm test`. Every
modal migrated in this build follows the same rules:
- **Escape cancels the top modal only.**
- **Enter = OK**: the primary action, or close for read-only modals.
- Focus moves in, Tab is trapped, and focus returns to the trigger.
- There is one modal look: frame, `--fs-title` header, D5 footers, a V4 hint,
  and one button shape with tab tones.

**Users.** The owner/player on desktop and mobile, keyboard and pointer alike.
The owner verifies the UI on `dev` from a manual checklist. Agents never open the
preview.

**Owner decisions (qa-log, 2026-11-18):**

| # | When | Decision |
|---|---|---|
| Scope | 11:52 | All modals onto the kit. Pickers (K7), inline fields (K10) and non-modal cleanups (V5–V8) are a later feature. |
| **D1** (Tier 1) | **11:53** | **Signed off.** Amend UI-GUIDELINES §7: Enter closes read-only modals everywhere, including the roll modal's OK view. |
| D2 | 11:54 | Ctrl/⌘+Enter saves textarea modals, with a "Ctrl+Enter saves" hint. Enter still types a newline. The modal focuses the textarea on open. This build adds kit support only; no textarea modal is migrated. |
| D3 | 11:55 | Free-text modals ask "Discard unsaved changes?". Short numeric or choice modals (Add Legend, Settings, Trade, Take damage, Karma Ritual) close without asking. This build adds the kit hook only. |
| D5 | 11:56 | Input and confirm modals: `[Cancel] [Primary]`, right-aligned, primary last. This adds Cancel to Take damage, and the Spells cast modal's Close becomes Cancel. Read-only modals: ✕ only, no footer button, so Spells info loses its Close. |
| V4 | 11:57 | A muted footer hint on input and confirm modals only: "Enter = OK · Esc = Cancel", or "Ctrl+Enter saves · Esc = Cancel" for textarea modals. |
| V2 | 11:58 | One primary-button shape. Colour comes from a tone: amber by default, spell on Spells, karma where Karma is spent (Commit, Learn spell), green for day-reset healing. |
| D8 | 11:59 | The kit rule lives in MODALS.md and the GUARDRAILS PR checklist (Tier 3). UI-GUIDELINES gets only the signed-off §7 Enter change. |
| Delivery | 12:01 | **Two builds.** This build covers `ed-confirm`, `ed-roll-modal`, the Spells info, learn and cast modals, the Equipment item modal, `ed-trade-modal`, `ed-damage-modal` and every Disciplines modal. A second slug migrates the rest and empties the baseline. |
| Defaults | 12:02 | Picker modals keep Enter as "activate the focused option" and do nothing in the search box. The Equipment add-item combobox keeps its own keys. The owner verifies on `dev`. |
| Roll OK | 13:40 | **Exception to D5:** the roll modal's result view and the Knockdown result keep their visible **OK** button. Enter = OK closes it. Every other read-only modal is ✕ only. Apply and the dice/aim choosers get `[Cancel] [Primary]`. |
| §7 scope | 13:42 | UI-GUIDELINES §7 gets **only** the D1 sentence, "Read-only modals: Enter closes (it is their OK)". "Escape closes only the top modal" and Ctrl/⌘+Enter are documented in MODALS.md. Ctrl/⌘+Enter joins §7 in the second feature, which asks for its own sign-off. |

**Architecture rule (tickets).** The kit is DOM-only plumbing. It never dispatches
game events and never mutates character state. Hosts pass
`onConfirm`/`onClose` callbacks and keep data-down / dispatch-up. The
key-routing core is pure and DOM-free.

## Discoveries

**Gate and test infrastructure**
- `npm test` = `pretest: node tools/check-imports.mjs` + `node --test` (Node
  v22.20.0, auto-discovers `**/*.test.js`, so `ui/kit/*.test.js` and
  `tools/check-ui-kit.test.js` are picked up). It is green today: 1300 tests.
- No CI workflow runs `npm test`. `.github/workflows/` only deploys Pages and
  folds custom items. The gate is the owner's and the agents' local Windows run.
- **The `check-imports` CLI is a silent no-op on Windows.** Its guard at
  `tools/check-imports.mjs:334` compares `import.meta.url` with
  ``file://${process.argv[1]}``. On Windows that gives `file:///C:/…` against
  `file://C:\…`, so the two never match. `node tools/check-imports.mjs` printed
  nothing and exited 0 here. Imports are still enforced, but only by the
  real-repo test in `tools/check-imports.test.js:96`. `check-ui-kit.mjs` must use
  `pathToFileURL(process.argv[1]).href` and also carry a real-repo test.
- **Both import walkers recurse only into top-level `ui/` and `engine/`**
  (`rel === 'engine' || rel === 'ui'`, at `tools/check-imports.mjs:303` and
  `tools/check-imports.test.js:102`). After `ui/modal-controller.js` moves to
  `ui/kit/`, every `./kit/…` import would be reported as `missing-file` unless
  both walkers also walk `ui/kit/`.
- **Modules that import `lit` cannot load under node.** There is no
  `node_modules`, and `lit` resolves only through the importmap in `index.html`.
  Importing `ui/dice-icon.js` under node fails with `ERR_MODULE_NOT_FOUND`. So:
  - `ui/kit/modal-stack.js` and `ui/kit/modal-controller.js` must stay lit-free
    (the controller already is);
  - `ui/kit/modal.js` and `ui/kit/button-css.js`, which use `html`/`css`, cannot
    be unit-tested;
  - any testable logic (router, hint text) goes in the lit-free module. This
    follows the existing `dice-icon.js` / `dice-geometry.js` split.
- No existing test reads UI component source, so migrations break nothing except
  the import check and the new UI-kit check.
- `tools/guardrail-hook.mjs:14` already protects `^ui\//`, which covers `ui/kit/`.

**Current controller** (`ui/modal-controller.js`, 224 lines)
- Each instance adds its own `document` keydown listener in `hostConnected`
  (line 134). It handles Escape and the Tab trap, and calls `e.stopPropagation()`,
  which is useless against other `document` listeners.
- It focuses `[autofocus]`, then `initialFocus`, then the first focusable
  element (usually the header ✕, the "Enter closes by accident" behaviour in
  Disciplines), then the dialog.
- `hostDisconnected` restores focus if the modal is still open.
- It exports `currentModality`, `deepActiveElement` and `returnFocusToTrigger`.
  `ed-app` uses these for the roll modal (`ui/ed-app.js:15`, `:265–266`,
  `_closeRoll` at `:1570–1577`).
- A window capture-phase listener tracks input modality (lines 39–44).
- Importers: `ui/ed-app.js:15`, `ui/ed-damage-modal.js:11`,
  `ui/ed-disciplines.js:14`, `ui/ed-spells.js:16`.
- Path references in docs: `docs/MODALS.md:4,59,107`, `ARCHITECTURE.md:568`,
  `CLAUDE.md:51` (source-of-truth map). `docs/TAXONOMY-AUDIT.md` mentions are
  historical; leave them.

**Legacy listeners that stay this build (baseline files)**
- `ed-notes.js:189` closes its modal on Escape unless `this._confirm` is set.
- `ed-combat.js:337` closes `_stepAudit` / `_confirmClear` on Escape.
- `ed-overview.js:602` closes `_addLegend`, `_karmaRitual`, `_modal` and
  `_lightbox`.
- `ed-day-reset.js:60–68`: Escape dismisses the embedded roll, then the modal.
- Also `ed-add-legend`, `ed-changelog`, `ed-character-picker`, `ed-conflict`,
  `ed-custom-item`, `ed-edit-meta`, `ed-homebrew`, `ed-save-key`, `ed-settings`.

During the two-build transition, kit modals and legacy modals can be stacked
together:
- a kit `ed-confirm` over a legacy Notes modal, or over a Combat or `ed-app`
  host;
- a legacy portal `ed-conflict` (z 2200), which can pop up during an autosave
  over an open kit modal. It focuses its own primary (`ui/ed-conflict.js:50`), and
  §8 "Keep mine: Enter confirms" must keep working.

So the kit's single listener must:
- run before the legacy bubble-phase `document` listeners (capture phase);
- swallow the keys it handles (`preventDefault` + `stopPropagation`), so a
  legacy listener below does not also act (for example, the Notes modal
  closing under its confirm);
- **pass** a key whose target is inside a dialog that is not on the kit stack
  (a legacy modal on top).

**Roll modal** (`ui/ed-roll-modal.js`)
- Its `document` listener (lines 110–118) handles Escape and Enter for the two
  choosers.
- There is no `role="dialog"`, no focus-in and no Tab trap.
- Render paths:
  - set-dice chooser (`_renderChooser`): primary `button.commit` "Roll ✦ N";
  - aim chooser (`_renderAimChooser`): number input plus `button.commit`
    "Roll", disabled until a target is entered;
  - result view: `.foot` with `button.ok` (OK), or `button.appbtn` (Apply) when
    `apply` is set and not `knockdown-result`.
- Strain is charged in `updated()` when `stepRow` changes (lines 126–160). The
  choosers charge in `_commit` / `_commitAim` (306, 343).
- `embedded` returns the bare `.dm` panel without an overlay (line 641). Inside
  it, `ed-day-reset._focusPrimary` queries `.appbtn, .ok` in the embedded roll's
  `renderRoot` (`ui/ed-day-reset.js:86–89`). **The embedded markup and class
  names must not change.**
- `ed-app` mounts it as `${this._roll && !this._dayReset ? html`<ed-roll-modal …>` : ''}`
  (`ui/ed-app.js:2070`).
- Apply paths close it by setting `this._roll = null` (disconnect), without
  `_closeRoll`, so there is no focus restore (`ui/ed-app.js:343–390`).

**ed-confirm** (`ui/ed-confirm.js`)
- It has its own `document` listener for Escape only, focuses its primary in
  `firstUpdated`, and has `role="dialog"`.
- It has five hosts:
  - `ed-app` (Discard local changes `:2107`; Load a different character `:2116`,
    whose Continue opens the §6a character picker next);
  - `ed-notes:654`;
  - `ed-combat` (clear log `:1523`; drink `:1280`);
  - `ed-equipment` (armour swap `:603`; drink `:776`).
- Equipment's close handlers call `this.renderRoot.activeElement?.blur()`
  (`:523`, `:609`, `:626`, `_closeUse` `:737`), and so does Combat's
  `_closeDrink` (`:1247`). These would undo any focus restore. Equipment's are
  removed in this build; Combat's stays as today until the second feature.

**Spells** (`ui/ed-spells.js`)
- There is one `document` listener `_onKey` (lines 276–287):
  - Escape closes info **and** learn;
  - Enter while `_learn` is set confirms if allowed (K4);
  - Enter while `_modal` is set closes.
- Learn modal (`_learnModal` 770, `_learnDetail`):
  - the footer is inside the detail pane and appears only once a spell is
    picked (877–880);
  - the Learn button has an inline karma style (879, rule 5);
  - closes set `_learn = null` directly (784, 788, 878, 767);
  - `_openLearn()` (913) and `_openDetail(s)` (936) receive no event, so the
    trigger must be threaded through.
- Info modal (`_detailModal` 960): it has a footer Close (980) and a circle pill
  `.mhead .cr` in the header.
- Cast modal (`_castModalTpl` 1268):
  - it already uses `_castModalCtl` (260, `initialFocus: '.btn.primary'`);
  - Close (1293) and Confirm / Cast on nothing (1294);
  - the number field has a local Enter handler (1289);
  - Confirm hands off to the roll modal with `close({ restoreFocus: false })`
    (1138).
- Spells' `button.btn` CSS (107, 108, 112) also styles the tab-body
  "＋ Learn spell" button (`.btn learnbtn`, 913).
- `ed-app` renders only the active tab, so a tab switch disconnects the host
  (`disconnectedCallback` 297).

**Equipment** (`ui/ed-equipment.js`)
- Its `document` keydown listener (147–150, added at 163) handles Escape for the
  item modal **and** for the add-item picker (`_addOpen`).
- The picker's input-level keys are in `_pickKeydown` (587–593).
  Close-on-outside-pointerdown is a `document` pointerdown listener (151–158),
  which rule 1 does not flag.
- If the document Escape branch goes, Escape no longer closes the picker when
  focus has left the input (for example after clicking a non-focusable result
  row, or on Done).
- Item modal (`_detailModal` 927–1018):
  - the tile opens it with `() => (this._modal = it.name)` (668), with no event;
  - ✕ and backdrop set `_modal = null` (976, 980), while Escape goes through
    `_closeModal()`, which blurs (175–179) (M3);
  - `_confirmTrade` sets `_modal = null` after a full sell (514);
  - the edit-mode Remove item button has an inline style (1013, rule 5);
  - the magic variant uses `.modal.magic` and `.modal.magic .mtitle` (370, 373).
- Custom items open from the add bar, not over the item modal.

**Trade** (`ui/ed-trade-modal.js`)
- It has a `document` Escape listener (229) and focuses its primary or Cancel in
  `firstUpdated` (236–241).
- Gem-row inputs are at 342–345.
- **Its `:host` redefines the type-scale tokens** (line 74:
  `--fs-value: 1.1rem; --fs-body: 0.9rem; --fs-small: 0.75rem; --fs-fine: 0.7rem`).
  These shadow the `index.html` `:root` scale, so kit buttons and copy would
  render at different sizes inside the trade modal. It is the only component that
  does this. Removing them restores §3a.

**Damage** (`ui/ed-damage-modal.js`)
- It is already on the controller (`initialFocus: 'input'`), and its footer is
  inside a `<form @submit>` (103–110).
- It has the hint "Enter applies · Escape closes" (107) and no Cancel.
- Knockdown hand-off: `close({ restoreFocus: !roll })` (68). After the Knockdown
  roll closes, focus falls to `<body>`, because `ed-app` captured the damage
  modal's input as the roll trigger and that input is gone. This is unchanged.

**Disciplines** (`ui/ed-disciplines.js`)
- It has one `_modalCtl` (256) for 9 modal types (render switch 1332–1349):
  - info: talent (default), skill, knack, granted;
  - pickers: halfmagic, learn (Add a talent option), learn-skill, learn-knack;
  - confirm: advance (Train).
- Autofocus targets:
  - Half-Magic default option `?autofocus` (833);
  - first talent option (994);
  - the search boxes (1037, 1133);
  - Train's `autofocus` is on a button that may be disabled (950), so today it
    focuses nothing when Train is blocked.
- Fee fields: `.silin` at 941 (Train), 1043 (skill), 1139 (knack), plus the knack
  parent `<select>` at 1175.
- Picks close first, then dispatch (`_learnPick`, `_learnKnackPick`,
  `_rollHalfMagic`), so `ed-app` captures the restored trigger for a follow-on
  roll.

**Overlay layers, widths and palette**
- Today's z-index values must be kept so stacks paint correctly:
  - Disciplines, Equipment and Overview: 2000;
  - confirm, Spells, damage and day-reset: 2100;
  - trade: 2150;
  - conflict, settings and toasts: 2200;
  - roll: 3000.
- Widths: confirm and damage 26rem, trade 27rem, Spells, Disciplines and
  Equipment 30rem (85vh with scroll), roll 340px.
- Colour variable names differ by host:
  - text is `--fg` (Spells, Disciplines, Equipment), `--text` (confirm,
    day-reset) or `--txt` (trade);
  - `ed-app` defines none, and the roll modal inlines `light-dark()` values with
    a non-theme `#b26a00` fallback;
  - `--spell` exists only in Spells; `--karma` exists in several hosts.
- Kit CSS therefore needs `var(--x, light-dark(…))` fallbacks. Colour tokens on
  `:root` are explicitly out of scope (V8, later).

**Check-script counts measured today**

These are what the analyzer must reproduce. Rule-3 numbers count one CSS rule
block per selector that names a frame class. The designer fixes the exact unit.

| File | r1 keydown | r2 role=dialog | r3 frame CSS | r4 raw font-size | r5 button style= |
|---|---|---|---|---|---|
| ed-add-legend.js | 1 | 1 | 6 | | |
| ed-app.js | | | | | 1 (`:2055`, the "Choose a character" stub) |
| ed-changelog.js | 1 | | 4 | | |
| ed-character-picker.js | 1 | 1 | 2 | | |
| ed-combat.js | 1 | 1 | 4 | | 1 (`:1388`) |
| **ed-confirm.js** | 1 | 1 | 8 | | |
| ed-conflict.js | 1 | 1 | | | |
| ed-custom-item.js | 1 | 2 | 6 | | |
| **ed-damage-modal.js** | | 1 | 4 | | |
| ed-day-reset.js | 1 | 1 | 7 | | |
| **ed-disciplines.js** | | 9 | 4 | | |
| ed-edit-meta.js | 1 | 1 | 6 | | |
| **ed-equipment.js** | 1 | 1 | 6 (+1 false positive, see below) | | 1 (`:1013`) |
| ed-homebrew.js | 1 | | 4 | | |
| ed-notes.js | 1 | 1 | 6 | | |
| ed-overview.js | 1 | | 4 | | 1 (`:974`) |
| **ed-roll-modal.js** | 1 | | 1 | | |
| ed-save-key.js | 1 | 1 | | | |
| ed-settings.js | 1 | 1 | | | |
| **ed-spells.js** | 1 | 3 | 9 | 5 (`:88, 91, 120, 163, 212`) | 1 (`:879`) |
| **ed-trade-modal.js** | 1 | 1 | 7 | 1 (`:80`) | |
| legend-spent-view.js | | | | 2 (`:25, 31`, `em` values) | |
| modal-controller.js | 2 (`:42` window, `:134` document) | 0 (its `'[role="dialog"]'` at `:113` is a selector string) | | | |

Bold rows are this build's files. `modal-controller.js` is counted at I2 because
it is still an ordinary `ui/` file then. I3 moves it into the exempt `ui/kit/`
and deletes its entry (F1). A recount of r1/r2 with comments stripped matched
every other row. Three analyzer gotchas:
- **Rule 3** must scan only CSS: `css` tagged templates and inline `<style>`
  text. `ui/ed-equipment.js:1076` is a Lit property binding
  (`.overlay=${this.customOverlay}`), not CSS.
- **Rule 4** must not let `\s*` backtrack. `font-size:\s*(?!var\(--fs-)`
  matches `font-size: var(--fs-body)` by backing off the space; use
  `font-size\s*:(?!\s*var\(--fs-)`.
- **Rule 5** must scan a `<button` tag to its real closing `>` while skipping
  `${…}` bindings. A naive `[^>]*` stops at the `=>` in `@click=${() => …}` and
  misses `ui/ed-equipment.js:1013`.

**Correction to the tickets' baseline statement.** T4 and the feature acceptance
say the final baseline holds "only second-feature files, plus the 5 `ed-spells.js`
rule-4 entries". Two more entries remain, and both belong to second-feature
surfaces:
- `ui/ed-app.js` r5: 1, the "Choose a character" stub button of the §6a picker
  flow;
- `ui/legend-spent-view.js` r4: 2, rendered inside the Overview and Notes
  "Legend spent" modals (V8).

The plan keeps both in the baseline. They, and the five `ed-spells.js` V8
literals, outlive the second feature too. See "Entries that outlive the second
feature" under Sequencing (F7).

**Git state.** `docs/UI-CONSISTENCY-REVIEW.md` and this plan folder are untracked
(`git status`: `??`). The build must stage the review doc by explicit path when
I12 updates it.

## Guardrail classification

| Item | Tier | Why | Sign-off |
|---|---|---|---|
| I1 Modal stack + key router | 3 | New pure module. Restores §7 "Escape closes / Enter confirms" for the top modal. | — |
| I2 UI-kit check + baseline | 3 | Tooling (D8). | — (D8, qa-log 11:59) |
| I3 Controller move + upgrade | 3 | Refactor that restores the MODALS.md contract. The only change for the three current users is that Escape becomes top-only. A controller with no `kind` keeps today's Enter and focus behaviour (F11). | — |
| I4 Frame, modal CSS, button CSS | 3 | Styling within the guidelines. The title at `--fs-title` restores §3a. Tab tones are kept (qa-log 11:58). | — |
| I5 `ed-confirm` pilot | 3 | Restores documented behaviour. | — |
| I6 `ed-roll-modal` | **1** (OK view: Enter closes) / 3 | §7 read-only Enter changes from no-op to close. | **Signed off: qa-log 2026-11-18T11:53 (D1)**, which names the roll modal's OK view. Keeping the visible OK button is an owner decision, an exception to D5 (qa-log 13:40). |
| I7 `ed-damage-modal` | 3 | Footer per D5, hint per V4. | — (D5 11:56, V4 11:57) |
| I8 `ed-trade-modal` | 3 | Restores Enter = OK and §3a (drops the local `--fs-*` overrides). | — |
| I9 Equipment item modal | **1** (read-only: Enter closes) / 3 | §7. | **Signed off: qa-log 11:53 (D1)** |
| I10 Spells modals | **1** (info: Enter closes) / 3 | §7. Close becomes Cancel and the info Close is removed (D5). | **Signed off: qa-log 11:53 (D1)**; D5 11:56 |
| I11 Disciplines modals | **1** (info: Enter closes on purpose) / 3 | §7. | **Signed off: qa-log 11:53 (D1)** |
| I12 Docs + changelog | **1** (UI-GUIDELINES §7 text) / 3 (MODALS.md, GUARDRAILS checklist, ARCHITECTURE layout, review status, changelog) | §7 is Tier-1 text. | **Signed off for the D1 sentence: qa-log 11:53.** Scope confirmed at qa-log 13:42: §7 gets **only** that sentence. "Escape closes only the top modal" and Ctrl/⌘+Enter go in MODALS.md (Tier 3). |

- There is no Tier-2 item: no taxonomy, `rules/*.json`, schema or engine change.
- No item is blocked. Every Tier-1 item's behaviour (read-only Enter closes) has
  recorded sign-off.
- No unsigned Tier-1 text is planned. §7 changes only by the D1 sentence (qa-log
  13:42).

**Tier-1 rules this feature must keep (re-check before shipping):**
- §6a picker: first row autofocused, Enter confirms the focused row,
  Escape/backdrop closes. The picker is legacy this build, and the kit stack is
  empty while it is open. **Risk:** `ed-confirm` "Load a different character?"
  Continue opens the picker next. The confirm's focus restore must run
  synchronously before it dispatches `confirm`, or it could steal the picker's
  first-row focus (I3, I5).
- §8 conflict: Keep mine is primary and Enter confirms. Legacy; covered by the
  router's "target inside a non-kit dialog → pass" rule (I1).
- §8a Settings: Enter saves. Legacy, and the stack is empty. The router treats
  checkboxes and radios as fields, not as own-Enter controls (F6), so §8a's
  "Enter saves" on the switches (`ui/ed-settings.js:127, 206`) and the radio
  group stays possible for the second feature.
- Equipment armour swap: Swap is primary (Enter), and Escape, backdrop or ✕
  keeps the current armour (I5, I9).
- Strain on roll is charged once (I6; I1 key-repeat rule).
- Pointer opens leave no ring on the trigger; keyboard opens keep it
  (`returnFocusToTrigger`, unchanged).
- Light and dark mode: all kit colours use `light-dark()` or host variables.
- The Overview still fits the viewport. No Overview layout change; modals are
  fixed overlays.
- Kit CSS uses two font weights (400/500) and `--fs-*` tokens only. Rule 4 on
  `ui/kit/` enforces the tokens; review checks the weights.

## Rules dependencies

**None.** `rules.md` records no Earthdawn rule dependency. This feature changes
modal keyboard handling, focus, layout and styling only. It adds no game value,
formula, cost, step or dice table, and no test asserts a rules value. `rules.md`
has no entry ids, so each item below lists "Rules: none".

These are existing app behaviours (not new rulings) that the migrated modals
**must preserve unchanged**, quoted from `rules.md`:

| Preserved behaviour | Source | Items that touch it |
|---|---|---|
| Strain on roll is charged **once** per ordinary roll, when the roll modal opens and auto-rolls. True Shot (set-dice) and Mystic Aim charge at commit. | `rules.md`; UI-GUIDELINES "Other conventions" → Strain on roll | I1 (key repeat), I6 |
| Karma is charged once per roll interaction (`ed-roll-modal` `_karmaCharged`). | `rules.md` | I6 |
| A hit five or more over the Wound Threshold hands off from Take damage to the Knockdown roll (`close({ restoreFocus: false })`). | `rules.md`; MODALS.md | I3, I7 |

There is no open `NEEDS_RULES`.

## Implementation items

Every item leaves `npm test` green. From I2 on, the baseline in
`tools/ui-kit-baseline.json` is a two-way ratchet, so **each migration item
lowers its own file's entries in the same change**. A count left above the new
code fails as "lower the baseline to N".

### I1 — Pure modal stack + key router (`ui/kit/modal-stack.js`)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** A pure, DOM-free, lit-free module with three parts:
  - a stack: `push(entry)`, `remove(entry)`, `top()`, size;
  - `routeKey(facts)`;
  - the footer-hint text helper used by the frame. It lives here because the
    frame module cannot load under node.

  Tests go in `ui/kit/modal-stack.test.js`.
- **Where:** `ui/kit/modal-stack.js`, `ui/kit/modal-stack.test.js` (new).
- **Approach:**
  - `facts` is plain data:
    - `key`, `ctrlKey`, `metaKey`, `shiftKey`, `altKey`, `isComposing`,
      `defaultPrevented`, `repeat`;
    - the target's `tag`, `type` and `role`, and whether it carries
      `data-enter="local"`;
    - `targetIsPrimary`;
    - **`targetInTop`**: the target is inside the top modal's dialog;
    - **`targetInForeignDialog`**: the target is inside a
      `[role=dialog]`/`[aria-modal]` element that is not on the kit stack;
    - the top entry's `kind` (`input | confirm | info | picker`) and
      `canConfirm` (absent when the stack is empty);
    - **`latched`** (F2): this is a `repeat` keydown of a key that was held down
      when a kit modal last closed or confirmed, by any path. That includes a
      native click from a passed Enter on Cancel, ✕ or OK. The DOM wrapper
      computes it (I3), so the router stays pure.
  - The three bold facts go beyond T1's list:
    - T7 requires that "Enter never reaches the trigger behind" while focus is
      still on the trigger;
    - §8 requires a legacy modal on top to keep its own keys;
    - the latch stops a held key from chaining close → reopen after the stack
      empties (F2).
  - **Routing: an ordered list. The first matching rule wins** (F2). Each rule is
    a unit test, and so is each ordering case in the acceptance criteria.
    1. Any key other than Enter or Escape → `pass`. The controller handles Tab
       for the trap, still subject to rules 2–4.
    2. `isComposing` → `pass` (IME).
    3. `latched` → **swallow**, even with an empty stack.
    4. Empty stack → `pass`.
    5. `targetInForeignDialog` → `pass`. A legacy modal above the kit stack
       handles its own keys, which preserves §8.
    6. `repeat` → **swallow**. A held key acts once: a held Escape closes only
       the top, and a held Enter confirms or closes once.
    7. `defaultPrevented` → `pass`. Another handler already owns the key.
    8. Target **outside** the top modal (stray focus behind the backdrop or on
       `<body>`; the K2 trigger). This is never `pass`:
       - Escape → `close`;
       - Enter with any modifier → swallow;
       - plain Enter: `info` → `close`; `input`/`confirm` → `confirm` when
         `canConfirm`, otherwise swallow; `picker` → swallow.
    9. Escape → `close`, for the top entry only.
    10. Enter with Shift or Alt → `pass`. The target is inside the top here.
    11. Ctrl/⌘+Enter in a `<textarea>` → `confirm` when `canConfirm` (D2),
        otherwise `pass`. Ctrl/⌘+Enter on any other target falls through to
        rules 12–14 as plain Enter (see Open questions).
    12. Enter on a control that does its own job → `pass`: `<textarea>`,
        `<select>`, `<a>`, a `button` / `[role=button]` that is not the
        primary, or anything marked `[data-enter="local"]`.
    13. Enter on the primary → `confirm`. The wrapper prevents the native click,
        so it does not fire twice.
    14. Enter by kind:
        - `info` → `close` (D1);
        - `input`/`confirm` → `confirm` when `canConfirm`, otherwise `pass`
          (a no-op inside the modal; a disabled default button blocks native
          implicit submission);
        - `picker` → `pass` (a focused option activates natively; a search
          box does nothing).
  - **Checkboxes and radios are fields**, so Enter on them falls through to
    rule 14 (F6). The roll modal meets T7 ("optional-mod checkboxes keep their
    own Enter") by marking those checkboxes `data-enter="local"` (I6). That
    keeps §8a's "Enter saves" possible on Settings' switches
    (`ui/ed-settings.js:127, 206`) and its radio group when Settings migrates.
  - **Signature note.** T1 states `'close' | 'confirm' | 'pass'`. The swallow
    cases need a fourth outcome, such as `'block'` (preventDefault with no
    action), or an equivalent `{ action, swallow }` shape. The designer picks
    one.
  - Hint helper: `footerHint({ hasTextarea })` returns "Enter = OK · Esc = Cancel"
    or "Ctrl+Enter saves · Esc = Cancel" (V4).
- **Dependencies:** none.
- **Acceptance criteria:**
  - Every T1 bullet has a passing unit test, as does every rule above.
  - Ordering tests (F2), each with its expected result:
    - a held Escape (`repeat`) on a two-entry stack is swallowed after the first
      close, so only the top closes;
    - Shift+Enter, and a picker-kind plain Enter, on a target **behind** an open
      kit modal are swallowed, not passed;
    - a `latched` Enter with an empty stack is swallowed (held Enter on OK, and
      held Enter on Cancel, do not reopen the roll);
    - a foreign-dialog target wins over `repeat` and over outside-the-top;
    - a checkbox inside an `input` modal confirms when allowed; the same
      checkbox with `data-enter="local"` passes.
  - Escape acts on the top entry only. Lower entries are untouched.
  - The module imports nothing from `lit` and touches no DOM global.
  - `npm test` is green.
- **Risks / unknowns:**
  - The foreign-dialog fact is a transitional heuristic. If the user clicks blank
    space in a legacy modal stacked over a kit modal, focus falls to `<body>` and
    Escape then closes the kit modal below. This is rare (conflict during an
    open modal) and disappears once the second feature migrates the portal
    modals. Document it in MODALS.md.

### I2 — UI-kit enforcement check with today's baseline (`tools/check-ui-kit.mjs`)
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** A pure analyzer plus CLI wrapper, its test on in-memory fixtures, and
  `tools/ui-kit-baseline.json` recording today's counts. It is added to `pretest`.
- **Where:**
  - new: `tools/check-ui-kit.mjs`, `tools/check-ui-kit.test.js`,
    `tools/ui-kit-baseline.json`;
  - changed: `package.json` (`pretest` becomes
    `node tools/check-imports.mjs && node tools/check-ui-kit.mjs`; optionally add
    a `lint:ui-kit` script).
- **Approach:**
  - Follow `tools/check-imports.mjs`: a pure `analyze…(modules, baseline)`
    returning `{ counts, errors }`, and a filesystem CLI. Strip comments first,
    reusing its `stripComments` approach.
  - The CLI walks `ui/**/*.js` recursively, excluding `*.test.js`. `ui/kit/` is
    exempt from rules 1, 2, 3 and 5, but **rule 4 applies to `ui/kit/` too**, so
    kit CSS uses tokens only.
  - The rules:
    1. `document` or `window` `.addEventListener(` with `'keydown'` or `'keyup'`
       (either quote, any whitespace or newline). `el.addEventListener` is not
       flagged.
    2. A literal `role="dialog"` or `role="alertdialog"` **attribute**, matched
       only when it is not inside a selector string. The controller's
       `'[role="dialog"]'` default (`ui/modal-controller.js:113`) is a selector,
       not markup, so it does not count.
    3. CSS rule blocks inside `css` tagged templates or inline `<style>` text
       whose selector names `.overlay`, `.modal`, `.mhead`, `.mclose` or
       `button.btn`. Use class-token boundaries so `.modal-x` and `.mtitle` don't
       match. Property bindings must not match: `ui/ed-equipment.js:1076`
       `.overlay=${…}` is not CSS.
    4. A `font-size:` whose value is not a `var(--fs-…)` token, with no
       whitespace backtracking.
    5. An inline `style=` on a `<button>`. The tag scan skips `${…}` bindings so
       `=>` inside them does not end the tag.
  - The baseline maps file → rule → allowed count:
    - a count above the baseline fails as a new violation;
    - a count below the baseline fails with "lower the baseline to N" (a
      ratchet);
    - a count for a file with no entry fails;
    - an entry that reaches 0 is deleted;
    - **an entry for a file that no longer exists fails**, with "remove stale
      entry for <file>" (F1). So a moved or renamed file cannot slip off the
      allowlist unnoticed:
      - a move to a path outside `ui/kit/` carries its entry to the new path in
        the same change;
      - a move into `ui/kit/`, or a deletion, removes the entry.
  - The CLI's main-module guard uses `pathToFileURL(process.argv[1]).href`. The
    `check-imports.mjs` form never fires on Windows.
  - Add a **real-repo test** in `tools/check-ui-kit.test.js`, like
    `tools/check-imports.test.js:96`, so `node --test` enforces the baseline even
    if `pretest` is skipped.
  - The initial baseline is the measured table in Discoveries, minus the
    Equipment false positive, **plus `ui/modal-controller.js` r1: 2** (F1). I2
    lands before I3 moves the controller, so at that point it is an ordinary
    `ui/` file: its `window` keydown listener (line 42) and `document` keydown
    listener (line 134) both count. Its r2 is 0 under the attribute-form rule
    2. A comment-stripped recount of r1/r2 matched the table for every other
    file. The analyzer's exact rule-3 counts win if they differ.
- **Dependencies:** none. It can land before or after I1, but before any
  migration.
- **Acceptance criteria:**
  - Each rule fires on a fixture.
  - Each named gotcha has a fixture: the property binding, the
    `var(--fs-…)`-with-space case, a `<button @click=${() => …} style=…>`, and
    a `'[role="dialog"]'` selector string, which does not count.
  - A baseline entry for a missing file fails with "remove stale entry for
    <file>" (F1).
  - The ratchet fails both ways, with a message that names the file, rule and
    number.
  - The real repository passes against the baseline.
  - `npm test` is green.
- **Risks / unknowns:**
  - Rule-3 unit and variants. Equipment's magic-item variant (`.modal.magic`)
    needs a frame hook that does not force "lose the accent or fail the check"
    (see I4). The designer fixes whether compound selectors on a frame class
    count.
  - Optional extension for the designer: count a `--fs-*:` redefinition outside
    `index.html` as a rule-4 hit. The only one is `ui/ed-trade-modal.js:74`, and
    I8 removes it.

### I3 — Move and upgrade `ModalController` into the kit
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:**
  - `git mv ui/modal-controller.js ui/kit/modal-controller.js` and update every
    import.
  - Replace the per-instance `document` listeners with **one** module-level
    listener that asks `routeKey` and acts on the top controller only.
  - Add the new options. Keep focus-in, the Tab trap, return-to-trigger with no
    ring after a pointer open, `close({ restoreFocus: false })` hand-offs, and the
    three exported helpers.
- **Where:**
  - `ui/kit/modal-controller.js` (moved);
  - imports in `ui/ed-app.js:15`, `ui/ed-damage-modal.js:11`,
    `ui/ed-disciplines.js:14`, `ui/ed-spells.js:16`;
  - `tools/check-imports.mjs` (walk `ui/kit/`, plus the Windows-safe CLI guard)
    and `tools/check-imports.test.js` (real-repo walker walks `ui/kit/`);
  - controller tests in `ui/kit/modal-controller.test.js` (new).
- **Approach:**
  - **Listener.** Register once, in the capture phase on `document`, only if
    `typeof document !== 'undefined'`. Build `facts` from the event:
    - deep target via `composedPath()`, so shadow-internal nodes are visible;
    - `targetInTop` and `targetInForeignDialog` from the **innermost**
      `[role=dialog]`/`[aria-modal="true"]` element on the event's composed path:
      - if it is the top controller's dialog, `targetInTop`;
      - if it is a lower kit entry's dialog, outside the top (not foreign);
      - if it is a dialog no kit entry owns, foreign;
      - if there is none, `<body>` or the page behind, so outside the top.

      Every migrated modal renders at its host's root, a sibling of other
      dialogs and never nested in one. The only nesting is day-reset's embedded
      roll, which has no stack entry.
    - `targetIsPrimary` by matching `primarySelector`.

    On `close`, `confirm` or swallow it calls `preventDefault()` and
    `stopPropagation()`, so the legacy bubble-phase `document` listeners in
    baseline files never also act. Tab traps within the top dialog, except when
    the target is in a foreign dialog. The modality tracker stays as is.
  - **Key latch (F2).**
    - The listener tracks which Enter/Escape keys are held: keydown adds the
      key, `keyup` removes it, and window `blur` clears the set.
    - Whenever a kit controller closes or confirms, by any path (routed key,
      native click on Cancel/✕/OK from a passed Enter, backdrop, programmatic),
      the currently held keys become **latched**.
    - A latched key's further `repeat` keydowns get `latched: true` in `facts`,
      and rule 3 swallows them, even when the stack is now empty. This stops a
      held Enter on the roll OK or Cancel from clicking the dice button that
      `_closeRoll` just refocused (`ui/ed-app.js:1570–1577`).
    - The latch clears on that key's `keyup`.
    - Repeats in textareas and in legacy modals are unaffected: the latch only
      sets after a kit close, and only for keys already held.
  - **Options:**
    - `kind`, `onConfirm`, `canConfirm`, `primarySelector`, `initialFocus`,
      `isDirty` + `onDiscardPrompt` (D3), `light` (portal hosts:
      `document.activeElement`, dialog inside the portal), plus the existing
      `onClose` and `dialogSelector`;
    - `kind` and `canConfirm` must be **readable at key time** (a getter or a
      value updated by the frame), because:
      - the roll modal changes from chooser to result while open;
      - Disciplines uses one controller for nine modal types;
    - `canConfirm` defaults to "the primary exists and is not `disabled`"
      (T3: a disabled primary means Enter is a no-op).
  - **Legacy-neutral default (F11).** A controller created **without** `kind`
    keeps today's behaviour in full until I7, I10 and I11 opt in:
    - Enter is not routed;
    - **today's initial-focus order is kept**: `[autofocus]`, then
      `initialFocus`, then the first focusable, then the dialog.

    So between I3 and I11 the Disciplines info modals still focus ✕, and Enter
    on it still closes them. The only change for the three current users is that
    Escape becomes top-only.
  - **Initial focus order (recommended), for controllers with a `kind`:**
    1. an enabled `[autofocus]`;
    2. the enabled primary (input/confirm);
    3. the host's `initialFocus`;
    4. for `info` kind, the frame's acknowledge button when the host asks for
       one (the roll OK view, I4/I6), otherwise the dialog itself
       (`tabindex="-1"`), never a body control;
    5. the first enabled control in the body, never the header ✕;
    6. the dialog.

    Step 4 prevents two accidents: Enter toggling Karma in the roll result, and
    Enter equipping or removing an item in the Equipment edit mode. Steps 1, 2
    and 5 skip disabled controls, which fixes Disciplines Train at
    `ui/ed-disciplines.js:950` once I11 gives it a `kind`.
  - **Refocus (F5).** `ctl.refocus()` re-runs the order while the modal stays
    open. The roll modal calls it when the view changes in place (chooser →
    result after `_commit` / `_commitAim`), so focus doesn't fall to `<body>`
    when the focused Roll button is removed.
  - **Stack lifecycle:**
    - `opened(trigger)` pushes and is idempotent (a re-open moves the entry to
      the top);
    - `close()` removes the entry **before** `onClose`, so a hand-off's next
      `opened()` lands on top;
    - `hostDisconnected` removes the entry.
  - **Restore timing.** `close()` restores focus **synchronously**, before
    `onClose`, so any modal the host opens next keeps its own focus. This
    preserves §6a's picker first-row autofocus after the confirm's Continue.
  - **Dirty guard.** User cancels (Escape, ✕, backdrop) go through a guarded
    path, for example `requestClose()`, that calls `onDiscardPrompt` when
    `isDirty()`. Programmatic `close()` (after a save) is unguarded.
  - **Testability.** The module stays lit-free and touches DOM only inside
    methods, so tests can use a fake host (`addController`, `updateComplete`,
    `renderRoot`) and drive the key handler with plain `facts`. No DOM library
    is needed.
- **Dependencies:** I1, I2. **In the same change, I3 deletes the
  `ui/modal-controller.js` baseline entry (r1: 2) that I2 recorded** (F1): the
  file moves into the exempt `ui/kit/`, and I2's stale-entry rule fails if the
  entry is left behind.
- **Acceptance criteria:**
  - A host can tell a cancel close from a confirm close (I5), so a separate
    component never emits `close` on Confirm.
  - Two stacked controllers: Escape closes only the top, and the next Escape
    closes the one below.
  - A hand-off (`close({ restoreFocus: false })`, then `opened()` on another)
    leaves the new modal on top.
  - Disconnecting a host with an open modal removes its entry.
  - With `isDirty()` true, Escape, ✕ and backdrop call `onDiscardPrompt`.
  - A controller with no `kind` does not route Enter and keeps today's
    initial-focus order (F11).
  - Key latch (F2), tested with a fake host:
    - a controller closed while Enter is held makes the next `repeat` Enter
      latched, with an empty stack;
    - after `keyup`, Enter routes normally again;
    - a latch set while Escape is held swallows only Escape repeats.
  - `refocus()` re-applies the initial-focus order (F5).
  - Disciplines, the Spells cast modal and Take damage work as today, except
    that Escape is top-only.
  - The baseline no longer lists `ui/modal-controller.js`.
  - `npm test`, including the import check over `ui/kit/`, is green.
  - No file imports `./modal-controller.js` any more.
- **Risks / unknowns:**
  - Spells will run three controllers in one shadow root (I10). Each must find
    **its own** dialog: the frame can stamp a per-controller id or attribute,
    which the default `dialogSelector` would then use. Today only one Spells
    modal is open at a time, so `[role="dialog"]` happens to work. Do not rely
    on that.

### I4 — Modal frame, modal CSS and button CSS
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:**
  - `ui/kit/modal.js` exports `modalFrame(ctl, opts)`, a Lit template rendered in
    the host's own shadow root, and `modalCss`.
  - `ui/kit/button-css.js` exports `buttonCss`.
  - No host uses them yet, so there is no visible change in this item.
- **Where:** `ui/kit/modal.js`, `ui/kit/button-css.js` (new).
- **Approach:**
  - **The frame renders:**
    - a backdrop, whose click calls the controller's guarded close;
    - an inner click that does `stopPropagation`;
    - the dialog with `role="dialog"`, `aria-modal="true"` and `aria-label`;
    - a header with the title at `--fs-title`, weight 500, an optional extra
      title slot (the Spells circle pill) and ✕ (`aria-label="Close"`);
    - the body;
    - for `input`/`confirm` only, a footer `[extra…] [Cancel] [Primary]`,
      right-aligned with the primary last (D5), and a muted `--fs-fine` hint from
      the I1 helper (V4);
    - for `info`, no footer button by default (D5). **When the host asks** (an
      option such as `ack: { label: 'OK' }`), it renders a single right-aligned
      acknowledge button. The button closes the modal through the controller, is
      the info modal's initial focus and its router primary (Enter closes), and
      gets no hint. Only the roll modal uses it: the owner's exception to D5,
      qa-log 2026-11-18T13:40. The host can supply a class for it, such as `ok`.
    - for `picker` (F10): ✕ only, with no footer button and no hint, the same as
      the Disciplines pickers today. A picker has no primary, so this is
      consistent with D5 and V4.
  - **Options the migrations need:**
    - `layer` (z-index), keeping today's values (2000, 2100, 2150, 3000);
    - `width`;
    - a scrollable body (`max-height: 85vh`);
    - a dialog **variant** hook for Equipment's magic item (box-shadow and arcane
      title) that rule 3 does not flag;
    - a stable per-controller dialog marker (see the I3 risk);
    - primary `{ label, tone, disabled, type }`;
    - **form support**, so a host can keep its `<form>` around body and footer,
      or give the primary `type="submit"` with a `form` id in the same shadow
      root, and native submit and validation still work (Take damage).
  - **`buttonCss`:**
    - `.btn` and `.btn.primary` share one shape: radius, padding, `--fs-body`,
      and weight 500 on the primary. Today the shapes vary: 6 vs 8px radius and
      12 vs 14px padding.
    - Tones: amber `--accent`/`--accent-bg` by default, plus `.danger`, `.spell`,
      `.karma` and `.heal` (green, used by day-reset in the second feature).
    - Disabled is opacity 0.4.
  - **Colours.** Each colour is `var(--host-var, light-dark(light, dark))`, with
    a fallback chain for the text colour (`--text`, `--fg`, `--txt`), because
    hosts name it differently and `ed-app` defines none.
- **Dependencies:** I1 (hint helper), I3 (controller API).
- **Acceptance criteria:**
  - All sizes are `--fs-*` tokens and weights are 400/500 only. Enforced by rule
    4 on `ui/kit/` and by review.
  - Every colour is theme-aware.
  - A form host can submit natively from the primary.
  - A disabled primary means `canConfirm` is false.
  - An `info` frame with no `ack` has no footer button. With `ack`, it shows one
    OK button that has focus on open and closes on click or Enter.
  - A `picker` frame has no footer and no hint.
  - `npm test` is green.
- **Risks / unknowns:**
  - Not unit-testable, because it imports `lit`. Correctness is proven by I5
    onward and the owner checklist.

### I5 — Migrate `ed-confirm` (pilot)
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3
- **What:**
  - Rebuild on `modalFrame` with an own `ModalController`: `kind: 'confirm'`,
    `onConfirm` → `_confirm`, `canConfirm` → `!disabled`.
  - Tone `danger` (the default) maps to `.danger`. `accent` maps to the default
    amber tone.
  - When `disabled`, focus goes to Cancel.
  - Keep the public API (`heading`, `message`, `warn`, `confirmLabel`, `tone`,
    `disabled`, events `confirm` and `close`) and the `warn`/`block` line.
- **Where:** `ui/ed-confirm.js`; `tools/ui-kit-baseline.json` (delete the
  `ed-confirm.js` entry).
- **Approach:**
  - The trigger is `deepActiveElement()` captured when the element connects,
    before the controller moves focus in. `opened(trigger)` runs at
    connect/first render.
  - Escape, ✕, backdrop and Cancel go through the controller (restore), then
    dispatch `close`.
  - Confirm restores focus synchronously, then dispatches `confirm`. This keeps
    focus for a follow-on modal, such as `ed-app`'s character picker after "Load
    a different character?" (§6a).
  - **The Confirm path dispatches only `confirm`, never `close` as well.** Hosts
    clear their prompt state in `@close` and read it in `@confirm`:
    - Equipment's swap `@close` (`ui/ed-equipment.js:609`) nulls `_swapPrompt`,
      which `_confirmSwap` (`:520`) reads;
    - `_closeUse` and `_confirmUse` (`:736–744`) work the same way;
    - so do Notes `_confirmDelete` and Combat's drink.

    A `close` fired before `confirm` would silently cancel the swap or drink. So
    the controller's close path needs to tell the host why it closed, for
    example `onClose(reason)` with `'cancel' | 'confirm'`, or a close option that
    skips `onClose`. Cover it in the I3 controller tests.
  - Removal by the host is a disconnect, which removes the stack entry.
  - Delete the `document` listener, `firstUpdated` focus and the local frame and
    button CSS.
  - The hosts stay unchanged in this item. Equipment's `blur()` calls are removed
    in I9. Combat's `_closeDrink` blur (`ui/ed-combat.js:1247`) stays, which is
    today's behaviour, until the second feature.
- **Dependencies:** I3, I4.
- **Acceptance criteria:**
  - Enter confirms; Escape, ✕ and backdrop close.
  - A blocked (disabled) confirm can't be confirmed by Enter, and focus is on
    Cancel.
  - Over the Equipment item modal (still legacy here), Escape closes only the
    confirm. The kit swallows the key before Equipment's bubble listener, so K1
    for the armour swap is fixed already. It is re-verified after I9.
  - Over a Notes modal, Escape closes only the confirm.
  - Focus returns to the trigger, with no ring after a pointer open.
  - "Load a different character?" → Continue opens the character picker with its
    first row focused.
  - Confirming still performs the action: Swap swaps, Drink drinks, Notes Delete
    deletes, Discard discards. No `close` event fires on Confirm.
  - The baseline has no `ed-confirm.js` entry, and `npm test` is green.
- **Risks / unknowns:**
  - Trigger capture fails on browsers that don't focus buttons on click (Safari):
    there is no trigger, so no restore. This is the same limitation as today's
    `ed-app` roll restore.

### I6 — Migrate `ed-roll-modal`
- **Covers tickets:** T7
- **Rules:** none (preserves Strain once and Karma once, per `rules.md`)
- **Tier:** **1** for "Enter closes the OK view" (**signed off, qa-log
  2026-11-18T11:53, D1**); 3 otherwise.
- **What:**
  - The non-embedded views render through `modalFrame`, with a controller whose
    `kind` follows the view:
    - **result, OK only** (including the Knockdown result): `info`, keeping its
      visible **OK** button through the frame's `ack` option, the owner's
      exception to D5 (qa-log 2026-11-18T13:40). Enter = OK closes (D1);
    - **result with `apply`** (not `knockdown-result`): `input`, primary
      **Apply** (`_apply`);
    - **set-dice chooser**: `input`, primary **Roll ✦ N** (`_commit`);
    - **aim chooser**: `input`, primary **Roll** (`_commitAim`), with
      `canConfirm` = `_aimTargetNum() != null`.
  - Focus moves to the primary on open. The aim chooser focuses the target input
    while Roll is disabled. The OK view focuses OK, never the Karma toggle.
  - When a chooser commits and the view changes in place to the result, the
    modal calls `ctl.refocus()` (I3), so focus lands on OK or Apply and not on
    `<body>` (F5).
  - Tab is trapped. These keep their own Enter:
    - the Karma toggle, Add die and ± dice, which are buttons (router `pass`);
    - the optional-mod checkboxes, which are marked `data-enter="local"`
      because checkboxes are fields in the router (I1, F6).
  - **Primary tones (F5, per V2):**
    - set-dice **Roll ✦ N**: karma, since Karma is spent at commit;
    - aim **Roll**: the default amber. It is karma-styled today, but the aim
      commit spends no Karma (`_commitAim`, `ui/ed-roll-modal.js:336–345`), so
      this is a listed visible change;
    - **Apply**: amber, as today;
    - **OK**: a neutral `.btn`.
- **Where:**
  - `ui/ed-roll-modal.js`: remove the listener at 105–124; route the framed
    views' `_close` through the controller; delete the `.overlay` CSS at 48;
  - `ui/ed-app.js` (roll trigger and `_closeRoll`, only if the designer moves the
    restore);
  - `tools/ui-kit-baseline.json` (delete the `ed-roll-modal.js` entry).
- **Approach:**
  - **Footers under D5:**
    - input views get `[Cancel] [Primary]` and the hint. The existing hints
      ("N Strain on roll.", "Max on a die explodes…") stay as body text near the
      footer;
    - the OK view and the Knockdown result **keep OK**, rendered as the frame's
      `ack` button (I4), with ✕ in the header as everywhere. There is no Cancel
      and no hint there. This is the only read-only modal with a footer button
      (qa-log 13:40).
    - Keep the class `ok` on that button, and `appbtn` on Apply where the
      embedded panel shares markup. `ed-day-reset._focusPrimary` looks up
      `.appbtn, .ok` (`ui/ed-day-reset.js:86–89`), and keeping OK means that
      lookup still finds its target.
    - Settings: `layer` 3000, width 340px, `aria-label` = `label`, title at
      `--fs-title`.
  - **Embedded mode is untouched.** It keeps the bare `.dm` panel with the same
    markup and classes (`.ok`, `.appbtn`, `.x`) and its own styles. It has no
    frame, no controller push and no key handling.
    `ed-day-reset._focusPrimary` depends on these classes.
  - **Embedded ✕ and OK keep dispatching `close` directly (F3).** In embedded
    mode `_close()` dispatches the `close` event itself, as today. Only the
    framed views go through `ctl.close()`, whose `onClose` then dispatches
    `close`.
    - `ed-day-reset` turns that event into `roll-dismiss`
      (`ui/ed-day-reset.js:106–109, 146`).
    - The controller is never opened in embedded mode, and `close()` returns
      early when not open (`ui/modal-controller.js:169–170`). Routing the
      embedded `_close` through it would silently break the dismiss.
  - **Strain and Karma.** Do not touch the `updated()` charge logic (126–160) or
    the chooser commits. Do not change `ed-app`'s conditional mount
    (`ui/ed-app.js:2070`), so `stepRow` is set once per interaction.
  - **Trigger restore (recommended).** Keep it in `ed-app`: capture at `:265–266`
    and restore in `_closeRoll` at `:1570–1577`. The roll modal's controller
    opens with no trigger of its own; Escape, ✕, backdrop and Cancel end in
    `close` and then `_closeRoll`. Apply closes stay as today (disconnect, no
    restore). That is identical behaviour, as T7 requires.
- **Dependencies:** I3, I4. I1's repeat and latch rules.
- **Acceptance criteria:**
  - While the modal is open, Enter never reaches the trigger behind it: no second
    `ed-roll`, no new `rollId`, no early Discord flush. Holding Enter on a dice
    button opens exactly one roll.
  - Holding Enter on OK or on Cancel closes the roll once and does not reopen it
    (latch, F2).
  - After a set-dice or aim commit, focus is inside the result view (F5).
  - Strain is charged exactly once per ordinary roll, and at commit for set-dice
    and aim. Karma is charged once per interaction.
  - The OK view and the Knockdown result still show OK, focused on open. Enter or
    clicking OK closes. Enter with Apply applies, and Enter in a chooser commits
    when allowed.
  - The Apply and chooser views show `[Cancel] [Primary]` and the hint.
  - Escape closes only the roll modal, including over the Spells learn modal.
    That is fully verified after I10; before I10 it already holds, because the
    kit swallows Escape before Spells' bubble listener. For the same reason, an
    Enter on the roll modal no longer reaches Spells' `_onKey`, so K4 is
    already fixed at this item.
  - Day-reset's embedded roll (F3):
    - its ✕ and its OK return to the stats view (`roll-dismiss`);
    - Heal applies;
    - Escape dismisses;
    - it still focuses Heal or OK when the roll lands.
  - `role="dialog"` is present.
  - The baseline has no `ed-roll-modal.js` entry, and `npm test` is green.
- **Risks / unknowns:**
  - The 340px width with `[Cancel] [Apply]`, the kit hint and the existing hints
    may crowd the footer. The designer lays it out, and the mobile width is on
    the owner checklist.
  - After a cast or Knockdown hand-off, `ed-app` captures a trigger that is
    removed, so focus falls to `<body>` when the roll closes. This is unchanged
    from today.

### I7 — Migrate `ed-damage-modal`
- **Covers tickets:** T11
- **Rules:** none (preserves the Knockdown hand-off, per `rules.md`)
- **Tier:** 3
- **What:**
  - `input` kind on the frame, keeping the `<form>`. The primary **Apply** is the
    submit button.
  - `onConfirm` → `form.requestSubmit()`. `canConfirm` → Take > 0, which is the
    default "primary not disabled".
  - Add **Cancel** (D5). The frame hint replaces "Enter applies · Escape closes"
    (line 107).
  - `.hbtn` becomes `buttonCss`.
  - Keep `:host { display: contents }`, `layer` 2100, the root rendering
    (`ui/ed-overview.js:1013`, `ui/ed-combat.js:1521`) and the Knockdown hand-off
    `close({ restoreFocus: !roll })` (line 68).
- **Where:** `ui/ed-damage-modal.js`; `tools/ui-kit-baseline.json` (delete the
  `ed-damage-modal.js` entry).
- **Approach:** It is already on the controller, so this is a small rewrite of
  `render()`. The kit's `preventDefault` on a routed Enter stops a second native
  implicit submission.
- **Dependencies:** I3, I4. I6, so that "the roll modal is on top with focus
  inside it" holds.
- **Acceptance criteria:**
  - Enter applies when Take > 0 and is a no-op at 0.
  - The Knockdown hand-off puts the roll modal on top with focus inside it.
  - Cancel, ✕, backdrop and Escape close it with focus returned to the trigger.
  - It works the same from Overview and Combat.
  - `npm test` is green.
- **Risks / unknowns:** none beyond I6's.

### I8 — Migrate `ed-trade-modal`
- **Covers tickets:** T10
- **Rules:** none
- **Tier:** 3
- **What:**
  - `input` kind on the frame with its own controller. The primary is
    **Buy**/**Sell**, with `canConfirm: () => this._canConfirm()` and `onConfirm`
    → `_confirm`.
  - Initial focus: the primary when enabled, else Cancel (unchanged).
  - Enter in **Amount** confirms when allowed.
  - The "Define a gem" inputs get `data-enter="local"` plus a local Enter →
    `_addGem()`.
  - The coin ± buttons keep their own Enter.
- **Where:** `ui/ed-trade-modal.js` (listener 221–234, `firstUpdated` 236–241,
  CSS 74–107, render 282+); `tools/ui-kit-baseline.json` (delete the
  `ed-trade-modal.js` entry).
- **Approach:**
  - Delete the `document` listener, the frame and button CSS, and the `.mclose`
    raw `font-size: 1.1rem` (line 80; its one rule-4 hit).
  - **Also delete the local `--fs-*` redefinitions on `:host` (line 74).** They
    shadow the §3a scale, so the kit's `--fs-body` buttons and copy would render
    at 0.9rem here instead of 0.82rem. Removing them restores §3a (Tier 3). It is
    a slight visible size change in the trade dialog, and it is on the owner
    checklist.
  - Settings: `layer` 2150, width 27rem with a scrollable body.
  - Like I5, Confirm dispatches only `confirm`. Equipment's
    `_confirmTrade(e.detail)` uses the event detail, but it closes the trade
    itself.
- **Dependencies:** I3, I4.
- **Acceptance criteria:**
  - Type an amount and press Enter: the trade confirms when the allocation is
    valid, and Enter is a no-op when it is not.
  - Enter in the gem row adds the gem only.
  - Stacked over the Equipment item modal, Escape closes only the trade dialog.
    The kit already swallows it before Equipment's legacy listener; it is
    re-verified after I9.
  - The baseline has no `ed-trade-modal.js` entry, and `npm test` is green.
- **Risks / unknowns:**
  - The token removal is the only deliberate size change outside the
    frame/button unification. If the owner dislikes it, the fallback is to keep
    the overrides and accept the mismatch (not recommended: it breaks "one
    look").

### I9 — Migrate the Equipment item modal
- **Covers tickets:** T9
- **Rules:** none
- **Tier:** **1** for "read-only Enter closes" (**signed off, qa-log 11:53,
  D1**); 3 otherwise.
- **What:**
  - The item detail modal becomes `info` kind on the frame, with a `_modalCtl`.
  - ✕, backdrop and Escape go through the controller, and focus returns to the
    tile. This replaces `blur()` (M3).
  - The edit-mode actions (Equipped/Stored, Remove item) stay as body buttons.
  - Remove Equipment's `document` keydown listener.
  - Hosted modals stack above it: the swap confirm, and sell/buy via
    `ed-trade-modal`.
- **Where:** `ui/ed-equipment.js`; `tools/ui-kit-baseline.json` (delete the
  `ed-equipment.js` entry). Specific edits:
  - tile open with the event (668);
  - `_closeModal` (175–179) → `ctl.close()`;
  - ✕ and backdrop (976, 980) → `ctl.close()`;
  - after a full sell (514) → `ctl.close()`;
  - delete the listener (147–150, 163, 168);
  - delete the `blur()` calls in `_confirmSwap` (523), the swap `@close` (609),
    the trade `@close` (626) and `_closeUse` (737);
  - Remove item's inline style (1013) becomes a class;
  - the frame CSS (368–375) becomes `modalCss` plus a variant for magic (370,
    373);
  - `layer` 2000, width 30rem, scrollable body.
- **Approach:**
  - The add-item picker loses the `document` Escape fallback. To keep "Escape
    closes the picker" when focus has left the input:
    - move that branch to an element-level `@keydown` on `.addbar`, which covers
      the input and Done;
    - keep result rows from taking focus by cancelling **`@mousedown`** on
      `.res` (`@mousedown=${(e) => e.preventDefault()}`; F8), so focus stays in
      the input after a row click. Moving focus is a default action of
      `mousedown`, and browsers do not reliably suppress it when only
      `pointerdown` is cancelled. A `pointerdown` cancel may be added alongside,
      but not instead.

    `_pickKeydown` (↑/↓/Enter/Escape) and close-on-outside-pointerdown are
    unchanged.
  - The `blur()` removals let the confirm and trade controllers return focus to
    their triggers: Equipped/Stored, Remove item, or the row's Use/Drink.
- **Dependencies:** I3, I4. I5 and I8 for the stacked acceptance.
- **Acceptance criteria:**
  - Item modal → Remove item → sell dialog → Escape: only the sell dialog closes,
    and Escape again closes the item modal.
  - The same holds for the armour swap confirm: Swap is primary and Enter swaps;
    Escape keeps the current armour.
  - Enter on the item modal closes it and does not re-click the tile.
  - Focus returns to the tile, with no ring after a pointer open.
  - In edit mode, opening the modal does not focus Equipped/Stored or Remove, so
    Enter closes.
  - The add-item picker still closes on Escape from the input, from Done and
    after a row click, and on an outside pointerdown.
  - The baseline has no `ed-equipment.js` entry, and `npm test` is green.
- **Risks / unknowns:**
  - Selling the whole stack removes the tile, so focus cannot return and falls to
    `<body>`. Acceptable; note it in MODALS.md.

### I10 — Migrate the Spells modals (info, learn, cast)
- **Covers tickets:** T8
- **Rules:** none
- **Tier:** **1** for "info Enter closes" (**signed off, qa-log 11:53, D1**); 3
  otherwise.
- **What:** Remove the Spells `document` keydown listener (`_onKey`, 276–287 and
  301).
  - **Info:** `info` kind. The footer Close (980) is removed (D5), and Enter
    closes (D1). The circle pill goes in the title-extra slot.
    `_openDetail(s, e)` passes the trigger (883, 936).
  - **Learn:** `input` kind:
    - primary **Learn {spell}** in the karma tone, replacing the inline style at
      879;
    - `canConfirm` = `_learnCanConfirm()`;
    - `onConfirm` → `_confirmLearn` (whose `_learn = null` at 767 becomes
      `ctl.close()`);
    - `_openLearn(e)` passes the trigger (652, 913);
    - ✕, backdrop and Cancel go through the controller (784, 788, 878);
    - spell rows (`.lrow` buttons) and the Roll buttons keep their own Enter;
    - the Teacher-assist checkbox is a field (I1, F6): Enter on it confirms
      Learn only when allowed.
  - **Cast:** it moves onto the frame:
    - **Close** becomes **Cancel** (1293), per D5;
    - the number field's local Enter (1289) is replaced by the router;
    - `initialFocus: '.btn.primary'` (262) becomes `primarySelector`;
    - the Confirm hand-off `close({ restoreFocus: false })` (1138) and "Cast on
      nothing" → `close()` (1146) are kept.
- **Where:** `ui/ed-spells.js`; `tools/ui-kit-baseline.json` (reduce the
  `ed-spells.js` entry to rule 4: 5).
- **Approach:**
  - Use three controllers, or one controller per modal type. Each finds its own
    dialog (the I3 risk).
  - The Spells `button.btn` CSS (107, 108, 112) gives way to `buttonCss`. This
    also re-styles the tab-body "＋ Learn spell" button (913). That is a visible
    shape change, within the guidelines.
  - The learn footer when no spell is selected is the designer's call: Cancel
    plus a disabled Learn, or Cancel only. Initial focus on open is the selected
    row or the first spell row, because the primary is disabled.
  - The five raw `font-size` literals (88, 91, 120, 163, 212) stay. They belong
    to the V8 cleanup, which is deferred to the later non-modal feature (qa-log
    11:52). **Correction (F7):** four of them are tab-body styles (`.attn`,
    `.rm`, the two `.soontag` rules), but **`.lflag` (212, `font-size: 8px`,
    below the §3 floor `--fs-eyebrow`) is inside the Learn modal's spell rows**
    (the "can't cast yet" flag, line 800). It is kept under the same V8
    deferral, so the count stays at T4's 5, and it is not tokenised here.
- **Dependencies:** I3, I4. I6 for the learn → roll stack.
- **Acceptance criteria:**
  - With the roll modal open over the learn modal:
    - Escape closes only the roll modal, and the learn draft (teacher, roll
      result, fee) survives;
    - Enter acts only on the roll modal and never confirms the learn.
  - Enter on a focused spell row selects that row only.
  - Enter in the silver field confirms Learn only when allowed.
  - The cast hand-off still opens the roll modal with focus inside it.
  - Enter in the cast target field confirms.
  - Info: Enter closes and focus returns to the ⓘ.
  - `ed-spells.js`'s baseline is only rule 4: 5, and `npm test` is green.
- **Risks / unknowns:**
  - The learn modal is wide and two-pane. The designer checks the frame's width
    option and the mobile fold.

### I11 — Migrate the Disciplines modals
- **Covers tickets:** T12
- **Rules:** none
- **Tier:** **1** for "info Enter closes" (**signed off, qa-log 11:53, D1**); 3
  otherwise.
- **What:** Move every Disciplines modal onto `modalFrame`, keeping the single
  `_modalCtl` (256), whose `kind` is derived from `_modal.type`:
  - **Info** (talent, skill, knack, granted): `info` kind. Enter closes on
    purpose through the router, with initial focus on the dialog, not the ✕.
  - **Pickers** (halfmagic, learn, learn-skill, learn-knack): `picker` kind:
    - the `autofocus` targets are kept: the Half-Magic default option (833), the
      first talent option (994) and the search boxes (1037, 1133);
    - the fee fields (`.silin` 1043, 1139) and the knack parent `<select>` (1175)
      get `data-enter="local"`;
    - Enter in the search box is a no-op.
  - **Train** (advance): `confirm` kind:
    - primary **Train** (950), with `canConfirm` = `canTrain`;
    - initial focus is Train when allowed, otherwise the fee field (941);
    - the Train fee field (`.silin` 941) **also gets `data-enter="local"`**, the
      same as the other Disciplines fee fields (T12). Enter while editing the
      fee does nothing. It never spends Legend and silver by accident. Enter on
      Train, or with focus on the dialog, still trains;
    - the requirement row is unchanged.
- **Where:** `ui/ed-disciplines.js`:
  - modals at 388, 610, 639, 758, 823, 925, 983, 1030, 1126;
  - CSS 225–229;
  - `.mbtn` and `.mactions` become `buttonCss` and the frame footer;
  - `.mtitle` becomes the frame title (`--fs-value` → `--fs-title`).

  Also `tools/ui-kit-baseline.json` (delete the `ed-disciplines.js` entry).
- **Approach:**
  - Keep "close first, then dispatch" in `_learnPick`, `_learnSkillPick`,
    `_learnKnackPick`, `_advancePick` and `_rollHalfMagic`, so focus is restored
    before `ed-app` captures a roll trigger.
  - With the new initial-focus order, Train no longer focuses nothing when it is
    blocked.
  - The earlier draft had Enter in the Train fee field confirm Train (the
    generic input-field rule). That is replaced by `data-enter="local"`, which
    matches T12's wording, that the fee fields are marked `data-enter="local"`
    (no-op), and
    needs no new owner decision (F4). The trade Amount field differs on purpose:
    T10 asks for Enter there to confirm.
- **Dependencies:** I3, I4.
- **Acceptance criteria:**
  - The Half-Magic default option is still autofocused.
  - The Learn skill and Learn knack search is still autofocused.
  - Train opens with focus on Train when it is allowed, and on the fee field when
    it is blocked.
  - Enter in a fee field (Train, skill, knack) does nothing.
  - Picking an option closes the modal and focus returns to the trigger.
  - Info: Enter closes.
  - The Circle-track tooltip and the Train requirement row are unchanged.
  - The baseline has no `ed-disciplines.js` entry, and `npm test` is green.
- **Risks / unknowns:**
  - Nine templates. Keep each modal's body markup and only swap the frame, to
    limit drift.

### I12 — Docs, review status, changelog
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** **1** for UI-GUIDELINES §7 (**the D1 sentence is signed off, qa-log
  2026-11-18T11:53**); 3 for the rest.
- **What:**
  - **UI-GUIDELINES §7 (Tier 1, D1):**
    - replace "Read-only modals (like the current roll and ability modals) have
      no primary action, so Enter is a no-op there; wire it as soon as a modal
      gains an accept action." with "Read-only modals: Enter closes (it is their
      OK).";
    - add an italic sign-off note ("*§7 amended 2026-11-18 by owner sign-off
      (ui-kit-modal-keyboard-contract qa-log, D1).*");
    - **nothing else changes in §7** (qa-log 13:42). "Escape closes only the top
      modal" and "Ctrl/⌘+Enter saves in textarea modals" are documented in
      MODALS.md only. The Ctrl/⌘+Enter line joins §7 in the second feature,
      under that feature's own sign-off.
  - **MODALS.md rewrite:**
    - the kit and its four files;
    - the stack and the **ordered** router rules (I1), including the
      `data-enter="local"` marker, checkboxes and radios as fields, the
      key-repeat rule, the key latch, and the transitional foreign-dialog rule;
    - controller options and the legacy-neutral default (I3);
    - the initial-focus order;
    - `modalFrame`, layers and widths;
    - the footer and hint conventions (D5, V4), including **the roll-modal OK
      exception**: the roll result view and the Knockdown result keep a visible
      OK (the frame's `ack` option), while every other read-only modal is ✕ only
      (qa-log 13:40);
    - "Escape closes only the top modal" and "Ctrl/⌘+Enter saves in textarea
      modals" as kit rules (qa-log 13:42);
    - the dirty-guard rule (D3: free-text modals ask, short numeric or choice
      modals don't);
    - `light` mode;
    - hand-offs (and the known "trigger gone → `<body>`" cases);
    - an updated checklist, from the review's migrated-modal checklist;
    - **a "Not yet on the kit" list (F9)**, so the known code/doc gap is written
      down and not silent. It names the modals that still follow the old
      behaviour, where Enter on a read-only modal re-clicks the trigger, so the
      new §7 sentence does not hold for them yet:
      - the Overview ⓘ info, character details and Legend spent modals;
      - Karma Ritual and the lightbox;
      - `ed-add-legend` and `ed-edit-meta`;
      - Notes;
      - the Combat step audit;
      - `ed-custom-item` and `ed-day-reset`;
      - `ed-character-picker`, `ed-settings`, `ed-save-key` and `ed-conflict`;
      - `ed-changelog` and `ed-homebrew`.

      Each is migrated by the second feature (qa-log 12:01). The list shrinks as
      that feature lands;
    - no reference to `ui/modal-controller.js`.
  - **GUARDRAILS.md PR checklist:** one line, "Modals and modal-like UI use
    `ui/kit/`; the UI-kit check passes" (D8).
  - **ARCHITECTURE.md §8 layout (Tier 3, design-agent):** replace the
    `modal-controller.js` line (568) with a `kit/` block (`modal-stack.js`,
    `modal-controller.js`, `modal.js`, `button-css.js`), and add
    `tools/check-ui-kit.mjs` plus the baseline.
  - **CLAUDE.md:51** source-of-truth map: "shared `ui/modal-controller.js`"
    becomes `ui/kit/`. This is an owner-visible file. If the build may not edit
    it, the Dev Lead lists the one-word change in `build-log.md` for the owner.
  - **docs/UI-CONSISTENCY-REVIEW.md** status table:
    - mark **fixed**: K1, K2 and K4;
    - mark **fixed for this build's modals, remainder in feature 2**: K3, K6,
      M1, M2, M3, V1, V2, V3 and V4;
    - mark **decided, with kit support shipped**: K8 (D2) and K9 (D3);
    - mark **built**: U1 (D7/D8 decided);
    - leave K5, K7, K10, M4 and V5–V8 open;
    - add the same "not yet on the kit" note beside K3, K6 and M1 (F9).

    The file is untracked; stage it by explicit path.
  - **Changelog:** add one `improved` line to `data/changelog.json`
    `unreleased.changes`. For example: "Modals now share one keyboard contract:
    Enter = OK, Escape closes only the top dialog, and focus stays inside and
    returns to the button that opened it. Applies to the roll, confirm, trade,
    Take damage, Spells, Equipment item and Disciplines modals, which now share
    one look."
- **Where:**
  - `docs/UI-GUIDELINES.md` §7;
  - `docs/MODALS.md`;
  - `docs/GUARDRAILS.md` (PR checklist);
  - `ARCHITECTURE.md` §8;
  - `CLAUDE.md:51` (owner);
  - `docs/UI-CONSISTENCY-REVIEW.md`;
  - `data/changelog.json`.
- **Approach:** Lands in the same build as I1–I11. The Dev Lead may fold the §7
  edit into I6, the first item where a read-only Enter closes, to shorten the
  window where code and doc disagree.
- **Dependencies:** I1–I11 (the docs describe what shipped).
- **Acceptance criteria:**
  - The §7 text matches the I1 router (read-only Enter closes), and the D1
    sentence is §7's only change.
  - MODALS.md documents the roll-modal OK exception, Escape top-only and
    Ctrl/⌘+Enter, and lists the modals not yet on the kit (F9).
  - MODALS.md has no reference to `ui/modal-controller.js`.
  - The PR checklist has the kit line.
  - The review status table marks what this build fixed.
  - The changelog line is a `{type, text}` object.
  - `npm test` is green, including `plans-status`, `release` and changelog
    tests.
- **Risks / unknowns:** none. The §7 scope is settled (qa-log 13:42).

## Sequencing

1. **I1 Modal stack + router.** Pure, with no dependencies. It is the testable
   core everything else routes through.
2. **I2 UI-kit check + baseline.** It locks today's counts before any migration,
   so every later item must ratchet its own file down in the same change.
3. **I3 Controller move + upgrade.** It needs the router. It is legacy-neutral,
   so the three current users don't change, and it fixes the import walkers for
   `ui/kit/`.
4. **I4 Frame and CSS.** It needs the controller API and the hint helper. There
   is no visible change yet.
5. **I5 `ed-confirm` pilot.** It proves the frame on the most-shared modal (five
   hosts). Because the kit swallows handled keys, it already fixes the swap and
   Notes confirm stacks.
6. **I6 `ed-roll-modal`.** The highest-impact fix (K2). It must precede I7 and
   I10, whose acceptance needs the roll modal on top.
7. **I7 `ed-damage-modal`.** Small. It needs I6 for the Knockdown hand-off.
8. **I8 `ed-trade-modal`.** Standalone. It must precede I9's stacked
   acceptance.
9. **I9 Equipment item modal.** It needs I5 and I8 for "Escape closes only the
   top" over swap and sell.
10. **I10 Spells.** It needs I6 for learn → roll.
11. **I11 Disciplines.** Last migration. It is already on a controller, so it is
    the lowest-risk.
12. **I12 Docs, review status, changelog.** Same build. The §7 edit may move up
    into I6.

After I11, `tools/ui-kit-baseline.json` holds only second-feature files plus
`ed-spells.js` rule 4: 5, `ed-app.js` rule 5: 1 and `legend-spent-view.js`
rule 4: 2.

**Entries that outlive the second feature (F7).** The second feature (qa-log
12:01) migrates the remaining modals and removes their entries, but it
**inherits** three entries that belong to the V8 cleanup in the later non-modal
feature (qa-log 11:52):
- the `ed-spells.js` rule-4 ×5 entry: `.attn`, `.rm`, the two `.soontag` rules,
  and `.lflag` inside the Learn modal;
- the `legend-spent-view.js` rule-4 ×2 entry;
- the `ed-app.js` rule-5 ×1 entry, the "Choose a character" stub. It sits on the
  §6a picker path, so the second feature may absorb it.

So the allowlist **empties in that later V8 cleanup, not in the second feature**,
unless the next planning round chooses to absorb these entries. qa-log 12:01's
"empties the baseline allowlist" is left as recorded. This note is the
correction to carry into that planning round.

## Owner manual checklist (for `build-log.md`, on `dev`)

- Every migrated modal, in light and dark mode and at mobile width:
  - confirm (swap, drink, discard, switch character, Notes delete, Combat clear);
  - roll (OK, Apply, set-dice, aim);
  - Take damage (Overview and Combat);
  - trade (buy and sell);
  - Equipment item (read and edit mode, magic item);
  - Spells info, learn and cast;
  - every Disciplines modal.
- **Stacked Escape:**
  - Equipment item → Remove → sell;
  - item → Equipped → swap;
  - Spells learn → Roll Patterncraft → roll.

  Escape closes only the top each time, and the next Escape closes the one
  below.
- **Held keys (F2):**
  - holding Escape on a two-modal stack closes only the top;
  - holding Enter on a dice button opens exactly one roll;
  - holding Enter on the roll's OK, or on Cancel, closes it once and does not
    reopen it;
  - Strain is charged once and no duplicate Discord report is sent.
- **Roll modal (I6):**
  - the result view and the Knockdown result still show OK, focused on open;
    Enter closes;
  - Apply, set-dice and aim show `[Cancel] [Primary]` and the hint;
  - Enter on Apply applies;
  - Enter in set-dice commits;
  - Enter in aim commits only once a target is entered;
  - after a chooser commits, focus is inside the result view;
  - toggling Karma charges it once;
  - unticking an optional-mod checkbox still works, and Enter on it doesn't
    close the modal.
- **Day-reset embedded roll (F3):**
  - its ✕ and OK return to the stats view;
  - Heal applies;
  - Escape dismisses the roll, and a second Escape closes the day-reset modal.
- **Take damage (I7):** Enter at Take 0 does nothing; Enter at Take > 0 applies;
  Cancel closes; after the Knockdown hand-off, focus is inside the roll. Check
  it from both Overview and Combat.
- **Trade (I8):**
  - Enter in Amount confirms only when the allocation is valid;
  - Enter in the gem row only adds the gem;
  - the coin ± buttons work from the keyboard.
- **Equipment (I9):**
  - Enter on the item modal closes it without re-clicking the tile;
  - in edit mode, opening the modal doesn't focus Equipped/Stored or Remove;
  - in the add-item combobox:
    - ↑/↓ and Enter work;
    - Escape closes it from the input, from Done and after a row click;
    - an outside click closes it.
- **Spells (I10):**
  - Enter on a spell row only selects it;
  - Enter in the silver field confirms Learn only when allowed;
  - the learn draft survives an Escape on the roll above it;
  - Enter in the cast target field confirms;
  - the cast → roll hand-off has focus inside the roll;
  - info Enter closes.
- **Disciplines (I11):**
  - the Half-Magic default option is autofocused;
  - the Learn skill and Learn knack search is autofocused, and Enter in it does
    nothing;
  - Train focuses Train when allowed, and the fee field when blocked;
  - Enter in any fee field (Train, skill, knack) does nothing;
  - info Enter closes;
  - the Circle-track tooltip and the Train requirement row are unchanged.
- **Legacy modals still behave, under the new global listener:**
  - §8a Settings: Enter saves from a field, from the switches and from the radio
    group; Escape discards;
  - a Notes note modal: Escape closes it; the Notes delete confirm over it closes
    alone on Escape;
  - Combat clear-log and drink confirms;
  - Overview info, Karma Ritual and Add Legend close on Escape;
  - the §6a picker: Enter confirms the focused row.
- Focus returns to the trigger with no stuck ring after a pointer open, and the
  ring is kept after a keyboard open.
- §6a: "Load a different character?" → Continue opens the picker with the first
  row focused.
- Visible changes are deliberate:
  - modal titles are larger (`--fs-title`);
  - buttons have one shape;
  - Take damage has Cancel;
  - the Spells cast modal says Cancel, and Spells info has no Close;
  - the trade dialog's text is slightly smaller (§3a tokens);
  - the "＋ Learn spell" button has the new shape;
  - the roll Apply and chooser views gain Cancel, and the roll OK button stays;
  - the aim chooser's Roll is amber instead of karma green, because the aim
    spends no Karma (V2; F5).
- The Overview still fits the viewport.

## Open questions

**Resolved owner questions** (raised by the planner as `NEEDS_HUMAN`):
1. **Roll modal OK button under D5.** Resolved at qa-log 2026-11-18T13:40:
   **keep OK as an exception.** The roll result view and the Knockdown result
   keep a visible OK, and Enter = OK closes it. Every other read-only modal is ✕
   only. Apply and the dice/aim choosers get `[Cancel] [Primary]`. This reverses
   the draft's default, and is applied in I4 (`ack` option), I3 (initial
   focus), I6, I12 and the owner checklist.
2. **§7 sign-off scope.** Resolved at qa-log 13:42: §7 gets **only** the D1
   sentence. "Escape closes only the top modal" and Ctrl/⌘+Enter go in
   MODALS.md, and Ctrl/⌘+Enter joins §7 in the second feature under its own
   sign-off. This matches the draft's default, and is applied in I12 and the
   guardrail table.

No owner question is open.

**Design details** (non-blocking; the designer resolves them at spec time):
- Rule-3 counting unit: whether compound selectors on a frame class
  (`button.btn.danger`, `.modal.magic`) count, and the exact variant hook for
  Equipment's magic item.
- Whether Ctrl/⌘+Enter outside a textarea behaves like Enter. This build
  recommends yes.
- Whether the router's swallow case is a fourth string (`'block'`) or a flag.
- Later improvement, not this build:
  - carry the original trigger through cast → roll and damage → Knockdown roll
    hand-offs, so focus doesn't fall to `<body>` when the roll closes;
  - restore focus after Apply-closes.

## Review responses

This is the single review pass (`review.md`): no blockers, 4 major and 7 minor
findings. **All 11 are fixed; none is disputed.**

| Finding | Sev | Resolution |
|---|---|---|
| **F1** — the I2 baseline leaves out `ui/modal-controller.js`; no ratchet rule for moved or deleted files | major | **Fixed.** <ul><li>I2's starting baseline adds `ui/modal-controller.js` r1: 2 (`:42` window, `:134` document), since the file is still an ordinary `ui/` file when I2 lands.</li><li>Rule 2 is defined as the attribute form only, so the selector string `'[role="dialog"]'` (`:113`) gives r2 = 0. It gets its own fixture.</li><li>New ratchet rule with a fixture: a baseline entry for a file that does not exist fails with "remove stale entry for <file>". A file moved outside `ui/kit/` carries its entry; a move into `ui/kit/` or a deletion removes it.</li><li>I3's dependency note now says it deletes the entry in the same change.</li><li>The Discoveries table gains the row. A comment-stripped recount matched every other row.</li></ul> |
| **F2** — router precedence unstated; a held key can chain close → reopen | major | **Fixed.** <ul><li>I1's rules are now an explicit ordered list, first match wins: non-Enter/Escape keys, `isComposing`, latch, empty stack, foreign dialog, `repeat`, `defaultPrevented`, target outside the top (never pass; modified Enter is swallowed), Escape, Shift/Alt, Ctrl/⌘+textarea, own-control, primary, then kind.</li><li>A **key latch** is added: a plain fact computed by the I3 listener from keydown/keyup tracking. It swallows repeats of a key held through any kit close or confirm, even with an empty stack.</li><li>New tests in I1 and I3: held Escape on a two-entry stack, a latched Enter with an empty stack (OK and Cancel), and Shift+Enter or picker Enter behind an open modal are swallowed.</li><li>New acceptance criteria in I6, and items in the checklist.</li></ul> |
| **F3** — routing `_close` through the controller breaks day-reset's embedded ✕/OK | major | **Fixed.** <ul><li>I6 now states that embedded mode keeps `_close()` dispatching `close` directly. Only the framed views go through `ctl.close()`.</li><li>Acceptance criteria and checklist added: the embedded ✕ and OK return to stats; Heal applies; Escape dismisses.</li></ul> |
| **F4** — the owner checklist misses most untestable DOM behaviour | major | **Fixed.** <ul><li>The checklist is regrouped by modal (I6–I11), plus held keys, day-reset embedded, Karma once, and a legacy-modal smoke pass (§8a Settings including switches and radios, Notes and its confirm, Combat confirms, Overview modals, §6a picker).</li><li>**Train fee field:** made `data-enter="local"`, consistent with T12's fee fields, so Enter in it does nothing. This replaces the draft's "Enter in the fee field trains". No owner decision is needed, so no `NEEDS_HUMAN`.</li></ul> |
| **F5** — focus lost after a chooser commits; primary tones unspecified | minor | **Fixed.** <ul><li>I3 adds `ctl.refocus()`. I6 calls it when the chooser view changes to the result, with an acceptance criterion and a checklist item.</li><li>I6 names the tones per V2: set-dice Roll ✦ N karma, aim Roll amber (it spends no Karma; added to visible changes), Apply amber, OK neutral.</li></ul> |
| **F6** — a global "checkbox → pass" rule conflicts with §8a | minor | **Fixed.** <ul><li>The router now treats checkboxes and radios as fields.</li><li>The roll modal marks its optional-mod checkboxes `data-enter="local"`, which meets T7.</li><li>Tests are added in I1. The §8a preservation note and the MODALS.md item are updated.</li><li>The Spells Teacher-assist checkbox is noted as a field.</li></ul> |
| **F7** — `.lflag` is modal code; the second feature cannot empty the baseline | minor | **Fixed (kept under the V8 deferral; description corrected).** <ul><li>I10 now says `.lflag` (`:212`, 8px, below the §3 floor) is inside the Learn modal's spell rows (`:800`), and it stays deferred with the other V8 literals (qa-log 11:52). The count stays 5.</li><li>Sequencing adds "Entries that outlive the second feature": Spells r4 ×5, `legend-spent-view.js` r4 ×2, `ed-app.js` r5 ×1. The allowlist empties in the later V8 cleanup, not in feature 2.</li><li>qa-log 12:01 is left unchanged, and the correction is recorded for the next planning round.</li></ul> |
| **F8** — cancelling `pointerdown` may not keep focus in the combobox input | minor | **Fixed.** I9 now cancels `@mousedown` on `.res` (`pointerdown` only as an addition). The row-click Escape case is on the checklist. |
| **F9** — the new §7 sentence ships before the legacy read-only modals follow it | minor | **Fixed.** I12 adds a "Not yet on the kit" list to MODALS.md, naming every second-feature modal and the feature that migrates it, plus a matching note in the review doc's status table. Acceptance criterion added. |
| **F10** — the `picker` frame is unspecified | minor | **Fixed.** I4 states that a picker frame is ✕ only, with no footer button and no hint (as today; consistent with D5/V4). Acceptance criterion added. |
| **F11** — the new focus order changes Disciplines before I11 | minor | **Fixed.** The new initial-focus order applies only to controllers with a `kind`. A controller with no `kind` keeps today's order, as well as unrouted Enter, so I3 is truly legacy-neutral apart from Escape becoming top-only. I3's text, its acceptance criterion and the guardrail table row are updated. |

## Q&A log reference

See `qa-log.md` for the full interrogation record.
