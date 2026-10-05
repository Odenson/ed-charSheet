# TAXONOMY-AUDIT — Effect taxonomy vs. rules data vs. engine code

Tracking doc for the audit of how the **effect taxonomy** is actually used across
`rules/*.json`, `data/*.json`, `engine/*`, and `ui/*`, measured against the
documented architecture. Same spirit as [RULEBOOK-AUDIT.md](RULEBOOK-AUDIT.md):
record a discrepancy here *before* fixing it, and cite the finding id (`T-nnn`)
in the fixing commit.

> Status: **audit pass complete (2026-09-30); re-validated 2026-10-04 (see *Re-validation*): 51 findings, 9 fixed (T-001, T-002, T-003, T-004, T-005, T-006, T-016, T-018, T-049).** Read-only audit of branch `dev` at `43b4e4a`+; three parallel passes (data, engine, UI/architecture), merged and renumbered `T-001…` by severity then tier. Original per-pass ids are kept in each finding as *Source pass id*.

## Scope & authority

| Role | Document / file |
|---|---|
| Authority (vocabulary) | [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md) (currently **v4**) |
| Authority (restrictions) | [RESTRICTION-TAXONOMY.md](RESTRICTION-TAXONOMY.md) |
| Authority (architecture rules) | [ARCHITECTURE.md](../ARCHITECTURE.md) §3, §4.1, §5.5 |
| Authority (working agreement) | [CLAUDE.md](../CLAUDE.md) — Tier 1 / Tier 2 |
| Audited (data) | `rules/*.json` (`effects` arrays, `schema` tags, `effectTaxonomy` refs), `data/character.json`, `data/characters/*.json`, `data/changelog.json` |
| Audited (code) | `engine/*.js` (effect handlers, fold, derive), `ui/*.js` (no game-value computation), `store.js` |
| Audited (tests) | `engine/*.test.js` — does coverage match each documented `type`? |

Out of scope unless a finding requires it: rulebook text accuracy (that is
RULEBOOK-AUDIT / the rule-agent), visual styling.

## Method

1. **Inventory the documented vocabulary** — every value of `type`, `target`,
   `operation`, `measure`, `condition`, `scope`, `stacking`, `duration`, `source`
   (taxonomy §2–§9). Record in *Appendix A*.
2. **Inventory what the data uses** — enumerate the distinct values per field
   across all `rules/*.json` and character data (script it; keep the script in
   the scratchpad, paste the counts into *Appendix B*).
3. **Inventory what the engine handles** — for each `type`/`operation`/`measure`
   the code branches on (grep `engine/`), note file:line. *Appendix C*.
4. **Diff the three sets** (doc ↔ data ↔ code) and record each gap as a finding.
5. **Check the architecture rules** against the code (checklist below).
6. **Classify every finding** by tier (CLAUDE.md) and severity, and propose a
   remedy — *without applying it*. Tier 1/2 remedies need owner sign-off.

## Severity & tier key

| Severity | Meaning |
|---|---|
| **S1** | Wrong game value can be shown/computed today |
| **S2** | Latent: data/code disagree but no current wrong output |
| **S3** | Doc drift / naming / housekeeping |

Tier: **1** locked · **2** taxonomy ceremony · **3** free (per CLAUDE.md).
Checklist result tags (in the `[ ]` boxes): `PASS` the documented rule holds · `FAIL` it does not (the line names the finding) · `PARTIAL` holds in some places only (the line says where) · `N/A` not applicable to this pass, covered elsewhere · `NOT AUDITED` no check was run · `INFO` a listing or inventory, no pass/fail.

Status: `open` · `accepted` (deliberate, documented) · `fix-proposed` · `fixed (sha)` · `wontfix`.

## Result at a glance

47 findings at the original pass — **S1 ×6**, S2 ×19, S3 ×22; Tier 1 ×15, Tier 2 ×9, Tier 3 ×23. Nothing was changed in the repo at that time. *Current position (2026-10-05): 51 findings, 9 fixed (T-001, T-002, T-003, T-004, T-005, T-006, T-016, T-018, T-049), 6 narrowed (T-021, T-023, T-031, T-032, T-038, T-046), 43 not yet fixed including the 4 added by the re-validation (T-049 is among the 8 fixed). S1 fixed ×6 of 6.* Caveats: the UI pass did not run the app or tests; the data pass audited character files from the `character-data` branch (not on `dev`); thread-item/restriction consistency was covered by the data and engine passes only. The engine suite (`node --test`) was green at 725/0 when the engine pass ran.

## Summary table

| Id | Title | Sev | Tier | Area | Status |
|---|---|---|---|---|---|
| T-001 | Knack parent names ("Melee Weapons", "Missile Weapons", "Throwing Weapons") never match the character's talent names | S1 | 3 | data | fixed (a968c33) |
| T-002 | `attribute-modifier` has no engine handler; always-on attribute bonuses are listed as active but never applied | S1 | 3 | engine | fixed (2c27128) |
| T-003 | `RecoveryTests` modifiers with `measure:"count"` are dropped by the `rating`-only guard | S1 | 3 | engine | fixed (cf3c05f); Bone Charm half split out as T-051 |
| T-004 | Always-on `attack-modifier` effects with `measure:"rating"`/`"result"` never reach the combat pools | S1 | 3 | engine | fixed (uncommitted) |
| T-005 | Spell cast success levels ignore roll-time flat mods, while the modal outcome includes them | S1 | 3 | ui | fixed (uncommitted) |
| T-006 | Custom-item builder emits characteristic-modifier effects with a measure the engine ignores | S1 | 3 | ui | fixed (uncommitted) |
| T-007 | Spells tab adds step bonuses to rolls itself (castingStep, Effect step, Patterncraft step) | S2 | 1 | ui | open |
| T-008 | Combat tab re-derives armed-talent per-success bonuses and spell defence/armour deltas | S2 | 1 | ui | open |
| T-009 | UI reads effect-taxonomy fields directly to format or filter effects | S2 | 1 | ui | open |
| T-010 | Cast-target number is recovered by regex from the display string `castingTarget` | S2 | 1 | ui | open |
| T-011 | Combat success-level damage bonus is keyed off the Roll Log label text | S2 | 1 | ui | open |
| T-012 | Lift is recomputed in the Equipment banner as a fallback | S2 | 1 | ui | open |
| T-013 | `allSilverAlloc` in the trade modal duplicates engine `allocForSilver` | S2 | 1 | ui | open |
| T-014 | Karma ledger clamp and Ritual affordability are computed in ed-app / ed-overview (duplicated from store.js) | S2 | 1 | ui | open |
| T-015 | store.js folds taxonomy fields to decide a thread weapon's Damage step | S2 | 1 | ui | open |
| T-016 | `attack-modifier` with `measure: "rating"` is outside the documented contract | S2 | 2 | data | fixed (uncommitted) |
| T-017 | `stacking` semantics in code differ from §7 (per-origin progression, origin-less exempt) | S2 | 2 | engine | open |
| T-018 | Obsidiman Skin armor value disagrees with its own summary | S2 | 3 | data | fixed (17b960e) |
| T-019 | Per-success talent/skill effects kept as `note` while the same shape is structured elsewhere | S2 | 3 | data | open |
| T-020 | Spell Success-Level/Extra-Thread options: v4 migration is partial | S2 | 3 | data | open |
| T-021 | Combat pools ignore `operation` (only `subtract` is special) and do not implement the §4.1 `set`-first contract | S2 | 3 | engine | narrowed (uncommitted) |
| T-022 | Documented vocabulary with no handler and no "reserved" marking | S2 | 3 | engine | open |
| T-023 | Unknown or unsupported effect values are skipped silently everywhere | S2 | 3 | engine | narrowed (uncommitted) |
| T-024 | Weapon Damage Step has two sources (`ref.damageStep` and the `attack-modifier add`); §4.1 documents only the effect | S2 | 3 | engine | open |
| T-025 | Hard-coded rule defaults and constants in UI code | S2 | 3 | ui | open |
| T-026 | Recomputable values still stored in character data (Kolon) | S3 | 1 | data | open |
| T-027 | Purity and regex inventory | S3 | 1 | engine | open |
| T-028 | No `dispatch` exists; ed-app.js acts as store and rules layer | S3 | 1 | ui | open |
| T-029 | Karma ritual log stores a derived total (`legend`) in character data | S3 | 1 | ui | open |
| T-030 | Derived-value placeholders: bare "—" instead of the dashed pill in Disciplines and Spells | S3 | 1 | ui | open |
| T-031 | Only 3 of ~20 modals use the shared modal controller; the rest hand-roll Escape handling | S3 | 1 | ui | open (narrowed) |
| T-032 | `custom-items.json` (and its emitters) still reference taxonomy v3; the v4 migration was half-done | S3 | 2 | data | open (narrowed) |
| T-033 | Undocumented effect fields and ref property (`note`, `rounds` in the table, `Max`) | S3 | 2 | data | open |
| T-034 | `scope` carries structured rules meaning as prose (costs, durations, prerequisites) | S3 | 2 | data | open |
| T-035 | `test`-domain target names fall outside the §3 list; one sense is spelled three ways | S3 | 2 | data | open |
| T-036 | Vocabulary and fields the code relies on that the taxonomy does not document | S3 | 2 | engine | open |
| T-037 | Taxonomy §11 and §6 text stale against shipped code | S3 | 2 | engine | open |
| T-038 | Custom-item builder duplicates the validator's type/target/measure tables | S3 | 2 | ui | narrowed (uncommitted) |
| T-039 | Two idioms for negative modifiers | S3 | 3 | data | open |
| T-040 | Stale taxonomy/schema version text in docs and code comments | S3 | 3 | data | open |
| T-041 | Two homebrew `set` targets in use are undocumented in HOMEBREW-RULES §5.5 | S3 | 3 | data | open |
| T-042 | Homebrew `ref` grammar is a second dialect of the taxonomy's `ref` paths | S3 | 3 | data | open |
| T-043 | Kolon's item names include near-duplicates of catalog entries that contribute nothing | S3 | 3 | data | open |
| T-044 | Documented `operation:"ref"` and ref-valued effects have no general evaluator | S3 | 3 | engine | open |
| T-045 | `validate-item.js` header cites taxonomy v3 but implements v4 vocabulary | S3 | 3 | engine | open |
| T-046 | Test coverage gaps against the documented vocabulary | S3 | 3 | engine | open (narrowed) |
| T-047 | Restriction gate: empty `discipline: []` blocks a knack forever; undocumented edge behaviours | S3 | 3 | engine | open |
| T-048 | Custom-item validator and builder do not know taxonomy v5/v6; `dice` measure accepted with a numeric value | S3 | 3 | engine | open |
| T-049 | `foldPool` silently drops dice effects that are unparseable or use `subtract` | S2 | 3 | engine | fixed (uncommitted) |
| T-050 | Spell dice readout filters on raw effect fields in `buildCastPlan` | S3 | 3 | engine | open |
| T-051 | Bone Charm's Recovery effect disagrees with the rulebook; its Death/Unconsciousness −1 is unsupported | S2 | 3 | data | open (owner decision) |

## Checklist A — Documented vocabulary ↔ data (data pass)

- [PASS] Every `type` used is defined in §2 (14/14 documented; engine handling of `attribute-modifier` is out of this pass).
- [PASS] Every `target` is defined in §3. All domains and structural names conform.
  - `test`-domain names outside the listed set are a doc-precision gap (T-035), not an undefined domain. `ability` names all resolve.
- [PASS] Every `operation` is defined in §4. The `set`-as-base pattern is present as documented: 12 spell `set` with `ref` to Willpower Step, and no weapon `set`. `items.json` has one `set`: Astral-Sensitive Eye `grant-ability`.
- [FAIL] Every `measure` is defined in §5. All values are in the doc. `attack-modifier`+`rating` (6) contradicts §2's "step or result" (T-016).
- [FAIL] Every `condition` / `scope` is defined in §6. `condition` is fully clean. `scope` is free text by design, but it drifts from the candidate tokens (`close combat` vs `close-combat`) and embeds costs and durations (T-034).
- [PASS] Every `stacking` / `duration` / `source` value is defined in §7–§9. 100% conformant.
- [FAIL] No rules file uses a field name absent from §1. Failed: `note` (4 effects) is undocumented, and `rounds` is documented only in §8 prose (T-033).
- [FAIL] Every `rules/*.json` carries `schema` and `effectTaxonomy (v4)` matching the doc. Failed: `custom-items.json` says v3 (T-032). All 10 other effect-bearing files are v4.
- [INFO] Dead vocabulary listed. Summary:
  - types: none dead.
  - operations: `multiply`, `divide`, `min`, `max`.
  - measures: `dice`, `yards`.
  - condition: trigger-object form.
  - stacking: `unique`.
  - durations: `encounter`.
  - sources: `blood-magic`, `trait`, `horror`.
  - characteristic names: `CarryingCapacity`, `Movement.Walk`, `Movement.Swim`.
  - attribute effects on Dexterity, Toughness, Willpower, Charisma.
  - resources: `Legend`, `Recoveries`.
  - attack appendage names: `horns`, `claws`, `bite`.
  - scope candidates: `ranged-combat`, `unarmed`.
  - `yards` being dead is notable because ~30 range/area notes carry yard values (T-020).
- [FAIL] Display strings carrying rules meaning that should be structured effects. Failed: T-034, T-019, T-020. The grandfathered `spells.js` duration parser (`engine/spells.js:208-216`) reads `spells.json` `duration` strings such as "Rank + 5 rounds"; 55 spells carry one. This is flagged as a known, grandfathered deviation, not a new finding.

Checklist C items that are data-facing:
- [FAIL] Store only inputs. Stored recomputable fields exist in Kolon's character file (T-026).
- [PASS] Homebrew uses the same effect vocabulary. It has no `effects` at all, so nothing diverges. Its ref grammar is a separate dialect (T-042).
- [PASS] Thread-item effects and restriction vocabulary are consistent with the taxonomy docs. `stacking:replace` is used as designed; `source:"condition"` is the documented convention.

---

## Checklist B — Documented vocabulary ↔ engine (engine pass)

- [FAIL] Every documented `type` has an engine handler (or is marked reserved). **No**: `attribute-modifier`, `grant-attack`, `sense`, `enable-option` have none and are not marked reserved (T-002, T-022).
- [PARTIAL] Every handler corresponds to a documented `type`. **Types yes; vocabulary no**: code branches on `test-modifier`+domain `ability`, scopes `sight`/`except-knockdown`/`missile`, `source:'Circle'`, `origin.kind:'homebrew'` (T-036).
- [FAIL] `operation`/`measure`/`stacking` semantics match §4/§5/§7. **No**: `count` measure dropped (T-003), combat pools ignore `set`/`multiply` (T-021), stacking is per-origin not per-target (T-017).
- [FAIL] Unknown/unsupported values fail visibly. **No**: every consumer skips silently; no rules lint; `validate-item.js` only guards custom items (T-023).
- [FAIL] Each documented `type` has at least one test. **No**: `attribute-modifier` (fold), `grant-attack`, `sense`, `enable-option` none; `duration-modifier` only catalog-backed (T-046).
- [PARTIAL] §11 open questions: resolved-but-listed reviewed. **Partial**: Q2 already struck; Q4 de facto partly locked; Q6 text stale; title says "v3 review" (T-037).

### Checklist C, engine items

- [PASS] Engine is pure and DOM-free. No `document`/`window`/`localStorage`/`fetch` in `engine/*.js`. Two impurities, not DOM: `potions.js:80,85` `Date.now()`; `dice.js:11,25,55` `Math.random` (injectable default). See T-027. `store-*.js`/`store.js` (app layer) legitimately use fetch/localStorage/document (`store-export.js:32-35`).
- [PARTIAL] Engine reads structured taxonomy, never regex-parses display strings. Engine: only `spells.js:208-216` (grandfathered). Non-grandfathered regex in the store layer: `store.js:97-100`, `:1126` (T-027). Full RegExp inventory is in T-027.
- Not in this pass: UI-computes-values (seen in passing: `ui/ed-combat.js:966`, `ui/ed-roll-modal.js:158`, `ui/ed-spells.js:968-982` multiply/sum effect values; hand to the UI pass).

---

## Checklist C — Architecture rules (Tier 1) ↔ code (UI pass; engine items are in Checklist B)

