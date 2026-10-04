---
status: implemented
shipped: unreleased
---
# Delivery Plan: New-Combat-UI (new-combat-ui)

## Context & learnings
The Combat tab (`ui/ed-combat.js`) is eight bordered cards, with chip sections
nested inside a card. The owner approved "Option A"
(`plans/new-combat-ui/design-option-a.html`, the design reference, built from the
app's real tokens). The layout becomes:

1. A plain-text **floating header line**: Defence `PD · MD · SD` (with the existing
   delta badges), Armour `Phys · Myst`, Initiative value + roll die + last result,
   and an "Available Karma N" pill at the right end.
2. **Your attack** and **Damage taken** as two side-by-side cards of equal height.
3. A card-less **Combat modifiers** block: eyebrow label, a segmented control
   (Combat options / Situational / Blood charms, each with an active-count badge)
   and the selected segment's chips. It sits beside the **Potions** card.
4. A flat, full-width **Combat log** table.

Owner decisions (qa-log):
- Tier-1 sign-off for the contract change and the UI-GUIDELINES §4 update (entry 1).
- Selected segment starts on Combat options. It is remembered per character in the
  session scratchpad, and reset on reload and on day reset (entry 2).
- Log columns are glyph · Roll · Step · Total · vs · Outcome · Detail, so nothing the
  current log shows is lost. System rows put the detail and Legend/silver/coin in
  Detail. Action rows show "—" in the numeric columns (entry 3).
- Narrow fold (≤720px): header wraps; sections stack Attack, Damage taken,
  Modifiers, Potions, Log; log rows fold to two lines; the log is capped at 320px
  with internal scroll; segments wrap (entry 4).
- Karma pill as on the Spells tab: `characteristics.karma.available`, hidden when
  null, shows 0, static (entry 5).
- All three segments are always visible; an empty segment shows the existing empty
  message (entry 6).

It is a view-only change. There are no engine, store, schema, taxonomy, dispatch or
roll-flow changes. No new game values are computed.

## Discoveries
- `ui/ed-combat.js` (1615 lines, Lit, shadow DOM). The `render()` at ~L1434 uses a
  `.top` grid with areas `atk dmg / dab log / mods log`. At ≤720px it falls back to
  one column and caps `.logblk .log` at 320px.
- The Initiative control lives in the attack card header (`.h .r`) and uses
  `_rollInitiative`, `_lastInitTotal` and the `.initres` style.
- Defence and Armour come from `_defArmourSection()` (L1116). It builds the
  `foldCombatRatings` result and the spell mods (`_spellRatingMods`, which pull
  spell defence/armour out of the base and re-add them as badges). It renders through
  `_combatRating(r)` (placeholder pill via `_pend()` when the value is null). It sits
  in a collapsible `.dablk` using `_collapsed['dab']`.
- The three chip sections are built by `_optSection`, `_sitSection` and
  `_charmSection`, which all call `_sec(title, id, count, body)`. That draws a
  collapsible header with a `· N on` count and a chevron, driven by `_collapsed`.
  - `_collapsed` is initialised by `defaultCollapsed()` (matchMedia mobile).
  - It is also saved and restored in `SCRATCH` (`_saveScratch` / `_restoreScratch`)
    and reset in `_resetSession`.
  - The counts: opts count toggled options plus armed `arms` options; sits count
    `_sits` plus locked situations; charms count `_activeCharmNames()`.
  - `_sitSection` also renders `_standUpLine()` (Knocked Down row) above the chips;
    the revised plan moves that call into the Damage taken card (I2).
  - `_charmSection` shows the `.empty` message "No blood charms equipped…" when none.
  - `_optSection` with no options renders an empty `.chips` div, so a new
    empty-state message is needed. See I3.
- The damage card (`_damageTbl`) and the potions card (`_potionsSection`, `_potionPill`,
  `_useModal` via `ed-confirm`) have no layout dependency beyond the CSS classes
  `.dtcol`, `.dablk`, `.dabhead` and `.dabbody`.
- The log is `_logBlock()` / `_logRow(r)` (L1379), reading `_rolls` from
  `loadRollLog(characterId).entries` (`store-rolllog.js`, shared with the Notes tab).
  - Entry kinds: `system|log|advancement` (label, detail, legendCost, silverFee,
    coinDelta), `action` (label only), and roll entries (label, step, total,
    difficulty, outcome `{ok, word}`, mods `[{label}]`).
  - The clear control is an `ed-confirm` via `_confirmClear`.
- `clearCombatScratch(id, mountedEl)` is exported and called from `ui/ed-app.js` L926
  on day reset. It resets the cached `opts`, `sits`, `charmsOn` and `target`, and
  calls `_clearDayState` on the mounted element. The remembered segment must be reset
  there too (I3).
- The Spells tab Karma pill is `ui/ed-spells.js` L64-65 and L871. It uses the `.kchip`
  style and `karma != null ? … : ''`. The prototype adds `margin-left:auto`.
- **Tests:** there are no DOM or component tests in the repo. The `ui/*.test.js`
  files cover only pure, DOM-free state modules (`item-equip-state.test.js`,
  `custom-item-state.test.js`, `format.test.js`). `npm test` is `node --test`, with a
  `pretest` import check (`tools/check-imports.mjs`, which also validates imports and
  exports). `engine/combat.test.js` and `store-combat.test.js` assert no layout. So no
  existing test asserts the old Combat layout, and "update existing layout tests"
  means checking nothing breaks. Layout-adjacent logic gets pinned by extracting two
  small pure modules (I3, I5).
- Docs describing the old layout: `docs/UI-GUIDELINES.md` §4 Combat row.
  `plans/PLAN-COMBAT-TAB.md` (L376, L491, L518, L546-551) records the historical
  design. Plan docs are history, so add a short superseded note rather than rewrite.
  `plans/mock-combat-tab.html` is the old mock; leave it. `ARCHITECTURE.md` L485 only
  says "Combat tab (per-encounter scratchpad, roll log)", which stays accurate.
- The prototype's CSS uses tokens only (`--fs-*`, the same colour vars as
  `:host` in ed-combat). The prototype's fixed names differ slightly from the app's:
  the app uses `.v` for stat values and `.dval` for ratings. Port the structure, not
  the class names, and keep the existing names where behaviour depends on them.
  `.badge` weight must stay 400 or 500, and both stay in the two-weight rule.

