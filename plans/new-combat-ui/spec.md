# Tech Spec: New-Combat-UI (new-combat-ui)

## Overview
View-only re-layout of the Combat tab (`ui/ed-combat.js`, Lit, shadow DOM) to the approved Option A (`plans/new-combat-ui/design-option-a.html`). `render()` is recomposed as: floating header line, then an Attack + Damage taken row, then a Modifiers + Potions row, then a flat full-width log table. Two small DOM-free modules (`ui/combat-mods-state.js`, `ui/combat-log-rows.js`) hold the only logic worth unit-testing (segment counts/normalisation, log row to cell mapping). No engine, store, schema, taxonomy, dispatch or roll-flow change.

## Guardrail alignment
- Tier 1 (UI/UX contract): `ui/ed-combat.js` layout and `docs/UI-GUIDELINES.md` §4 Combat row. Owner sign-off: qa-log entry 1 (2026-10-04); entries 2-6 and the dev-lead entry settle details.
- Data-down/dispatch-up holds: the view only renders `model` and dispatches the existing events (`ed-roll`, `ed-toggle-charm`, `ed-use-potion`, `ed-clear-pending-use`, `ed-edit-health`, `ed-day-reset` etc., all unchanged). The engine is untouched and pure.
- Store-only-inputs holds: the selected modifier segment (`modTab`) is session scratchpad state (the in-memory `SCRATCH` Map), never persisted to the character. Nothing derived is stored.
- Derived values: Defence/Armour/Initiative/Karma are rendered from the model. Unknown values keep the dashed placeholder pill via `_pend()`. The Karma pill is hidden on null.
- Tier 2: not triggered. No Tier-1 item was missed by the plan.

## Design
### Data / types
None stored. UI-only state:
- `_modTab`: `'opts' | 'sits' | 'charms'`, default `'opts'`, Lit `state: true`. Remembered in `SCRATCH` as `modTab`.
- Removed: `_collapsed` (property, constructor init, `SCRATCH.collapsed`, `_resetSession` reset), `defaultCollapsed`/`MOBILE_QUERY`.

### Modules & functions
New, pure, DOM-free, with node:test files alongside (pattern: `ui/item-equip-state.js`/`.test.js`):
- `ui/combat-mods-state.js`
  - `export const MOD_TABS = [{id:'opts',label:'Combat options'},{id:'sits',label:'Situational'},{id:'charms',label:'Blood charms'}]`
  - `export function modTabCounts({ options, armedNames, toggledOpts, sits, toggledSits, charmNames })` returns `{ opts, sits, charms }`.
    - `opts` is the number of options `o` where `o.arms ? armedNames.has(o.name) : toggledOpts.includes(o.name)`. This is the same rule as today's `_optSection`.
    - `sits` is `toggledSits.length` plus the number of `sits` entries with `locked`. This is the same rule as today's `_sitSection`.
    - `charms` is `charmNames.length`.
    - Inputs may be undefined, treated as empty.
  - `export function normalizeModTab(v)` returns `v` if it is one of the three ids, else `'opts'`.
- `ui/combat-log-rows.js`
  - `export function logRowCells(entry)` returns `{ glyph, roll, step, total, vs, outcome, detail }` (strings, except `outcome` which is `{ word, ok } | null`). Mapping is in "Rules"/"Edge cases" below and mirrors the current `_logRow`.

Changes in `ui/ed-combat.js`:
- Replace `_defArmourSection()` (L1116) with `_headerLine()`. Keep the `foldCombatRatings` and `_spellRatingMods` logic and `_combatRating(r)` verbatim. Drop the collapsible wrapper and `_collapsed['dab']`.
- Initiative (value, `_rollInitiative`, `?disabled=${!init?.value}`, `_lastInitTotal()` shown in `.initres`) moves from the attack-card header into `_headerLine()`.
- Karma pill, as in `ui/ed-spells.js`: `const karma = this.model?.characteristics?.karma?.available;` then `karma != null ? html\`<span class="kchip">Available Karma <b>${karma}</b></span>\` : ''`. Copy the `.kchip` CSS from ed-spells L64-65 plus `margin-left:auto`. Static, no click, no max.
- Remove `_modsGroup`, `_optSection`, `_sitSection`, `_charmSection`, `_sec`, `_toggleSec`. Add `_modsBlock()`:
  - Eyebrow "Combat modifiers".
  - A `.seg` row of three `<button aria-pressed=${active}>` built from `MOD_TABS`, with `<i>${count}</i>` shown only if count > 0. Click sets `_modTab` only.
  - Panel: opts `_chips(this._allOptions(), this._opts, 'opts')`; sits `_chips(this._situations(), this._sits, 'sits', 'sit')`; charms `_chips(charms, active, 'charms', 'charm')` with the existing "No blood charms equipped…" `.empty`.
  - For empty opts/sits, render `.empty` with "No combat options apply to this pick." and "No situations apply right now." (owner-approved).
  - `_chips` and `_toggle` are untouched.