- [N/A] Engine pure / DOM-free: out of scope for the UI pass; covered in Checklist C above (engine pass).
- [N/A] Engine reads structured taxonomy, never regex: engine side is covered in Checklist C above (engine pass). UI-side regex over rule display strings found anyway (T-010, T-011, T-015).
- [FAIL] UI never computes game values: FAILS. Step sums, success levels, karma clamps, coin split, lift and per-success multipliers are computed in ui/* (T-005, T-007, T-008, T-009, T-012, T-025, T-013, T-014).
- [PARTIAL] Data down / events up: MOSTLY holds. Child views only dispatch CustomEvents and never write `model`. But no `dispatch()` exists and ed-app.js is the de facto store and rules layer (T-028).
- [PARTIAL] Store only inputs (§4.1): passes for the UI overlay saves, but fails overall (see also the data checklist and T-026). The overlay saves (`saveMetaEdits`, `saveItemEdits`, `saveKarmaEdits`, `saveAdvancementEdits` ...) write input shapes. `forSave()` (store.js:420) strips talent `tier`. One derived figure is persisted by the Karma ritual log (`rituals[].legend`, T-029).
- [PARTIAL] Derived values as placeholder pills: PARTIAL. Overview and Combat use a dashed `.pend` pill. Disciplines and Spells render a bare "—" for missing derived steps (T-030). No fabricated numbers found except the hard-coded 10 sp fee default (T-025) and the Lift fallback (T-012).
- [PARTIAL] Homebrew uses the same taxonomy vocabulary: vocabulary matches the doc, but the builder's per-type measure defaults produce effects the engine ignores (T-006), and the builder duplicates the validator's constants (T-038).
- [PASS] Homebrew rules modal (ed-homebrew.js) is display-only; it reads `rules/homebrew.json` notes and emits no effect vocabulary.
- [NOT AUDITED] Thread-item / restriction vocabulary consistency: not audited in the UI pass (the data pass covers it: see Checklist A, which marks it PASS).

Other checks that passed, no finding:
- index.html, app.js: relative paths only (`./vendor/...`, `./app.js`, `./favicon.svg`).
- Theme and weights: no violations seen in the touched code.
- ed-combat `_attackPool`, `_damagePool`, `_defArmourSection` and ed-overview `_char` / `_movementRate` consume engine output. The mod badges in ed-overview are formatting of `modifiers[]` from the engine.
- Roll Log (store-rolllog.js) is device-local and never part of character data.

## Findings

Ordered by severity, then tier. Each finding's own `Status` line is current: T-001, T-002, T-003 and T-018 are `fixed` (commit shas in the summary table); the others are `open`. T-048 to T-051 were added in the 2026-10-04 re-validation (see *New findings*). Tier 1/2 remedies need owner sign-off.

### T-001 — Knack parent names ("Melee Weapons", "Missile Weapons", "Throwing Weapons") never match the character's talent names
- Source pass id: T-D01
- Severity: S1  Tier: 3  Status: fixed 2026-10-05 (`a968c33`; data fix as proposed, no character file stored a plural name)
- Area: data
- Documented: CLAUDE.md / ARCHITECTURE §4.1 treats `rules/talents.json` names as the identifiers that disciplines, characters and knacks share. `rules/disciplines.json` line 3: "Talent names normalized to match rules/talents.json and data/character.json (e.g. rulebook 'Missile Weapons' -> 'Missile Weapon')".
- Observed:
  - Disciplines and characters use the singular names `Melee Weapon`, `Missile Weapon`, `Throwing Weapon`.
  - `knacks.json` `parents` still use the plural rulebook names: `Melee Weapons` ×9, `Missile Weapons` ×3, `Throwing Weapons` ×4.
  - To keep the parent lookup from dangling, `talents.json` carries attribute-only stub entries for the plurals (`Melee Weapons`, `Missile Weapons`, `Throwing Weapons`, and similar). These are never owned by a character.
  - `store.js` builds `parentTalents` keyed by the character's exact talent name (store.js:1175-1180).
  - `learnableKnacks` does an exact `talents[pn]` lookup (engine/knack-options.js:~95-98).
  - Consequence: an Archer with `Missile Weapon` rank N never qualifies for `Flare`, and a Warrior with `Melee Weapon` never qualifies for `Deflect Blow`, `Give Ground`, `Harrying Attack`, `Improvised Weapon` and others.
  - Exception: `Unarmed Combat` and other names that are identical in both files work.
- Evidence:
  - rules/knacks.json:266, 596, 940, 1036, 1096, 1120 (parents "Melee Weapons").
  - rules/talents.json:2860-2867 (plural stubs) and 2872 ("Throwing Weapons" stub).
  - rules/talents.json:582 (real "Melee Weapon") and 773 (real "Throwing Weapon").
  - rules/disciplines.json:3 and :27 ("Missile Weapon").
  - Chakka, `character-data` branch: Archer with `Missile Weapon`.
- Impact: the Add-Knack picker silently omits every weapon-talent knack for characters that own the singular talent. The wrong availability is shown today.
- Proposed remedy: normalise knack `parents` and the `restrictions.ability` names to the singular catalog names and delete the plural stubs (Tier 3 data fix; add a catalog test that every knack parent is an owned-able discipline talent name). Alternative: alias at the engine. The data fix is preferred.
- Note: the knack-parent catalog check I ran (every `parents` value exists in talents/skills) passes only because of the stubs.

### T-002 — `attribute-modifier` has no engine handler; always-on attribute bonuses are listed as active but never applied
- Source pass id: T-E01
- Severity: S1  Tier: 3 (fix = new handler; data/vocab unchanged)  Status: fixed 2026-10-05 (`2c27128`; see the Re-validation table)
- Area: engine
- Documented: §2 "`attribute-modifier` | adjusts one of the six attributes"; §5 `value` "+2 Strength value"; §6 auto-apply "folds in **only** effects that are `condition: "always"` and not `gmDiscretion`".
- Observed: `attributeValue()` is `base + points + increases` and `deriveModel` builds attributes from it alone; no code path reads `attribute-modifier`. The effect still travels in `model.activeEffects`, so the Active Effects panel advertises it.
- Evidence: `engine/derive.js:6-8`; `store.js:649-657`; no other `attribute-modifier` branch in `engine/`, `store*.js`, `ui/` except validation/builders (`engine/validate-item.js:29,59`, `ui/custom-item-builder.js:29`, `ui/ed-overview.js:688`). Data: `rules/thread-items.json` Bracers of Obsidiman Strength `threadRanks[5].effects[0]` (Strength +2 value, `condition:"always"`, rank 6); `rules/custom-items.json` Beer Mug of Brawling `effects[2]` (Perception −1 step, always). Race Strong Back (`races.json` races[0]) is situational, so correctly not folded.
- Impact: a rank-6 Bracers wearer gets no Strength value/step, Carrying Capacity, Strength-based Damage or Knockdown change. Custom items can legally carry the effect (validator accepts it, builder offers it) and it silently does nothing.
- Proposed remedy: add a fold step (value- and step-measure) before `attrStepByName` is built, reusing `applyModifiers`/`autoApplies`; or, if deferred, mark the type "reserved" in §2 and reject it in `validate-item.js` so it cannot be authored. Needs tests.

### T-003 — `RecoveryTests` modifiers with `measure:"count"` are dropped by the `rating`-only guard
- Source pass id: T-E02
- Severity: S1  Tier: 3 (code) / doc clarification  Status: fixed 2026-10-05 (`cf3c05f`; owner chose option B, `rating` is the one characteristic measure; Bone Charm split out as T-051)
- Area: engine
- Documented: §3 `RecoveryTests` is a `characteristic`; §5 `count` "discrete count | +1 recovery test/day".
- Observed: every static characteristic matcher requires `(e.measure ?? 'rating') === 'rating'`. The shipped `+1 Recovery test` effects are authored with `measure:"count"` (the doc's own example), so they never fold. Executed: `recoveryTests(14, [+1 count effect])` returns 3, same as base 3.
- Evidence: `engine/characteristics.js:323-330,377-381`; wired at `store.js:1082`. Data: `rules/disciplines.json` Warrior circle 7 `effects[0]` (RecoveryTests add 1, `measure:"count"`); `rules/items.json` Bone Charm `effects[0]` (same, `condition:"always"`). Test `characteristics.test.js:213` only checks the no-effect case.
- Impact: Recoveries/day under-counted for a Warrior at Circle 7 and for anyone wearing a Bone Charm (Recovery pool, buttons, end-of-day reset).
- Proposed remedy: accept `count` for `RecoveryTests` (and document which measure each `characteristic` name takes in §3/§5), or migrate the two data effects to `rating` (Tier 3 data) and state the rule. Add a test with a `count` effect.
- Resolution 2026-10-05 (`cf3c05f`): option B. `count` has no engine meaning and `RecoveryTests` is a characteristic like Death Rating, so it takes `rating`. Warrior Circle 7 migrated (bonus confirmed by the rule-agent, RULES-FAQ Q023); a +1 RecoveryTests effect now raises the daily count; §5 of the taxonomy marks `count` reserved and says characteristics take `rating`. The Bone Charm effect was **not** migrated: the book gives it +1 to Recovery test *results*, not per day (T-051).

### T-004 — Always-on `attack-modifier` effects with `measure:"rating"`/`"result"` never reach the combat pools
- Source pass id: T-E03
- Severity: S1  Tier: 3  Status: fixed 2026-10-05 (see the Re-validation table; the Bracers were migrated to `step` on the owner's ruling)
- Area: engine
- Documented: §2 "`attack-modifier` ... weapon / natural-attack damage step, to-hit step ... so the combat resolver can gather them in one dispatch"; §6 auto-apply of `always` effects; §5 measure meanings.
- Observed: `foldPool` folds only `measure==='result'` or `'step'`; any other measure is skipped with no trace. Executed: Aspect of the Casual Murderer (`attack/Attack` +5 and `attack/Damage` +5, `measure:"rating"`, sustained) is admitted by `activeSpellBundlesFor` (1 bundle), then `damagePool({weaponDamageStep:5,strengthStep:6})` = step 11, i.e. unchanged; the active-spell chip reads "+5 Attack rating". Separately `weaponPoolEffects` admits only `test-modifier`/`resource-modifier`, and `store.js:1384-1395` only `measure:"step"`, `add`, `replace`, so Bracers of Obsidiman Strength ranks 2/4 (`attack/Damage`, `measure:"result"`, scope "close combat", always) are folded nowhere.
- Evidence: `engine/combat.js:171-180,282-299,316-331`; `store.js:1384-1395`; data `rules/spells.json` Aspect of the Casual Murderer `effects[0..1]`, Aspect of the Fog Ghost `effects[0..1]` (+3/+3 rating); `rules/thread-items.json` Bracers of Obsidiman Strength `threadRanks[1].effects[0]`, `threadRanks[3].effects[0]`. Tests cover only step-measure (`combat.test.js:252-268,283`).
- Impact: advertised attack/damage bonuses from Aspect spells and the Bracers are not in the attack or damage Step or result mods. The roll is lower than the sheet shows as active.
- Proposed remedy: decide the canonical measure for attack bonuses (doc §5 gives `rating` no attack meaning), then either fold `rating`/`result` attack-modifiers as flat result mods and widen `weaponPoolEffects`, or migrate the data to `step`/`result` and have `foldPool` log a visible warning for unsupported measures (see T-023).

### T-005 — Spell cast success levels ignore roll-time flat mods, while the modal outcome includes them
- Source pass id: T-U01
- Severity: S1  Tier: 3  Status: fixed 2026-10-05 (see the Resolution note below)
- Area: ui
- Documented: ARCHITECTURE §3: "The UI never mutates state or computes game values directly." UI-GUIDELINES §5. The roll modal's total is "dice + Karma die + any roll-time modifiers" (ed-roll-modal.js:333).
- Observed: `_rollCast` passes Spellcasting `resultMods` (for example an activated Desperate Spell's bonus) to the roll modal as flat `mods` (ed-spells.js:1016-1025). The modal's Hit/Miss outcome and `_grandTotal()` include those mods. ed-spells `_onRoll` then rebuilds the total itself as `result.total + karmaResult.total`, omitting `mods`, and uses that to compute `successCount` (cast levels). The `ed-roll-logged` detail has no grand total: `{rollId, result, karmaResult, outcome, difficulty}` (ed-roll-modal.js:286-297). ed-app adds mods for the log (ed-app.js:286) but ed-spells does not.
- Evidence: ed-spells.js:366 and 399 (`const levels = successCount(total, this._castTarget)`); ed-spells.js:354 (learn-roll total, same omission); ed-spells.js:1016-1025 (mods passed); ed-roll-modal.js:333-340 (`_grandTotal`); ed-app.js:286.
- Impact: with any Spellcasting result mod active, the modal can say "Success" while `levels` is one or more lower. That blocks the self-cast activation (`levels >= 1`, `ed-spell-activate`), under-counts Success-Level extra effects, and misreports "Applied / No effect" for static effects. The wrong value is shown and acted on today.
- Proposed remedy: have the modal include `total` (grand total) and `levels` in the `ed-roll-logged` detail, or have ed-spells call the engine with the merged total. Do not re-sum in the view.
- Resolution 2026-10-05: new pure `rollTotal` in `engine/dice.js` (dice + Karma die + Bonus Dice + flat roll-time mods) is the one definition of a roll's total. The roll modal uses it for its Hit/Miss and now sends it as `total` on `ed-roll-logged`; `ed-app` logs that number and `ed-spells` uses it for the cast, learn-roll and teacher-roll totals instead of re-summing `result + karma` and leaving the mods out. Concrete case: a Knocked Down caster (−3 on every roll) rolls exactly the cast target; the modal said Miss while the Spells tab computed a success level and activated the spell. The Spells tab's `_onRoll` is a Lit method with no unit harness, so the tests cover `rollTotal` (`engine/dice.test.js`) and the wiring was checked by reading, not run in a browser.

### T-006 — Custom-item builder emits characteristic-modifier effects with a measure the engine ignores
- Source pass id: T-U02
- Severity: S1  Tier: 3  Status: fixed 2026-10-05 (see the Resolution note below)
- Area: ui
- Documented: EFFECT-TAXONOMY §6: "A `measure` mismatch is also a guard: a `rating`-measure modifier applies to a static rating, not to a step or result." Data convention: Initiative effects use `measure: "step"` (rules/items.json 15x, thread-items 11x, disciplines 2x); RecoveryTests uses `count`.
- Observed: `TYPE_META['characteristic-modifier'].measure` is a single `'rating'` for all targets. `blankEffect` and `_setEffect` (on a type change) and the target select (`_setTargetName`, which never resets the measure) leave Initiative/RecoveryTests at `rating`. `stepCharacteristic` only matches `(e.measure ?? 'step') === 'step'`, so an explicit `rating` Initiative effect never folds. The quick template "− Initiative" does set `step`, so only the dropdown path is broken. The Measure select offers all 6 measures for every type, and `validateItem` does not cross-check measure against target, so the bad item is accepted and saved.
- Evidence: ui/custom-item-builder.js:30 (TYPE_META characteristic-modifier) and :57-65 (`blankEffect`); ui/ed-custom-item.js:286-292 and :296-298 (`_setEffect`), :318-326 (`_setTargetName`), :506-512 (Measure select); ui/ed-custom-item.js:59-70 (templates that do set measure correctly); engine/characteristics.js:470-477; engine/validate-item.js:108-132 (no measure/target cross-check).
- Impact: a player who builds a custom item with "Initiative -1" from the dropdown gets an item whose auto-summary reads "Reduces Initiative by 1" but has no effect on the derived Initiative step. The mismatch is saved to GitHub.
- Proposed remedy: make the builder's measure default per target (Initiative -> step, RecoveryTests -> count, rating targets -> rating), reset it in `_setTargetName`, and add a measure/target cross-check to `validateItem`. Engine auditor owns the validator side.
- Re-check 2026-10-05 against the builder after v1.29/v1.30 (unarmed weapons, Damage Step as a single input, dropdown fixes): **still open, narrowed.** (a) The `RecoveryTests` half is no longer wrong: the builder's default `rating` is the measure the fold honours since T-003. (b) **Initiative is still broken.** Executed: `blankEffect('characteristic-modifier')` gives target `WoundThreshold`, measure `rating`; choosing Initiative through `_setTargetName` leaves `rating`; `finishEffect` summarises it "Reduces Initiative by 1", the validator accepts it, and `initiative(8, [effect])` returns 8, not 7. (c) The Measure select still offers all six measures for every type and `validateItem` has no measure/target cross-check. (d) The v1.30 `?selected` fixes make the Measure select display the stored value, which is good, but it now shows `rating` for an Initiative effect without any hint that it will be ignored. (e) Adjacent: `test-modifier` still defaults to `result`, while the owner's Step ruling (Q009) and the shipped data use `step` for Attack and Damage; the Beer Mug only worked because its author changed the measure by hand. Nothing in the v1.29/v1.30 changes touches measure defaults, so the remedy below is unchanged.
- Resolution 2026-10-05: engine/validate-item.js now owns which measures each type and target folds with (`measuresFor`, `defaultMeasure`): Initiative `step`, other characteristics `rating`, armor/defence `rating`, attribute `value` or `step`, attack/test `step` or `result`. `validateItem` rejects any other measure, naming the allowed ones, so a bad item cannot be saved. The builder takes its defaults from the same tables (a blank characteristic effect, a type change, and `reconcileMeasure` on a target change all land on a measure that folds; `test-modifier` now defaults to `step` per the Step ruling), and the Measure dropdown offers only the allowed measures. Every saved custom-items file (bundled, local, `character-data`) still validates. Tests in `custom-item-builder.test.js`. Also narrows T-038: the builder now imports these tables from the validator instead of copying them.

### T-007 — Spells tab adds step bonuses to rolls itself (castingStep, Effect step, Patterncraft step)
- Source pass id: T-U03
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ARCHITECTURE §3 "The UI never ... computes game values directly." ed-spells.js:1017-1021 itself calls this a bonus added "the same way the learn flow adds the teacher-TW bonus".
- Observed: three roll steps are summed in the view: `plan.castingStep + armed.step`, `plan.effect.step + effectBonus + charmStepBonus`, and `t.step + teacherRank`. `_charmStepBonus` and `_charmResultMods` walk `model.activeEffects` and filter on `e.type`, `e.target.domain`, `e.target.name`, `e.measure`, `e.operation` (see T-009). The display line "Step X +N = X+N" repeats the sum (ed-spells.js:1169).
- Evidence: ui/ed-spells.js:632, 964-993, 1021, 1044-1047, 1169.
- Impact: no wrong value observed today. The fold rules (measure guard, stacking) are reimplemented in the view, so any engine change to step folding can drift from what the tab rolls.
- Proposed remedy: have `castPlan` / `buildSpellsContext` return final `castStep`, `effectStep` and `learnStep`; the view dispatches them unchanged.

### T-008 — Combat tab re-derives armed-talent per-success bonuses and spell defence/armour deltas
- Source pass id: T-U04
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ed-combat.js:608 says "pools (pure engine; the view never computes game values)"; ARCHITECTURE §3.
- Observed: (a) `perSucc = value * armed.successes` computed in the chip badge/title; the same multiplication exists in the roll modal `_aimSummary`. (b) `_defArmourSection` subtracts the active spell's defence/armour delta from the engine's derived value and re-adds it as a mod (`sub = val - sum(mods)`), built by `_spellRatingMods`, which reads `e.type`, `e.target.domain`, `e.target.name`, `e.operation`, `e.value`. (c) `_chargeStrain` computes `damage + amount`.
- Evidence: ui/ed-combat.js:966-973, 1098-1125, 1265-1268; ui/ed-roll-modal.js:154-172.
- Impact: the figures shown can diverge from the engine's fold if `perSuccess` or stacking semantics change. The code comment at 1090-1097 describes the subtract-and-re-add as intentional.
- Proposed remedy: have `collectCombatEffects` / `foldCombatRatings` return the itemised spell deltas and per-success bonuses; `applyHealth` should accept an additive strain delta.

### T-009 — UI reads effect-taxonomy fields directly to format or filter effects
- Source pass id: T-U05
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: CLAUDE.md Tier 1: "The engine stays pure and DOM-free and reads rule data as structured taxonomy." ARCHITECTURE §3: UI renders engine output.
- Observed: several views branch on raw `effect.type/target.domain/target.name/measure/operation/value`: ed-combat `_badges`, `_spellRatingMods`, armed-effect filters; ed-spells `_charmResultMods` / `_charmStepBonus`; ed-roll-modal `_aimSummary`; ed-equipment `deriveTileEffect`, `modifierChip` (with `TILE_SUFFIX` / `EFFECT_SUFFIX` tables keyed on type); ed-overview `_modSummary` and cond badges on `operation`; ed-disciplines `_modChip`. The formatting-only ones (ed-equipment, ed-overview, `_modChip`) are labelled presentation. The ones that sum or choose by those fields are T-007 / T-008.
- Evidence: ui/ed-combat.js:883-892, 975, 1102-1107; ui/ed-spells.js:969-984; ui/ed-roll-modal.js:164-171; ui/ed-equipment.js:80-104; ui/ed-overview.js:230, 253-257, 286; ui/ed-disciplines.js:664-675.
- Impact: any taxonomy vocabulary change (Tier 2) now also needs UI edits; the Tier 2 migration checklist does not list ui/*.
- Proposed remedy: expose engine "view models" (label, signed delta, tone) and migrate the UI to them; or record the read-only formatting readers as an accepted deviation and add ui/* to the Tier 2 checklist.

### T-010 — Cast-target number is recovered by regex from the display string `castingTarget`
- Source pass id: T-U06
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ARCHITECTURE §5.5: "Regex-based rule parsing is Tier 1 ... Grandfathered deviations: `engine/spells.js` — `durationRounds` / `increaseEffectAmount` / ..." (only those four functions).
- Observed: `_defaultTarget` does `castingTarget.match(/\d+/)` to get the cast difficulty; `_castLabel` tests `/Mystic Defense/i`; the cast panel tests the same regex. rules/spells.json values: "Fixed 10" (22), "Fixed 6" (12), "Fixed 20" (3), "Fixed 8" (2), "Fixed 15" (1), "6 or Target's Mystic Defense (see text)" (1), "15 or Target's Mystic Defense" (1), "Target's Mystic Defense" (67), "... (see text)" (14). Not covered by the grandfathering in §5.5.
- Evidence: ui/ed-spells.js:852-858, 916-919, 1131; rules/spells.json (`castingTarget`).
- Impact: the two "N or Target's Mystic Defense" spells silently default to N; correct rules-wise is a choice. Nothing wrong today. A new phrasing ("Fixed 6/8") would mis-parse.
- Proposed remedy: add structured `castingTarget` fields (fixed number, `mysticDefense` flag) in rules/spells.json and have `buildSpellsContext` expose them; requires owner sign-off as it extends the grandfathered parser set.

### T-011 — Combat success-level damage bonus is keyed off the Roll Log label text
- Source pass id: T-U07
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ARCHITECTURE §3/§5.5 (structure, not display strings).
- Observed: `_onRollLogged` finds the attack roll with `/^Attack/.test(r.label)` over the Roll Log and feeds its `total` / `difficulty` into `attackSuccessLevels` for the Damage step bonus. The label is built by `_rollLabel('Attack', weapon)`; a free-action roll is labelled by the talent name (`opt.name`), which can begin with "Attack" and so be mistaken for the weapon attack. Line 1392 also picks a glyph by label regex (cosmetic).
- Evidence: ui/ed-combat.js:358-360, 811, 1392.
- Impact: latent. A talent or skill starting with "Attack" could arm or overwrite the damage-bonus source.
- Proposed remedy: tag Roll Log entries with a structured `kind: 'attack'` (the roll event already carries `kind`) and match on that.

### T-012 — Lift is recomputed in the Equipment banner as a fallback
- Source pass id: T-U08
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: UI-GUIDELINES §5 "Never show a fabricated number"; ed-equipment.js:789 "nothing is computed here".
- Observed: `cc?.lift ?? capacity * 2 - 1`. The engine returns `lift` with carryingCapacity (engine/characteristics.js:429), but the UI duplicates the 2x-1 rule and will show a number if `lift` is missing (for example if `capacity` comes from `w.capacity`, which can differ from `cc`).
- Evidence: ui/ed-equipment.js:797-807; engine/characteristics.js:427-430.
- Impact: latent. `w.capacity` and `cc.value` could differ and the fallback would then produce a Lift inconsistent with the engine.
- Proposed remedy: drop the fallback; render a pill when `lift` is null.

### T-013 — `allSilverAlloc` in the trade modal duplicates engine `allocForSilver`
- Source pass id: T-U10
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ARCHITECTURE §3 (UI does not compute game values; engine owns wealth math).
- Observed: `allSilverAlloc(coins, amount, capped)` repeats the body of `allocForSilver` in engine/wealth.js:123-131 (round to copper, split silver/copper) and adds purse capping (`Math.min(want, owned)`). ed-spells already imports `allocForSilver`.
- Evidence: ui/ed-trade-modal.js:36-48; engine/wealth.js:123-131; ui/ed-spells.js:13.
- Impact: a change to denominations or rounding in the engine will not reach the trade dialog.
- Proposed remedy: add a `capped` option to the engine function and delete the UI copy.

### T-014 — Karma ledger clamp and Ritual affordability are computed in ed-app / ed-overview (duplicated from store.js)
- Source pass id: T-U11
- Severity: S2  Tier: 1  Status: open
- Area: ui
- Documented: ed-app.js:992-995 comment: "the spendable pool `available` is DERIVED (`clamp(converted - spent, 0, max)`)"; ARCHITECTURE §3.
- Observed: store.js:1063 derives `available`; `_editKarma` re-derives it (`Math.max(0, Math.min(max, converted - spent))`), then computes ritual `room`, `affordable = floor(availLegend / cost)`, `points`, the `legend: points * cost` total, the refill target (`spent + max`). ed-overview `_ritualMaxBuy` repeats room / affordable in the view, and the ritual body shows `spend = n * cost`.
- Evidence: ui/ed-app.js:1004-1048; ui/ed-overview.js:344-361; store.js:1056-1064.
- Impact: three copies of the karma-economy rule. The ed-app copy is defensive re-clamping and agrees with the others today.
- Proposed remedy: one engine function (for example `karmaRitualPlan(karma, legendAvailable)`) used by the store derivation, ed-app and the view.

### T-015 — store.js folds taxonomy fields to decide a thread weapon's Damage step
- Source pass id: T-U17
- Severity: S2  Tier: 1  Status: open
- Area: store (followed import)
- Documented: ARCHITECTURE §3: engine folds effects by taxonomy; EFFECT-TAXONOMY §7 (`stacking: replace`).
- Observed: store.js loops `it.effects` and, for `attack-modifier / attack / Damage / step / add / stacking replace`, sets `damageStep = e.value` (last write wins) instead of using an engine fold. Data must stay in ascending rank order for this to be right, which the comment acknowledges.
- Evidence: store.js:1377-1397.
- Impact: latent; a different order or a non-`add` operation for woven ranks silently yields the base Damage step.
- Proposed remedy: move the fold into engine/combat.js (or characteristics.js) using `collapseByTarget`, and call it from store.

### T-016 — `attack-modifier` with `measure: "rating"` is outside the documented contract
- Source pass id: T-D03
- Severity: S2  Tier: 2 (doc clarification) or 3 (data change)  Status: fixed 2026-10-05 (no `attack-modifier` uses `rating` now; see T-004)
- Area: data
- Documented: §2: `attack-modifier` "adjusts an attack's step or result". §5: `rating` = "a static stat (defense / armor / threshold / movement)".
- Observed: six `attack-modifier` effects use `measure: "rating"`, all in two spells. "Aspect of the Fog Ghost": Attack +3 and Damage +3 (sustained), plus an `extraThreads` Attack +1. "Aspect of the Casual Murderer": Attack +5 and Damage +5, plus an `extraThreads` Attack +1. `attack-modifier` with `result` also appears twice in `thread-items.json` (Bracers of Obsidiman Strength, Damage +1/+2, scope "close combat"). `result` is documented.
- Evidence:
  - rules/spells.json:1087 (Fog Ghost).
  - rules/spells.json "Aspect of the Casual Murderer" `.effects[0..1]` and `.extraThreads[0]`.
  - rules/thread-items.json `.items.Bracers of Obsidiman Strength.threadRanks[1]` and `[3]`.
  - engine measure guard: engine/characteristics.js:476 defaults `attack` folds to `step`.
- Impact: a measure-guarded fold would ignore or mis-class these effects. I have not verified which happens. The data's own meaning ("+3 to Attack and Damage" as flat) corresponds to `result`, not `rating`.
- Proposed remedy: re-measure to `result` (or `step` if that is the rule), or add `rating` to `attack-modifier` in §2. Adding it is Tier 2, bump to v5.

### T-017 — `stacking` semantics in code differ from §7 (per-origin progression, origin-less exempt)
- Source pass id: T-E08
- Severity: S2  Tier: 2 if the doc is corrected (taxonomy text), else 3  Status: open
- Area: engine / doc
- Documented: §7 "`highest` only the largest applies; `replace` this effect overrides others on the target; `unique` only one instance regardless of source".
- Observed: `collapseStacking` groups by `origin.kind:name` and collapses each group independently, so two sources on the same target both apply (tested as intended: "independent sources still add together"). Only `unique` is cross-source. Effects with no `origin` are never collapsed even if they say `highest`/`replace`. A group's mode is taken from its first member only (`group[0].stacking`). `ability-ranks.js` and `combat.js` re-group by `type|domain|name|measure|scope` for their own paths, and `store.js:1384-1395` re-implements "replace" for the thread-weapon damage step by hand.
- Evidence: `engine/characteristics.js:76-102`; `engine/ability-ranks.js:34-44`; `engine/combat.js:282-299`; tests `characteristics.test.js:379-421`; `store.js:1384-1395`.
- Impact: S2: no shipped data collides today (`highest` is same-origin discipline circles, `replace` is thread ranks and Natural Armor `set`), but a second source with `stacking:"highest"` on the same target would be summed, contrary to §7.
- Proposed remedy: rewrite §7 to describe per-progression stacking (and the origin-less exemption), or implement per-target stacking; fold the store.js hand-rolled replace into `collapseByTarget`.

### T-018 — Obsidiman Skin armor value disagrees with its own summary
- Source pass id: T-D02
- Severity: S2  Tier: 3  Status: fixed 2026-10-05 (`17b960e`)
- Area: data
- Documented: EFFECT-TAXONOMY §1 `summary`: "Concise original-wording description". `value` is the machine quantity and `summary` is its display.
- Observed: `Obsidiman Skin` has `armor-modifier` Physical `add 2` with summary "Physical Armor 3". This is the only mismatch out of 945 effects in a mechanical value-vs-summary-digits check. Every other armor item agrees with its summary.
- Evidence: rules/items.json:414 (`.items.Obsidiman Skin.effects[0]`). Mystic `add 1`, summary "Mystic Armor 1" is consistent.
- Impact: either the armor contribution is 1 under-counted or the summary is wrong. I have not established which is correct from the rulebook.
- Proposed remedy: have the rule-agent confirm Obsidiman Skin's Physical Armor, then fix `value` or `summary`.
- Update 2026-10-04: rule-agent confirmed (RULES-FAQ Q022, `text-RB-players-guide.txt` Armor Table): Physical 3, Mystic 1. `value` set to 3 in `rules/items.json` on 2026-10-05; summary unchanged.

### T-019 — Per-success talent/skill effects kept as `note` while the same shape is structured elsewhere
- Source pass id: T-D10
- Severity: S2  Tier: 3  Status: open
- Area: data
- Documented: §2 "`note` records a non-numeric / roleplay effect (no dispatch)". §6 `on-success` + `perSuccess` covers "+2 PD per success".
- Observed:
  - 17 `type:"note"` effects carry `condition:"on-success"` and `perSuccess:true` and state a numeric modifier. Examples: "+2 to Physical Defense per success" (Acrobatic Defense), "+2 to close-combat Attack tests against the target per success", "-2 per success to the target's tests".
  - The same mechanic is structured as `defense-modifier` for Anticipate Blow (talents.json) and the skill at skills.json:221.
  - Overall 98 spell notes, 18 skill notes, 14 thread-item notes, 9 item notes, 6 talent notes, 5 combat notes and 2 discipline notes contain digits or Strain costs.
- Evidence: rules/skills.json:27 (Acrobatic Defense, note) vs rules/skills.json:221 (structured, same rule shape); rules/skills.json:68.
- Impact: the engine cannot apply or surface these as modifiers. They are invisible to the roll pool and Combat fold, so the sheet can show a lower defense or pool than the rule grants.
- Proposed remedy: convert the 17 per-success notes to `test-modifier` / `defense-modifier` with `on-success` + `perSuccess` (Tier 3 data, existing vocabulary), adding `arms` where a later action is buffed.

### T-020 — Spell Success-Level/Extra-Thread options: v4 migration is partial
- Source pass id: T-D11
- Severity: S2  Tier: 3  Status: open
- Area: data
- Documented: v4 note: "a spell's 'Increase Duration' Success-Levels / Extra-Thread options carry a machine-applicable effect instead of a free-text `note`". §5 defines `yards` and `count`.
- Observed (inside `extraThreads[]` and `successes[]`):
  - `duration-modifier` is used for 55 options (rounds 28, minutes 23, hours 4).
  - Still `note`: 5 "Increase Duration (N months)", 1 "(N days)", 26 "Increase Range (N yards/miles)", 5 "Increase Area (N yards)", 7 "Additional Target(s)".
  - "Increase Effect" is inconsistent: 7 as `note` ("N Effect Step") vs 8 as `attack-modifier` ("N Effect Step"), and further notes ("N bonus", "N Mystic Armor", "N Defenses") beside typed versions.
  - Measure `yards` and `count` exist in §5 but are unused.
  - `months` and `days` have no measure at all.
- Evidence: rules/spells.json:170-183 ("Bone Circle" months notes); rules/spells.json "Astral Spear".extraThreads[1..2] (range and target notes).
- Impact: extra-thread / success options that change range, area, targets or effect-step cannot be applied by the engine, and the same option type behaves differently between spells.
- Proposed remedy: convert `Increase Range/Area` to a typed effect with measure `yards`, make `Increase Effect` uniform, and either add `days`/`months` measures (Tier 2, v5) or leave them as accepted notes.

### T-021 — Combat pools ignore `operation` (only `subtract` is special) and do not implement the §4.1 `set`-first contract
- Source pass id: T-E04
- Severity: S2  Tier: 3  Status: narrowed 2026-10-05 (pools report unsupported operations; `set`-first not implemented)
- Area: engine
- Documented: §4.1 "All `set` effects on a target establish the base first ..., then `add`/`subtract`/… fold on top"; "Substitution talents ... are `set` on the base"; §4 operations list.
- Observed: `opValue` negates on `subtract` and otherwise returns `value`. A `set`, `multiply`, `min`, `max` or `divide` effect is therefore added; a `{ref}` value is string-concatenated. Executed on `damagePool(5+6)`: `set 3` gives 14, `multiply 2` gives 13, `set {ref}` gives `"11[object Object]"`. The §4.1 pass-1 fold exists only in `applyModifiers` (`characteristics.js:161-165`); `damagePool`/`attackPool` have no such pass. No shipped pool-bound effect uses these today (spell `set` effects are `duration:"test"` and not sustained), but the validator lets custom items carry `set` and `{ref}` on a `test-modifier`, and equipped weapon `test-modifier` effects go straight to `foldPool`.
- Evidence: `engine/combat.js:108,162-181,212-219,282-299`; `engine/validate-item.js:40,115-116`; contrast `engine/characteristics.js:153-174`.
- Impact: latent wrong Step or a non-numeric Step if a `set`/`ref`/`multiply` effect is authored for a pool.
- Proposed remedy: have `foldPool` reuse `applyModifiers` semantics (set pass, numeric guard, unsupported-operation rejection) or explicitly skip-and-flag unsupported operations; add tests. Alternatively document that pools support add/subtract only and tighten the validator.

### T-022 — Documented vocabulary with no handler and no "reserved" marking
- Source pass id: T-E06
- Severity: S2  Tier: 3 (doc/marking); any new handler Tier 3  Status: open
- Area: engine / doc
- Documented: §2 types `grant-attack`, `sense`, `enable-option`; §2 "`enable-option` ... its `target.name` must match an option's `name` in `rules/combat.json` ... always on once granted"; §3 `Movement.Fly|Swim`, `resource` Karma/Legend/Recoveries, `attack` natural names, `sense`, `option`; §6 object `trigger` condition; §8 durations `rounds` (+`"rounds": N`), `encounter`, `special`; §5 `dice`, `yards`, `value`.
- Observed: none of the above has an engine consumer (Appendix C). `enable-option` is replaced in practice by an undocumented `restricted` race gate on the combat option (`ui/ed-combat.js:518`, data `rules/combat.json` Tail Attack `restricted:"T'skrang"`), so the documented mechanism is dead. The Windling fly rate exists as both an effect (`races.json` races[7].abilities[1]) and `movement.fly`, with neither read (`store.js:1085` derives Walk only). Data uses `grant-attack` ×1, `sense` ×6, `enable-option` ×1.
- Evidence: Appendix C rows; `engine/characteristics.js:447-457`; `rules/combat.json` Tail Attack; `ui/ed-combat.js:518`.
- Impact: S2 latent. Sense/Fly data is display-only text, so nothing wrong is computed, but the taxonomy implies engine behaviour that does not exist.
- Proposed remedy: add a "handled / display-only / reserved" column to §2–§8, and either implement `enable-option` gating and Fly/Swim or retire/redirect them (`restricted`). Doc edits are Tier 2 (bump v5 and keep schema refs in step).

### T-023 — Unknown or unsupported effect values are skipped silently everywhere
- Source pass id: T-E07
- Severity: S2  Tier: 3  Status: narrowed 2026-10-05 (combat pools report `unapplied`; other consumers still silent)
- Area: engine / tests
- Documented: Checklist B "fail visibly (or are skipped deliberately) — not silently mis-computed"; ARCH §3 placeholder-pill principle.
- Observed: every consumer filters with `type ===`/`target.name ===` matches and ignores the rest (`characteristics.js:155,201-205,224-228`; `combat.js:171-178`; `ability-ranks.js:62`; `store.js:1565-1570`). There is no `console.warn`, no "unhandled effect" list, and no test or lint that validates `rules/*.json` against the vocabulary (`tools/` has only import/dev-server/fold tests). `engine/validate-item.js` is the sole vocabulary gate and covers only custom items (8 of 14 types; no `ref`/`multiply`/`min`/`max`; condition objects unchecked). T-002/02/03 are all instances of this gap.
- Evidence: greps of `console.` in `engine/` and `store.js` return nothing; `package.json` test script is `node --test`; `engine/validate-item.js:28-66`.
- Impact: any data/engine vocabulary drift is invisible until a number is wrong.
- Proposed remedy: add a `rules/*.json` vocabulary test (every type/target/operation/measure/condition/duration must be in a table shared with the validator) and surface an "effects not applied" marker in the Active Effects panel. Tier 3.

### T-024 — Weapon Damage Step has two sources (`ref.damageStep` and the `attack-modifier add`); §4.1 documents only the effect
- Source pass id: T-E10
- Severity: S2  Tier: 3  Status: open
- Area: engine / doc
- Documented: §4.1 "A weapon entry therefore carries only its own `add` (the weapon's Damage Step), e.g. the Medium Crossbow's `add 5`".
- Observed: combat reads `ref.damageStep` (`w.damageStep`, `ui/ed-combat.js:699`; built at `store.js:1374-1376`) and adds the Strength step in `damagePool`; the weapon's own `attack-modifier` Damage effect is deliberately not folded a second time (`combat.js:271-281`). Thread weapons instead take the last `add`+`replace` step effect (`store.js:1384-1395`). All 46 catalog weapons that have both agree today (0 mismatches); 2 weapons carry `ref.damageStep` only.
- Evidence: `engine/combat.js:212-215,271-281`; `store.js:1370-1395`; `rules/items.json` weapon entries (scan: 48 weapons, 46 with both, 0 differing).
- Impact: latent duplicated truth; editing one copy (or a custom weapon with only the effect, which gets a null step and a placeholder pill) diverges silently.
- Proposed remedy: declare one canonical source (recommend the effect, per §4.1) and derive `damageStep` from it, or document `ref.damageStep` as the combat input and drop the duplicate effect.
- **Follow-up agreed by the owner (2026-10-05, option B):** once the weapon Damage Step has a single source, collapse the *bonus* uses of `attack-modifier` onto `test-modifier`, leaving `attack-modifier` to mean only "this weapon's or spell's base step". Candidates to migrate: the sustained spell bonuses (Arrow of Night, the two Aspects, Night's Edge's dice) and the thread-weapon rank bonuses. (The builder's weapon Damage template was removed 2026-10-05, custom-item-builder; the builder now generates the weapon's base-step `attack-modifier` from `ref.damageStep`, which stays `attack-modifier` under option B.) Today the authoring rule is the interim one written into EFFECT-TAXONOMY §2 (option A): both types fold identically in the combat pools, and an item's Attack/Damage bonus should be a `test-modifier`. Settle T-024 first, because the weapon's base Damage Step (`ref.damageStep` and the effect) is what keeps `attack-modifier` from being retired outright.

### T-025 — Hard-coded rule defaults and constants in UI code
- Source pass id: T-U09
- Severity: S2  Tier: 3  Status: open
- Area: ui
- Documented: ed-disciplines.js:468 comment "Seed fee from costs.skillTraining[1] (data)"; CLAUDE.md: rule data lives in rules/*.json.
- Observed: (a) skill training fee falls back to a literal `10` sp when the option has none. (b) Skill tier mapping `cat.tier === 2 ? 'Journeyman' : 'Novice'` in ed-app and `o.tier === 'Journeyman' ? ... : 'Novice'` in ed-disciplines. (c) Trade modal hard-codes 10 copper per silver in `allSilverAlloc`. (d) Coin parsing in ed-equipment with `parseInt`. (e) Combat `roll.vs ?? 'Mystic'` default in two places.
- Evidence: ui/ed-disciplines.js:469; ui/ed-app.js:1215; ui/ed-disciplines.js:990; ui/ed-trade-modal.js:36-48; ui/ed-combat.js:757, 761; ui/ed-disciplines.js:295-298.
- Impact: a fee of 10 sp is shown as a default when data is missing (a fabricated number). The copper rate already lives in `engine/wealth.js` COIN_DENOMINATIONS.
- Proposed remedy: read the rate from COIN_DENOMINATIONS; leave the fee empty / pill when `trainingSilver` is null; move tier labels into the legend/skills data.

### T-026 — Recomputable values still stored in character data (Kolon)
- Source pass id: T-D14
- Severity: S3  Tier: 1 (data-model invariant)  Status: open (known as REVIEW-FINDINGS G1)
- Area: data
- Documented: ARCHITECTURE §4.1 "store only inputs; never store what a rule can recompute".
- Observed:
  - `kolon.json` still stores `resources.karma.available` = 35 (= `converted` 140 − `spent` 105) and `resources.karma.legend` = 980 (= 140 × 7). Both are recomputable.
  - `store.js` ignores both: it derives `karmaAvailable` from `converted − spent` (store.js:1061-1064), and `karma.legend` is not read anywhere (grep hit nothing).
  - `resources.legend.totalSpent` is stored in all three characters (45261 / 43380 / 44661), and legacy `totalEarnt` in all three. `store.js` still reads `totalSpent` (store.js:1286) for the reconciliation delta, so it is a recorded input. REVIEW-FINDINGS G1 tracks this and marks `karma.available`/`karma.legend` as the open half.
  - `chakka.json` and `test-char.json` no longer store `karma.available` or `karma.legend`, so they are already clean.
- Evidence (`character-data` branch): data/characters/kolon.json:249-252 (`available`, `converted`, `spent`, `legend`); data/characters/*.json `legend.totalSpent` (chakka :267, kolon :255, test-char :196).
- Impact: no wrong number today (both stored values are ignored), but the stored figures will drift from the inputs when Kolon's karma is edited. The dead fields also mislead future readers.
- Proposed remedy: drop `karma.available` and `karma.legend` from `kolon.json` (data cleanup on the `character-data` branch, needs owner sign-off for the invariant per G1). Decide whether `totalSpent` is a sheet-recorded input (document the exception) or drop it.

### T-027 — Purity and regex inventory
- Source pass id: T-E11
- Severity: S3  Tier: 1 (non-grandfathered regex items need owner decision)  Status: open
- Area: engine / store
- Documented: CLAUDE.md Tier 1 "engine stays pure and DOM-free and reads rule data as structured taxonomy, never by regex-parsing display strings"; ARCH §5.5 grandfathered list.
- Observed:
  - DOM/network/storage in `engine/*.js`: none. Non-determinism: `potions.js:80,85` `Date.now()` stamped into `armPotion` results; `dice.js` default `Math.random` (overridable `rng`).
  - Regex / string parsing over rule or display strings, complete list:
    - `engine/spells.js:208,211,213,216` `durationRounds` parses the printed `duration` ("Rank minutes", "Rank + 5 rounds"). **Grandfathered.** It is the only survivor: the ARCH §5.5 list also names `increaseEffectAmount` / `increaseDurationRounds` / `increaseEffectSteps`, which no longer exist (migrated to structured `effects[]` in v4; `spells.js:288-332` "No label parsing"). ARCH §5.5 is stale.
    - Not rule text, name normalisation: `engine/spells.js:36` and `engine/legend-spent.js:102` (curly to straight apostrophe), `engine/validate-item.js:95-102` (`BAD_NAME_CHARS`, `.trim()`).
    - Structured ref grammar (`a|b|c`), not display text: `engine/spells.js:147`, `store.js:1019`.
    - **Not grandfathered**: `store.js:97-100` regex `^(.*?)\s*\(([^)]+)\)\s*$` recovers a knack's parent from a character-stored display name "Name (Parent)" when the catalog has no entry; `store.js:1126` strips a "(specialisation)" suffix from a skill name to find its catalog entry. Both derive structure from a name string.
    - Unrelated: `store.js:154-155` (ETag/sha), `store-export.js:21` (filename slug), `store-log.js` `.trim()` only.
- Evidence: lines above; `grep` of `RegExp|.match|.replace|.split|.test(` over `engine/*.js store*.js`.
- Impact: no wrong value observed. Two un-sanctioned name-parsing spots sit on the Tier 1 line; `Date.now()` makes `armPotion` non-deterministic for tests (existing tests tolerate it).
- Proposed remedy: owner to rule on `store.js:97,1126` (accept as deviation, or add structured `parent`/`specialisation` fields); accept or inject `Date.now()`; refresh ARCH §5.5 to list only `durationRounds` and add a structured duration field when convenient (Tier 2 if the spell schema changes).

### T-028 — No `dispatch` exists; ed-app.js acts as store and rules layer
- Source pass id: T-U12
- Severity: S3  Tier: 1  Status: open
- Area: ui / doc
- Documented: ARCHITECTURE §3 diagram: "dispatch(action) -> engine -> new state -> notify UI"; app.js "wires store, dispatch, persistence" (ARCHITECTURE:469).
- Observed: there is no dispatch function. Child components raise CustomEvents (`ed-edit-items`, `ed-edit-health`, `ed-roll`, ...) that ed-app's ~20 `_editXxx` handlers apply by assigning `this._character = {...}` (19 assignment sites), calling `saveXxxEdits`, then `this._model = this._derive()`. The events-up half of the golden rule is honoured (no child writes `model`). The same ed-app handlers also hold game logic: learn-skill/talent/knack cost gating, karma ritual, potion arming, legend-cost deltas (`auditLegendSpent` after - before), trade log arithmetic.
- Evidence: ui/ed-app.js:501, 536, 569, 688, 743, 775, 793, 980, 1050, 1076, 1085, 1098, 1160-1376; app.js:1-3; ARCHITECTURE.md:90-95, 469.
- Impact: doc/code drift: the documented layer boundary does not exist, so "UI never computes" cannot be checked mechanically. Root cause of T-014 and T-025.
- Proposed remedy: either update ARCHITECTURE to name ed-app as the application layer and list which `_editXxx` logic belongs in engine modules, or extract a `store-dispatch.js`. Owner decision (Tier 1 wording).

### T-029 — Karma ritual log stores a derived total (`legend`) in character data
- Source pass id: T-U13
- Severity: S3  Tier: 1  Status: open
- Area: ui
- Documented: ARCHITECTURE §4.1: "store only inputs; never store what a rule can recompute."
- Observed: each ritual event saved in `resources.karma.rituals` includes `legend: points * cost`. engine/legend-spent.js:433 says the Legend sink is derived as `converted x cost` independent of the events, so `legend` is a recomputable duplicate; `cost` is a per-purchase snapshot input. The undo notice reads `ev.legend` with a fallback to `points * cost`.
- Evidence: ui/ed-app.js:1023, 1035; engine/legend-spent.js:430-442.
- Impact: none today (value never read as authority); violates the stated invariant and would go stale if the cost rule changed.
- Proposed remedy: drop `legend` from the stored event and compute it at display time from `points x cost`; keep reading old files.

### T-030 — Derived-value placeholders: bare "—" instead of the dashed pill in Disciplines and Spells
- Source pass id: T-U14
- Severity: S3  Tier: 1  Status: open
- Area: ui
- Documented: UI-GUIDELINES §5: "shows as a muted dashed placeholder pill (—)".
- Observed: ed-overview, ed-combat, ed-equipment (capacity) and ed-disciplines (Legend chip) use a `.pend` pill. Missing step/dice and learning values render as plain text "—": ed-disciplines talent/skill/granted `step` rows, and ed-spells learning difficulty, Legend cost, Patterncraft/Thread Weaving step, weaving difficulty, `learntSuccess`, cast target. No number is invented, but the pill treatment is not applied.
- Evidence: ui/ed-disciplines.js:273, 401, 696; ui/ed-spells.js:729-732, 765, 839-840, 854, 872.
- Impact: visual inconsistency with the guideline only.
- Proposed remedy: share the `.pend` pill (for example from ui/format.js or a small element) and use it in those cells.

### T-031 — Only 2 of ~20 modals use the shared modal controller; the rest hand-roll Escape handling
- Source pass id: T-U16
- Severity: S3  Tier: 1  Status: open
- Area: ui / doc
- Documented: docs/MODALS.md: "New or edited modals adopt the controller; they do not hand-roll their own Escape/focus handling." CLAUDE.md source-of-truth map lists `ui/modal-controller.js` as the standard.
- Observed: `modal-controller` is imported by ed-app.js and ed-disciplines.js only. 19 files add `document.addEventListener('keydown', ...)` themselves (for example ed-homebrew, ed-custom-item, ed-settings, ed-trade-modal, ed-roll-modal). Escape-closes works in those I read (ed-homebrew.js:92-95, ed-custom-item.js:107-115); the focus-return, Tab-trap and pointer-open ring-suppression parts of the contract are not provided by them. ed-homebrew has no `role="dialog"` and no initial focus.
- Evidence: ui/ed-app.js and ui/ed-disciplines.js (imports); ui/ed-homebrew.js:92-107, 131-153; ui/ed-custom-item.js:107-123; grep count of `document.addEventListener('keydown'` = 19.
- Impact: the stuck-focus-ring bug MODALS.md describes can return in the hand-rolled modals.
- Proposed remedy: migrate modals to the controller, or narrow MODALS.md to say which are exempt.

### T-032 — `custom-items.json` (and its emitters) still reference taxonomy v3; the v4 migration was half-done
- Source pass id: T-D04
- Severity: S3  Tier: 2  Status: open
- Area: data
- Documented: CLAUDE.md Tier 2 step 3: "Update the version references that point at it — the schema tags and the effectTaxonomy field in the affected files. All three happen together, or none do." EFFECT-TAXONOMY v4 note: "every `rules/*.json` `effectTaxonomy` reference bumped v3 → v4".
- Observed: `rules/custom-items.json` (and the identical `character-data` `data/custom-items.json`) has `effectTaxonomy: "…(v3)"`. The Worker that creates the file stamps v3 (`tools/worker/worker.js:287`), so a fresh custom-items file is born v3. Fixtures and tests assert v3: `tools/dev-server.test.js:179`, `tools/worker/worker.test.js:120,709`, `tools/fold-custom-items.test.js:21`, `engine/validate-item.test.js:198`, `store-custom-items.test.js:253`. `data/changelog.json:299` says "the effect taxonomy is now v4", which is true for everything except this file.
- Evidence: rules/custom-items.json:3; tools/worker/worker.js:287; data/changelog.json:299.
- Impact: doc and data disagree. The tag is not read by the engine, so no wrong value, but it is the exact half-migration Tier 2 is meant to prevent.
- Proposed remedy: bump the tag in `rules/custom-items.json`, the `character-data` copy and worker.js, update the test fixtures in the same change, and confirm the CI fold does not reject a v4 file.
- Update 2026-10-05: the bundled file and the worker/dev-server stamps are v6, but the CI fold (`tools/fold-custom-items.mjs`) mirrors `character-data`'s `data/custom-items.json` byte for byte and that file still says v3. The fold commit `929f0bb` therefore reintroduced v3 into `rules/custom-items.json` and turned the conformance tests red; it was re-tagged v6 by hand on `dev`. **It will happen again on the next custom-item save.** Permanent fix, owner decision: (a) have the fold stamp the current `effectTaxonomy` ref when mirroring (and update its tests), or (b) bump the tag in `character-data`'s `data/custom-items.json` once.

### T-033 — Undocumented effect fields and ref property (`note`, `rounds` in the table, `Max`)
- Source pass id: T-D05
- Severity: S3  Tier: 2  Status: open
- Area: data / doc
- Documented: §1 field table lists type, target, operation, value, measure, condition, scope, perSuccess, stacking, duration, source, gmDiscretion, summary. §8 says "rounds: add `"rounds": N`" in prose only. §3: `property` "`Step`/`Rank` when used inside a `ref`".
- Observed:
  - `note` (a free string on an effect, not `type:"note"`) appears on 4 effects. The content is rules-bearing: "acts as a base; only living armor adds on top", "may attach a melee weapon of up to Size 2", "fatigue after ~20 min flight", "as if possessing the talent".
  - `rounds` (numeric) is used on 5 effects, correctly paired with `duration:"rounds"`, but it is not in the §1 table.
  - `ref` value `resource|Karma|Max` (`Max` is not a documented property).
- Evidence: rules/items.json `Astral-Sensitive Eye.effects[0]`; rules/races.json races[3].abilities[1].effects[0], races[6].abilities[0].effects[0], races[7].abilities[1].effects[0]; rules/knacks.json "Anticipate Spell"; rules/skills.json line ~221; rules/talents.json "Anticipate Blow"; rules/spells.json "Spirit Dart".effects[2]; rules/talents.json:2897.
- Impact: a doc-conformant validator would reject these. The engine ignores `note` on effects (data loss for authors).
- Proposed remedy: document `rounds` (and `Max`) in §1/§3. Either document effect-level `note` or fold it into `summary`. Either doc change is Tier 2, so bump to v5 and migrate together.

### T-034 — `scope` carries structured rules meaning as prose (costs, durations, prerequisites)
- Source pass id: T-D06
- Severity: S3  Tier: 2  Status: open
- Area: data
- Documented: §6 "`scope` narrows applicability. Free text for now; candidate controlled values: `carryingCapacity`, `close-combat`, `ranged-combat`, `vs-horrors`, `adept-only`, `unarmed`." §11.4 "still open".
- Observed: of 47 distinct scopes, only 3 match the candidate tokens, and `close combat` (space) is used instead of `close-combat` (5 uses). Many scopes encode Strain costs and durations that a `resource-modifier` (Strain) or `duration` could express. Examples:
  - `1 Strain`
  - `for one test, for 1 Strain`
  - `per 2 Strain taken; not Damage tests`
  - `for 2 Strain`
  - `8 hours`
  - `next Recovery test within 24 hours`
  - `tests to resist disease, for 24 hours`
  - `upon the character's death`
  - `if the character knows the Astral Sight talent`
  - `uses Perception step`
- Evidence: rules/items.json (Strength Booster, Initiative Booster, Death Cheat, Booster Potion, Astral-Sensitive Eye); rules/thread-items.json (Bracers of Aras rank 5, Bracers of Obsidiman Strength); rules/races.json `carryingCapacity`.
- Impact: none for computation today, since situational effects are surfaced only. It blocks future automation and mixes display text and logic.
- Proposed remedy: lock a small enum for the recurring tokens (`close-combat`, `ranged-combat`, …) and normalise `close combat` → `close-combat` (Tier 2, bump and migrate). Move Strain costs to `resource-modifier` siblings.

### T-035 — `test`-domain target names fall outside the §3 list; one sense is spelled three ways
- Source pass id: T-D07
- Severity: S3  Tier: 2  Status: open
- Area: data / doc
- Documented: §3 `test` names: "`Action` `Attack` `Damage` `Effect` `Initiative` | a named ability". §11.5 says `Knockdown` is "not yet in the characteristic vocabulary".
- Observed:
  - 13 `test` targets are not abilities and are not in the list: `Recovery` (5), `Knockdown` (1), `Astral Sensing` (1), and the attribute-named tests `Strength` (1), `Toughness` (1), `Perception` (1), `Charisma` (1). `Intimidation` (2, spells) is not a talent, skill or knack in the catalog.
  - Astral sight is expressed as `sense/AstralSight` (talents.json), `ability/Astral Sight` (items.json, races.json) and `test/Astral Sight` plus `test/Astral Sensing` (items.json).
  - `Knockdown` is modified by an effect (Wound Balance) in the `test` domain, which resolves §11.5's trigger condition but the open question is still listed.
- Evidence: rules/items.json `Death Cheat`, `Booster Potion`, `Healing Potion`, `Healing Kit: Basic`, `Wound Balance`, `Strength Booster`, `Horn Needle`, `Astral-Sensitive Eye.effects[1..2]`; rules/disciplines.json (Perception, Charisma, Recovery); rules/spells.json "Soulless Eyes".
- Impact: there is no controlled name for attribute-based and Recovery tests, so the same concept can be spelled several ways and engine matching by name may miss.
- Proposed remedy: extend §3 `test` names (`Recovery`, `Knockdown`, `Attribute:*`) and pick one representation for Astral Sight. Tier 2 (bump and migrate).

### T-036 — Vocabulary and fields the code relies on that the taxonomy does not document
- Source pass id: T-E09
- Severity: S3  Tier: 2 for vocabulary additions, 3 for field docs  Status: open
- Area: engine / doc
- Documented: §1 field table; §3 `test` names; §6 candidate scopes; §9 source list.
- Observed:
  1. Effect fields not in §1: `origin` ({kind,name,ability/circle/rank}) added by the store and read everywhere; `label` added by `collectCombatEffects` (`combat.js:424`); `note` on effects (4 in data); `rounds` on effects (5 in data, documented in §8 but never read).
  2. `origin.kind` values `homebrew`, `spell`, `condition`, `thread` (`store.js:915,945-971,1005`); synthesized `source:'Circle'` (`characteristics.js:312`) is not one of the 12 §9 values and breaks the lower-case convention.
  3. `test-modifier` accepted with `target.domain:'ability'` (`store.js:1567`); §2/§3 only define `test`.
  4. Scope literals the code branches on: `'sight'` (`combat.js:134`), `'except-knockdown'` (`:137`), `'missile'` (`:325`, compared to weapon category). §6 candidates are `close-combat`/`ranged-combat`/`vs-horrors`…, while data uses "close combat" (space) and "sight-based"; no branch matches those. Since situational-chips-global (d871a31): `'ranged'` (`combat.js` damage-pool admit; `roll-mods.js`) and `'movement'` (Impaired Movement, treated as a generic scoped mod) are also live; `ranged` overlaps the §6 candidate `ranged-combat`.
  5. `duration:"test"` used as the discriminator for a spell's Effect `add` (`spells.js:175`), not mentioned in §4.1.
  6. Auto-apply exceptions in §6 "never silently baked": activated blood-charm situational test-mods are folded (`store.js:1566-1568`, `session.activeCharms`); toggled combat bundles fold situational and on-success effects.
  7. Non-effect fields the engine/store reads: combat option `restricted`, `appliesTo`, `excludes`; talent `karmaDice`; `arms.roll.{vs,strain}` + `arms.rounds` (only the `arms` sibling is in §6, not its shape); knack `attribute`, `versus`, `effects`, `combatOptions`, `arms` (`store.js:109-122`); homebrew `set` target registry.
- Evidence: as cited inline; `rules/combat.json`, `rules/talents.json`, `rules/knacks.json` field scan.
- Impact: doc/code drift; authors cannot tell which scope strings actually do anything (only three do).
- Proposed remedy: document the three live scopes and convert §6 candidates to match; add `origin`/`label`/`note`/`rounds` to §1 (or drop the unused ones); document combat-option and arms shapes; correct `source:'Circle'` to `'discipline'` or add a value.

### T-037 — Taxonomy §11 and §6 text stale against shipped code
- Source pass id: T-E13
- Severity: S3  Tier: 2 (edits to the taxonomy doc)  Status: open
- Area: doc
- Documented: §11 heading "Open questions (v3 review)"; Q6 "currently only weapon *damage* uses [attack-modifier]"; §6 "Engine auto-apply rule (as of Phase 3)"; Q4 scope "free text".
- Observed: doc is v4. `attack-modifier` now carries `attack/Attack` and sustained spell effects (`combat.js:121-125,316-331`; `spells.json` Arrow of Night, Aspects), so Q6's premise is out of date (its to-hit decision is still open: Mystic Aim stays in `test/Attack`). Q4: three scope literals are hard-wired (T-036). Q5 (Knockdown) is still accurate: engine derives it (`characteristics.js:496`), §3 lacks it, and a `test/Knockdown` effect already exists in data (`items.json` Wound Balance, test domain, not characteristic). Q2 already resolved/struck. Q1/Q3 still "keep". §6 auto-apply text omits the charm and toggled-bundle exceptions (T-036.6).
- Evidence: `docs/EFFECT-TAXONOMY.md` lines 404-431 and 304-313.
- Impact: doc drift only.
- Proposed remedy: retitle to v4 review; rewrite Q6 and Q4; add a resolved note for Q2; fold the exceptions into §6 (bundle with the next version bump).

### T-038 — Custom-item builder duplicates the validator's type/target/measure tables
- Source pass id: T-U15
- Severity: S3  Tier: 2  Status: open
- Area: ui
- Documented: custom-item-builder.js:22 "type -> target/measure constraints (mirrors engine/validate-item.js)". EFFECT-TAXONOMY v4 (§2, §3, §5). Tier 2 checklist requires migrating every vocabulary user.
- Observed: `TYPE_META`, `OPERATIONS`, `MEASURES`, `CONDITIONS` are hand-maintained copies of `TARGET_RULES`, `OPERATIONS`, `MEASURES`, `CONDITIONS` in engine/validate-item.js (not exported). Vocabulary emitted is within the v4 doc: types, operations (add/subtract/set), measures, conditions, `source: 'item'`. Drift already present: builder `test-modifier` names include `Recovery`, which is not in the §3 test list (`Action Attack Damage Effect Initiative` or a named ability, so technically allowed as a named test); builder omits `duration-modifier` and `on-success` that the validator accepts; validate-item.js header still says "EFFECT-TAXONOMY v3 grammar" though the doc is v4.
- Evidence: ui/custom-item-builder.js:22-39; engine/validate-item.js:1-7, 29-43, 55-79.
- Impact: doc/code drift; a v5 taxonomy change would need edits in two places plus the docs.
- Proposed remedy: export the tables from validate-item.js and import them in the builder; update the v3 header comment to v4.

### T-039 — Two idioms for negative modifiers
- Source pass id: T-D08
- Severity: S3  Tier: 3  Status: open
- Area: data
- Documented: §4 defines both `add` and `subtract`. It does not say which to use for a penalty.
- Observed: `combat.json` expresses penalties as `add` with a negative value (17 effects, e.g. situations[0] "−2 Physical Defence"). Everything else uses `subtract` with a positive value (58 effects in items, thread-items, spells, talents and custom items).
- Evidence: rules/combat.json situations[0].effects[0..1] (value −2, op add); rules/items.json `subtract` + positive value on armor Initiative penalties (e.g. characteristic/Initiative entries, 44 `subtract` in items.json).
- Impact: any engine or UI logic that keys on `operation:"subtract"` (for example, penalty colouring) misses the combat penalties. The fold itself handles both.
- Proposed remedy: choose one idiom and state it in §4. Migrating the 17 combat effects is Tier 3 data but should be noted in the doc.

### T-040 — Stale taxonomy/schema version text in docs and code comments
- Source pass id: T-D09
- Severity: S3  Tier: 3  Status: open
- Area: doc
- Documented: CLAUDE.md "current `schema: "ed-character/2"`".
- Observed:
  - `docs/THREAD-ITEMS.md:21` says character schema `ed-character/1` and, on the next row, taxonomy "v3" (the file's own example at :30 says v4).
  - `ARCHITECTURE.md:173` and :196 say `ed-homebrew/1` (actual `/3`).
  - `store.js:597` and :828 say `ed-thread-items/1` (actual `/2`).
  - EFFECT-TAXONOMY.md §11 heading still reads "Open questions (v3 review)".
- Evidence: the file:line pairs above.
- Impact: misleads contributors about the current version.
- Proposed remedy: update the four references. Documentation and comments only.

### T-041 — Two homebrew `set` targets in use are undocumented in HOMEBREW-RULES §5.5
- Source pass id: T-D12
- Severity: S3  Tier: 3  Status: open
- Area: doc
- Documented: HOMEBREW-RULES §5.5 registry lists four targets: `karma.step`, `karma.maxCap`, `karma.ritualCost`, `legend.additionalTierShift`.
- Observed:
  - `store.js` `HOMEBREW_SET_TARGETS` holds six; the extra two are `legend.spellLearnCostMultiplier` and `spells.learnSilverMultiplier`.
  - Rule `hb-free-spell-learning` uses both. The behaviour is honoured (they are in the registry), but the doc does not describe them.
- Evidence: store.js:627; rules/homebrew.json:83-84.
- Impact: doc drift only. The authoring guide is incomplete for a shipped, enabled rule.
- Proposed remedy: add both targets to §5.5 (semantic: Legend multiplier for spell learning, silver multiplier for spell learning).

### T-042 — Homebrew `ref` grammar is a second dialect of the taxonomy's `ref` paths
- Source pass id: T-D13
- Severity: S3  Tier: 3  Status: open
- Area: data / doc
- Documented: EFFECT-TAXONOMY §3/§4 ref form `domain|name|property`, e.g. `ability|Avoid Blow|Rank`, `attribute|Strength|Step`. HOMEBREW §4 defines `talent|<name>|<Rank>` and `characteristics|<column>`.
- Observed: homebrew formula terms use `talent|Durability|Rank` and `characteristics|uncon` / `characteristics|death`. The taxonomy uses `ability|…` (not `talent`) and has no `characteristics|column` domain. `attribute|Toughness|Step` is shared. `talents.json` (`ref: "resource|Karma|Max"`) and spells (`attribute|Willpower|Step`) follow the taxonomy form.
- Evidence: rules/homebrew.json (`hb-uncon-death` formula terms); docs/HOMEBREW-RULES.md §4; docs/EFFECT-TAXONOMY.md §10.
- Impact: two resolvers must be kept in sync. No wrong value today.
- Proposed remedy: document explicitly that the homebrew ref grammar is a separate, non-taxonomy grammar, or unify on `ability|` (format change, Tier 1 for homebrew schema).

### T-043 — Kolon's item names include near-duplicates of catalog entries that contribute nothing
- Source pass id: T-D15
- Severity: S3  Tier: 3  Status: open
- Area: data
- Documented: THREAD-ITEMS §3: `name` "must match a catalogue key. Unknown names degrade gracefully (kept, contribute nothing)".
- Observed: 31 of Kolon's 48 items are not in any catalog (items, thread-items or custom-items). Several look like aliases of catalog entries or a typo:
  - `Night Sting Armor` (catalog `Night Sting`)
  - `Wooden Bracers of Fury` (catalog `Wooden Braces of Fury`)
  - `Guantlets of Strength`
  - `Bloodied Great Cleaver` (catalog `Great Bloody Clever`)
  - `Iopian Dagger`
  - Kolon also separately owns the real catalog entries `Night Sting` and `Wooden Braces of Fury` at thread rank 4.
- The other characters are clean: Chakka has zero unmatched names; test-char's two unmatched names are deliberate TEST items.
- Evidence (`character-data` branch): data/characters/kolon.json items list (for example `Wooden Bracers of Fury` equipped: true).
- Impact: each aliased item's effects are dropped and, if the player intends the catalog item, the modifiers are missing. Whether these are intentional (separate mundane items) cannot be determined from the data.
- Proposed remedy: have the owner confirm and rename or remove the duplicates. Add a dev-time warning listing unmatched item names.

---

### T-044 — Documented `operation:"ref"` and ref-valued effects have no general evaluator
- Source pass id: T-E05
- Severity: S3  Tier: 3  Status: open
- Area: engine / doc
- Documented: §4 `ref` "value is pulled from another target-path"; ARCHITECTURE §5.1 (evaluator "expected later").
- Observed: `applyModifiers` drops any non-numeric `value` (`characteristics.js:155`), so `operation:"ref"` is inert. Ref values are read only in two special places: spell `set` base (`spells.js:170-173`, hard-wired to "attribute Step") and homebrew formula refs (`store.js:1018-1038`, a separate `attribute|…|Step/Value`, `talent|…|Rank`, `characteristics|col` grammar with no `resource`/`ability` domain). The one data use, T'skrang Tail Combat `grant-attack` (`operation:"ref"`, `attribute|Strength|Step`), is never consumed.
- Evidence: `engine/characteristics.js:39-47,155`; `engine/spells.js:145-149`; `store.js:1018-1038`; `rules/races.json` races[6].abilities[0].effects[0].
- Impact: none today (deferred by design); risk is authors assuming `ref` is honoured. Note `spells.js:parseRef` ignores the ref's domain and looks up `attrStep[name]`, so a non-attribute ref would silently resolve to `null`.
- Proposed remedy: mark `ref`/ref-values "deferred" in §4, or build the small evaluator promised in ARCH §5.1 and route `parseRef`, `resolveRef` and `applyModifiers` through it.

### T-045 — `validate-item.js` header cites taxonomy v3 but implements v4 vocabulary
- Source pass id: T-E12
- Severity: S3  Tier: 3  Status: open
- Area: engine (doc comment)
- Documented: CLAUDE.md Tier 2 step 3 (version references move together).
- Observed: header says "validates against the EFFECT-TAXONOMY v3 grammar"; code includes `duration-modifier` and the `rounds|minutes|hours` measures, which are v4. It also implements a subset (8 of 14 types; operations add/subtract/set only) without saying where the subset is specified.
- Evidence: `engine/validate-item.js:7,28-66`.
- Impact: misleading when the taxonomy next bumps; the validator is also the fail-closed worker gate.
- Proposed remedy: update the comment to v4, and state the custom-item subset in EFFECT-TAXONOMY or HOMEBREW/THREAD docs.

### T-046 — Test coverage gaps against the documented vocabulary
- Source pass id: T-E14
- Severity: S3  Tier: 3  Status: open
- Area: tests
- Documented: Checklist B "Each documented `type` has at least one test".
- Observed: no tests for `grant-attack`, `sense`, `enable-option`, or any `attribute-modifier` fold (only `custom-item-builder.test.js:50` builds one). `duration-modifier` is covered only through the real Soul Armor catalog (`spells.test.js:261`), `minutes` only (`hours` branch `spells.js:285` untested). Operations `divide`, `max`, `ref` untested; `multiply`/`min` only through Movement (`characteristics.test.js:268-277`). Measures `count`, `dice`, `yards`, `value` untested (and `count` is broken, T-003). Condition object triggers, durations `rounds`/`encounter`/`special`, `Movement.Fly` (only asserted as ignored) untested. `knack-options.test.js:17-20,293` fixtures use the legacy string `restrictions` ("None", "Warrior"), not RESTRICTION-TAXONOMY v1 shapes (real data is all objects: 36 discipline, 4 attribute, 3 race, 3 note, 2 ability). No test asserts that `rules/*.json` vocabulary is a subset of the documented vocabulary (T-023).
- Evidence: greps of `engine/*.test.js` and root `*.test.js` for each type/operation/measure string.
- Impact: regressions in the listed areas would not be caught.
- Proposed remedy: add the tests alongside T-002/02/03/07 fixes; move knack fixtures to v1 restriction shapes.

### T-047 — Restriction gate: empty `discipline: []` blocks a knack forever; undocumented edge behaviours
- Source pass id: T-E15
- Severity: S3  Tier: 3  Status: open
- Area: engine
- Documented: RESTRICTION-TAXONOMY §1 "an empty object `{}` means no restriction"; §2 "a knack with a **non-empty** `discipline` entry is learnable iff ...".
- Observed: engine matches §2 for string, array, `{name,circle}` and OR semantics. Edge cases outside the doc: `discipline: []` yields `entries=[]` so the loop finds no match and returns false (knack unlearnable) rather than "no restriction" (`knack-options.js:64-77`); when `characterDisciplines` is omitted/empty the gate is off entirely; a `Set` input carries no circle so circle-qualified entries pass. No shipped knack has `[]` (scan: 26 string, 10 array, 0 empty).
- Evidence: `engine/knack-options.js:44-77`.
- Impact: latent only.
- Proposed remedy: treat an empty array as unrestricted (or reject in a rules check); note the no-circle behaviour in §2.

---

## Re-validation — 2026-10-04 (dev at `6ea5d12`, taxonomy v6)

Re-check of every finding against current code and data after releases v1.25.0 to v1.28.0 (Spells target effects, `action-modifier` v5, Combat tab redesign, Night's Edge with `dice` measure and `object` selector, v6). Method: scripted re-inventory of `rules/*.json` effects (949, was 945), targeted reads/greps of the cited lines, `node --test` (942 pass, 0 fail; was 725). The `character-data` branch was re-read for T-026, T-032 and T-043. No audit pass was re-run end to end, and the new UI code in `ed-spells.js` / `ed-combat.js` was spot-checked, not line-audited.

**Result at the time of the re-validation (2026-10-04): no finding closed, 3 narrowed, 4 new (T-048 to T-051). Fixes made since are tracked in the table below, the Log and each finding's Status line.** Line numbers in the findings above have drifted (`ed-combat.js` and `ed-spells.js` changed by hundreds of lines); each finding's *symptom* was re-confirmed by symbol, not by the old line.

### Verdicts

| Id | Verdict | Evidence now |
|---|---|---|
| T-001 | fixed 2026-10-05 (`a968c33`) | Knack `parents` and `restrictions.ability` names normalised to `Melee Weapon` / `Missile Weapon` / `Throwing Weapon`; the 3 plural stub talents deleted; `store-knack.test.js` fixtures moved to singular; `knacks-catalog.test.js` gained a guard against the stubs and a check that the weapon parents are talents disciplines teach |
| T-002 | fixed 2026-10-05 (`2c27128`) | New `foldAttribute` in `engine/characteristics.js` folds always-on `attribute-modifier` effects (`measure` value, default, or step; Step floored at 0). `store.js` now assembles `activeEffects` before the attributes and `attrVal` reads the folded Value, so carrying capacity, defences, Mystic Armor, talent steps and `attribute\|…\|Step` refs all see it. Tests: `engine/characteristics.test.js`, new `store-attribute-modifier.test.js`. The mixed `measure` (races/Bracers `value`, Beer Mug `step`) is now honoured both ways |
| T-003 | fixed 2026-10-05 (`cf3c05f`; Warrior), Bone Charm split to T-051 | Owner chose option B (`rating` is the one measure for characteristics). Warrior Circle 7 effect migrated `count` → `rating`; rule-agent confirmed the bonus (RULES-FAQ Q023: Warrior Circle 7 "gains an additional Recovery test"). Tests added in `engine/characteristics.test.js`. EFFECT-TAXONOMY §5 marks `count` reserved and states characteristics take `rating`. **Bone Charm deliberately not migrated**: the book says its bonus is +1 to Recovery test *results*, not +1 per day, so migrating would have made it wrong in a new way |
| T-004 | fixed 2026-10-05 | Owner ruled "+N to a test" is a **Step** bonus (RULES-FAQ Q009) and the Aspect bonuses sit on the target (Q024). (1) Aspect of the Fog Ghost / Casual Murderer: `rating` → `step`, `close-combat` scope, plus notes; Casual Murderer `situational`. (2) `activeSpellBundlesFor` understands the §6 token `close-combat` (melee + unarmed) and a `situationalOn` list; new `situationalSpellBundlesFor`; a situational spell appears as a toggle chip in the Combat tab's Situational segment. (3) New `activeItemBundlesFor` routes always-on `attack-modifier` effects of worn NON-weapon items into the pools (rank effects collapse by `stacking`; a weapon is excluded because its own effects already arrive via the selected weapon); Bracers' scope normalised to `close-combat`. Item bundles accept the bonus as either an `attack-modifier` or a `test-modifier` on the Attack/Damage test (the custom Beer Mug of Brawling, edited in the builder, uses the latter). Side effect: that Beer Mug now takes effect. (4) `foldPool` reports effects it cannot fold — see T-021/T-023/T-049. Owner ruled the Bracers ranks 2/4 are `step` too (same "+N to close combat Damage tests" wording as the Aspect spells), so they were migrated `result` → `step`: rank 4 now adds +2 Damage Step in close combat |
| T-005 | fixed 2026-10-05 | See the Resolution note in the finding: one engine `rollTotal`, sent by the modal as `total`, used by `ed-app` and `ed-spells` |
| T-006 | fixed 2026-10-05 | See the Resolution note in the finding: measure tables live in `engine/validate-item.js`, the validator rejects measures the engine ignores, the builder defaults and restricts from the same tables |
| T-007, T-008, T-009 | still open | `_charmStepBonus`, `plan.castingStep + armed.step`, `perSucc` in the badge and `_aimSummary`, `_spellRatingMods` all present |
| T-010 | still open | `castingTarget.match(/\d+/)` and `/Mystic Defense/i` still in `ed-spells.js` |
| T-011 | still open | `/^Attack/.test(r.label)` still in `ed-combat.js` `_onRollLogged` |
| T-012 | still open | `cc?.lift ?? capacity * 2 - 1` unchanged |
| T-013 | still open | `allSilverAlloc` still in `ed-trade-modal.js` |
| T-014 | still open | karma clamp / ritual affordability still in `ed-app.js` and `ed-overview.js` |
| T-015 | still open | store.js thread-weapon `damageStep = e.value` loop unchanged |
| T-016 | fixed 2026-10-05 | No `attack-modifier` uses `rating` any more (the two Aspect spells migrated to `step`, see T-004) |
| T-017 | still open | `collapseStacking` unchanged (per-origin, origin-less exempt) |
| T-018 | fixed 2026-10-05 (`17b960e`; value now 3) | Rule-agent (RULES-FAQ Q022): the Armor Table gives Obsidiman Skin Physical 3 / Mystic 1 (PG p. 435). The `summary` is right; `value: 2` is wrong. Fix is a one-number data change to `3`, Tier 3 |
| T-019 | still open | 17 `note` + `on-success` + `perSuccess` effects |
| T-020 | still open | `yards` / `count` measures still unused for range, area and targets |
| T-021 | narrowed 2026-10-05 | Attack/Damage pools now skip, and report, an effect with an unsupported operation (`set`, `multiply`, ...) or a non-numeric value instead of mis-adding it (`foldPool`). The §4.1 `set`-first contract is still not implemented for pools; no shipped effect needs it |
| T-022, T-023, T-044 | T-023 narrowed 2026-10-05; T-022, T-044 still open | No handler for `grant-attack`, `sense`, `enable-option`, `ref` operation. For T-023, the combat pools now return `unapplied` (label + reason) for every effect that targets the roll but cannot be folded; it is stored on the Roll Log entry and shown in the Combat log detail as "⚠ Not applied: …". A catalog test keeps shipped Attack/Damage modifiers foldable. Other consumers (characteristics, defences, ability ranks) and a rules-wide lint are still silent |
| T-024 | still open | `ref.damageStep` and the `attack-modifier` effect remain two sources; the custom-item builder now treats `ref.damageStep` as its single input and writes the matching effect on save, seeding the field from a legacy effect on open (custom-item-builder, 2026-10-05) |
| T-025 | still open | Fee fallback `: 10` (`ed-disciplines.js`), tier mapping in `ed-app.js` / `ed-disciplines.js`, `roll.vs ?? 'Mystic'` ×3, 10 copper in trade modal |
| T-026 | still open | `kolon.json` on `character-data` still stores `karma.available` 35 and `karma.legend` 980 |
| T-027 | still open | `Date.now()` in `potions.js`; store.js name regexes; ARCHITECTURE §5.5 still lists four functions, only `durationRounds` exists |
| T-028, T-029 | still open | No `dispatch`; ritual event still stores `legend: points * cost` |
| T-030 | still open | Bare "—" still used for missing derived values across Spells and Disciplines |
| T-031 | **narrowed** | `ed-spells.js` now adopts `modal-controller` (3 of ~20: `ed-app`, `ed-disciplines`, `ed-spells`). 20 other files still hand-roll `document.addEventListener('keydown')` |
| T-032 | **narrowed** | Fixed: all `rules/*.json` including `custom-items.json`, `tools/worker/worker.js`, `tools/dev-server.mjs` now say v6. Still v3: `character-data` `data/custom-items.json`, test fixtures (`validate-item.test.js`, `store-custom-items.test.js`, `fold-custom-items.test.js`, `worker.test.js`), comments (`validate-item.js`, `health.js`, `encumbrance.js`) |
| T-033 to T-037 | still open | Taxonomy doc not changed for effect-level `note` / `rounds` / `Max`, scope tokens, §3 `test` names, §11 (still titled "Open questions (v3 review)"). v5/v6 notes were additive only |
| T-038 | narrowed 2026-10-05 | The builder now imports `measuresFor` / `defaultMeasure` from the validator; `TYPE_META` names, `OPERATIONS` and `CONDITIONS` are still copies |
| T-039 | still open | 17 negative `add` effects, all in `combat.json` |
| T-040 | still open | Same four stale version strings |
| T-041, T-042 | still open | Homebrew docs unchanged for the two extra `set` targets and the ref dialect |
| T-043 | still open | Kolon: 31 of 48 items not in any catalog; the five alias names are still there |
| T-045 | still open | Header still says v3; validator also lacks v5/v6 vocabulary (T-048) |
| T-046 | **narrowed** | New tests cover `dice` (`dice-bonus.test.js`, `combat-bonus-dice.test.js`) and `action-modifier` (`ability-actions.test.js`). Still no tests for `attribute-modifier` fold, `grant-attack`, `sense`, `enable-option`, `count`, `yards`, `divide`/`max`/`ref`, object triggers |
| T-047 | still open | `discipline: []` still returns false in `passesDisciplineGate` |

### Checklist and appendix status

Appendices A to C and Checklists A to C describe the v4 vocabulary (14 types, 945 effects) and were not regenerated. Known deltas to v6: types now 15 (`action-modifier`, 1 effect); measures `action` (1) and `dice` (1) are no longer dead / absent; `object` field (2 effects) is documented in §1.1; `attack-modifier` count 101, `duration-modifier` 56, `test-modifier` 49. Regenerate them only if the audit is re-run as a whole.

## New findings (2026-10-04)

### T-048 — Custom-item validator and builder do not know taxonomy v5/v6; `dice` measure accepted with a numeric value
- Severity: S3  Tier: 3  Status: open
- Area: engine / ui
- Observed: `EFFECT_TYPES` in `engine/validate-item.js` omits `action-modifier`; `MEASURES` omits `action`; the optional-field check does not know `object`. The validator does accept `measure: "dice"`, but `hasValue` requires a number (or `{ref}`) while the engine only rolls a dice string (`combat.js` `parseDice`), so the combination is accepted and then ignored. The builder (`TYPE_META`, `MEASURES`) mirrors the older set.
- Impact: v5/v6 effects cannot be authored as custom items (fails closed, not wrong output); a numeric `dice` effect is saved and silently does nothing. Same drift class as T-038 and T-045.
- Proposed remedy: export the validator tables, add the v5/v6 vocabulary, and reject `dice` with a non-string value. Tier 3.

### T-049 — `foldPool` silently drops dice effects that are unparseable or use `subtract`
- Severity: S2  Tier: 3  Status: fixed 2026-10-05 (`foldPool` reports an unreadable or subtracted Bonus Die in `unapplied`; tests in `engine/combat.test.js`)
- Area: engine
- Observed: in `engine/combat.js` the `measure:"dice"` branch pushes a bonus die only `if (list && e.operation !== 'subtract')`. A malformed dice string or a subtracted die produces no bonus and no trace. The v6 §5.2 grammar says nothing about `subtract`.
- Impact: latent (the only shipped dice effect, Night's Edge `D4` with `add`, works). A homebrew or future spell with a typo vanishes. Another instance of T-023.
- Proposed remedy: document add-only in §5.2 and warn visibly (or reject in the validator and a rules lint) on unparseable dice.

### T-050 — Spell dice readout filters on raw effect fields in `buildCastPlan`
- Severity: S3  Tier: 3  Status: open
- Area: engine
- Observed: `engine/spells.js` builds `out.dice` by filtering `spell.effects` on `measure === 'dice'`, `duration === 'sustained'`, `!gmDiscretion` and `typeof value === 'string'`, separately from the `foldPool` path that actually rolls the die. Two filters, one rule.
- Impact: latent. The readout can promise a die the pool does not roll (or the reverse) if one filter changes.
- Proposed remedy: derive the readout from the same collected bundle the pool uses.

### T-051 — Bone Charm's Recovery effect disagrees with the rulebook; its Death/Unconsciousness −1 is unsupported
- Severity: S2  Tier: 3  Status: open (needs owner decision)
- Area: data
- Source: found while fixing T-003; rule-agent answer logged as RULES-FAQ Q023.
- Observed: `rules/items.json` Bone Charm carries `characteristic-modifier` `RecoveryTests` add 1, `measure:"count"`, summary "+1 Recovery test." The book (Player's Guide, blood charms) says the common Bone Charm grants a +1 bonus *to Recovery tests*, i.e. to the test result, like booster potions and healing kits, not +1 test per day. The effect is inert today (the fold drops `count`), so it is accidentally harmless; migrating it to `rating` as for the Warrior would have given an extra daily Recovery, which is wrong.
- Also: the item's `DeathRating −1` / `UnconsciousnessRating −1` effects are not stated by the book. It describes 1 Blood Magic Damage, tracked separately and not healable while the charm is worn; whether that lowers the ratings is ambiguous.
- Impact: none computed today for the Recovery effect (dropped); the −1/−1 ratings do apply and may be wrong.
- Proposed remedy: owner decides the representation. Likely a `test-modifier` on `Recovery`, `measure:"result"`, `add 1`, `condition:"always"` (the shape healing kits and potions use), and rule on the −1/−1 ratings. The Blood Magic Damage itself is a note.

## Accepted / deliberate deviations

_None recorded. Owner to mark any finding `accepted` with a reason._

## Appendix B — Vocabulary observed in data (data pass)

Flag legend:
- `OK` = in the doc.
- `NOT-IN-DOC` = used but undocumented.
- `DOC-SCOPE` = within the doc's open-ended class but outside its listed names.
- `(dead)` = documented but unused.

### B.1 `type` (§2) — 945 effects

| value | total | per file | flag |
|---|---|---|---|
| note | 509 | skills 153, spells 187, items 86, talents 42, thread-items 20, combat 15, disciplines 6 | OK |
| attack-modifier | 99 | items 46, spells 40, thread 12, custom 1 | OK |
| characteristic-modifier | 61 | items 44, thread 12, disciplines 3, races 2 | OK |
| defense-modifier | 60 | items 13, thread 13, combat 12, disciplines 16, spells 2, knacks/races/skills/talents 1 each | OK |
| duration-modifier | 55 | spells 55 | OK (v4) |
| armor-modifier | 53 | items 27, thread 21, spells 3, disciplines 1, races 1 | OK |
| test-modifier | 48 | items 20, combat 11, spells 5, thread 4, talents 3, knacks 2, custom/disciplines/races/skills 1 each | OK |
| grant-ability | 32 | thread 29, races 2, items 1 | OK |
| grant-karma-use | 9 | disciplines 9 | OK |
| resource-modifier | 8 | combat 4, thread 3, talents 1 | OK |
| sense | 6 | races 4, items 1, talents 1 | OK |
| attribute-modifier | 3 | custom 1, races 1, thread 1 | OK |
| grant-attack | 1 | races 1 | OK |
| enable-option | 1 | races 1 | OK |

- No undocumented `type`.
- No dead `type`: all 14 are used.

### B.2 `target.domain` (§3) — 380 effects carry a target

| value | total | per file | flag |
|---|---|---|---|
| attack | 100 | spells 40, items 46, thread 12, custom 1, races 1 | OK |
| characteristic | 61 | items 44, thread 12, disciplines 3, races 2 | OK |
| defense | 60 | (as defense-modifier) | OK |
| test | 57 | items 20, combat 11, disciplines 9, spells 5, thread 4, talents 3, knacks 2, custom/races/skills 1 | OK |
| armor | 53 | items 27, thread 21, spells 3, disciplines 1, races 1 | OK |
| ability | 32 | thread 29, races 2, items 1 | OK |
| resource | 8 | combat 4, thread 3, talents 1 | OK |
| sense | 6 | races 4, items 1, talents 1 | OK |
| attribute | 3 | custom 1, races 1, thread 1 | OK |
| option | 1 | races 1 | OK |

- Every documented domain is used.

### B.3 `target.name` per domain (§3)

| domain | observed names (count) | flag |
|---|---|---|
| attack | Damage 95, Attack 4, tail 1 | OK. Dead examples: horns, claws, bite |
| defense | Physical 36, Mystic 22, Social 2 | OK |
| armor | Physical 28, Mystic 25 | OK |
| characteristic | Initiative 28, DeathRating 14, UnconsciousnessRating 14, RecoveryTests 3, WoundThreshold 1, Movement+property Fly 1 | OK. (dead) CarryingCapacity, Movement.Walk, Movement.Swim |
| attribute | Strength 2, Perception 1 | OK. (dead as effects) Dexterity, Toughness, Willpower, Charisma |
| resource | Strain 7, Karma 1 | OK. (dead) Legend, Recoveries |
| sense | LowLightVision 3, HeatSight 2, AstralSight 1 | OK. See T-035: the same sense is also spelled as ability/test "Astral Sight" |
| option | Tail Attack 1 | OK (verified to match a `combat.json` option name) |
| test | Action 13, Attack 12, Damage 5, Initiative 3, Effect 1 | OK |
| test (DOC-SCOPE) | Recovery 5, Spellcasting 2, Avoid Blow 2, Intimidation 2, Astral Sensing 1, Astral Sight 1, Toughness 1, Strength 1, Perception 1, Charisma 1, Knockdown 1, Wilderness Survival 1, Emotion Song 1, Alchemy 1, Stealthy Stride 1, Swimming 1, Perception/Charisma/Strength/Toughness | Doc says "a named ability". Recovery, Knockdown, Astral Sensing, the four attribute names and Intimidation are not catalog abilities (see T-035) |
| ability | Wood Skin 4, Avoid Blow 3, Claw Shape 3, Melee Weapon 3, Astral Sight 2, Conceal Object 2, Stealthy Stride 2, Spellcasting 2, Willforce 2, plus 11 singletons (Air Dance, Waterfall Slam, Earth Skin, Fire Heal, Wound Balance, Great Leap, Unarmed Combat, Surprise Strike, Versatility …) | OK. All 32 resolve to a talent, skill, knack or racial ability in the catalog |

### B.4 `operation` (§4) — 420 effects carry one

| value | total | per file | flag |
|---|---|---|---|
| add | 341 | items 106, spells 91, thread 83, combat 27, disciplines 20, races 4, talents/knacks 3, custom 2, skills 2 | OK |
| subtract | 58 | items 44, thread 10, spells 2, talents 1, custom 1 | OK |
| set | 20 | spells 12, races 4, thread 2, items 1, talents 1 | OK |
| ref | 1 | races 1 (`grant-attack` Tail) | OK |
| multiply, divide, min, max | 0 | | (dead) |

- Negative `value`: 17 `add` effects in combat.json carry a negative value. See T-039.
- `value` kinds: int 406, `{ref}` 14.
- `ref` targets used: `attribute|Willpower|Step` 12, `attribute|Strength|Step` 1, `resource|Karma|Max` 1.

### B.5 `measure` (§5) — 431 effects carry one

| value | total | per file | flag |
|---|---|---|---|
| step | 159 | items 76, spells 39, thread 24, combat 10, custom 3, disciplines 2, knacks 2, talents 2, races 1 | OK |
| rating | 150 | items 68, thread 35, disciplines 17, combat 12, spells 11, races 4, knacks/skills/talents 1 | OK. 6 are `attack-modifier`+`rating`, which is outside §2's "step or result" (T-016) |
| rank | 32 | thread 29, races 2, items 1 | OK |
| rounds | 28 | spells 28 | OK |
| minutes | 23 | spells 23 | OK |
| result | 12 | items 5, thread 3, combat/races/skills/talents 1 each | OK |
| points | 8 | combat 4, thread 3, talents 1 | OK |
| hours | 4 | spells 4 | OK |
| count | 2 | disciplines 1, items 1 | OK |
| value | 2 | races 1, thread 1 | OK |
| dice, yards | 0 | | (dead) |

### B.6 `condition` (§6) — 609 effects carry one; the rest default to `always`

| value | total | per file | flag |
|---|---|---|---|
| on-success | 229 | skills 152, spells 37, talents 37, knacks 3 | OK |
| always | 260 | items 158, thread 85, races 11, custom 3, skills 2, spells 1 | OK |
| situational | 120 | items 80, combat 27, thread 10, races 3 | OK |
| object form `{trigger:{…}}` | 0 | | (dead) |

- Spells: 254 of 292 effects omit `condition` and so default to `always`. This is legal.
- `perSuccess: true` appears 63 times, always paired with `on-success` (spells 37, skills 19, talents 4, knacks 3). OK.

### B.7 `scope` (§6, free text by design) — 47 distinct strings, 77 uses

| class | examples | flag |
|---|---|---|
| doc-candidate token | `carryingCapacity` (races), `adept-only` (races), `vs-horrors` (thread 2) | OK |
| near-miss of candidate | `close combat` (thread 2, disciplines 1) vs doc `close-combat`; `ranged weapons`, `missile`, `sight` / `sight-based` | NOT-IN-DOC (candidates are only hyphenated tokens) |
| prose | 40+ sentences | free text allowed (§11.4). See T-034 for rules meaning embedded in them |

- Dead candidates: `ranged-combat`, `unarmed`.

### B.8 `stacking` (§7) — 103 explicit

| value | total | per file | flag |
|---|---|---|---|
| replace | 87 | thread-items 86, races 1 | OK |
| highest | 16 | disciplines 16 | OK |
| cumulative, unique | 0 explicit | | (dead; `cumulative` is the default) |

### B.9 `duration` (§8) — 55 explicit

| value | total | per file | flag |
|---|---|---|---|
| test | 33 | spells 33 | OK |
| sustained | 15 | spells 15 | OK |
| rounds | 5 | spells 2, knacks/skills/talents 1 each. Every one carries `"rounds": N` | OK (the `rounds` field itself: T-033) |
| special | 2 | talents 2 | OK |
| permanent (default), encounter | 0 explicit | | (dead) |

### B.10 `source` (§9) — 945 effects

| value | total | per file | flag |
|---|---|---|---|
| spell | 292 | spells 292 | OK |
| item | 241 | items 238, custom 3 | OK |
| skill | 155 | skills 155 | OK |
| thread | 106 | thread-items 106 | OK |
| condition | 51 | combat 42, thread 9 (combatOptions) | OK. Documented in THREAD-ITEMS §4.1 as the "nearest" source |
| talent | 48 | talents 48 | OK |
| discipline | 35 | disciplines 35 | OK |
| race | 14 | races 14 | OK |
| knack | 3 | knacks 3 | OK |
| blood-magic, trait, horror | 0 | | (dead) |

- Every effect carries `source`, and `source` always matches the file of origin. No missing `source` or `summary`.

### B.11 Other effect-object keys (§1)

| key | count | flag |
|---|---|---|
| gmDiscretion | true 116 (spells 110, disciplines 5, races 1), false 79 (spells) | OK |
| perSuccess | true 63 | OK |
| summary | 945/945 strings | OK (required) |
| `rounds` | 5 (knacks, skills, talents, spells ×2) | Only in §8 prose, absent from the §1 field table (T-033) |
| `note` | 4 (items: Astral-Sensitive Eye; races: Obsidiman skin, Tail, Fly) | NOT-IN-DOC (T-033) |

- `ref` property segments used: `Step` and `Rank` (documented) and `Max`. `Max` is undocumented (T-033).

### B.12 Non-effect vocabularies

| vocabulary | observed | verdict |
|---|---|---|
| `restrictions` (knacks, 145 entries) | discipline 36 (26 str, 10 list; list entries `{name,circle}` 11, str 9), attribute 4 (`{name,value?}`), race 3, ability 2, note 3 | Matches RESTRICTION-TAXONOMY v1 exactly. No stray keys. `restrictionTaxonomy: (v1)` present |
| homebrew levers | `formula` 1 rule, `set` 3 rules, `knackParents` 1 rule | `set` targets used: `karma.step`, `karma.maxCap`, `karma.ritualCost`, `legend.additionalTierShift`, plus **`legend.spellLearnCostMultiplier`** and **`spells.learnSilverMultiplier`**, which are undocumented (T-041) |
| homebrew formula terms | keys `ref` / `times` / `sign` / `coef` / `over` / `note` | Matches HOMEBREW §3 |
| thread-items entry keys | kind, tier, maximumThreads, mysticDefense, base, ref, threadRanks, combatOptions | Matches THREAD-ITEMS §2 |
| schema tags | see B.13 | |

### B.13 Schema and taxonomy-reference tags

| file | `schema` | `effectTaxonomy` | verdict |
|---|---|---|---|
| combat, disciplines, homebrew, items, knacks, races, skills, spells, talents, thread-items | ed-combat/1, ed-disciplines/1, ed-homebrew/3, ed-items/3, ed-knacks/2, ed-races/2, ed-skills/1, ed-spells/1, ed-talents/1, ed-thread-items/2 | (v4) | OK |
| **custom-items.json** | ed-items/3 | **(v3)** | STALE (T-032) |
| attributes, characteristics, legend, steps | ed-*/1 | none | OK. No `effects` arrays, so no ref needed |
| knacks.json | | `restrictionTaxonomy: (v1)` | OK |
| character files (char-data branch) | ed-character/2 ×3 | n/a | OK (matches CLAUDE.md) |
| index.json | ed-characters-index/1 | n/a | |
| changelog.json | ed-changelog/1 | n/a | |

