# Tech Spec: Night's Edge (spell-nights-edge)

## Overview
Add taxonomy v6 (string dice values for `measure:"dice"`, optional `object` selector), align the `Night’s Edge` entry in `rules/spells.json` to the book, and wire it end to end. A self-cast opens a standard modal (weapon pick + editable target number); the choice is stored as `chosen: {name, index}` on the session-only active-spell record; `engine/combat.js` folds the D4 into the chosen equipped weapon's Damage pool as `bonusDice`; the roll path rolls it as a separate exploding group. A no-equipped-weapon "Cast on nothing" escape wastes threads and the spell. Plan.md is authoritative; this spec only pins contracts. Build order I1..I8 per plan.

## Guardrail alignment
- I1 Tier 2: doc bump to v6, migrate every `rules/*.json` `effectTaxonomy` ref, update stamping code and conformance, all together.
- I2..I8 Tier 3. No Tier 1 item; no sign-off needed (tickets.md, build-log gate 1).
- Data down / events up: the modal's pick, number and touched flag are transient view state; the only dispatches are `ed-spell-activate` (now with `object`), existing roll events, and new `ed-spell-wasted`. Engine stays pure and DOM-free (all new helpers in `engine/`). Nothing new is persisted: `chosen` lives in `_activeSpells` (session-only); the wasted log row reuses the existing device-local Roll Log. Derived values are not stored; unknown values keep placeholder pills.

## Design
### Data / types
- `docs/EFFECT-TAXONOMY.md` v6: `measure:"dice"` value is a string matching `^(\d*D(4|6|8|10|12|20))(\+\d*D(4|6|8|10|12|20))*$` (leading count optional: `D4`, `2D6`, `D4+D6`). New optional effect field `object: {kind: "weapon"|"melee-weapon"|"missile-weapon"|"character"|"item", require?: "equipped"}`. Semantics: chosen at activation, session-only; `require` gates when the effect folds; when `object` is present `object.kind` replaces `scope` for matching, otherwise `scope` is unchanged. Add Night's Edge worked example (section 10) and the version-history line.
- `rules/spells.json` `Night’s Edge` (curly apostrophe, ~line 1344): `successes: [Increase Duration (+2 rounds)]` copied from Arrow of Night; `extraThreads`: Increase Effect (+2 Damage Step) = `attack-modifier {attack, Damage}` add 2 `measure:"step"` `duration:"sustained"` with the same `object`; Increase Range (+10 yards) note; Additional Target (+Rank) note (copy the Arrow of Night wording). Top-level effects: (1) sustained `attack-modifier {attack, Damage}` add `measure:"dice"` `value:"D4"` `source:"spell"` `object:{kind:"weapon",require:"equipped"}` with summary, NOT gmDiscretion; (2) `note` `gmDiscretion:true` for -2 Mystic Defense until end of next round. Fix `summary`.
- Active record (session-only): `{...existing, chosen?: {name, index}}`. `index` = 0-based occurrence among equipped items of that name. `activeSpellEffects` stamps object-bearing effects with `object` (unchanged) and `chosen`; others get neither.
- `store.js equippedWeapons` (~1378) adds `mysticDefense: it.thread?.mysticDefense ?? null`.
- Wasted log entry: `{label:"Cast — <spell> (wasted: no equipped weapon)", total:null, step:null, dice:[], outcome:{word:"Wasted",ok:false}, rollId}`. Wasted `_prog` marker: `cast: {total:null, levels:0, outcome:{word:'Wasted',ok:false}}`, same for `effect`.
- Roll result gains an optional `bonusResult: {dice:[...], total}` group; absent on old entries and non-bonus rolls.