- `_standUpLine()` (L1073) is called inside `_damageTbl()`'s card, above the pinned ✗ ⚄ ☼ buttons. It is no longer rendered in the Situational segment, so it is rendered in exactly one place.
- `_potionsSection()`: change the `.dablk/.dabhead/.dabbody` wrapper to generic `.blk` + `.h`. Logic, `_potionPill` and `_useModal` are unchanged.
- `_logBlock()`/`_logRow()` are replaced by a `<table>` that calls `logRowCells`:
  - Header cells are `<th scope="col">`: a visually hidden glyph header, then Roll, Step, Total, vs, Outcome, Detail.
  - Keep the clear button (disabled when empty), `_loadRolls`, `_clearLog` and the `ed-confirm` modal.
  - Empty state keeps the exact existing text: "No rolls yet — roll to begin. This log lives in this browser only (the Notes Log)."
  - Order is as returned by `loadRollLog` (newest first). No sort is added.
- Scratch wiring:
  - `_saveScratch` adds `modTab: this._modTab`.
  - `_restoreScratch` sets `this._modTab = normalizeModTab(s.modTab)`.
  - `_resetSession` sets `_modTab = 'opts'`.
  - `_clearDayState` (L454) sets `_modTab = 'opts'`.
  - `clearCombatScratch` (L45) adds `modTab: 'opts'` to the cached reset.
- `render()` (L1434) composes: `_headerLine()`, then `.top2` (attack card | damage card, `minmax(0,1fr) 240px`, `align-items:stretch`), then the mods row (`_modsBlock()` | `_potionsSection()`, `minmax(0,1fr) 240px`, `align-items:start`), then the log table.
- CSS: drop `.dab*`, `.sec*`, `.dabpair`, the grid-areas `.top`, `.h .r`, `.logrow/.lx/.lt` and the old initiative-in-header styles. Add `.float/.item`, `.seg`, the table styles and `.dtbtns{align-items:center}`. Scope header-line styles under `.float` because `.v` is shared. Tokens only (`--fs-*`, existing colour vars).

Also change:
- `docs/UI-GUIDELINES.md` §4 Combat row (suggested text is in plan I7) plus a dated owner sign-off italic note under the table.
- `plans/PLAN-COMBAT-TAB.md`: a one-line "superseded layout" note.

### UI / behavior
- Header line: Defence `PD · MD · SD` and Armour `Phys · Myst` with the existing delta badges, Initiative value + ⚄ roll + last result, and the Karma pill at the right end. It wraps at ≤720px.
- Attack card: contents are unchanged (art box, pickers, stat-lines, ⓘ audits, `vs #`, `succ`, bonus badge, range).
- Damage taken card: contents are unchanged, plus the Stand-up bar now lives here.
- Modifiers: segments start on Combat options. Counts are live for all three segments. Switching segments never clears or alters a chip. Buttons are keyboard-operable and use `aria-pressed`.
- Potions card: behaviour and modal are unchanged. Escape closes and Enter confirms via the shared modal contract (`docs/MODALS.md`). No modal code is touched.
- Log: flat table. Desktop is uncapped (the store holds at most 20 entries by default).
- Narrow fold (≤720px, existing breakpoint):
  - All rows go to one column in the order Attack, Damage taken, Modifiers, Potions, Log.
  - `.attacktop` stays `auto 1fr` and the art box stays visible. Do NOT copy the prototype's `display:none` or one-column rules. Cap the art box at a small fixed size (for example `height:96px`).
  - Segments wrap. Use a radius that reads well when wrapped.
  - Log `thead` is visually hidden but kept for assistive tech. Each `tr` becomes a two-line grid: line 1 glyph/Roll/Step/Total/vs/Outcome, line 2 muted Detail.
  - The log container has `max-height:320px; overflow:auto`.
  - Grid children get `min-width:0`. There is no horizontal scroll at 375px.