---

## Appendix C — Engine handler map (engine pass)

Legend: "H" = handler file:line; "T" = test file:line. `none` = no handler / no test.
"partial" = handled in some consumers only.

### C.1 `type` (§2)

| Value | Engine handler (H) | Test (T) |
|---|---|---|
| attribute-modifier | **none** (`derive.js:6-8` `attributeValue` = base+points+increases; `store.js:649-657`). Only validated: `validate-item.js:29,59` | none for fold; builder only `custom-item-builder.test.js:50` |
| defense-modifier | `characteristics.js:198-207` (`defense`); excluded from pools / routed to `defenseMods`: `combat.js:164,425-428,457`; synthesized `health.js:205-227`, `encumbrance.js:90-117,144-164` | `characteristics.test.js:85,92,97,110,117`; `combat.test.js:76` |
| characteristic-modifier | `characteristics.js:323-330` (health ratings), `:419-429` (CarryingCapacity), `:447-457` (Movement, Walk only), `:470-478` (Initiative/Knockdown step); synthesized `characteristics.js:283-317`, `encumbrance.js:80-88,134-142` | `characteristics.test.js:186-227,237,249-277,279-308` |
| armor-modifier | `characteristics.js:223-230`; combat routing `combat.js:429-432` | `characteristics.test.js:138-176`; `combat.test.js:234-240` |
| attack-modifier | `combat.js:121-125,171,316-331` (partial: step/result only, see T-004); `store.js:1384-1395` (thread-weapon damageStep) | `combat.test.js:252-268,283,307-311` |
| test-modifier | `combat.js:127-145,171,286`; `store.js:1563-1581` (`abilityTestMods`); `potions.js:43-52` (Recovery) | `combat.test.js:76-101,178,257-258`; `potions.test.js` |
| duration-modifier | `spells.js:281-302` (`durationMeasureRounds`, `sumOptionBoosts`) | `spells.test.js:261-270` (catalog-backed; `hours` branch `spells.js:285` untested) |
| grant-ability | `ability-ranks.js:60-104` (only `measure:"rank"`, `autoApplies`); `store.js:1202-1255` | `ability-ranks.test.js:10-175`; `store-ranks.test.js:117` |
| grant-attack | **none** | none |
| sense | **none** | none |
| resource-modifier | `combat.js:165-170,286-292` (only `{resource,Strain}`) ; `store.js:1440-1450` (synth Strain) | `combat.test.js:179,223`; `store-combat.test.js:305`; `store-thread-item.test.js:139` |
| enable-option | **none** (Tail Attack is gated by the undocumented `restricted` field on `rules/combat.json` options, `ui/ed-combat.js:518`) | none |
| grant-karma-use | `characteristics.js:514-524` (`karmaUse`) | `characteristics.test.js:328-345` |
| note | skipped, "no dispatch": `combat.js:164`; accepted `validate-item.js:109` | `combat.test.js:311`; `validate-item.test.js:40,156` |

