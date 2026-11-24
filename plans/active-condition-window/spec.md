# Tech Spec: Active effects window (active-condition-window)

## Overview
One pure engine module (`engine/active-effects.js`) defines the entry/record contract, a builder that folds every session source into one ordered list, a grouper, and the reducers (add / tick / end / clear). `store.js` calls the builder and exposes the result as the NEW key `model.effectWindow`; `ui/ed-app.js` owns the session lists and is a thin dispatcher onto the reducers. A new Lit element `ui/ed-active-effects.js` renders the grouped list (Spells-card look) from `.effects` only and dispatches `ed-end-effect`; it is mounted in `ed-combat` (columns) and `ed-spells` (stack). Taunt ships as `arms {roll:{vs:"Social"}, rounds:"rank"}` on the Taunt talent. Nothing is persisted; `model.activeEffects` (Overview strip) is untouched.

## Guardrail alignment
- Tiers (confirmed against the plan): I1, I2a, I2b, I3, I7 = Tier 3 (pure engine, session-only state, existing `arms` field with a new VALUE `"rank"`, docs; no taxonomy version bump, no schema shape change). I4, I5, I6 = Tier 1 (UI-GUIDELINES s4 Combat/Spells tab contents) - owner sign-off 2026-11-24 (qa-log "Tier-1 sign-off"; brief T4-T6). UI-GUIDELINES s4 is updated in the same change (I7). No Tier-2 items.
- Data down / events up: `ed-active-effects` takes `.effects` + `.layout` and dispatches events; it computes nothing (the `low` flag, pct, grouping, labels all come from the engine). Reducers and ticking are pure engine functions; ed-app only calls them. Engine stays DOM-free.
- Store only inputs: every new list (`_opponentEffects`, `_toggledOptions`, `_targetName`) is session-only, never written to the character file; `effectWindow` is derived at model assembly.
- Placeholder pills: an unknown effect text/total renders the existing `—` placeholder style (see `tepend` "Effect —"); never a fabricated value.
- Discovery: `armedTalents` consumers would otherwise treat Taunt as a bonus. Resolved by keeping opponent records OUT of `armedTalents` entirely (see I3) plus a defensive skip. No missed Tier-1 item.

## Design
### Data / types
No stored data. Session shapes (JSDoc typedefs in `engine/active-effects.js`):

```
Entry (model.effectWindow[i]):
{ id, kind: 'spell'|'talent'|'option'|'charm'|'situation'|'condition',
  side: 'atk'|'you'|'tgt',            // group: This attack / Lasting - on you / Lasting - on target
  name, effectLabel, text,            // text = longer description (Taunt "-1 tests / -1 Social Def per success")
  roundsLeft, roundsTotal,            // null for round-free entries (side 'atk' or untimed situations)
  pct, low,                           // derived here: pct 0-100 (100 when untimed), low = roundsLeft != null && roundsLeft <= 3
  chips: [{label, count?}],           // spell options/success picks
  targetName,                         // string|null; display label for tgt entries ("target" fallback applied by the builder)
  endable, endAction }                // endAction = {kind, id}; null when endable === false
OpponentRecord (session, ed-app _opponentEffects):
{ id: 'opp:<seq>', kind: 'spell'|'talent', name, effectLabel, text, targetName, roundsLeft, roundsTotal }
```

Entry ids (stable, used as keys and for X routing): `spell:<name>`, `talent:<name>` (Aim), `opp:<seq>`, `option:<name>`, `charm:<name>`, `situation:<name>`, `condition:Knocked Down`, `condition:Encumbered Harried`.

New model keys (all derived/pass-through, NOT stored): `model.effectWindow` (Entry[]), `model.targetName` (string, "" = blank), `model.toggledOptions` (string[]). New session fields passed to store alongside `activeSpells/activeCharms/armedTalents` (ed-app l.1314-1316): `opponentEffects`, `toggledOptions`, `targetName`.

Rules data: `rules/talents.json` Taunt (l.2803) gains `"arms": { "roll": { "vs": "Social" }, "rounds": "rank" }`. Nothing else in that file changes.

### Modules & functions