## Guardrail classification
Whole plan: **Tier 1** (UI/UX contract; `ui/ed-combat.js` and the UI-GUIDELINES §4
Combat row).
- Sign-off is recorded in qa-log entry 1 (2026-10-04). Entries 2-6 settle the
  detailed choices (segment memory, log columns, narrow fold, Karma pill, empty
  segments). All items are covered, so nothing blocks the build.
- Golden-rule check: the view still only renders `model`/props and dispatches events
  up. No game value is computed in the UI. The remembered segment is session
  scratchpad UI state, not persisted (consistent with "store only inputs").
- Engine, store, schema, taxonomy: untouched, so no Tier 2 ceremony. The new pure
  helper modules sit in `ui/` and do not touch the engine.
- Re-check "Before finishing" in GUARDRAILS.md: placeholder pills, light/dark
  (tokens only), modal contract (Escape/Enter unchanged), relative paths, two weights.

## Rules dependencies
None. `rules.md` records 0 rules. This is a re-layout only. No Earthdawn rule is
asserted or changed, and every number comes from the existing model/engine.
No `NEEDS_RULES`.

## Implementation items

### I1 — Header line: floating Defence / Armour / Initiative / Karma
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 1 (qa-log entries 1 and 5)
- **What:** Remove the Defence & Armour card and the Initiative control from the
  attack-card header. Render one plain-text row above everything: Defence, Armour,
  Initiative (value, roll die, last result) and the Karma pill.
- **Where:** `ui/ed-combat.js`
  - Replace `_defArmourSection()` with `_headerLine()` (keep the fold and spell-mod
    logic verbatim; drop the collapsible wrapper).
  - Add `.float`, `.item` and `.kchip` CSS from the prototype. `.kchip` is copied
    from `ui/ed-spells.js` L64-65, plus `margin-left:auto`.
  - Delete the `.dabhead`, `.dabrow`, `.dablk` and `.dabbody` CSS used only by the
    old card, but keep any rule Potions still needs (see I4).
