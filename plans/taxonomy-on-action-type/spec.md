# Tech Spec: Taxonomy on action type (taxonomy-on-action-type)

## Overview
Add a new effect type `action-modifier` (effect taxonomy v5) that `set`s a talent's or skill's action (Free/Simple/Standard). A new pure engine module `engine/ability-actions.js` resolves active effects (fastest wins) and returns the effective action, the base action and the contributing sources. `store.js` folds the result onto derived talents and skills next to `applyTestMods`. `ui/ed-disciplines.js` and `ui/ed-combat.js` only render the pre-resolved fields (accent colour, plus a hover on Disciplines). Death's Head becomes the first consumer.

## Guardrail alignment
- Taxonomy v5 (doc, `rules/*.json` refs, version stamps, conformance): **Tier 2** ceremony. All three steps land together: doc bump, migration of all 11 `rules/*.json` refs, and the schema/stamp/conformance code. No Tier-1 sign-off is needed. `schema` tags (`ed-<x>/N`) are unchanged because v5 is additive.
- Engine resolver and store fold: Tier 3. Pure and DOM-free, reads structured fields only (no label parsing), stores nothing. The derived fields `action`, `actionBase` and `actionSources` are computed per derive, never persisted. Death's Head activity stays session state.
- UI: Tier 3 within UI-GUIDELINES. It uses the existing `--accent` token (light and dark), adds no new tokens or weights, receives data down, and computes no game value. In particular, it does not compare action speeds.
- Data (Death's Head): Tier 3 once v5 exists.
- No Tier-1 item was missed.

## Design
### Data / types
New effect shape (taxonomy v5, in `rules/spells.json` and any future rules file):
`{ type:"action-modifier", target:{domain:"ability", name:<ability>}, operation:"set", measure:"action", value:"Free"|"Simple"|"Standard", duration, source, summary }`.

Derived, never stored, written only on a changed ability: `ability.action` (effective), `ability.actionBase` (printed), `ability.actionSources: [{name, action, applied}]`. Unchanged abilities get no new keys.

`rules/*.json`: `effectTaxonomy` becomes `"docs/EFFECT-TAXONOMY.md (v5)"` in these 11 files: races, homebrew, thread-items, knacks, spells, items, custom-items, skills, disciplines, talents, combat. `attributes`, `characteristics`, `legend` and `steps` carry no ref and stay untouched.

### Modules & functions
Tier 2 unit (I1 to I4, one change):
- `docs/EFFECT-TAXONOMY.md`:
  - Title `v5`, status "v5, under review", and a v5 changelog paragraph dated 2026-10-03 above the v4 one.
  - §1 note that `value` may be a controlled word.
  - §2: table row `` | `action-modifier` | … | ability `` plus a prose paragraph covering `set` only, override semantics, fastest-wins, an effect equal to the printed action not counting as a change, and non-numeric (not summed or stacked).
  - §4: one-line note.
  - §5: table row `` | `action` | … | ``.
  - **`### 5.1 Action values` as prose, not a table**, listing `Free` · `Simple` · `Standard` fastest first, with `Sustained` and `NA` explicitly invalid. A table would pollute the `measure` vocab that `tableVocab` derives from the doc.
  - §10: Death's Head worked example.
- Version mentions moved to v5 in `docs/HOMEBREW-RULES.md` (L23, L36), `docs/THREAD-ITEMS.md` (L30) and `docs/GUARDRAILS.md` (L47).
- The 11 `rules/*.json` files: single-line targeted edits only, keeping the files byte-stable.
- `tools/worker/worker.js` L287 and `tools/dev-server.mjs` L70: literal swap v4 to v5. Update the `tools/dev-server.test.js` L179 assertion. Add a small fresh-catalog stamp assertion to the worker test if none exists. The owner must redeploy the Cloudflare worker at release (flag it in the build log).
- `tools/rules-conformance.test.js`:
  - New parser `ACTION` from the §5.1 prose with `/\`([A-Za-z]+)\`/g` (the existing `proseVocab` is lowercase-only).
  - New helper `actionModifierProblems(e)` returning a list of violations: `operation` must be `set`, `measure` must be `action`, `target.domain` must be `ability` with a non-empty `name`, and `value` must be a string in `ACTION`.
  - Call the helper for every `action-modifier` effect in the existing vocab walk.
  - Negative unit tests reject `Sustained`, `NA`, `Instant`, a number, a missing value, `operation:add`, a wrong measure and a wrong domain. A valid `Simple` effect is accepted.
  - A doc test asserts `ACTION` equals exactly `[Free, Simple, Standard]` and that the `measure` vocab does not contain those words.
- Leave alone: `data/custom-items.json`, `scripts/sync-local-data.sh`, `docs/TAXONOMY-AUDIT.md`, the `engine/spells.js` "taxonomy v4" comments, and the v3 test fixtures.

Engine (I5): new `engine/ability-actions.js`.
- `export const ACTION_SPEED = ['Free','Simple','Standard']` (fastest first).
- `export function resolveAbilityAction(abilityName, baseAction, effects)` returns `{ action, actionBase, actionSources } | null`.
  - Considered effects have `type==='action-modifier'`, `operation==='set'`, `target.domain==='ability'`, `target.name===abilityName`, a string `value` in `ACTION_SPEED`, and `autoApplies(e)` (from `engine/characteristics.js` L53: condition always or absent, not `gmDiscretion`).
  - The winner is the lowest index in `ACTION_SPEED`.
  - Return `null` if there are no considered effects or the resolved action equals `baseAction`.
  - `actionSources` lists all considered effects, de-duplicated, in order of appearance. `name = e.origin?.name ?? e.source ?? 'effect'`. `applied = (value === resolved action)`, so equal winners are all applied. The tie rule is a planner default accepted by the owner.
  - A base not in the list (None, Sustained, NA, missing) is still overridden. `actionBase` keeps the raw value.
  - Invalid values are ignored.
- Tests are in `engine/ability-actions.test.js` (node:test).

Store (I6): `store.js` imports `resolveAbilityAction`. Next to `applyTestMods` (L1583-1597) it calls the resolver for each discipline talent (L1596) and each skill (L1597) with `activeEffects`. On a non-null result it writes `action`, `actionBase` and `actionSources`. Only the derived per-character copy is mutated. Test in a new `store-action-modifier.test.js`, modelled on `store-combat.test.js`.

Data (I9): `rules/spells.json` `Death’s Head` (the key uses U+2019). Add to the base `effects` (keep the existing `note`, the +2 Frighten extra thread, the spell summary and the success level):
`{type:"action-modifier", target:{domain:"ability",name:"Frighten"}, operation:"set", value:"Simple", measure:"action", duration:"sustained", source:"spell", summary:"Use Frighten as Simple Action"}`.
There is no `condition` and no `gmDiscretion`. Update `engine/spells-standalone-option.test.js`.

### UI / behavior
- `ui/ed-disciplines.js`:
  - There are four surfaces: talent row cell (L274), talent modal chip (L356), skill row cell (L402) and skill modal chip (L591).
  - When `a.actionBase != null`, add a `changed` class (`.action.changed { color: var(--accent); }`) and a `title` from one module-level pure formatter `actionHoverText(a)`.
  - Hover text format: line 1 is `<base> → <action>`. Then one line per `actionSources` entry in engine order: `<value>: <name> (applied)` or `<value>: <name> (overridden)`, chosen from `src.applied` with no speed comparison.
  - The modal chip descriptor extends to `{v, c, title}`, and the chip label stays `${a.action} action`.
  - Unchanged abilities render byte-identical markup.
  - The hover is desktop-only (accepted): native `title` does not show on touch, and `.action` is hidden at narrow widths (L223). No mobile UI is added.
- `ui/ed-combat.js`:
  - Carry `actionBase` into the attack options (talents and skills, ~L545-580).
  - Add `class="chg"` on the changed `<option>` (L1460), with CSS `option.chg { color: var(--accent); }`.
  - Toggle `chg` on the `<select>` when the selected option is changed, so the closed control shows the accent.
  - No marker, no suffix, no hover. Safari ignores native `<option>` colour (accepted, no custom picker).
- Both themes use the existing `--accent`. No modal Escape/Enter changes. The Overview viewport is untouched. Confirm during the build that `ui/ed-overview.js` Active Effects (L738+) renders a string-valued spell effect sanely.

### Rules
| Rule | Value / formula | rules.md |
|---|---|---|
| Valid effect action values | Free, Simple, Standard only. Sustained and NA are not valid. | R1 (Q018, PG p.122-123, 373-375) |
| Conflict resolution | Several effects on one ability: fastest wins, Free > Simple > Standard. This is an owner house rule (books print no ordering). An effect overrides the printed action, in either direction. | R2 (owner decision 2026-10-03) |
| Frighten and Death's Head | Frighten is Standard. With Death's Head it is Simple for the duration, on every use, including with 0 extra threads. | R3 (Q017, PG p.323) |
| Beguiling Blade / Swift Link | Future users only; not migrated. | R4 |

### Edge cases & invariants
- A resolved action equal to the base returns `null`: no accent, no hover, no keys, even if effects exist.
- A slower-than-base effect is an override: a Simple effect on a Free talent gives action Simple, actionBase Free. This is pinned by test.
- `gmDiscretion` and `condition: situational` effects are ignored. Effects targeting another ability are ignored. Invalid values are ignored.
- Same-name talent and skill both fold from one effect (mirrors `applyTestMods`; documented, not tested).
- After the spell expires (`tickActiveSpells`), the next derive reverts the action with no `actionBase`.
- Nothing is persisted. Stored character data is unchanged.
- Known transient: a Death's Head already active in a saved session (a snapshot taken at cast time) gains the effect only on recast.
- The `applied` flag is engine-computed. At least one applied winner group always exists.
- `buildActiveSpell` and `effectLabel` behaviour is unchanged: with 0 picks the label equals `dh.summary`, and with picks the label and step bonus stay +2 per thread.
- The engine module imports no DOM or store.

## Testability notes
- node:test units:
  - `engine/ability-actions.test.js`: Simple vs Standard base; Free + Simple gives Free with both sources and the applied flags; ties; slower override; null cases; ignored effects. Also a drift test comparing `ACTION_SPEED` against the §5.1 set parsed from the doc.
  - `store-action-modifier.test.js`: Death's Head in `session.activeSpells` gives Frighten action Simple, actionBase Standard, sources `[{name:"Death’s Head",action:"Simple",applied:true}]`. A synthetic skill effect derives the same fields. Two effects give Free applied and Simple overridden. Revert after removal. Other talents are unchanged.
  - `tools/rules-conformance.test.js` and `tools/dev-server.test.js` as described above.
  - `engine/spells-standalone-option.test.js`: the Death's Head data test asserts the new base effect and the unchanged extra-thread option. 0 picks keeps the Frighten step at +0, and 1 or 2 picks still give +2 or +4.
- Use a Nethermancer fixture owning Frighten.
- Owner manual verification (do not open the preview unless asked):
  - Accent in light and dark on the talent and skill rows and modals.
  - Hover text content.
  - Combat picker colour, including the closed select.
  - The Active Effects card row.

## Changelog entry
Added: A talent or skill whose action is changed by an effect (for example Death's Head making Frighten a Simple action) now shows the new action in the accent colour, with a hover listing the sources. Add it as type `added` under `unreleased.changes` in `data/changelog.json`.

## Out of scope
- Knacks UI.
- Migrating Beguiling Blade, Swift Link or other abilities.
- New colour tokens and direction-aware colours.
- A conflict-resolution UI.
- Sustained, NA or other action values.
- A mobile or touch hover alternative.
- A Safari custom picker or marker.
- Editing `docs/TAXONOMY-AUDIT.md`, `data/custom-items.json` or `scripts/sync-local-data.sh`.
