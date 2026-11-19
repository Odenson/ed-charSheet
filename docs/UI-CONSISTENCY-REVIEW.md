# UI Consistency Review — cleanup list

A working list of UI inconsistencies between tabs and modals, focused on the
keyboard contract (**Enter = OK, Escape = Cancel**). Each item has an ID, where it
is, what is wrong, why it matters, and how to fix it. Update an item's status in
the summary table when it is fixed.

- **Baseline:** `dev` @ `7388c48` (v1.38.0), reviewed 2026-11-18.
- **Method:** I read every component that renders a modal or picker (20 files in
  `ui/`) and checked the main bugs in the running app.
  - ✅ **Seen in the app**: reproduced in the browser.
  - 📖 **From code**: found by reading the code, not reproduced.
- **Authorities:** [UI-GUIDELINES.md §7](UI-GUIDELINES.md) (Tier 1, the modal
  keyboard rules), [MODALS.md](MODALS.md) (the focus contract and the
  `ModalController` recipe), [GUARDRAILS.md](GUARDRAILS.md).

---

## Status summary

| ID | Finding | Sev | Tier | Status |
|----|---------|-----|------|--------|
| [K1](#k1-one-escape-closes-every-stacked-modal) | One Escape closes every stacked modal | High | 3 | ✅ FIXED (ui-kit-modal-keyboard-contract) |
| [K2](#k2-roll-modal-enter-re-fires-the-dice-button-behind-it) | Roll modal: Enter re-fires the dice button behind it | High | 3 | ✅ FIXED (ui-kit-modal-keyboard-contract) |
| [K3](#k3-enter-works-only-if-the-right-thing-has-focus) | Enter works only if the right thing has focus (5 different implementations) | High | 3 | 🟢 FIXED for this build's modals; rest in feature 2 — not yet on the kit: see [MODALS.md](MODALS.md#not-yet-on-the-kit) |
| [K4](#k4-spells-learn-modal-enter-confirms-under-the-roll-modal) | Spells learn modal: Enter confirms while the roll modal is on top | High | 3 | ✅ FIXED (ui-kit-modal-keyboard-contract) |
| [K5](#k5-karma-ritual-enter-on-any-button-buys-karma) | Karma Ritual: Enter on any button (↺ Undo, ✕) buys Karma | Med | 3 | 🔴 OPEN |
| [K6](#k6-read-only-modals-enter-does-something-different-on-every-tab) | Read-only modals: Enter does something different on every tab | Med | **1** | 🟢 FIXED for this build's modals; rest in feature 2 — not yet on the kit: see [MODALS.md](MODALS.md#not-yet-on-the-kit) |
| [K7](#k7-pickers-and-search-lists-handle-keys-differently) | Pickers and search lists handle keys differently | Med | 3 | 🔴 OPEN |
| [K8](#k8-textarea-modals-have-no-keyboard-save) | Textarea modals have no keyboard Save | Low | 3 | 🟢 DECIDED (D2); kit support shipped |
| [K9](#k9-escape-and-unsaved-changes-inconsistent-guard) | Escape with unsaved changes: guarded in some modals, silently discarded in others | Med | 3 | 🟢 DECIDED (D3); kit hook shipped |
| [K10](#k10-inline-fields-and-add-rows-no-enter-no-escape) | Inline fields and add rows: no Enter to add, no Escape to revert | Low | 3 | 🟡 NEEDS OWNER (D4) |
| [M1](#m1-only-3-of-20-modal-hosts-use-the-shared-modalcontroller) | Only 3 of ~20 modal hosts use the shared `ModalController` | High | 3 | 🟢 FIXED for this build's modals; rest in feature 2 — not yet on the kit: see [MODALS.md](MODALS.md#not-yet-on-the-kit) |
| [M2](#m2-missing-roledialog--aria-modal) | Missing `role="dialog"` / `aria-modal` on 8 modals | Med | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [M3](#m3-close-paths-differ-inside-one-component) | Close paths differ inside one component | Low | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [M4](#m4-modals-with-no--or-no-keyboard-way-in) | Modals with no ✕, or no keyboard way to open them | Low | 3 | 🔴 OPEN |
| [V1](#v1-modal-footers-cancel--close--nothing) | Modal footers: Cancel / Close / nothing | Low | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [V2](#v2-nine-primary-button-styles) | Nine primary-button styles | Low | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [V3](#v3-modal-title-size-breaks-the-type-scale) | Modal title size: 1 of ~20 follows §3a | Low | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [V4](#v4-keyboard-hints-shown-in-two-modals-only) | Keyboard hints shown in two modals only | Low | 3 | 🟢 FIXED for this build's modals; rest in feature 2 |
| [V5](#v5-destructive-actions-confirmed-in-some-tabs-not-others) | Destructive actions: confirmed in some tabs, not others | Med | 3 | 🟡 NEEDS OWNER (D6) |
| [V6](#v6-the-drink-potion-confirm-is-written-twice-and-has-drifted) | The Drink-potion confirm is written twice and has drifted | Low | 3 | 🔴 OPEN |
| [V7](#v7-clear-log-wording-differs-between-combat-and-notes) | Clear-log wording differs between Combat and Notes | Low | 3 | 🔴 OPEN |
| [V8](#v8-smaller-drift-items) | Smaller drift items (font literals, palette copies, label collision, day-reset accent) | Low | 3 | 🔴 OPEN |
| [U1](#u1-build-an-in-repo-ui-kit-uikit-and-enforce-its-use) | **Plan:** in-repo UI kit (`ui/kit/`) + `npm test` check that enforces it | — | 3 | ✅ BUILT (D7/D8 decided) |

**Tier note.** Almost everything here restores documented behaviour (§7 "Escape
closes / Enter confirms", MODALS.md's focus contract), so it is **Tier 3**. **K6**
changes the wording of UI-GUIDELINES §7, so it is **Tier 1**: owner sign-off goes
in the plan's `qa-log.md` before it is built. Items marked *NEEDS OWNER* need a
decision first. The decisions are listed under [Owner decisions](#owner-decisions).

---

## Root cause in one paragraph

The keyboard contract is implemented once, in `ui/modal-controller.js`, but only
`ed-disciplines`, the Spells cast modal and `ed-damage-modal` use it. Every other
modal adds its **own** `document.addEventListener('keydown', …)` and handles
Enter in its own way. Each of these listeners is attached to the same `document`
node, so `e.stopPropagation()` (used in most of them) **cannot** stop the others.
The result: one key press reaches every open modal (K1, K4). Enter also depends on
which element has focus, and in most modals focus never moves into the dialog
(K2, K3). Almost every finding in section K below comes from this. The same
copy-instead-of-reuse habit causes the visual drift in section V. The fix for
both is the shared UI kit in [U1](#u1-build-an-in-repo-ui-kit-uikit-and-enforce-its-use).

---

## K — Keyboard contract (Enter = OK, Escape = Cancel)

### K1. One Escape closes every stacked modal
✅ **Seen in the app** (Equipment). 📖 the other cases.

- **Where:**
  - Equipment item modal → *Remove item* → sell dialog (`ed-trade-modal`): one
    Escape closed **both** (checked: `_modal` and `_trade` both became `null`).
  - Equipment item modal → *Equipped/Stored* → armour swap `ed-confirm`: same
    pattern (`ui/ed-equipment.js:148`, `ui/ed-confirm.js:52`).
  - Spells learn modal → *Roll Patterncraft* → roll modal: Escape closes the roll
    **and** the learn modal (`ui/ed-spells.js:280`, `ui/ed-roll-modal.js:112`).
    The learn draft (teacher, roll result, fee) is lost.
- **Why it matters:** Escape should cancel the *top* dialog only. Closing the
  modal underneath throws away context (the learn workspace) and surprises the
  user. Notes avoids this with a guard (`ui/ed-notes.js:186`
  `if (this._confirm) return;`), so the same action behaves differently on
  different tabs.
- **Fix:** add a **modal stack** to `modal-controller.js`. Use one
  module-level `keydown` listener. `opened()` pushes the controller onto the
  stack and `close()` pops it. Escape and Enter go to the top entry only. Give
  separate-component modals (`ed-confirm`, `ed-trade-modal`, `ed-roll-modal`, …)
  their own controller so they join the same stack. Remove the per-component
  `document` listeners. Add a unit test for the stack: push A, push B, Escape →
  only B closes.

### K2. Roll modal: Enter re-fires the dice button behind it
✅ **Seen in the app** (Overview → Dexterity die).

- **Where:** `ui/ed-roll-modal.js` (render 455–641, keydown 110–117) and
  `ui/ed-app.js:255` (the `ed-roll` handler).
- **What happens:** when the roll modal opens, focus stays on the dice button
  behind the backdrop (checked: active element = `BUTTON[Roll Dexterity]`).
  Pressing Enter clicks that button again. In the test, `ed-roll` was dispatched
  again, the open modal got a **new `rollId`** (`mwm152w2…` → `mwm15bj7…`), and
  `_flushRollReport()` ended the pending Discord report early. The dice didn't
  visibly change only because that roll's `stepRow` was the same cached object.
  Rolls that build a new `stepRow` would re-roll and **charge Strain again**
  (`updated()` → `ed-strain`, `ui/ed-roll-modal.js:155`).
- **Also:** the roll modal has no `role="dialog"`/`aria-modal`, does not move
  focus inside, and does not trap Tab. In its normal result view Enter does
  nothing. Only the True Shot and Mystic Aim choosers handle Enter.
- **Why it matters:** the one modal every tab uses is the least consistent. Enter
  should mean OK. Today it silently restarts the roll interaction, which can
  double-report to Discord and double-charge Strain.
- **Fix:** add `role="dialog" aria-modal="true"` to `.dm`. On open, focus the
  primary control: **Apply** when `apply` is set, otherwise **OK**, or **Roll ✦ N**
  in the chooser and aim views. With the K3 controller change, Enter = primary in
  every view. `ed-app` already captures and restores the trigger, so keep that.

### K3. Enter works only if the right thing has focus
📖 **From code** (Trade checked in the app).

Modals use **five** different ways to make Enter confirm:

| Approach | Modals | Fails when… |
|---|---|---|
| `<form @submit>` + submit button | add-legend, edit-meta, notes (note/event), save-key, settings, damage, custom-item form, conflict | works from any field ✔ (the best of the five) |
| Focus the primary button on open | `ed-confirm`, trade, custom-item list, day-reset, character picker, Disciplines Train/Half-Magic/Learn option | the user clicks a field or blank area: focus moves and Enter does nothing (Trade: typing an **Amount** then Enter does nothing; there is no form) |
| `document` Enter listener | Spells learn + info, roll choosers | runs whatever has focus, including other modals (K4) |
| `keydown` on the overlay | Overview Karma Ritual | catches Enter on every button inside it (K5) |
| Nothing | Overview info modal, Equipment item modal, Combat step audit, changelog, homebrew, roll modal result view | Enter clicks the trigger behind the backdrop again (K2, K6) |

- **Why it matters:** the user asked for Enter = OK everywhere. Today it depends
  on focus.
- **Fix:** give `ModalController` an `onConfirm` (and optional `canConfirm`)
  option. On Enter for the **top** modal, call `onConfirm()` unless:
  - focus is in a `<textarea>`,
  - focus is on a button, link, or a `[role=button]` that is not the primary
    button (let that control do its own job),
  - the event was already handled (`defaultPrevented`).

  Modals that already use `<form>` can pass `onConfirm: () => form.requestSubmit()`.
  This replaces approaches 2–5 with one rule. Document it in MODALS.md's contract
  (item 2).

### K4. Spells learn modal: Enter confirms under the roll modal
📖 **From code**, `ui/ed-spells.js:282–284`.

- **What happens:** the Spells `document` listener runs `_confirmLearn()` on
  **any** Enter while `_learn` is set and `_learnCanConfirm()` is true. That
  includes:
  - when the roll modal is open on top of it (after a successful Patterncraft
    roll, Enter on the roll result also learns the spell),
  - when focus is on a different spell row (Enter both selects that row *and*
    confirms the previously armed spell).
- **Why it matters:** learning a spell spends Legend and silver. It should take a
  deliberate press on *this* dialog's primary button.
- **Fix:** move to the controller (K1 stack + K3 `onConfirm` with
  `canConfirm: () => this._learnCanConfirm()`). The button-focus exclusion
  covers the row case.

### K5. Karma Ritual: Enter on any button buys Karma
📖 **From code**, `ui/ed-overview.js:1037–1039`.

- **What happens:** the `keydown` on `.overlay` calls `preventDefault()` and
  buys Karma on **every** Enter inside the modal. A keyboard user who tabs to
  **↺ Undo this ritual** or **✕** and presses Enter buys Karma instead (the
  `preventDefault` also blocks the button's own click).
- **Fix:** use the controller with `onConfirm` (the button exclusion from K3).
  While there, add `role="dialog"` (M2) and a Cancel button (V1).

### K6. Read-only modals: Enter does something different on every tab
📖 **From code.** **Tier 1:** needs D1.

| Tab / modal | Enter today |
|---|---|
| Disciplines talent / skill / knack / granted info | **closes** (by accident: the controller focuses the first focusable element, the ✕) |
| Spells info | **closes** (explicit `document` listener) |
| Overview ⓘ info, Legend spent, character details | clicks the ⓘ behind the modal again (reopens the same modal: no-op) |
| Equipment item modal | clicks the item tile behind again (no-op) |
| Combat step audit, changelog, homebrew | clicks the trigger behind again (no-op) |

- **Why it matters:** UI-GUIDELINES §7 says Enter is a **no-op** in read-only
  modals. In practice two tabs close and four click the trigger again. You asked
  for Enter = OK, which for an information modal means **close it**.
- **Fix (after D1):** change §7 to *"Read-only modals: Enter closes (it is
  their OK)."* Then pass `onConfirm: () => ctl.close()` for every read-only
  modal. The K3 controller work makes this a one-line option per modal.

### K7. Pickers and search lists handle keys differently
📖 **From code.**

| Picker | ↑/↓ | Enter | Escape |
|---|---|---|---|
| Equipment **Add item** combobox (`ui/ed-equipment.js:587`) | ✔ moves highlight | ✔ adds highlighted | ✔ closes |
| Disciplines **Learn a skill** / **Learn a knack** (search autofocused) | ✘ | ✘ nothing | closes modal |
| Disciplines **Add a talent option**, **Half-Magic** | Tab only | ✔ focused option | closes |
| Spells **Learn a spell** list | Tab only, no initial focus | (see K4) | closes |
| **Character picker** (`ui/ed-character-picker.js:86`) | ✘ | ✔ focused row | closes |

- **Why it matters:** the same kind of control (a list of choices) needs
  different keys on each tab. The Equipment combobox is the best of them and
  should be the pattern everywhere.
- **Fix:** pull the Equipment combobox keyboard logic into a small shared helper:
  ↑/↓ highlight, Enter picks the highlighted row (or the only match), Escape
  clears the search first and then closes. Use it in the skill, knack and spell
  learn pickers. In the character picker, add ↑/↓ and start focus on the
  **currently loaded** character instead of the first row.

### K8. Textarea modals have no keyboard Save
📖 **From code.** Needs D2.

- **Where:** Notes *Add/Edit note* (textarea only), *Add/Edit event*, and the
  edit-meta description and Gahad fields.
- **What happens:** Enter correctly types a newline, so the only keyboard way to
  save is Tab → Save → Enter. The Notes modals also don't move focus into the
  textarea when they open (`ui/ed-notes.js` has no `focus()` call), so you click
  before you can type.
- **Fix:** **Ctrl/⌘+Enter = Save** in any modal with a textarea, with a hint
  ("Ctrl+Enter saves"). Autofocus the textarea or first field on open.

### K9. Escape and unsaved changes: inconsistent guard
📖 **From code.** Needs D3.

| Modal | Escape / ✕ / backdrop with unsaved edits |
|---|---|
| Notes note / event | asks *"Discard unsaved changes?"* ✔ |
| Custom items list | asks *"Unsaved changes — close anyway?"* ✔ |
| Custom item **form** (`ui/ed-custom-item.js:102`; ✕ at 434, Cancel at 500) | **silently** discards the item form |
| Edit character details | silently discards |
| Add Legend, Settings, Trade | silently discards (acceptable: short forms) |

- **Fix:** write down one rule (see D3) and apply it. The likely rule: modals
  where you typed free text (notes, item builder, character details) ask before
  discarding; short numeric or choice forms do not.

### K10. Inline fields and add rows: no Enter, no Escape
📖 **From code.** Needs D4.

- **Add rows with no Enter:** Equipment wealth card gem row
  (`ui/ed-equipment.js:914–917`) and the Trade sell-gem row
  (`ui/ed-trade-modal.js`, *Define a gem*). You have to click **Add**.
- **Inline number fields** (edit-mode Damage/Wounds/Recoveries on Overview, the
  Combat current Damage/Wounds, coin counts, rank and fee fields): these commit on
  `change`. Escape does not put the old value back, and the typed value is still
  committed on blur.
- **Fix:** wrap each add row in a `<form>` (Enter = Add). For inline number
  fields, Escape restores the rendered value and blurs. Enter already commits
  through `change`.

---

## M — Modal implementation consistency

### M1. Only 3 of ~20 modal hosts use the shared ModalController
📖 **From code.**

- **Use the controller (reference):** `ed-disciplines`, the Spells cast modal,
  `ed-damage-modal`.
- **Hand-rolled Escape** (no focus moved inside, **no Tab trap**, focus not
  returned to the trigger): `ed-overview`, `ed-equipment`, `ed-combat`,
  `ed-spells` (info + learn), `ed-notes`, `ed-add-legend`, `ed-edit-meta`,
  `ed-confirm`, `ed-trade-modal`, `ed-custom-item`, `ed-day-reset`,
  `ed-character-picker`, `ed-settings`, `ed-save-key`, `ed-conflict`,
  `ed-changelog`, `ed-homebrew`, `ed-roll-modal`.
- **Effects:**
  - Tab moves out of the dialog into the page behind it.
  - Equipment, Overview and Homebrew close with `activeElement.blur()`, so focus
    falls to `<body>` and a keyboard user starts again at the top of the page.
  - The roll modal and the Equipment item modal leave focus on the trigger, which
    causes K2 and K6.
- **Why it matters:** MODALS.md says *"New or edited modals adopt the controller;
  they do not hand-roll their own Escape/focus handling."* Most modals predate
  that rule. They are the cause of K1–K6.
- **Fix:** migrate each host to the recipe in MODALS.md. Order: roll modal,
  Spells, Equipment, Overview, then the shared `ed-confirm` and `ed-trade-modal`
  (that fixes every confirm at once), then the rest. Each migration is small: one
  controller, route ✕ and backdrop through `close()`, delete the listener.

### M2. Missing `role="dialog"` / `aria-modal`
📖 **From code.**

Missing on:

- the Overview info modal (`ui/ed-overview.js:1017`)
- Karma Ritual (`:1040`)
- the portrait lightbox (`:1028`)
- `ed-changelog` (`:169`)
- `ed-homebrew` (`:147`)
- all three roll-modal views (`ui/ed-roll-modal.js:465, 496, 524+`)

Screen readers don't announce these as dialogs. The controller looks for
`[role="dialog"]` by default, so this has to be done before or with M1.

### M3. Close paths differ inside one component
📖 **From code.**

- **Equipment item modal:** Escape → `_closeModal()` (blurs), but ✕ and backdrop
  set `this._modal = null` directly (`ui/ed-equipment.js:976, 980`).
- **Spells:** the cast modal goes through the controller; the info and learn
  modals set state directly (`ui/ed-spells.js:784–788, 962–966`).
- **Fix:** comes for free with M1. Every close goes through `ctl.close()`.

### M4. Modals with no ✕, or no keyboard way in
📖 **From code.**

- **Portrait lightbox:** opened only by clicking an `<img>`, which can't take
  keyboard focus. It has no ✕. Make the portrait a `<button>` and add a ✕.
- **Custom items "Unsaved changes" sub-dialog**
  (`ui/ed-custom-item.js:551`): no ✕, and focus is not moved into it, so Enter
  goes to whatever had focus underneath. Focus **Keep editing** or **Close** on
  open.
- **Custom items list:** `firstUpdated` focuses **Save to GitHub**, which is
  **disabled** when nothing is pending, so focus stays behind the backdrop.
  Fall back to **＋ New item**.

---

## V — Visual and wording consistency across tabs

### V1. Modal footers: Cancel / Close / nothing
Needs D5.

- **Input modals with Cancel + primary:** add-legend, edit-meta, notes, confirm,
  trade, settings, save-key, Train.
- **Different:**
  - The Spells cast modal says **Close**, not Cancel.
  - The damage modal has **no** Cancel.
  - Karma Ritual has **no** Cancel, and its **Buy** button sits under the field,
    not in a footer.
- **Read-only modals:** Spells info has a **Close** button; the Disciplines,
  Equipment, Overview, Combat, changelog and homebrew info modals have only ✕.
- **Suggestion:**
  - Input and confirm modals: `[Cancel] [Primary]`, right-aligned, primary last.
  - Read-only modals: ✕ only (Enter closes after D1).
  - Write this down in MODALS.md.

### V2. Nine primary-button styles
📖 **From code.**

`.btn.primary`, `.btn.accent`, `.hbtn` (two different definitions: body/6px in
the damage modal, small/8px in Overview), `.mbtn.primary`,
`.fbtn.m-primary`/`.f-primary`, `.edc-/.edk-/.eds-btn.primary`, `.commit`,
`.appbtn`, `button.ok`, plus an inline `style=` on the Spells **Learn** button
(`ui/ed-spells.js:879`).

They differ in radius (6 vs 8px), padding (12 vs 14px) and font size (`--fs-small`
vs `--fs-body`).

**Fix:** a shared `modal-css.js` (the same pattern as `diceIconCss` and
`infoIconCss`) that exports `.overlay`, `.modal`, `.mhead`, `.mclose`,
`.actions`, `.btn`, `.btn.primary` and `.btn.danger`. Keep tab accents
(`--spell`, `--karma`) as modifier classes, not separate button systems.

### V3. Modal title size breaks the type scale
📖 **From code.**

UI-GUIDELINES §3a says `--fs-title` is for *"Panel & modal titles"*. Only the
Spells modals use it (`ui/ed-spells.js:99`). Every other modal title is
`--fs-value`. Move titles to `--fs-title` in the shared CSS from V2. This is
Tier 3: it restores §3a.

### V4. Keyboard hints shown in two modals only
📖 **From code.**

- The damage modal shows *"Enter applies · Escape closes"*.
- The Combat step audit shows *"Escape closes"*.
- No other modal shows a hint.

Either drop them, or show the same hint on every input modal from the shared
footer (*"Enter = OK · Esc = Cancel"*). Showing them makes the new contract
easy to discover.

### V5. Destructive actions: confirmed in some tabs, not others
📖 **From code.** Needs D6.

- **Notes:** delete note, event or Legend entry → `ed-confirm`. ✔
- **Equipment:** *Remove* → the sell dialog. ✔
- **Custom items:** ✕ only marks the item *to delete* until you save. ✔
- **Spells:** **✕ Remove from grimoire** (`ui/ed-spells.js:947`, `_remove`
  at 638) removes the spell **at once** with no confirm and no undo. It also
  clears any matrix holding the spell. That spell cost Legend, silver and a
  Patterncraft roll.
- **Fix:** route the spell removal through `ed-confirm` (danger tone, *"Remove
  {spell} from the grimoire? Its matrix is cleared."*).

### V6. The Drink-potion confirm is written twice and has drifted
📖 **From code.**

`ui/ed-equipment.js` `_useModal()` (~741–785) and `ui/ed-combat.js` (~1250–1289)
build the same `ed-confirm` with copy-pasted logic, and they have already
drifted:

- The hint text says *"from the **pending pill**"* in Equipment and *"from the
  **Potions pill**"* in Combat.
- The quantity check is `(it.qty ?? 1) > 1` in one and `it.qty > 1` in the other.

**Fix:** move the warning and blocked logic into one pure helper (next to
`item-equip-state.js`) that both tabs call.

### V7. Clear-log wording differs between Combat and Notes
Both clear the **same** device-local log.

- **Combat:** button **"clear"** (lowercase), heading *"Clear the Combat log?"*.
- **Notes:** button **"Clear"**, heading *"Clear the Log?"*, different message.

**Fix:** use one label (**Clear**), one heading (*"Clear the roll log?"*) and
the Combat message, which says that the other tab's view is cleared too.

### V8. Smaller drift items
- **Raw `font-size` literals** remain (§3a says always use a token):
  - `ui/ed-spells.js`: 5
  - `ui/legend-spent-view.js`: 2
  - `ui/ed-trade-modal.js`: 1
- **Colour palette copied into ~17 components:** each component redeclares
  `--accent`, `--border`, … with `light-dark()`. The values match today. Moving
  them to `:root` in `index.html` (like the type scale) prevents drift.
- **Day-reset uses a green `--accent`** (`ui/ed-day-reset.js`), so its primary
  button is green while every other modal's is amber. Confirm whether that is
  intentional (healing = green) or should match.
- **Accessible-name collision:** the header edit-mode switch, the Overview details
  region, and the edit-meta dialog are all named *"Edit character details"*.
  Rename the switch to *"Edit mode"* (on/off is already given by `aria-checked`).
- **Always-on listeners:** `ed-changelog` and `ed-homebrew` are always mounted
  and react to every Escape on the page, even when closed. M1 removes this.

---

## U — Shared UI kit plan

### U1. Build an in-repo UI kit (`ui/kit/`) and enforce its use
Needs D7 and D8.

**Why.** Every K, M and V finding above comes from shared behaviour being copied
instead of reused. "Keep the code reusable" did not hold on its own. MODALS.md
already told every modal to use the controller, and most still don't (M1). A
separate, versioned component library would be overhead for a single-owner app
with no build step. The middle path: a small kit inside the repo, plus a check
that runs on `npm test` and fails when a component goes around it.

**Rules for the kit:**
- Only add a piece when it has **two or more users today**. Pull something in on
  its second use, never before.
- Same pattern as the rest of the repo (`item-equip-state.js`, `picker.js`,
  `tools/check-imports.mjs`): a **pure, DOM-free core** that `node --test` can
  test with no browser, plus a thin Lit/DOM wrapper. The repo has no DOM test
  library, and this keeps it that way.
- The kit holds **UI plumbing only** (focus, keys, layout, styling). Game logic
  stays out. For example, the potion-warning helper (V6) goes beside
  `item-equip-state.js`, not in the kit.
- Data-down / dispatch-up holds: kit pieces never dispatch game events or
  mutate state. They call the host's callbacks (`onConfirm`, `onClose`).

**What goes in it:**

| Piece | File | Replaces | Fixes |
|---|---|---|---|
| **Modal stack + key router** (pure): push/pop/top, and `routeKey(event facts) → 'close' \| 'confirm' \| 'pass'`, covering the textarea, other-button and Ctrl+Enter rules | `ui/kit/modal-stack.js` + `.test.js` | the 18 per-component `document` keydown listeners | K1, K3, K4, K5, K8 |
| **ModalController**, upgraded: registers with the stack; adds `onConfirm`, `canConfirm`, an optional `isDirty` + discard prompt, and a `light` mode for portal modals | `ui/kit/modal-controller.js` (moved from `ui/`) | hand-rolled focus, blur and Escape code | K2, K9, M1, M3 |
| **`modalFrame()` template + `modalCss`**: backdrop, `role="dialog"`/`aria-modal`/`aria-label`, header with title and ✕, body, footer `[extra…] [Cancel] [Primary]`, keyboard hint. Variants: `input`, `confirm`, `info` | `ui/kit/modal.js` | ~20 copies of the overlay/`.mhead`/`.mclose`/`.actions` markup and CSS | M2, M4, V1, V3, V4 |
| **`buttonCss`**: `.btn`, `.btn.primary`, `.btn.danger`, with tone modifiers (`.spell`, `.karma`) for tab accents | `ui/kit/button-css.js` | nine primary-button styles and inline `style=` | V2 |
| **Listbox keys helper**: ↑/↓ highlight, Enter picks the highlighted row (or the only match), Escape clears the search and then closes | `ui/kit/listbox.js` + `.test.js` | the Equipment combobox logic, and nothing in the other pickers | K7 |
| **Inline-field helper** (after D4): Escape restores the rendered value and blurs; Enter commits | `ui/kit/field.js` | nothing today | K10 |
| **Colour tokens on `:root`** in `index.html`, next to the type scale | `index.html` | the palette copied into ~17 components | V8 |

**Already shared, so they move onto the kit rather than into it:**
- `ed-confirm`: rebuilt on `modalFrame` (the `confirm` variant). It is the pilot
  migration.
- `ed-damage-modal`, `dice-icon.js`, `info-icon.js`, `format.js`: unchanged.

**Design note (a correction to the earlier chat suggestion).** I first suggested
an `<ed-modal>` custom element with slots. On a closer look, a **template helper
rendered in the host's own shadow root** is lower risk:
- A `<form>` slotted into another element's shadow DOM can't be submitted by a
  footer button in that shadow, so Enter-to-submit would need workarounds.
- The focus trap would have to walk slotted nodes and shadow nodes in flat-tree
  order, which is fiddly and easy to get wrong.

With `modalFrame()` everything stays in one tree, so native forms, the existing
trap code and `role="dialog"` lookups just work.

**Special cases the kit must support:**
- **Portal modals** (`ed-conflict`, `ed-save-key`, `ed-settings`) render into
  `document.body` so password managers can see the fields. These use the
  controller's `light` mode, and `modalCss` is injected inline.
- **Embedded roll panel** inside `ed-day-reset`: `ed-roll-modal` in `embedded`
  mode renders without a frame. The frame is optional.
- **Hand-offs** (cast → roll, damage → Knockdown roll): keep
  `close({ restoreFocus: false })`. The stack pops the closing modal before the
  next one pushes.
- Frames still render at the host's root (`.overlay` is `position: fixed`), as
  MODALS.md already says.

**Enforcement.** Add `tools/check-ui-kit.mjs`, run in `pretest` like
`check-imports.mjs`: a pure analyzer, a CLI wrapper, and its own test. Outside
`ui/kit/`, it fails on:
1. `document.addEventListener('keydown'` or `'keyup'` (all key routing goes
   through the stack);
2. a literal `role="dialog"` or `role="alertdialog"` (use `modalFrame`);
3. CSS rules defining `.overlay`, `.modal`, `.mhead`, `.mclose` or `button.btn`;
4. a raw `font-size` literal instead of a `--fs-*` token (§3a);
5. an inline `style=` on a `<button>`.

During migration the check reads a **baseline allowlist**
(`tools/ui-kit-baseline.json`: file → allowed count). Counts may only go down,
so the build stays green while each file is moved over and can't regress. The
list ends empty.

**Docs to update with the kit:**
- **MODALS.md:** the new contract (stack, Enter rules, `modalFrame`, the
  `light` mode).
- **GUARDRAILS.md PR checklist:** add *"new UI uses `ui/kit/`; `npm test` UI-kit
  check passes"* (D8).
- **UI-GUIDELINES.md:** only §7 for D1. The kit needs no other Tier-1 change.

**Tier.** The kit, the check and the migrations are **Tier 3**: a refactor that
restores the documented behaviour, and unifying button and title styles stays
within the guidelines. Visible changes from the migration (button radius and
padding, title size, footers) are deliberate and listed in V1–V3.

---

## Owner decisions

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Change UI-GUIDELINES §7 so **Enter closes read-only modals** (its OK) instead of "no-op". Tier 1. | **Yes**: this is what you asked for, and Disciplines and Spells already behave this way. |
| **D2** | **Ctrl/⌘+Enter saves** modals that have a textarea. | Yes, with a visible hint. |
| **D3** | Dirty-guard rule: which modals ask before Escape discards edits? | Free-text modals (notes, event, item builder, character details) ask; short numeric or choice modals don't. |
| **D4** | Inline number fields: **Escape reverts**; add rows: **Enter adds**. | Yes. |
| **D5** | Footer convention: `[Cancel] [Primary]` for input modals; ✕ only for read-only modals. | Yes; record it in MODALS.md. |
| **D6** | Confirm before **Remove from grimoire**. | Yes (danger-tone `ed-confirm`). |
| **D7** | Approach to reuse: an in-repo kit (`ui/kit/`) enforced by an `npm test` check, a separate versioned component library, or conventions only. | **In-repo kit + check** (U1). A library is overhead for one app; conventions alone have already drifted. |
| **D8** | Where the "use the kit" rule lives: MODALS.md + the GUARDRAILS PR checklist + the check script, or also as a Tier-1 rule in UI-GUIDELINES.md. | **MODALS.md + PR checklist + check script.** The check enforces it, so no Tier-1 change is needed. |

---

## Suggested order of work

This follows the U1 kit plan. Each phase leaves `npm test` green, because the
baseline allowlist only shrinks.

1. **Phase 1 — Build the kit** (no visible change yet):
   - colour tokens on `:root`;
   - `modal-stack.js` with its tests;
   - the upgraded `modal-controller.js`, moved into `ui/kit/`;
   - `modal.js` (`modalFrame` + `modalCss`) and `button-css.js`;
   - `tools/check-ui-kit.mjs` with its test and a baseline allowlist that records
     today's counts;
   - a MODALS.md rewrite.

   **Pilot:** move `ed-confirm` onto the frame. That changes the Notes, Combat,
   Equipment and app-level confirms in one step and proves the design.
2. **Phase 2 — High-impact migrations:**
   - `ed-roll-modal` (K2, M2);
   - Spells learn and info (K4), and the Spells **Remove** confirm (V5, after D6);
   - the Equipment item modal (K1, M3);
   - `ed-trade-modal`.
3. **Phase 3 — Remaining migrations:**
   - Overview: info, Karma Ritual (K5), lightbox (M4);
   - Notes (K8, K9);
   - the Combat audit;
   - custom items (K9, M4);
   - day-reset;
   - the portal modals (`light` mode);
   - the character picker, changelog and homebrew.

   Remove each file from the baseline as it is migrated.
4. **Phase 4 — Behaviour that needs decisions:**
   - read-only Enter = close (K6, after D1: amend §7, then one option per
     modal);
   - `listbox.js` for every picker (K7);
   - `field.js` for inline fields and add rows (K10, after D4).
5. **Phase 5 — Finish:**
   - the potion helper (V6), clear-log wording (V7), the rest of V8;
   - check that the baseline allowlist is empty, then delete it;
   - add the kit rule to the GUARDRAILS.md PR checklist (D8).

**Tiers.** Phases 1–3 and 5 are Tier 3 and fit one `/new-feature` run, e.g.
"UI kit + modal keyboard contract". Phase 4's K6 needs the D1 sign-off recorded
in that plan's `qa-log.md`.

### Checklist for every migrated modal
- [ ] Renders through `modalFrame()` with `modalCss` and `buttonCss` from `ui/kit/`; the file is removed from the UI-kit baseline allowlist.
- [ ] Opens through `ModalController.opened(trigger)`; ✕, backdrop and Escape all go through `close()`.
- [ ] `role="dialog"` + `aria-modal="true"` + `aria-label` (supplied by the frame).
- [ ] Focus moves inside on open (primary control, first field, or the default option).
- [ ] Tab stays inside; focus returns to the trigger on close (no ring after a pointer open).
- [ ] **Enter = OK** (primary action, or close if read-only); Enter on another button runs that button.
- [ ] **Escape = Cancel**, top modal only; stacked modals underneath stay open.
- [ ] Footer follows D5; primary button uses the shared style.
- [ ] Works in light and dark mode.