- **Approach:**
  - Reuse `_combatRating`, `foldCombatRatings`, `_spellRatingMods` and `_pend`
    unchanged.
  - Initiative keeps `_rollInitiative`, `init?.value ?? this._pend()`,
    `?disabled=${!init?.value}`, and the `.initres` result from `_lastInitTotal()`.
  - Karma pill: `const karma = this.model?.characteristics?.karma?.available;`
    renders `karma != null ? html\`<span class="kchip">Available Karma <b>${karma}</b></span>\` : ''`.
    Use `!= null` so 0 still shows. Static, with no click and no max.
  - Remove `'dab'` from `defaultCollapsed()` (I3 removes the whole mechanism).
  - Wrap rather than overflow on narrow screens: `flex-wrap`, with Karma free to wrap.
- **Dependencies:** none (do first; it unblocks the attack-card header edit in I2).
- **Acceptance criteria:**
  - Defence/Armour values and delta-badge logic are identical to today, including the
    spell-mod pull-out.
  - Unknown values are dashed placeholder pills.
  - There is no Defence & Armour collapse control.
  - The Karma pill matches the Spells tab, is hidden on null, shows 0 at 0, and
    updates when the model's Karma changes.
  - The Initiative roll dispatches `ed-roll` (kind `initiative`) as before, and its
    last result shows.
- **Risks / unknowns:**
  - The `.v` class is shared, so scope the new header-line styles under `.float`.
  - `defenseMods`/`armorMods` come from `_poolEffects()`, which needs a selected
    weapon and talent. This is unchanged from today.

### I2 — Attack and Damage taken side-by-side cards
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 1 (qa-log entry 1)
- **What:** Drop the Initiative block from the "Your attack" header. Place Attack and
  Damage taken as a two-column row (`minmax(0,1fr) 240px`, `align-items: stretch`).
  The Damage taken buttons stay pinned to the bottom.
- **Where:** `ui/ed-combat.js`
  - Remove `.h .r`, `.h .r b` and `.initres` CSS from the card header (the initiative
    style moves with I1).
  - Replace the `.top` grid-areas layout with the row layout. Name it `.top2` as in
    the prototype or keep `.top`, but remove the `log`/`dab`/`mods` areas.
  - `_artBox`, the pickers, the stat-lines, the audit buttons, the `vs #` input, the
    `succ` field, the bonus badge and the range stay as they are.
  - `_damageTbl()` content is unchanged. Add `align-items: center` to `.dtbtns` per
    the prototype. Call `_standUpLine()` inside the Damage taken card (above the
    pinned buttons, as in the prototype).
- **Approach:**
  - Pure markup and CSS re-composition. Keep every `@click`, `@input` and `@change`
    handler intact.
  - Do not touch the `ed-roll` / `ed-edit-health` / `ed-day-reset` dispatches.
  - The prototype hides `.artbox` at ≤720px (`display:none`) and collapses
    `.attacktop` to one column. Do NOT copy either rule. The current app keeps
    `.attacktop` as `auto 1fr` at ≤720px (L165) and shows the art box; keep that.
    Cap the art box with an explicit small size at ≤720px (for example `height:96px`;
    `.artbox` is otherwise `aspect-ratio:1; height:100%`, which would become a huge
    square). Confirm at 375px.
- **Dependencies:** I1.
- **Acceptance criteria:**
  - Same contents and behaviour as today.
  - Equal-height cards at ≥721px, with the ✗ ⚄ ☼ buttons at the bottom of the
    Damage taken card.
  - Edit-mode inputs for current damage and wounds (`_curDmg`, `_curWounds`) still work.
  - The Knocked Down Stand-up bar (`_standUpLine()`) renders inside the Damage taken
    card, as in the approved prototype (design-option-a.html L205) and T1. It is the
    same handler as today, and it is rendered in exactly one place (not also in the
    Situational segment, see I3), so a knocked-down character always sees it.
- **Risks / unknowns:**
  - Today the Stand-up row lives in the Situational section; this item moves it into
    the Damage taken card (owner decision: matches prototype and tickets). Only the
    placement changes, not the handler, label or dispatch. Mention the move in the PR
    notes.
  - The `.roll.boosted` class is referenced in markup but has no CSS today. Leave it.