### C.2 `target.domain` / `name` (§3)

| Domain / name | Engine handler | Test |
|---|---|---|
| attribute / Dexterity…Charisma | none (see T-002) | none |
| defense / Physical, Mystic, Social | `characteristics.js:176-207` (`DEFENSE_ATTRIBUTE`) | `characteristics.test.js:72,78,110,117` |
| characteristic / WoundThreshold | `characteristics.js:390-394` | none direct (race +3 in data only) |
| characteristic / DeathRating, UnconsciousnessRating | `characteristics.js:342-370` | `characteristics.test.js:186-224` |
| characteristic / RecoveryTests | `characteristics.js:377-381` (guard drops `measure:"count"`, T-003) | `characteristics.test.js:213` |
| characteristic / Initiative | `characteristics.js:470-488` | `characteristics.test.js:279-302` |
| characteristic / Movement (+`property` Walk) | `characteristics.js:447-457` | `characteristics.test.js:249-277` |
| characteristic / Movement.Fly, .Swim | **none** (`movementRate` ignores non-Walk; `races.json` `movement.fly` unread) | `characteristics.test.js:260` (asserts Fly ignored) |
| characteristic / CarryingCapacity | `characteristics.js:419-429` | `characteristics.test.js:237` |
| characteristic / Knockdown (not in §3; §11.5) | `characteristics.js:496-498` | `characteristics.test.js:304` |
| armor / Physical, Mystic | `characteristics.js:223-259` | `characteristics.test.js:138-176` |
| resource / Strain | `combat.js:166` | `combat.test.js:179,223` |
| resource / Karma, Legend, Recoveries | **none** (Karma Ritual `set` + `{ref:"resource|Karma|Max"}` in `talents.json` is never folded; `store.js:1018-1038` `resolveRef` has no `resource` domain) | none |
| ability / `<name>` | `ability-ranks.js:69-104` (grant-ability); also accepted as `test-modifier` target at `store.js:1567` (undocumented, T-036) | `ability-ranks.test.js` |
| attack / Damage, Attack | `combat.js:121-125,316-331`; spells readout `spells.js:170-177` | `combat.test.js:252-268,307` |
| attack / natural-attack names (tail…) | **none** | none |
| test / Action, Attack, Damage, Effect | `combat.js:129-137` | `combat.test.js:76-101` |
| test / Initiative, Perception, Recovery … (karma) | `characteristics.js:514-524` (by name); Recovery `potions.js:43-52` | `characteristics.test.js:328` |
| test / `<named ability>` | `combat.js:143` (activeTalent, attack pool only); `store.js:1563-1581` | `combat.test.js` (Spellcasting charm) |
| sense / HeatSight, LowLightVision, AstralSight | **none** | none |
| option / `<option name>` | **none** (see enable-option) | none |

