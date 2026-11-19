# Feature: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Summary
Modals behave differently on every tab because each one copies its own Escape and
Enter handling. The results: one Escape closes a whole stack of modals; Enter
re-clicks the dice button behind the roll modal; Enter does nothing once the user
clicks into a field. This feature builds a small in-repo UI kit (`ui/kit/`):
- a modal stack and key router;
- an upgraded `ModalController`;
- a shared modal frame and button styles;
- a `npm test` check that enforces the kit.

It then moves the high-severity modals onto the kit, so that **Enter = OK and
Escape = Cancel** for the top modal only. Source analysis:
[docs/UI-CONSISTENCY-REVIEW.md](../../docs/UI-CONSISTENCY-REVIEW.md) (U1;
findings K1–K6, K8, K9, M1–M4, V1–V4).

## Goals / Non-goals
- **Goal:** one implementation of the modal keyboard and focus contract, in `ui/kit/`, enforced by `tools/check-ui-kit.mjs` in `npm test`.
- **Goal:** for every modal migrated in this build:
  - Escape cancels the **top** modal only;
  - Enter = OK: the primary action, or close for read-only modals (D1, signed off);
  - Ctrl/⌘+Enter saves in textarea modals (D2: kit support only; no textarea modal is migrated in this build);
  - focus moves in, Tab is trapped, and focus returns to the trigger.
- **Goal:** one modal look: frame, header (title at `--fs-title`), footer `[Cancel] [Primary]` with a key hint on input modals, ✕ only on read-only modals, and one button shape with tab colour tones.
- **Goal:** move these modals onto the kit: `ed-confirm`, `ed-roll-modal`, the Spells modals (info, learn, cast), the Equipment item modal, `ed-trade-modal`, `ed-damage-modal`, and every Disciplines modal.
- **Non-goal (second feature, planned next):** migrating the remaining modals:
  - Overview info, Karma Ritual and lightbox;
  - `ed-add-legend`, `ed-edit-meta`;
  - Notes;
  - the Combat step audit;
  - `ed-custom-item`, `ed-day-reset`;
  - `ed-character-picker`, `ed-settings`, `ed-save-key`, `ed-conflict`;
  - `ed-changelog`, `ed-homebrew`.

  That feature uses D2 and D3 for real and empties the baseline allowlist.
- **Non-goal (later picker/cleanup feature):** picker keyboard navigation (K7), inline-field Escape/Enter (K10), the spell-removal confirm (V5), the potion helper (V6), clear-log wording (V7), and colour tokens on `:root` plus the other V8 items.
- **Non-goal:** no change to the engine, character data, `rules/*.json`, the taxonomy, or any schema.

## Guardrail alignment
Docs touched:
- UI-GUIDELINES §7 (Tier 1, signed off);
- MODALS.md (rewritten for the kit);
- GUARDRAILS.md PR checklist (one line, D8);
- the design-agent may propose an ARCHITECTURE.md note on `ui/kit/` at build time.

Architecture rule: the kit is DOM-only plumbing. It never dispatches game events
and never mutates character state. Hosts pass `onConfirm`/`onClose` callbacks and
keep data-down / dispatch-up. The key-routing core is pure and DOM-free.

| Ticket | Tier | Sign-off |
|---|---|---|
| T1 Modal stack + key router | 3 | — |
| T2 ModalController upgrade | 3 | — |
| T3 Modal frame + button CSS | 3 | — (title size restores §3a; tones kept per qa-log 11:58) |
| T4 UI-kit check script | 3 | — (D8, qa-log 11:59) |
| T5 Docs | **1** (§7 part) / 3 | **Signed off — qa-log 2026-11-18T11:53 (D1)** |
| T6 `ed-confirm` | 3 | — |
| T7 `ed-roll-modal` | **1** (OK view: Enter closes) / 3 | **Signed off — qa-log 11:53 (D1)** |
| T8 Spells modals | **1** (info: Enter closes) / 3 | **Signed off — qa-log 11:53 (D1)** |
| T9 Equipment item modal | **1** (read-only: Enter closes) / 3 | **Signed off — qa-log 11:53 (D1)** |
| T10 `ed-trade-modal` | 3 | — |
| T11 `ed-damage-modal` | 3 | — |
| T12 Disciplines modals | **1** (info: Enter closes) / 3 | **Signed off — qa-log 11:53 (D1)** |