### I3 — Combat modifiers: segmented control (+ scratchpad, + pure state helper)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 1 (qa-log entries 1, 2 and 6)
- **What:** Replace `_modsGroup()` and the collapsible `_sec()` with a card-less
  block: eyebrow "Combat modifiers", a segmented control (Combat options /
  Situational / Blood charms, each with an active-count badge) and the selected
  segment's chips. Remove the collapse state entirely.
- **Where:**
  - `ui/ed-combat.js`
    - Replace `_modsGroup`, `_optSection`, `_sitSection`, `_charmSection`, `_sec`
      and `_toggleSec` with `_modsBlock()`, which calls the existing `_chips(...)`.
    - New state `_modTab` (`'opts' | 'sits' | 'charms'`, default `'opts'`).
    - Add `.seg`, `.seg button[aria-pressed]` and `.seg i` CSS, and `.mods` padding.
      Remove the `.sec`, `.sechead` and `.secbody` CSS.
    - Delete the `MOBILE_QUERY`/`defaultCollapsed` helper and the `_collapsed`
      property, constructor init, `_saveScratch`/`_restoreScratch` fields and
      `_resetSession` reset. (Grep to confirm nothing else uses `_collapsed`: only
      `ed-combat.js` does.)
    - `_modTab` is added to `SCRATCH` (`modTab`) and restored in `_restoreScratch`.
      In `_resetSession`, reset it to `'opts'`.
    - `clearCombatScratch`: add `modTab: 'opts'` to the cached reset, and reset
      `_modTab` in `_clearDayState`.
  - New pure module `ui/combat-mods-state.js` (DOM-free; the component delegates to
    it, in the style of `item-equip-state.js`). It exports:
    - `MOD_TABS` (the id/label list).
    - `modTabCounts({ options, armedNames, toggledOpts, sits, toggledSits, charmNames })`,
      returning `{ opts, sits, charms }` with the same counting rules as today.
    - `normalizeModTab(v)`, falling back to `'opts'` for anything unknown.
  - New `ui/combat-mods-state.test.js`.
- **Approach:**
  - **Counts:**
    - Combat options count toggled options plus armed `arms` options (`armedTalents`
      with `successes > 0`).
    - Situational counts `_sits.length` plus locked situations.
    - Blood charms count `_activeCharmNames().length`.
    - The badge is hidden at 0 (prototype: `c ? <i>c</i> : ''`).
    - Counts are always computed for all three segments, so hidden chips stay
      discoverable.
  - **Segment buttons:** `<button aria-pressed=${active}>`, keyboard-operable, with the
    count in `<i>`. Selecting only sets `_modTab`. It never clears or alters a chip.
  - **Panel content:**
    - opts: `_chips(opts, this._opts, 'opts')`.
    - sits: `_chips(sits, this._sits, 'sits', 'sit')` only. `_standUpLine()` moves to
      the Damage taken card (I2).
    - charms: `_chips(charms, active, 'charms', 'charm')`.
  - **Empty message:**
    - Charms keep the current `.empty` text.
    - Opts and sits can be empty (opts after the scope filter). Use the same `.empty`
      style with these fixed one-line messages, in the voice of the Blood charms one:
      Combat options: "No combat options apply to this pick." Situational: "No
      situations apply right now." This is new wording (qa-log entry 6 only covers the
      existing charms message); it stays an owner-vetoable open question.
  - **Chip behaviour:** `_chips` and `_toggle` are untouched (locked, spent/noKarma,
    aimed, arms and `rollAim`, charm dispatch to `ed-toggle-charm`, badges and
    exclusivity).
  - **`_modTab` and scratchpad:** `_modTab` is a lit `state` property. It is saved on
    `disconnectedCallback` and restored on `firstUpdated`, like the other picks.
    The session-only rule holds: it is never persisted to the character.
  - **Day reset:** `ed-app` calls `clearCombatScratch`, which now resets `modTab`
    for both the cache and the mounted element.
  - **Narrow screens:** `.seg` uses `flex-wrap: wrap` and a border radius that still
    reads well when wrapped (a 999px pill with two lines looks odd, so use 12px
    when wrapping, or keep the pill and let each button wrap). Confirm at 375px.