### C.3 `operation` (§4)

| Value | Handler | Test |
|---|---|---|
| add | `characteristics.js:40`; `combat.js:108` (default branch) | `characteristics.test.js:432` |
| subtract | `characteristics.js:41`; `combat.js:108` | `characteristics.test.js:432-440`; `combat.test.js:76` |
| multiply | `characteristics.js:42` (static fold only; **combat pools treat as add**, T-021) | `characteristics.test.js:268-272` (Movement halving) |
| divide | `characteristics.js:43` (÷0 returns base, silent) | none |
| set | `characteristics.js:46,161,164` (pass 1 "set first"); `ability-ranks.js:84-91`; **not implemented in `combat.js` pools** (T-021) | `characteristics.test.js:167-177`; `ability-ranks.test.js` |
| min | `characteristics.js:44` | `characteristics.test.js:274-277` |
| max | `characteristics.js:45` | none |
| ref (as operation) | **none** (`applyModifiers` requires `typeof value==='number'`, `characteristics.js:155`) | none |
| `value:{ref}` (any op) | `spells.js:145-149,170-173` (spell `set`→attribute Step only); `store.js:1018-1038` (homebrew formulas, separate grammar) | `spells.test.js:62,163` |

### C.4 `measure` (§5)

| Value | Handler | Test |
|---|---|---|
| value | none consumed (attribute-modifier unhandled) | none |
| step | `combat.js:177`; `store.js:1577`; Initiative/Knockdown guard `characteristics.js:476`; `spells.js:176,298` | `combat.test.js`; `characteristics.test.js:286` |
| result | `combat.js:175`; `store.js:1579`; `health.js:188-196` | `combat.test.js:76,491`; `health.test.js` |
| rating | guard in `defense`/`armor`/health/carry/movement: `characteristics.js:205,228,328,426,454`; `spells.js:246,299` | `characteristics.test.js` |
| rank | `ability-ranks.js:62` | `ability-ranks.test.js` |
| dice | none | none |
| points | not checked by `foldPool` (Strain sums any measure) `combat.js:166` | `combat.test.js:179` |
| yards | none | none |
| rounds / minutes / hours | `spells.js:283-286` | `spells.test.js:261` (minutes only) |
| count | **none** — and the rating guard drops it (T-003) | none |