No Tier-2 item. No ticket is `BLOCKED`.

**Behaviour that must not change** (Tier-1 rules that this feature keeps):
- §6a picker: first row autofocused, Enter confirms, Escape/backdrop closes.
- §8 conflict: Keep mine is primary, Enter confirms.
- §8a Settings: Enter saves.
- Equipment armour swap: Swap is primary (Enter); Escape keeps the current armour.
- Strain on roll is charged once.
- Pointer opens leave no focus ring on the trigger; keyboard opens keep it.
- Light and dark mode both work.
- The Overview still fits the viewport.

## Tickets

### T1 — Pure modal stack + key router
- **What:** `ui/kit/modal-stack.js`, pure and DOM-free:
  - a stack (`push(entry)`, `remove(entry)`, `top()`);
  - `routeKey(facts) → 'close' | 'confirm' | 'pass'`.

  `facts` is plain data: `key`, `ctrlKey`/`metaKey`/`shiftKey`/`altKey`,
  `isComposing`, `defaultPrevented`, the target's tag/type/role, whether the
  target is the primary control, and the top modal's `kind`
  (`input | confirm | info | picker`) and `canConfirm`. Tests in
  `ui/kit/modal-stack.test.js`.
- **Why:** K1 (one Escape closed the whole stack) and K3–K5 (Enter depended on
  focus), with a testable core. The repo has no DOM test library.
- **Tier:** 3.
- **Acceptance criteria:**
  - Escape → `close` for the top entry only. Lower entries are untouched.
  - Enter in `input`/`confirm` → `confirm` when `canConfirm`; `pass` (no-op) when it can't.
  - Enter in `info` → `close` (D1).
  - Enter in `picker` → `pass`, so a focused option button activates natively and Enter in a search box does nothing.
  - Enter → `pass` when the target is:
    - a `<textarea>`, a `<select>`, or a link;
    - a button / `[role=button]` that is **not** the primary control;
    - an element marked as handling its own Enter (e.g. `data-enter="local"`).

    Enter also passes when `isComposing` (IME) or `defaultPrevented` is set.
  - Ctrl/⌘+Enter in a `<textarea>` → `confirm` (D2).
  - Shift/Alt+Enter → `pass`.
  - With an empty stack, every key → `pass`.
  - Unit tests cover every row above.
- **Open questions:** none.

### T2 — ModalController upgrade, moved into the kit
- **What:** move `ui/modal-controller.js` → `ui/kit/modal-controller.js` and
  update every import. Then:
  - Use **one** module-level `document` keydown listener that asks
    `modal-stack.routeKey` and acts on the top controller only.
  - `opened(trigger)` pushes the controller; `close()` removes it.
  - New options:
    - `kind` (`input | confirm | info | picker`);
    - `onConfirm`, `canConfirm`;
    - `primarySelector`, used for initial focus and to tell the router which control is the primary;
    - `isDirty` + `onDiscardPrompt`: the D3 hook. Supported now; first used in the second feature;
    - `light`: for portal hosts that render into `document.body`. Supported now; used in the second feature.
  - Keep: focus-in, the Tab trap, return focus to the trigger (no ring after a
    pointer open), `close({ restoreFocus: false })` hand-offs, and the exported
    `currentModality`, `deepActiveElement` and `returnFocusToTrigger`.
- **Why:** M1 and M3. One place owns the contract.
- **Tier:** 3.
- **Acceptance criteria:**
  - Two stacked controllers: Escape closes only the top one, and the next Escape closes the one below.
  - A hand-off (`close({ restoreFocus: false })` followed by `opened()` on another) leaves the new modal on top.
  - Disconnecting a host with an open modal removes its stack entry.
  - The current controller users (`ed-disciplines`, the Spells cast modal, `ed-damage-modal`) keep working.
  - With `isDirty()` true, Escape, ✕ and backdrop call `onDiscardPrompt` instead of closing.
  - `npm test` (including `check-imports`) is green.
- **Open questions:** none.