- **Dependencies:** I2 (layout row). The `_chips` function is reused as is.
- **Acceptance criteria:**
  - All chip toggling, arming, locking and Karma-gating behaviour is unchanged.
  - Counts update live: toggle a chip, then switch segments.
  - Selecting a segment changes no chip state.
  - The segment buttons are keyboard-operable and carry `aria-pressed`.
  - The selection survives a tab switch within the session. It resets on reload, on
    character switch and on the day reset. Manual check of the three reset paths
    (list in the PR notes): `_resetSession` (called from the `characterId` branch on
    character switch), `_clearDayState` on the mounted element, and the cached
    `SCRATCH` entry reset in `clearCombatScratch`. The selection is remembered per
    character otherwise (qa-log entry 2).
  - The old collapse chevrons and collapsed state are gone.
  - `npm test` runs `combat-mods-state.test.js`, which asserts the counts (toggled
    and armed arms options; sits including locked; charms), the zero hiding rule is
    left to the view, and `normalizeModTab`.
- **Risks / unknowns:**
  - The `_clearDayState` and `clearCombatScratch` paths are easy to miss.
    Add a note in the PR checklist.
  - Existing `SCRATCH` entries are in memory only, so there is no migration. A cached
    entry without `modTab` must fall back to `'opts'` in `_restoreScratch`
    (use `normalizeModTab`).
  - Blood-charm chips use the `.chip.charm` class, which only applies when the
    charms segment is active. The cls argument already handles this.

### I4 — Potions card on its own row beside the modifiers
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 1 (qa-log entry 1)
- **What:** Keep `_potionsSection()` as a card. Place it in a row with the modifiers
  block (`minmax(0,1fr) 240px`, `align-items: start`). Remove the `.dabpair` wrapper.
- **Where:** `ui/ed-combat.js`: `render()` composition, and the Potions CSS
  (`.potpick`, `select.pot`, `.drink`, `.emptyhint`, `.potpend` and so on, which stay).
  `_potionsSection` currently uses `.dablk`/`.dabhead`/`.dabbody` as its header
  wrapper, so switch it to the generic `.blk` + `.h` markup (`<div class="h">`) and
  delete the old dab classes.
- **Approach:**
  - Picker, Drink, pending pill, emergency heal Roll, clear, empty hint and the
    confirm modal (`_useModal`, `ed-confirm`) are untouched.
  - The pill keeps `_potionPill` and its dispatches (`ed-use-potion`,
    `ed-clear-pending-use`, `ed-roll`).
- **Dependencies:** I1 and I3 (the row composition).
- **Acceptance criteria:**
  - Behaviour and the modal are unchanged. Escape closes and Enter confirms, as before.
  - Layout matches the prototype.
  - Stacks below the modifiers at ≤720px (T6).
- **Risks / unknowns:** low. Make sure no leftover `.dabhead` rule is orphaned.

### I5 — Combat log as a full-width table (+ pure row-mapper)
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 1 (qa-log entries 1 and 3)
- **What:** Replace the right-hand log card with a flat table under a "Combat log"
  eyebrow with the clear button. Columns: glyph · Roll · Step · Total · vs · Outcome ·
  Detail.
- **Where:**
  - `ui/ed-combat.js`: replace `_logBlock()` and `_logRow()` with a `<table>` render
    and the table CSS from the prototype (`th`, `td`, `.glyph`, `.hit`, `.miss`, `.r`).
    Keep `_loadRolls`, `_clearLog` and the `ed-confirm` modal.
  - New pure module `ui/combat-log-rows.js` exporting `logRowCells(entry)`, which
    returns `{ glyph, roll, step, total, vs, outcome, detail }`, where `outcome` is
    `{ word, ok } | null`. The component only lays the cells out.
  - New `ui/combat-log-rows.test.js`.