**I1 / I2a - `engine/active-effects.js` (new) + `engine/active-effects.test.js`** (pure, no DOM, no imports from ui):
- `export const GROUPS = [{side:'atk', label:'This attack'}, {side:'you', label:'Lasting · on you'}, {side:'tgt', label:'Lasting · on target'}]`
- `export function buildActiveEffectsList({ spells, opponent, armed, options, charms, situations, knockedDown, encumbranceHarried, targetNameFallback = 'target' })` -> Entry[].
  - `spells`: session `activeSpells` records (shape from `buildActiveSpell`: name, effectLabel, roundsLeft, roundsTotal, chosen, options{picks,success}) -> kind `spell`, side `you`; `chosen.name` appended to name as `ed-spells._activeRow` does today; chips from `options.picks/success` (`label`, `count` when >1, success `mult` as count).
  - `opponent`: OpponentRecords -> side `tgt`, `endAction {kind, id}`; a blank `targetName` shows as `targetNameFallback`.
  - `armed`: `armedTalents` records WITHOUT `opponent` -> kind `talent`, side `you` (Aim), roundsLeft/Total from the record, effectLabel e.g. `+2 Attack x<successes>` is NOT computed here: store passes a pre-formatted `effectLabel` per armed record via a small `armedLabel` map - if absent, label is `successes` count text ("2 successes"). A record with `opponent:true` is skipped (defensive).
  - `options`: `[{name, summary}]` for each toggled option name (store resolves summary from `combatRules.options` / talent options; unknown -> summary '') -> kind `option`, side `atk`, roundsLeft null, `endAction {kind:'option', id}`.
  - `charms`: `[{name, summary}]` for each active charm -> kind `charm`, side `atk`, endable, `endAction {kind:'charm'}` (deactivate only).
  - `situations`: `[{name, summary}]` (store's `activeSituations` + summary) -> kind `situation`, side `you`, roundsLeft null, endable, `endAction {kind:'situation', id}`.
  - `knockedDown` (bool) -> kind `condition`, name "Knocked Down", side `you`, `endable:false`, `endAction:null`. `encumbranceHarried` (bool; true when weightStanding.stage is BURDENED, store l.1389) -> kind `condition`, name "Harried", effectLabel "encumbrance", `endable:false`.
  - Order: by GROUPS order (atk, you, tgt), then source order within group = spells, armed, charms/options, situations, conditions, opponent (insertion order within each). Deterministic.
- `export function groupEffects(list)` -> `[{side, label, items}]` for all three groups (empty groups kept with `items: []`, so the Combat columns always render 3 headings).
- Reducers (all pure, never mutate input):
  - `addOpponentEffect(list, rec)` -> `[...list, rec]` (no dedupe; ids unique per cast).
  - `tickOpponentEffects(list)` -> decrement `roundsLeft`, drop those reaching 0 (same contract as `tickArmedTalents`, engine/combat.js l.123).
  - `endEffect(state, {kind, id})` where `state = {activeSpells, opponentEffects, armedTalents, toggledOptions, activeCharms}` -> `{ state: next, action: null | {type:'toggle-situation', name} }`. spell: remove by name; opponent (`opp:` id): remove by id; talent: remove from `armedTalents` by name; option: remove from `toggledOptions`; charm: remove from `activeCharms` only (NO unequip); situation: state unchanged, `action {type:'toggle-situation', name}` (ed-app calls its existing `_toggleSituation(name)`); condition: state unchanged, action null (no-op). Unknown id -> state unchanged.
  - `clearAll()` -> `{ opponentEffects: [], toggledOptions: [] }` (spells/arms/charms are cleared by ed-app's existing code; ed-app also calls this).
  - `armOpponent({ arms, successes, targetName, seq })` -> `OpponentRecord | null` (null when `successes <= 0` or `!arms.opponent`); `roundsLeft = roundsTotal = arms.rounds` (already numeric, see I3); `id = 'opp:'+seq`; `kind 'talent'`; `effectLabel = successes+' success'+(s>1?'es':'')`; `text = arms.text`.
  - `otherCastToRecord({ outcome, spell, seq, targetName })` -> `OpponentRecord | null`: null unless `outcome.hit` and `outcome.duration?.rounds` is a positive number (non-parsable/absent duration -> no entry). `roundsLeft = roundsTotal = outcome.duration.rounds` (minutes x10, hours x600 already done by `durationRounds` in engine/spells.js l.309 - do not re-convert). `id 'opp:'+seq`, `kind 'spell'`, `name outcome.spell`, `effectLabel` = `outcome.effect?.text ?? null` (placeholder while Effect total is pending), `text = outcome.text`.
  - `setOtherCastEffect(list, seqId, effectText)` -> updates `effectLabel` of that record (follow-up event).
- `export function removeToggled(names, remove)` helper not needed in ed-combat: option-end sync is removal-only (see I2b).

**I2a - `ui/ed-app.js`**
- Constructor (l.668-672 block): add `this._opponentEffects = []; this._toggledOptions = []; this._targetName = ''; this._effectSeq = 0;`.
- `_advanceRound()` (l.1033): `this._opponentEffects = tickOpponentEffects(this._opponentEffects)` (set needsDerive); `this._toggledOptions = []` (single-round options). Ticking happens ONLY here.
- Day reset finalize (l.1430-1431): `this._opponentEffects = []; this._toggledOptions = [];`. Character switch: wherever ed-app loads another character, reset the same three session fields and `_targetName`.
- Session passed to store (l.1314-1316): add `opponentEffects`, `toggledOptions`, `targetName`.
- New listeners (next to l.479-518):
  - `ed-end-effect` `{kind, id}` -> `endEffect(...)`, assign returned state fields, run `action` (toggle-situation -> `this._toggleSituation(name)`), `this._model = this._derive()`.
  - `ed-target-name` `{name}` -> `this._targetName = String(name ?? '').trim()`; derive.
  - `ed-options-toggled` `{names}` -> `this._toggledOptions = [...names]`; derive (mirror only).
  - `ed-other-cast` `{seq, spell, targetName, levels, total, castingRank, extraPicks}` -> build `cast = {name:spell, target, total, levels, extraPicks, effectTotal:null}`, `outcome = otherCastOutcome(joinSpell(ctx, spell)/rules spell, cast, {rank:castingRank})`, `rec = otherCastToRecord({...})`; if rec, `addOpponentEffect`. `seq` is the ed-spells `_castSeq`; ed-app uses `_effectSeq` for the record id and keeps a map `castSeq -> recId` so the follow-up resolves it.
  - `ed-other-cast-effect` `{seq, effectTotal}` -> `setOtherCastEffect` with `Effect <total>`.
- ed-roll handler (l.390-399): when `arms.opponent`: `rec = armOpponent({arms, successes, targetName: this._targetName, seq: ++this._effectSeq})`; if rec, `addOpponentEffect`; DO NOT touch `_armedTalents` (a miss adds nothing and clears nothing). Non-opponent arms: existing replace-by-name branch unchanged.

**I2a - `store.js`**
- Model assembly (~l.2203): add after `armedTalents`:
  `effectWindow: buildActiveEffectsList({ spells: session?.activeSpells ?? [], opponent: session?.opponentEffects ?? [], armed: session?.armedTalents ?? [], options, charms, situations, knockedDown: session?.knockedDown === true, encumbranceHarried: burdened })`, `targetName: session?.targetName ?? ''`, `toggledOptions: session?.toggledOptions ?? []`. `options`/`charms`/`situations` are small `{name, summary}` arrays built from `combatFile.options`/talent options, equipped-charm items and `activeSituations`+`combatFile.situations[].summary`. `model.activeEffects` line (l.2203) is NOT edited.
- `spellsCtx.active` (l.2042) stays for the cast flow (`ed-spells` `ctx.active` consumers other than the old card).

**I2b - option lift / target name / cast event**
- `ui/ed-combat.js`: add `_pushOpts()` that dispatches `ed-options-toggled {names: [...this._opts]}`; call it from the toggle handler (l.~986 `key==='_opts'`), SCRATCH restore (l.400-437, after `_opts` assignment), the local resets (l.421, 435), and the Initiative reset (l.904). Sync DOWN is removal-only to avoid a loop: in the existing model-sync block (l.381-386 style), if `_opts` contains a name absent from `model.toggledOptions` AND the last push already matched the model, drop the name locally (this is how the window's X untoggles). `_charmsOn` legacy sync is unchanged. Keep SCRATCH `target` (number) as is; do NOT add a name to SCRATCH (name state is `model.targetName` only).
- `ui/ed-spells.js`: on cast `step === 'cast'` with `_castOnOther` (l.454-457) additionally dispatch `ed-other-cast` (payload above; `targetName` = `this.ctx.targetName ?? ''`, i.e. the shared model value, `castingRank` from `this.ctx?.castingRank`). On `step === 'effect'` (l.486-488) dispatch `ed-other-cast-effect {seq: this._castSeq, effectTotal: res.total}`. The local `_otherCast` raw record stays only to render the cast result panel.
- `ui/ed-disciplines.js`: no name field; the Disciplines-rolled Taunt labels with `model.targetName`.
- A pure helper `ui/combat-mods-state.js` addition `optionsAfterPush(opts, modelNames)` (removal-only reconcile) with tests in `combat-mods-state.test.js`; existing `modTabCounts` outputs unchanged.

**I3 - Taunt plumbing**
1. `rules/talents.json` l.2803: add `arms`; update header note l.11 (`"rank"` allowed for `arms.rounds`).
2. `store.js` l.1184-1192: `rounds` becomes `resolveArmRounds(cat.arms.rounds, rank)`: number stays; `"rank"` -> `Math.max(1, t.rank ?? 1)`; missing -> 1. Add to the descriptor `opponent: cat.arms.roll?.vs === 'Social'` and `text: opponent ? firstNoteSummary(cat.effects) : null` (the talent's `note` effect summary: "Per success the target gets -1 to tests and -1 Social Defense for Rank rounds."). Payload `effects` filter (l.1194) unchanged -> Taunt `effects: []`.
3. Descriptor builders add `opponent`/`text`: `ui/ed-disciplines.js` `_rollDetail` l.409 (`arms: {..., opponent: t.arms.opponent ?? false, text: t.arms.text ?? null}`) and `ui/ed-combat.js` l.804 (`opt.arms`) and the `_rollAim`/talent-pick path used by `_rollAttack` l.834 (Taunt is picked from the talent picker, `arms: t.arms` at l.560). The aim `vs` ("Social") label reaches the modal unchanged (`aim: {vs}`).
4. `ui/ed-app.js` ed-roll handler: see I2a.
5. `ui/ed-roll-modal.js` l.521: when `this.arms?.opponent`, hint reads "Each success applies the effect to the target." (`this.arms` is the roll config; confirm the field name the modal already holds - `_isAim()` uses `this.aim`; pass `opponent` on `aim` too if `arms` is not on the modal).
6. Consumer audit (skip `a.opponent`): `store.js` l.2053 loop, `engine/combat.js` `collectCombatEffects` l.579, `ed-combat.js` `_armedForPick` l.689 and l.1027/1294 (`armedNames`), `ed-spells.js` l.1271. Defensive only: opponent records are never in `armedTalents`.
7. Docs: EFFECT-TAXONOMY s6 value note.

**I4 - `ui/ed-active-effects.js` (new) + `ui/active-effects-state.js` (+ test)**
- `customElement 'ed-active-effects'`, props `effects` (Entry[]), `layout` ('columns'|'stack'). Renders heading "Active effects · N", then via `groupEffects` (copied display grouping done in `active-effects-state.js` `viewGroups(effects)`: omits empty groups in `stack`, keeps all three in `columns`). Row markup reuses `_activeRow` (mark, name · effectLabel, bar `style=width:pct%`, rounds pill `"N rds"` or "this attack"/"active" for round-free; amber bar/pill when `low`). X button (a `<button class="btn">`-free small icon button, no inline style) hidden when `endable === false`; click dispatches `ed-end-effect {kind, id}` (bubbles, composed) from `endAction`. Empty state text (keep the old aeempty wording). Escape/modal behavior: none (not a modal).
- CSS: move `.aecard/.aerow/.aemark/.aename/.aefx/.aebar/.aeopts/.aerounds/.aeempty/.aehead` from `ed-spells.js` into the new element; define `--spell` / `--amber` / `--karma` fallbacks on `:host` (Combat lacks these tokens). Font sizes use `var(--fs-*)` only (check-ui-kit font-size rule). Light and dark both work through the existing theme tokens.
- `ui/active-effects-state.js` exports: `viewGroups(effects, layout)`, `roundsPillText(entry)` (`"N rds"` | `"this attack"` | `"active"`), `endButtonLabel(entry)` (`"End <name>"`). Pure, tested.
- Run `node tools/check-ui-kit.mjs` and `node tools/check-imports.mjs`; if the ed-spells CSS move lowers a baseline count, lower `tools/ui-kit-baseline.json` in the same change (two-way ratchet).

**I5 - `ui/ed-combat.js` render (~l.1400)**: insert `<ed-active-effects .effects=${this.model?.effectWindow ?? []} .layout=${'columns'}>` between the Modifiers/Potions block and the Combat log. Add an optional name input to the attack row: `<input aria-label="Opponent name" placeholder="target" .value=${this.model?.targetName ?? ''} @change=...>` dispatching `ed-target-name {name}` (on `input` debounced not needed; `change` + blur). Import `./ed-active-effects.js`.

**I6 - `ui/ed-spells.js`**: delete `_targetEffects()` (l.516-544) and `_activeRow`/`_activeEffects` (l.503-512, 546-564) plus their CSS; l.1498 becomes `<ed-active-effects .effects=${this.ctx?.effectWindow ?? []} .layout=${'stack'}>` shown for both subjects (self and other). The cast result panel / success banner stay. `ctx` must expose `effectWindow` and `targetName`: store sets `spellsCtx.effectWindow` and `spellsCtx.targetName` next to `spellsCtx.active` (l.2042). The cast-on-Other target input binds to `ctx.targetName` and dispatches `ed-target-name`. Update ed-spells tests that referenced the Target effects card (spells-options.test.js keeps its engine assertions: minutes x10).

**I7 - docs**: UI-GUIDELINES s4 (Combat + Spells rows, dated sign-off), ARCHITECTURE (session-state note: `model.effectWindow`, `targetName`, `toggledOptions`, opponent/option session lists), EFFECT-TAXONOMY s6 (~l.350-363: `arms.rounds` may be `"rank"`, store resolves to a number; no version bump), `rules/talents.json` header note, `plans/active-condition-window/mock-d.html` fixes (group by lifetime, Aim under Lasting on you, Taunt rounds = rank, drop "Entangle").

### UI / behavior
- Groups: `This attack` (toggled options, active charms), `Lasting · on you` (self spells, Aim, situation chips, Knocked Down, encumbrance Harried), `Lasting · on target` (cast-on-Other spells, Taunt).
- Combat: three groups side by side (reflow on phone); Spells: single stacked column, no truncation of name/effect text.
- X semantics: spell/opponent/Aim remove the record; option untoggles (ed-combat drops the chip via model sync); charm deactivates only (item stays equipped); situation chip toggles off via `ed-toggle-situation`; Knocked Down and encumbrance Harried have no X.
- Ticking: only on an Initiative roll (`ed-roll` kind `initiative` -> `_advanceRound`). Options also clear then. Day reset clears all session lists. Aim = 1 round (gone next Initiative).
- Cast on Other: entry only if hit AND duration parses (rounds/minutes/hours); effect label shows `Effect —` placeholder until the Effect roll lands (`ed-other-cast-effect`).
- Taunt: hit (>=1 success vs the Difficulty typed into the roll modal's existing "Target's Social Defence" input) -> one new `tgt` entry per cast, `roundsLeft = rank`, `text` shown; miss -> nothing.

### Rules
| Rule | Value / formula | Source |
|---|---|---|
| Taunt test | Rank+CHA step, Simple, 1 Strain, vs target's Social Defense; hit = `successCount(total, difficulty) >= 1` | rules.md R1 (talents:636-639, 506-509; Q048) |
| Taunt effect | -1 to target's tests and -1 Social Defense per success, for rounds = adept's Taunt rank; one target; shown as text only (display-only) | R1 |
| Taunt stacking | Not stated: one entry per cast, no replace | R1 decision (plan) |
| Mystic Aim | until end of round; `arms.rounds = 1`; replace-by-name kept; sits under "on you" | R2 (PG:5621-5629) |
| Spell rounds | tick per Initiative roll; X always available except locked conditions; minutes = 10 rounds, hours = 600 rounds, "Rank" = Spellcasting rank | R3 (house ruling 2026-11-24; spell-concepts) |
| Combat options | single-round, no counts, "This attack" group; cleared on new round / Day reset / character switch | R5 (PG:14375-14481) |

### Edge cases & invariants
- `model.activeEffects` deep-equals its pre-change value for the same inputs (regression test).
- Empty sources -> `effectWindow === []`; `groupEffects([])` -> three empty groups.
- Two Taunts on two named targets, and two on the same target, all coexist (ids distinct).
- `tickOpponentEffects` never leaves `roundsLeft <= 0`; input array not mutated.
- A Taunt miss never clears prior Taunt entries; Aim miss still clears the Aim arm (existing).
- `armedTalents` never contains `opponent` records; Taunt folds nothing into any roll, `modTabCounts`, armed names or `castingArmed`.
- `"rank"` never reaches the session: `arms.rounds` is a number >= 1 in every store output.
- Blank `targetName` -> label "target"; name is trimmed.
- Non-parsable duration (e.g. months) or a miss on Other -> no entry; no-duration spell -> no entry.
- Charm X leaves `item.equipped` unchanged; Initiative still spends (unequips) charms as today.
- Character switch / Day reset clear opponent list, toggled options and name.

## Testability notes
node:test units (`npm test`; `pretest` also runs check-ui-kit):
- `engine/active-effects.test.js`: per-source builder cases (spell, Aim, charm, option, situation, Knocked Down, Harried), grouping and order, `pct/low` (roundsLeft 3 -> low, 4 -> not), `endable:false` cases, `armOpponent` (hit/miss, rounds, text, non-opponent -> null), `otherCastToRecord` (hit with rounds, miss, minutes x10 via real `otherCastOutcome`, months -> null, no duration -> null), `setOtherCastEffect`, reducers add/tick/end per kind (charm end leaves `activeCharms` only; situation returns the action; unknown id no-op), `clearAll`.
- Store test (new `store.effect-window.test.js` or an existing store test file): `model.effectWindow` built from a session; `model.activeEffects` unchanged; `model.targetName/toggledOptions` pass-through; Taunt talent surfaces `arms.rounds` = rank (min 1) as a number, `opponent:true`, `text`; Taunt in `session.armedTalents` folds nothing (`castingArmed` absent).
- `engine/combat.test.js`: `collectCombatEffects` ignores an `opponent` armed record.
- `ui/active-effects-state.test.js` and `ui/combat-mods-state.test.js` (`optionsAfterPush`, `modTabCounts` unchanged).
- Data test (`engine/` data-style test like `air-sailor-data.test.js`): Taunt carries exactly the new `arms` descriptor; Mystic Aim arms unchanged; `effectTaxonomy` still v6.
Manual (owner, not unit-testable): the ten checks in plan.md "Owner manual verification" (light/dark, phone reflow, no truncation in stack, Escape unaffected, placeholder pills, Combat placement/name field, Other-cast countdown + X, Taunt from Combat and Disciplines, Aim, X per kind, Day reset, Overview strip unchanged). Also verify during build: the Disciplines-rolled Taunt gets its Difficulty from the roll modal's aim target input (plan I3 risk).

## Changelog entry
{"type": "added", "text": "New Active effects window on the Combat and Spells tabs: tracks active spells (including ones cast on others), Aim, Taunt, toggled combat options and charms, with round countdowns and an end button; optional opponent name labels effects on a target."}

## Out of scope
- Overview Active Effects strip and `model.activeEffects` (unchanged).
- Persistence of any window entry; any taxonomy change or version bump.
- Opponent effects other than Taunt (Frighten, Battle Shout, etc.) and the Taunt SKILL (later Tier-3 data).
- Mechanical application of opponent penalties (display-only); a Resist Taunt flow.
- Replace/stack rules for repeated Taunts beyond one entry per cast.