### C.5 `condition` / `scope` / `perSuccess` / `gmDiscretion` (§6)

| Value | Handler | Test |
|---|---|---|
| always (default) | `characteristics.js:53-57` (`autoApplies`); `combat.js:287,324`; `ability-ranks.js:64` | `characteristics.test.js:92` |
| situational | excluded by `autoApplies`; `combat.js` folds it only when the bundle is user-toggled (`collectCombatEffects`, `:411-436`); blood-charm activation bypass `store.js:1566-1568` | `combat.test.js:222-238,491`; `ability-ranks.test.js:155` |
| on-success | `combat.js:419-423`; `store.js:705,1518,1617` | `combat.test.js:406-444,536-544` |
| object trigger `{trigger:{…GE…}}` | **none** (non-string is just "not always", never evaluated) | none |
| perSuccess | `combat.js:422`; `store.js:1620` (UI duplicates: `ui/ed-combat.js:966`, `ui/ed-roll-modal.js:158`) | `combat.test.js:417-444` |
| gmDiscretion | `characteristics.js:55`; `combat.js:287,324`; `spells.js:189,195` | `characteristics.test.js:92-95` |
| scope (free text) | branched on: `'sight'` `combat.js:134`, `'except-knockdown'` `:137`, weapon category `'missile'` `:325`; grouping key only elsewhere (`characteristics.js:122`, `ability-ranks.js:37`); surfaced by `karmaUse` `characteristics.js:522` | `combat.test.js:76,98,307` |