### T3 — Modal frame, modal CSS, button CSS
- **What:**
  - `ui/kit/modal.js` exports `modalFrame(ctl, opts)`, a Lit template rendered
    in the host's own shadow root, and `modalCss`. The frame renders:
    - the backdrop (click → `ctl.close()`);
    - the dialog with `role="dialog"`, `aria-modal="true"` and `aria-label`;
    - a header with the title at `--fs-title`, an optional extra title slot (e.g. the Spells circle line), and ✕;
    - the body;
    - for `input`/`confirm` only: a footer `[extra…] [Cancel] [Primary]`, right-aligned, primary last (D5), with a muted hint — "Enter = OK · Esc = Cancel", or "Ctrl+Enter saves · Esc = Cancel" when the modal has a textarea (V4);
    - for `info`: no footer button, ✕ only (D5).
  - `ui/kit/button-css.js` exports `buttonCss`: `.btn` and `.btn.primary` with
    one shape (radius, padding, `--fs-body`, weight 500 for primary), plus tones
    `.danger`, `.spell`, `.karma`, `.heal`. Amber `--accent` is the default (V2,
    tones kept per qa-log 11:58).
- **Why:** M2, M4, V1–V4. One frame instead of about 20 copies.
- **Tier:** 3. Visible changes stay within the guidelines; the title size restores §3a.
- **Acceptance criteria:**
  - All sizes are `--fs-*` tokens; weights are 400/500 only.
  - Every colour comes from `light-dark()` or host variables (theme-aware).
  - Hosts that use a `<form>` can make the primary a submit button, so native submit and validation still work.
  - Disabled primary → `canConfirm` false, and Enter is a no-op.
- **Open questions:** none.

### T4 — `tools/check-ui-kit.mjs` (enforcement)
- **What:** a pure analyzer plus CLI wrapper, with
  `tools/check-ui-kit.test.js` on in-memory fixtures and a baseline file
  `tools/ui-kit-baseline.json`. Add it to `pretest` next to `check-imports.mjs`.
  Outside `ui/kit/` it flags:
  1. `document`/`window` `addEventListener('keydown'|'keyup'`;
  2. a literal `role="dialog"` / `role="alertdialog"`;
  3. CSS rules defining `.overlay`, `.modal`, `.mhead`, `.mclose` or `button.btn`;
  4. a raw `font-size` literal that is not a `--fs-*` token;
  5. an inline `style=` on a `<button>`.

  The baseline maps file → allowed count per rule. Any count above the baseline
  fails. Any count below the baseline also fails, with "lower the baseline to N"
  (a ratchet, so the allowlist shrinks honestly).
- **Why:** D7/D8. Conventions alone have drifted.
- **Tier:** 3.
- **Acceptance criteria:**
  - After this build, the baseline contains **no** entries for the T6–T12 files (`ed-confirm`, `ed-roll-modal`, `ed-spells`, `ed-equipment`, `ed-trade-modal`, `ed-damage-modal`, `ed-disciplines`). Only second-feature files remain.
  - Exception: `ed-spells.js` keeps **5** rule-4 (raw `font-size`) entries. These are tab-body styles outside modal code — `.attn`, `.rm`, two `.soontag` and `.lflag`, at lines 88, 91, 120, 163 and 212 — and V8 fixes them in a later feature. `ed-trade-modal`'s single literal is its `.mclose` style, which the migration removes, so `ed-trade-modal` ends with 0.
  - The test proves each rule fires on a fixture and that the ratchet fails both ways.
- **Open questions:** none.