- **Approach:** the mapping mirrors the current `_logRow` branches exactly:
  - **system / log / advancement:**
    - glyph `✦`.
    - Roll is `label ?? 'System'`.
    - Step, Total, vs and Outcome are `—`.
    - Detail: `logRowCells` builds an array of the non-empty parts (`detail`,
      `N Legend` when `legendCost != null`, `N sp` when `silverFee > 0`, `coinDelta`
      when truthy) and joins them with " · ". No leading or trailing separator when
      `detail` is empty. The test includes a system row with no `detail`.
  - **action (for example Stand up):**
    - glyph `↑`.
    - Roll is `label ?? 'Action'`.
    - All numeric columns and Outcome are `—`.
    - Detail is empty.
  - **roll entries:**
    - glyph is `⚔` when the label matches `/attack|damage/i`, else `⚄`.
    - Roll is `label ?? 'Roll'`.
    - Step is `step ?? '—'`.
    - Total is `total ?? '—'`.
    - vs is `D${difficulty}` when `difficulty != null`, else `—`.
    - Outcome is the `outcome.word` with `ok` styling (`hit`/`miss`), else `—`.
    - Detail is `mods.map(m => m.label).join(', ')`.
  - Never fabricate a number: a missing value is `—` (UI-GUIDELINES §5).
  - Newest-first order is unchanged (it comes from `loadRollLog`; no sort is added).
  - The empty state keeps the exact existing text, rendered in a single
    `colspan=7` row (or a div replacing the table). The clear button stays disabled
    when empty.
  - **Table markup:** for accessibility use real `<th scope="col">`, plus a
    visually-hidden header for the glyph column. In a shadow root, style the table
    inside the component CSS.
- **Dependencies:** I2/I4 (render composition). The narrow fold is part of I6. The
  mapper and its test can be built first, independently.
- **Acceptance criteria:**
  - Every field that the current `_logRow` renders appears in exactly one column. A
    test enumerates the three entry kinds and a roll with and without
    difficulty, outcome and mods.
  - The Notes-tab Log reads the same store and is unchanged.
  - The clear confirm modal is unchanged.
  - The order is newest first.
- **Risks / unknowns:**
  - The 320px cap on a table needs a scroll wrapper. On desktop the table is
    full-width with no cap (the old card stretched to the rail). Decide whether to
    cap desktop height. The ticket only mandates the mobile cap, so leave desktop
    uncapped, or add a generous `max-height` (for example 320px) if the table makes
    the tab very long. Flag in "Open questions".
  - Roll entry shapes: confirm `store-rolllog.js` field names (`outcome`,
    `difficulty`, `mods`) against the saved entries while writing the test fixtures.

### I6 — Page composition and narrow-screen fold (≤720px)
- **Covers tickets:** T6 (and the assembly of T1-T5)
- **Rules:** none
- **Tier:** 1 (qa-log entries 1 and 4)
- **What:** Compose the final `render()`: header line → attack + damage row →
  modifiers + potions row → log. Add the ≤720px rules.
- **Where:** `ui/ed-combat.js` (`render()` and the `@media (max-width: 720px)` block).
- **Approach:**
  - At ≤720px, all rows go to one column in the order Attack, Damage taken, Modifiers,
    Potions, Log. The header wraps with Defence, Armour, Initiative and Karma
    kept together as plain text. The segments share the row and wrap.
  - Log table fold: `thead` visually hidden (kept for assistive tech). Each `tr`
    becomes a two-line block, with `display:grid` areas. Line 1 holds
    glyph / Roll / Step / Total / vs / Outcome, and line 2 holds the muted Detail.
    The log container has `max-height: 320px; overflow: auto`.
  - `.top > *, grid children { min-width: 0 }` to prevent overflow, as today.
  - Keep the `1fr 240px` desktop row widths from the prototype, so the Damage taken
    card keeps its current width.
- **Dependencies:** I1-I5.
- **Acceptance criteria:**
  - No horizontal scroll at 375px width, and every control stays reachable and
    tappable.
  - Section order at ≤720px matches the ticket.
  - The log is capped at 320px with internal scroll at ≤720px.
  - Light and dark modes both work. Only `--fs-*` tokens are used for font-size, and
    only two weights (400/500).
- **Risks / unknowns:**
  - Table-to-stacked-row CSS in a shadow root needs a quick check at 375px.
  - The owner verifies UI themselves (memory: UI verification preference), so the
    implementer should not open a preview unless asked. Give a manual check list in
    the PR notes instead: 375px, light/dark, each modal (audit, take damage, drink,
    clear), and each segment.