### C.6 `stacking` / `duration` / `source` (§7–§9)

| Value | Handler | Test |
|---|---|---|
| cumulative (default) | `characteristics.js:99` | `characteristics.test.js:391` |
| highest | `characteristics.js:97` (per origin progression) | `characteristics.test.js:353`; `ability-ranks.test.js:109` |
| replace | `characteristics.js:98` (per origin progression, last wins) | `characteristics.test.js:366`; `combat.test.js:252-268` |
| unique | `characteristics.js:79-82` (cross-source) | `characteristics.test.js:400`; `ability-ranks.test.js:119` |
| duration permanent | none needed (default) | n/a |
| duration sustained | `spells.js:179,189,195` | `spells.test.js:252,298` |
| duration test | `spells.js:175` (used as the "spell Effect add" discriminator) | `spells.test.js:163` |
| duration rounds (+ `rounds:N`) | **none** (effect-level `rounds` never read; `arms.rounds` is a different, talent-level field) | none |
| duration encounter / special | **none** | none |
| source (all 12 values) | never branched on. Engine stamps `source:'talent'` (`characteristics.js:298`), `'Circle'` (`:312`, not in §9), `'condition'` (`health.js`, `encumbrance.js`); store stamps `origin.kind` race/discipline/item/thread/homebrew/spell/condition (`store.js:945-971,1005-1052`). Data never uses `blood-magic`, `trait`, `horror`. | n/a |