### T5 — Docs
- **What:**
  - **UI-GUIDELINES §7 (Tier 1, signed off D1):** only one change — read-only
    modals: Enter closes (it is their OK). Drop "(like the current roll and
    ability modals) … no-op". Nothing else is added to §7 in this build (qa-log
    13:42).
  - **MODALS.md rewrite:**
    - the kit;
    - "Escape closes only the top modal" and Ctrl/⌘+Enter saves in textarea modals (D2) — documented here, not in §7 (qa-log 13:42);
    - the roll-modal OK exception to the ✕-only footer rule (qa-log 13:40);
    - the stack and router table (T1);
    - controller options (T2);
    - `modalFrame` and the footer/hint conventions (D5, V4);
    - the dirty-guard rule (D3: free-text modals ask; short numeric/choice modals don't);
    - the `light` mode;
    - an updated checklist.
  - **GUARDRAILS.md PR checklist:** one line — "Modals and modal-like UI use `ui/kit/`; the UI-kit check passes" (D8).
- **Why:** if code and docs disagree, that is a bug (CLAUDE.md).
- **Tier:** 1 for the §7 text (**signed off, qa-log 2026-11-18T11:53**); 3 for the rest.
- **Acceptance criteria:**
  - The §7 text matches the T1 router behaviour.
  - MODALS.md has no reference to the old `ui/modal-controller.js` path.
  - The review doc's status table marks the items this build fixes.
- **Open questions:** none.

### T6 — Migrate `ed-confirm` (pilot)
- **What:** rebuild on `modalFrame` (`kind: 'confirm'`). Tone `danger`
  (default) or `accent` maps to `buttonCss` tones. `disabled` →
  `canConfirm: false`, focus on Cancel. Keep the public API unchanged
  (`heading`, `message`, `warn`, `confirmLabel`, `tone`, `disabled`, events
  `confirm`/`close`), so the hosts (Notes, Combat, Equipment, `ed-app`) need no
  change beyond what their own tickets do.
- **Why:** used in five places; it proves the frame.
- **Tier:** 3.
- **Acceptance criteria:**
  - Enter confirms; Escape, ✕ and backdrop close.
  - A blocked confirm can't be confirmed by Enter.
  - The confirm stacks correctly over the Equipment item modal: Escape closes only the confirm (K1).
  - Focus returns to the trigger.
- **Open questions:** none.

### T7 — Migrate `ed-roll-modal`
- **What:** the non-embedded views use `modalFrame` and a controller:
  - **result view:** `info` kind when there is only OK; `input` kind with primary **Apply** when `apply` is set (except `knockdown-result`, which stays OK). **Exception to D5:** the OK-only result view and the Knockdown result keep their visible **OK** button (qa-log 13:40); Enter closes it;
  - **set-dice chooser:** primary **Roll ✦ N**;
  - **aim chooser:** primary **Roll**, `canConfirm` = a target is entered.

  Focus moves to the primary on open, and Tab is trapped. The other buttons
  (Karma toggle, Add die, ± dice, optional-mod checkboxes) keep their own Enter
  (router `pass`).

  `embedded` mode (inside `ed-day-reset`) is **unchanged**: no frame, no stack
  entry, the host owns the keys. `ed-app` keeps the trigger restore (or hands it
  to the controller) with identical behaviour.
- **Why:** K2. The roll modal is the most-used modal and the least consistent.
- **Tier:** 1 for "Enter closes the OK view" (signed off D1); 3 otherwise.
- **Acceptance criteria:**
  - While the roll modal is open, Enter never reaches the trigger behind it: no second `ed-roll`, no new `rollId`, no early Discord flush.
  - Strain is charged exactly once per ordinary roll (and at commit for set-dice and aim).
  - Enter on OK closes; Enter with Apply applies; Enter in the choosers commits when allowed.
  - Escape closes only the roll modal, even when it is opened over the Spells learn modal.
  - Day-reset's embedded roll still works.
  - `role="dialog"` is present.
- **Open questions:** none.

### T8 — Migrate the Spells modals (info, learn, cast)
- **What:** remove the Spells `document` keydown listener.
  - **Info modal:** `info` kind; the footer **Close** button is removed (D5); Enter closes (D1).
  - **Learn modal:** `input` kind.
    - Primary: **Learn {spell}**, karma tone.
    - `canConfirm` = `_learnCanConfirm()`.
    - Spell rows and Roll buttons keep their own Enter (router `pass`).
  - **Cast modal:** already uses a controller; moves onto the frame. **Close** becomes **Cancel** (D5). The target-number field's local Enter handler is replaced by the router (Enter = Confirm). The roll hand-off on Confirm is kept.
- **Why:** K1 and K4. Escape and Enter under the roll modal acted on the learn modal.
- **Tier:** 1 for "info Enter closes" (signed off D1); 3 otherwise.
- **Acceptance criteria:**
  - With the roll modal open over the learn modal:
    - Escape closes only the roll modal, and the learn draft survives;
    - Enter acts only on the roll modal and never confirms the learn.
  - Enter on a focused spell row selects that row only.
  - The cast hand-off still opens the roll modal with focus inside it.
- **Open questions:** none.

### T9 — Migrate the Equipment item modal
- **What:**
  - The item detail modal becomes `info` kind on the frame. Its edit-mode
    actions (Equipped/Stored, Remove item) stay as body buttons, not footer
    buttons.
  - ✕, backdrop and Escape all go through the controller, and focus returns to
    the item tile. This replaces `blur()` (M3).
  - Remove Equipment's `document` keydown listener. The add-item combobox keeps
    its input-level keys (↑/↓/Enter/Escape) and its close-on-outside-pointerdown.
  - Hosted modals (swap and drink via `ed-confirm`, sell/buy via
    `ed-trade-modal`) stack above it.
- **Why:** K1 (seen in the app: Escape closed the sell dialog and the item modal), K6, M3.
- **Tier:** 1 for "read-only Enter closes" (signed off D1); 3 otherwise.
- **Acceptance criteria:**
  - Item modal → Remove item → sell dialog → Escape: only the sell dialog closes. Escape again closes the item modal.
  - The same holds for the armour swap confirm.
  - Enter on the item modal closes it and does not re-click the tile.
  - Focus returns to the tile, with no ring after a pointer open.
- **Open questions:** none.

### T10 — Migrate `ed-trade-modal`
- **What:** `input` kind on the frame.
  - Primary: **Buy**/**Sell**, `canConfirm` = `_canConfirm()`.
  - Initial focus: the primary when enabled, else Cancel (unchanged).
  - Enter from the **Amount** field confirms when allowed.
  - The sell-side "Define a gem" inputs are marked `data-enter="local"`. Enter there **adds the gem**; it does not confirm the trade.
  - The coin ± buttons keep their own Enter.
- **Why:** K3. Enter did nothing once the user typed an amount.
- **Tier:** 3.
- **Acceptance criteria:**
  - Type an amount, press Enter → the trade confirms when the allocation is valid. When invalid, Enter is a no-op.
  - Enter in the gem row adds the gem only.
  - Escape closes only the trade dialog when it is stacked over the item modal.
- **Open questions:** none.

### T11 — Migrate `ed-damage-modal`
- **What:** `input` kind on the frame, keeping its `<form>` (the primary
  **Apply** is the submit button).
  - Add **Cancel** (D5).
  - The frame hint replaces "Enter applies · Escape closes".
  - Keep the Knockdown hand-off (`close({ restoreFocus: false })` → roll modal on top).
  - Rendered at host root (unchanged).
- **Why:** V1, V4, consistency. It is already the best-behaved modal.
- **Tier:** 3.
- **Acceptance criteria:**
  - Enter applies when Take > 0, and is a no-op at 0.
  - The Knockdown hand-off puts the roll modal on top with focus inside it.
  - The modal works the same from Overview and Combat.
- **Open questions:** none.

### T12 — Migrate the Disciplines modals
- **What:** move every Disciplines modal onto `modalFrame` (they already use a
  controller).
  - **Info (talent, skill, knack, granted):** `info` kind. Enter closes on
    purpose (D1), not by focusing ✕.
  - **Pickers (Half-Magic, Add a talent option, Learn a skill, Learn a knack):**
    `picker` kind. Enter activates the focused option; Enter in the search box
    is a no-op (until the K7 picker feature). The fee fields are marked
    `data-enter="local"` (no-op).
  - **Train to next Circle:** `confirm` kind. Primary **Train**,
    `canConfirm` = `canTrain`; the requirement row is unchanged.
- **Why:** M2, V1–V3 consistency. Removes the "Enter closes by accident" behaviour.
- **Tier:** 1 for "info Enter closes" (signed off D1); 3 otherwise.
- **Acceptance criteria:**
  - The Half-Magic default option is still autofocused.
  - The Learn skill/knack search is still autofocused.
  - Train opens with focus on Train when it is allowed.
  - Picking an option closes the modal and focus returns to the trigger.
  - The Circle-track tooltip and the Train requirement row are unchanged.
- **Open questions:** none.

## Feature-level acceptance
- `npm test` is green: the new `modal-stack`, `check-ui-kit` and existing tests, plus `check-imports`.
- `tools/ui-kit-baseline.json` lists only second-feature files, plus the 5 `ed-spells.js` rule-4 entries (T4).
- Owner manual checklist on `dev` (agents never open the preview):
  - every migrated modal in light and dark mode;
  - mobile width;
  - stacked-modal Escape (Equipment item → sell; Spells learn → roll);
  - roll modal Enter on OK / Apply / chooser;
  - Strain charged once;
  - focus return with no stuck ring;
  - the Overview still fits the viewport.