### I7 — Docs and test sweep
- **Covers tickets:** T7
- **Rules:** none
- **Tier:** 1 (guideline text; qa-log entry 1)
- **What:**
  - Update the Combat row of `docs/UI-GUIDELINES.md` §4 to the new design. Suggested
    text: "Per-encounter scratchpad: a floating header line (Defence, Armour,
    Initiative with roll, Available Karma); the equipped weapon + attack talent
    card (attack/damage/strain stat-lines, target-# field) beside a Damage taken
    card; a segmented control over combat-option / situational / blood-charm chips
    (active-count badges, session-remembered selection); a Potions card; and the
    device-local roll log as a full-width table." Also add a dated italic owner
    sign-off note under the table, like the existing "Sixth tab" note (2026-10-04,
    owner sign-off, with a link to this plan).
  - Add a one-line "superseded layout" note near the top of `plans/PLAN-COMBAT-TAB.md`
    pointing at this plan and UI-GUIDELINES §4. Do not rewrite its history.
  - Grep the other docs for the old layout wording (`docs/*.md`, `ARCHITECTURE.md`).
    Only the two above currently match. Update `ARCHITECTURE.md` only if a statement
    turns out to be stale.
  - Run `npm test` (including the `pretest` import check). The new test files must
    pass, and no existing test should need changes. If the import checker flags
    the new `ui/` modules, fix the imports.
  - Add the spec's changelog line to `data/changelog.json` `unreleased.changes`.
    Do not touch the version; `/release-feature` owns versioning.
- **Where:** `docs/UI-GUIDELINES.md`, `plans/PLAN-COMBAT-TAB.md`, the two new test
  files from I3 and I5.
- **Approach:** Docs-only edits plus a final `npm test` run.
- **Dependencies:** I1-I6.
- **Acceptance criteria:**
  - UI-GUIDELINES §4 accurately describes the new Combat tab.
  - `npm test` passes.
  - No remaining doc statement claims the old rail / collapsible-section layout as
    current.
- **Risks / unknowns:** none significant.

## Sequencing
1. **I3-pure and I5-pure first** (`combat-mods-state.js`, `combat-log-rows.js` plus
   their tests). They are independent, DOM-free, and give early `npm test` signal.
2. **I1** (header line) — frees the attack-card header and removes the Defence card.
3. **I2** (attack + damage row).
4. **I3-view** (segmented control, scratchpad and day-reset wiring).
5. **I4** (Potions on its own row beside the modifiers).
6. **I5-view** (log table).
7. **I6** (composition and the ≤720px fold, plus CSS clean-up of orphaned rules).
8. **I7** (docs and a final `npm test`).

I2-I6 land as one build unit: I2 removes the `log`/`dab`/`mods` grid areas while the
old log, modifiers and potions are still composed in `render()` until I3-I6, so the
tab is only coherent once I6 composes the final `render()`. Do not ship or review
intermediate states.

The order is so because the view items all edit `ui/ed-combat.js`. Doing them as
sequential small edits keeps the file consistent. The pure modules are
done first because they are the only part with automated tests. The fold comes last
since it needs every block to exist.

## Open questions
Resolved 2026-10-04: owner approved all defaults below (qa-log, asked by dev-lead).
1. **Weapon art box on narrow screens.** The prototype hides it at ≤720px. Today it is
   shown. Default: keep it shown, `.attacktop` stays `auto 1fr`, art box capped at a
   small fixed size (I2).
2. (Stand-up location resolved: inside Damage taken, see I2.)
3. **Desktop log height.** The prototype table has no cap. Default: uncapped on desktop
   and capped at 320px at ≤720px per the ticket.
4. **Empty Combat options / Situational segments.** Only blood charms has an existing
   empty message today. Default: new one-line `.empty` messages with the wording fixed
   in I3. The owner may veto.
5. **Prototype classes.** `.hit`, `.miss` and `.r` are in the prototype. The app's
   `.logrow .lx` styles go away with the table.

## Review responses
- F1 (Stand-up default): fixed. `_standUpLine()` renders in the Damage taken card (I2);
  I2 acceptance reworded; I3 sits panel no longer renders it; open question removed.
- F2 (empty-state wording): fixed. Fixed wording in I3; open question 4 kept for veto.
- F3 (Detail separator): fixed. Non-empty parts joined with " · "; test for a system
  row without `detail` (I5).
- F4 (art box on mobile): fixed. `.attacktop` stays `auto 1fr`; art box capped small (I2).
- F5 (sequencing): fixed. I2-I6 land as one unit; I6 dropped from I5 dependencies.
- F6 (reset paths): fixed. Three reset paths listed as a manual check in I3.
No findings disputed.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