### C.7 Restriction taxonomy v1

| Value | Handler | Test |
|---|---|---|
| `discipline` (string / array / `{name,circle?}`) | `knack-options.js:62-78` (OR-list, circle floor) | `knack-options.test.js:226-296` |
| `race`, `attribute`, `ability`, `note` | none by design (v1 "GM adjudicates"); rendered by `ui/ed-disciplines.js:1028` | `knack-options.test.js:268` |
| legacy string `restrictions` | falls through ungated (`knack-options.js:64-66`) | `knack-options.test.js:17-20,293` (fixtures use the legacy shape) |

---

## Appendix A — Documented vocabulary

See [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md) §2–§9 and [RESTRICTION-TAXONOMY.md](RESTRICTION-TAXONOMY.md); the data and engine appendices above are keyed to it value by value.

## Log

| Date | Note |
|---|---|
| 2026-09-30 | Scaffold created. |
| 2026-09-30 | Audit pass complete: 3 parallel read-only passes merged; 47 findings logged, none fixed. |
| 2026-10-04 | Re-validation against `6ea5d12` (taxonomy v6): 0 closed (T-018, T-001, T-002 and T-003 fixed 2026-10-05), 3 narrowed (T-031, T-032, T-046), 4 new (T-048 to T-051). Test suite 942/0. |
| 2026-10-05 | T-018 fixed (`17b960e`): Obsidiman Skin Physical armor 3. |
| 2026-10-05 | T-001 fixed (`a968c33`): knack parents use singular weapon talent names; plural stubs removed. |
| 2026-10-05 | T-002 fixed (`2c27128`): `attribute-modifier` folds into attributes; Overview pill. |
| 2026-10-05 | T-003 fixed (`cf3c05f`): Warrior Circle 7 Recovery bonus uses `rating`; Bone Charm split out as T-051 (open, owner decision). |
| 2026-10-05 | T-004 narrowed, T-016 fixed (uncommitted): Aspect of the Fog Ghost / Casual Murderer migrated to `step` with `close-combat` scope; Casual Murderer situational. Bracers routing and a toggle for situational spell bundles remain open. |
| 2026-10-05 | T-004 fixed, T-049 fixed, T-021 and T-023 narrowed (uncommitted): situational spell toggle, worn-item attack routing, `close-combat` scope, and `unapplied` reporting in the combat log. |
| 2026-10-05 | `attack-modifier` vs `test-modifier` (uncommitted): option A adopted. Authoring rule written into EFFECT-TAXONOMY §2, §11 Q6 partly resolved, custom-item Type control gets a hint; the collapse onto `test-modifier` is recorded as an agreed follow-up under T-024. |
| 2026-10-05 | T-006 fixed (uncommitted): per-target measure tables in the validator, shared by the builder; Measure dropdown restricted; `test-modifier` defaults to `step`. T-038 narrowed. |
| 2026-10-05 | T-005 fixed (uncommitted): engine `rollTotal`; the modal sends `total`; Spells and the Roll Log use it. All six S1 findings are now fixed. |