### Modules & functions
- `docs/EFFECT-TAXONOMY.md`, all `rules/*.json`, `tools/worker/worker.js:287`, `tools/dev-server.mjs:70`, `tools/rules-conformance.test.js` (replace v5 literal ~125-129; add `validateObject` / `validateDiceValue` exported or unit-testable; reject malformed kind/dice, dice string on non-dice measure, numeric value on dice measure), plus v5 mentions in the other tests and docs listed in plan Discoveries (grep `v5`, `(v5)`; leave historical plan docs).
- Reader audit (I1): list every reader of `e.value` / `.measure` / `Number(e.value)` in `store.js` (fold ~960-972, `activeSpellEffects`), `engine/`, `ui/` (Active effects, effect-source displays, pills), `tools/` homebrew validation; guard or confirm measure-gated; add a no-NaN test.
- `engine/dice.js`: `parseDice(str) -> Array<{count,sides}>|null` (null on junk); `rollDiceList(list, rng) -> {dice:[{sides,rolls:[...]}], total}` exploding per die via `rollDie`, separate group from step and Karma dice.
- `engine/spells.js`: `spellObjectRequirement(spell)`; `weaponOccurrence(equippedWeapons, weapon) -> number`; `buildActiveSpell(spell, rank, ctx)` accepts `ctx.object` -> `record.chosen`; label rule (dice effect present: "+D4 Damage", standalone step appended ", +2 Damage Step"; else existing numeric logic; no dice and no number: existing summary fallback); `activeSpellEffects` stamping; `castWeaponChoices(ctx) -> {choices:[{name,index,label}], empty, reason}` (labels "Spear", "Spear (2nd)", "Spear (3rd)" only when duplicates; `empty:true, reason:'No equipped weapon'` when spell needs `object` and none matches `object.kind`; never empty for spells without `object`); `weaponMysticDefense(weapon) -> number|null` (thread value if number, else 2, null if no weapon); `nextCastNumber({current,touched,weapon})`; `wastedCastLogEntry({spellName,rollId,at})`; `effectReadout` / `otherCastOutcome` handle dice values (D4 and the penalty note render under Target effects; no Effect-roll button for Night's Edge).
- `engine/combat.js`: `foldPool` collects `bonusDice` for `measure:'dice'` (no step effect); `damagePool` returns `{step,resultMods,bonusDice}`; `auditPool` adds parts `kind:'dice'`; `activeSpellBundlesFor(activeEffects, weaponCategory, weapon)` (weapon = `{name, category, index}`): object-bearing effects admitted only if kind matches (weapon any; melee/missile by category) and `chosen.name`/`chosen.index` match; others keep `scope` filtering (Arrow of Night unchanged).
- `ui/ed-combat.js`: `_activeSpellBundles` passes the selected weapon + occurrence index; `_rollDamage` passes `dp.bonusDice` in `_roll` options; Damage pill shows "Step N + D4"; audit lists "Night's Edge: +D4".
- `ui/ed-app.js`: `_activateSpell` forwards `object`; roll handling rolls `bonusDice` via `rollDiceList`, adds to `_grandTotal` through a pure helper; new `ed-spell-wasted` handler calls `saveRollLog` (`store-rolllog.js:50`) with `wastedCastLogEntry`.
- `store-rolllog.js`, `ui/combat-log-rows.js`: record/read `bonusResult`, tolerate absence; wasted entry renders label + outcome word, dashes for nulls. Check Spells Log and Notes Roll Log readers for arithmetic on `total`/`dice`; record checked readers in the build log.
- `ui/ed-spells.js`: Cast press for object-bearing self-cast opens the cast modal via `ui/modal-controller.js`; `_castOnNothing(plan)` (reset as lines ~453-461, bump `_castSeq`, no roll, no `ed-spell-activate`, dispatch `ed-spell-wasted`, then `_loadRolls()`); snapshot weapon+number in `_castPicks`; hide "vs" box for this case (static hint "Target number set when you cast"; roll summary reads the confirmed number). Verify `_rollRes`, banner, line ~455 and the persisted snapshot (~320-355) tolerate null `total`.
- `ui/ed-roll-modal.js` (I5b): bonus group in the die chain, total, Karma/re-roll still correct.
- Docs: `docs/THREAD-ITEMS.md` (`mysticDefense` also default cast target number), `ARCHITECTURE.md`, `docs/MODALS.md` / `UI-GUIDELINES.md` if a pattern is added, version mentions; `data/changelog.json`.

### UI / behavior
- Self-cast, object spell, weapons available: modal lists equipped weapons (first preselected), number field prefilled from `weaponMysticDefense`; weapon change re-prefills only while untouched; Confirm requires a positive integer; Confirm closes WITHOUT focus return (roll modal takes over); Karma re-roll never reopens the modal.
- Escape/backdrop/Close: no roll, no state change, focus returns to Cast. Enter confirms (also inside number field); primary control has initial focus; Tab trapped.
- No weapon: same modal, body "No equipped weapon", primary "Cast on nothing", Close. Wastes threads/spell, wasted log row, armed Anticipate Spell stays armed. Cancel spends nothing.
- Cast on Other: no modal; text under Target effects. Other spells and Cast on Other keep the "vs" box.
- Weapon unequipped mid-spell: record keeps counting; D4 absent until re-equipped. Active effects row names the weapon ("Night's Edge — Broadsword", label "+D4 Damage").
- Theme tokens (light + dark) and `--fs-*` type tokens only.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Stat block | Nethermancer C2, threads 0, weaving 6/11, vs target's Mystic Defense, Touch, Rank+5 rounds, +D4 Bonus Die to weapon Damage; success level +2 rounds; extra threads +2 Damage Step, +10 yards, +Rank targets | R1 (Q019, PG p.324) |
| Every Damage test | D4 on every Damage test with the chosen weapon while active | R2 (house, owner) |
| Weapons | Equipped/wielded only, any type | R3 (house, owner) |
| Penalty | -2 Mystic Defense on any target damaged, until end of next round; gmDiscretion note | R4 (Q019) |
| Bonus Die | Explodes (max roll earns another of same type, repeating); separate die alongside step dice and Karma die (inference, moderate confidence) | R5 (Q020) |
| Cast target | Weapon's Mystic Defense: `thread.mysticDefense` if present else 2; editable | R6 (Q021, house, owner) |
| Willing target lowers MD to 2 | NOT applied | R7 |

### Edge cases & invariants
- Duplicate names: `[Spear, Sword, Spear]` occurrences 0,0,1; D4 on the chosen occurrence only; unequipping an earlier same-name item shifts indices (documented, accepted).
- Re-cast refreshes by name and replaces the previous weapon.
- Dice effect never changes `step`; attack pool unaffected; no NaN anywhere from string values.
- Rolls without bonus dice are byte-identical to before; old log entries read fine.
- `_pendingStep` never set by "Cast on nothing"; `_prog` reset identical to an ordinary non-step cast.

## Testability notes
node:test: conformance validators (malformed fixtures); `parseDice`, `rollDiceList` (injected RNG: max explodes repeatedly, non-max does not, separate group); `buildActiveSpell` / `activeSpellEffects` / labels / `weaponOccurrence` / Arrow of Night regression; `activeSpellBundlesFor` and `damagePool` / `auditPool`; `castWeaponChoices`, `weaponMysticDefense`, `nextCastNumber`, `wastedCastLogEntry` + `saveRollLog` round-trip; `combat-log-rows` wasted and bonus entries; store test for `equippedWeapons.mysticDefense` (10 / null); no-NaN reader test; Night's Edge option-count assertions in `spells-options.test.js`.
Owner manual (UI): per plan's "Owner manual verification" list (modal flow, focus handoff, wasted state, roll-modal bonus group, Combat pill/audit, Active effects row, Target effects text, theme).

## Changelog entry
"Night's Edge now works end to end: pick a weapon when you cast it and its Damage tests gain a D4 Bonus Die for the spell's duration."

## Out of scope
Night's Blade knack (-4); using `character`/`item`/`melee-weapon`/`missile-weapon` kinds in data; modelling the target's -2 Mystic Defense; applying R7; item ids (separate Tier-1 feature).