- Light and dark themes both work via tokens. Only weights 400/500 are used. The Overview viewport fit is not affected.

### Rules
None. `rules.md` records 0 rules. No Earthdawn value or formula is asserted. All numbers come from the existing model.

Log cell mapping (UI mapping, mirrors current `_logRow`; not an Earthdawn rule):

| Entry kind | glyph | roll | step | total | vs | outcome | detail |
|---|---|---|---|---|---|---|---|
| `system`, `log`, `advancement` | `✦` | `label ?? 'System'` | `—` | `—` | `—` | `null` (shown `—`) | non-empty parts of [`detail`, `${legendCost} Legend` if `legendCost != null`, `${silverFee} sp` if `silverFee > 0`, `coinDelta` if truthy] joined with " · "; empty string if none |
| `action` | `↑` | `label ?? 'Action'` | `—` | `—` | `—` | `null` | empty string |
| roll (anything else) | `⚔` if `/attack\|damage/i` matches the label, else `⚄` | `label ?? 'Roll'` | `step ?? '—'` | `total ?? '—'` | `D${difficulty}` if `difficulty != null`, else `—` | `{word, ok}` from `outcome`, else `null` | `mods.map(m => m.label).join(', ')` (empty if no mods) |

### Edge cases & invariants
- Karma 0 shows the pill ("Available Karma 0"). Null or undefined hides it. Use `!= null`.
- Badge counts are hidden at 0 (view rule). `modTabCounts` returns 0.
- An unknown or missing cached `modTab` falls back to `'opts'`. No migration is needed because `SCRATCH` is in memory only.
- `modTab` resets on reload (the Map is gone), on character switch (`_resetSession`), and on day reset (both `clearCombatScratch` paths). It is remembered otherwise within the session.
- A system row with no `detail` has no leading or trailing " · ". A row with only `legendCost: 0` shows "0 Legend" (`!= null`).
- Never fabricate numbers: a missing value is `—`.
- Knocked Down Stand-up is visible whenever the condition is live, independent of the selected segment, and appears once.
- The Notes-tab Log reads the same store and is unchanged.
- `npm test`'s `pretest` import check (`tools/check-imports.mjs`) must pass with the new modules.

## Testability notes
- node:test (`npm test`):
  - `ui/combat-mods-state.test.js`
    - Counts: a toggled non-arms option counts only if toggled.
    - Counts: an arms option counts only if in `armedNames`, regardless of `toggledOpts`.
    - Counts: sits is toggled plus locked.
    - Counts: charms is the names length.
    - Counts: undefined inputs give 0.
    - `normalizeModTab`: valid ids pass through; `undefined`, `null`, `''` and `'x'` give `'opts'`.
  - `ui/combat-log-rows.test.js`
    - system row with all of detail/legend/silver/coin.
    - system row with no `detail` (no stray separator).
    - system row with `silverFee: 0` (omitted) and `legendCost: 0` (shown).
    - action row.
    - roll row with full data.
    - roll row without difficulty/outcome/mods (`—`, `null`, empty).
    - glyph `⚔` for "Attack"/"Damage" labels and `⚄` otherwise.
    - missing labels use the defaults.
- Owner manual verification (no DOM tests exist; the owner does UI checks):
  - 375px layout: no horizontal scroll, segments wrap, the log folds to two-line rows with a 320px internal scroll, the art box is capped.
  - Light and dark themes.
  - Modals: audit, take damage, drink and clear (Escape/Enter).
  - Each segment, with counts updating.
  - The three modTab reset paths: character switch, day reset, reload.
  - Stand-up bar in the Damage taken card.
  - Karma pill at 0 and null.

## Changelog entry
Combat tab redesigned: a header line with Defence, Armour, Initiative and Available Karma, side-by-side Attack and Damage cards, tabbed combat modifiers, and the combat log as a table.

## Out of scope
- Engine, store, data, schema and effect taxonomy changes.
- Dispatch events, roll flows, and what is rolled or computed.
- Other tabs, the roll modal, and the Notes-tab Log (shared store, unchanged).
- Version bumps and release entries (the release workflow owns them; the `unreleased` changelog line is in scope).
- Rewriting `plans/mock-combat-tab.html` or the history in `plans/PLAN-COMBAT-TAB.md`.
