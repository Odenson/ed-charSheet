---
status: implemented
shipped: unreleased
---
# Delivery Plan: Taxonomy on action type (taxonomy-on-action-type)

## Context & learnings
Death's Head lets the caster use Frighten as a Simple action instead of Standard (PG p. 323; rules.md R3). Nothing in the app can change a talent's action type, so the effect is today only a `gmDiscretion` note. The owner chose (qa-log 2026-10-03): a new effect type `action-modifier` (taxonomy v5; `operation: set`, new `measure: action`, string `value` Free/Simple/Standard, target `{domain: "ability", name: <talent>}`); when several active effects set different actions on one talent the **fastest wins, Free > Simple > Standard** (R2, an owner house rule since the books print no ordering); a changed action is shown in `--accent` (single existing token, not direction-aware) on the Disciplines talent AND skill rows and their modals (full skill parity, owner pass 2026-10-03) with a hover giving `base → final`, then EVERY contributing source with its value, the winner marked "applied" and the others "overridden" (engine supplies sources and winner flag; UI only renders), and in the Combat attack picker (talent and skill options) as colour only (no hover). Safari's native `<option>` colour limit is accepted: no marker, no custom picker. Death's Head becomes the first consumer (sustained, active even with 0 extra threads). Non-goals: knacks UI, migrating Beguiling Blade / Swift Link (R4), new colour tokens, conflict UI, Sustained/NA values.

T1 is a **Tier 2** change and this plan commits to all three ceremony steps together (CLAUDE.md / GUARDRAILS.md): (1) bump `docs/EFFECT-TAXONOMY.md` v4 to v5; (2) migrate every `rules/*.json` `effectTaxonomy` ref; (3) update schema/conformance/version-stamping code. All or none; I1-I4 land as one unit before any consumer item.

## Discoveries
- `docs/EFFECT-TAXONOMY.md`: title `# Effect Taxonomy — v4`, status blockquote + v4 changelog note (L1-23), §2 type table (L75-90) with `duration-modifier` prose added in v4 (L107-114), §3 `ability` domain already exists (L147), §4 operations include `set` (L193), §5 measure table (L252-265), §10 worked examples (L351+), §11 open questions. The changelog is a blockquote of per-version paragraphs.
- `tools/rules-conformance.test.js` derives vocab from the doc: `tableVocab(n)` = backticked first cell of every `^|` table row in section n; `proseVocab` for §9. `section(n)` runs until the next `## <n>.` heading, so a `###` sub-section stays inside its parent. **Gotcha:** a new table under §5 (or §4) would pollute the `measure`/`operation` vocab with Free/Simple/Standard. Put the action-value list as **prose** (not a `|` table), under a `### 5.1`, and parse it separately. The test checks `type/operation/measure/stacking/duration/source` membership only; it has no per-type value check, so "rejects an invalid `action-modifier` value" needs new logic.
- Files carrying `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (v4)"` (11): `rules/races.json`, `homebrew.json`, `thread-items.json`, `knacks.json`, `spells.json`, `items.json`, `custom-items.json`, `skills.json`, `disciplines.json`, `talents.json`, `combat.json`. The conformance test enforces equality with the doc version and also fails any file with effects but no ref.
- Version stamps in code: `tools/worker/worker.js` L287 (fresh custom-items catalog; check for a second occurrence by grep), `tools/dev-server.mjs` L70 (`FRESH_CATALOG`), assertion in `tools/dev-server.test.js` L179. Fixtures in `tools/worker/worker.test.js`, `tools/fold-custom-items.test.js`, `store-custom-items.test.js`, `engine/validate-item.test.js` use `(v3)` as opaque input and need no change. `data/custom-items.json` is a local legacy copy stamped v3 (not under `rules/`, not conformance-checked); leave it. `scripts/sync-local-data.sh` L77 has a historical `(v3)` literal; leave it. `docs/TAXONOMY-AUDIT.md` is a dated audit snapshot; leave it.
- Doc references to the version: `docs/HOMEBREW-RULES.md` L23 (table "v4") and L36 (example), `docs/THREAD-ITEMS.md` L30 (example), `docs/GUARDRAILS.md` L47 ("explicitly `v4, under review`"). These must move to v5. Engine comments saying "taxonomy v4" (`engine/spells.js` L326/396/420/460) are historical for duration-modifier; leave.
- Fold path: `store.js` L943-972 builds `activeEffects` (race, discipline, equipped items, homebrew, `activeSpellEffects(session.activeSpells)` all origin-tagged). Test-modifiers are folded onto talents/skills at L1549-1597 (`abilityTestMods`, `applyTestMods`, using `autoApplies` from `engine/characteristics.js` L53 and the `stepBase` audit pattern). `action-modifier` should be folded in the same place and the same style, but as a pure engine function so the store only calls it.
- Talents carry `action` as a string from `rules/talents.json` (Frighten: `"Standard"`, L524). UI reads `t.action`: `ui/ed-disciplines.js` L274 (row cell `<span class="action sd">`), L356 (modal chip `${t.action} action`); `ui/ed-combat.js` L554/576 (attack options carry `action`), L1460 (native `<select>` option text `… · ${o.action} · ${o.step}`). `--accent` is already defined for both themes in each component's CSS (`ed-disciplines.js` L34). Skills also carry `action` (ed-combat L576); the Disciplines Skills tab has the same row cell (`ui/ed-disciplines.js` L402, `<span class="action sd">${s.action ?? ''}</span>`) and the skill modal chip (L591, `${s.action} action`). `store.js` L1596-1597 already folds test mods over both talents and skills.
- Death's Head (`rules/spells.json` L1270, key uses U+2019 `Death’s Head`): base `effects` is one `note` (`gmDiscretion: true`, summary "Use Frighten as Simple Action"); one extra thread "Increase Effect (+2 bonus to Frighten)" (sustained `test-modifier`, shipped v1.25.2). `sustainedEffectsOf` (`engine/spells.js` L290) filters `duration === 'sustained' && !gmDiscretion`, so a new sustained `action-modifier` joins the active record automatically. Interactions checked: `buildActiveSpell` boost fold only touches numeric values (string "Simple" skipped); `isStandaloneOptionEffect` requires a numeric base match (unchanged result for the +2 option); `effectLabel` uses the first numeric effect, so with 0 picks the label stays `spell.summary` (existing test `spells-standalone-option.test.js` L60-66 asserts this) and with picks stays "+2 Frighten test"; `effectReadout` needs a numeric sustained value so stays `none`; `isSustainedSelfEffect`/`tracksOnSelf` become true via the base effect (already true via `duration`). `engine/spells-standalone-option.test.js` L21 `frighten()` filters by `type === 'test-modifier'`, so the new effect does not pollute its sums.
- Active Effects card in `ui/ed-overview.js` L738+ lists non-race/discipline/item/thread-origin effects (spell origins included) using `e.source`/summary; confirm during build that a string-valued effect renders sanely there (it should show the summary).

## Guardrail classification
- **I1, I2, I3, I4 (T1): Tier 2** (effect-taxonomy vocabulary change). Ceremony: doc version bump + migration of every `rules/*.json` ref + schema/version-stamp code, all in one change. No owner sign-off required for Tier 2 (tickets.md "Guardrail alignment").
- I5, I6 (T2 engine/store): Tier 3. Engine function is pure and DOM-free, reads structured fields only, stores nothing (derived at read time, "store only inputs" kept; Death's Head activity stays session state).
- I7, I8 (T3 UI, talents and skills): Tier 3 within `docs/UI-GUIDELINES.md` (existing `--accent`, no new weights or tokens, data flows down, UI formats pre-resolved fields and computes no game value).
- I9 (T4 data): Tier 3 once v5 lands.
- No Tier-1 item; no sign-off needed or missing. The `rules/*.json` `schema` tags (`ed-<x>/N`) are unchanged: v5 is additive and backward compatible, like v4.

## Rules dependencies
- R1 Action types (ANSWERED, Q018): five types; only Free/Simple/Standard are valid effect values here.
- R2 Ordering between action types (NOT-COVERED in books; owner house rule 2026-10-03 recorded): fastest wins Free > Simple > Standard; an effect `set`s the action. Used by I1 (doc), I5.
- R3 Frighten / Death's Head (FAQ-HIT, Q017): Frighten Standard; Death's Head Simple for the duration. Used by I9.
- R4 Beguiling Blade / Swift Link (ANSWERED): out of scope, noted only as future users in the doc.
No open NEEDS_RULES.

## Implementation items

### I1 — Taxonomy doc to v5 (Tier 2 step 1)
- **Covers tickets:** T1
- **Rules:** R1, R2, R4
- **Tier:** 2
- **What:** Edit `docs/EFFECT-TAXONOMY.md`: title `v5`; status line "v5, under review"; add a v5 changelog paragraph (date 2026-10-03) above the v4 one: added `action-modifier` (§2) and `measure: action` (§5), additive and backward compatible, every `rules/*.json` `effectTaxonomy` ref bumped v4 to v5. §1 field table: note that `value` may also be a controlled word for `action-modifier`. §2: add a table row `action-modifier | sets which action a talent uses | ability`, plus a prose paragraph: `operation` is always `set`, `measure` is `action`, `target` is `{domain:"ability", name:<talent>}`, `value` is one of the controlled words in §5.1, it overrides the printed action (not "must be faster than"; a value slower than the printed action still applies, e.g. Standard to Free-listed talent shows Free to Simple), multiple active effects on one ability resolve fastest wins (Free > Simple > Standard, owner rule, books print no ordering), and an effect whose value equals the printed action is not a change. Note it is a non-numeric effect: not summed, not stacked. §4: add a one-line note that `set` with `measure: action` carries a word value. §5: add table row `action | an action type (word value, not a number) | set Frighten to Simple`. Add `### 5.1 Action values` as **prose** (not a table): `Free` · `Simple` · `Standard`, ordered fastest first; `Sustained` and `NA` are deliberately not valid. §10: add the Death's Head worked example (below, same shape as I9).
- **Where:** `docs/EFFECT-TAXONOMY.md`; also update the version mentions in `docs/HOMEBREW-RULES.md` (L23, L36), `docs/THREAD-ITEMS.md` (L30), `docs/GUARDRAILS.md` (L47 "v4, under review").
- **Approach:** Keep the test-parsed structure: new §2/§5 rows are `| \`name\` | …` table rows (the conformance test reads them); the action list is prose so it does not enter `measure`/`operation` vocab.
- **Dependencies:** none (do first; I2-I4 must ship with it).
- **Acceptance criteria:** doc title/status say v5; `action-modifier` in the §2 table, `action` in the §5 table, §5.1 lists Free/Simple/Standard, §10 has the example, changelog paragraph present; HOMEBREW-RULES/THREAD-ITEMS/GUARDRAILS version mentions read v5.
- **Risks / unknowns:** The §5.1 heading must not be matched by the `^## \d+\.` section regex (it uses `###`, so it will not).

### I2 — Migrate every `rules/*.json` ref to v5 (Tier 2 step 2)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 2
- **What:** In all 11 files listed under Discoveries, change `effectTaxonomy` to `"docs/EFFECT-TAXONOMY.md (v5)"`. No other content change; `schema` tags unchanged.
- **Where:** `rules/{races,homebrew,thread-items,knacks,spells,items,custom-items,skills,disciplines,talents,combat}.json`.
- **Approach:** Targeted single-line edit per file (not a reformat; keep file formatting byte-stable). Finish with `grep -L "(v5)"` over files that contain `effectTaxonomy`, and `grep -rn "(v4)" rules/` to prove none remain. Files with no ref (`attributes`, `characteristics`, `legend`, `steps`) stay untouched.
- **Dependencies:** I1.
- **Acceptance criteria:** every `rules/*.json` that has `effectTaxonomy` says v5; `effectTaxonomy refs name the current taxonomy version` conformance test passes.
- **Risks / unknowns:** None beyond a missed file, which the conformance test catches.

### I3 — Update version-stamping code (Tier 2 step 3, part a)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 2
- **What:** The stamps that write a fresh custom-items catalog must emit v5: `tools/worker/worker.js` (L287; grep for every `effectTaxonomy:` occurrence in the file) and `tools/dev-server.mjs` `FRESH_CATALOG` (L70). Update the assertion in `tools/dev-server.test.js` L179 to v5. Add/adjust a worker test if one asserts the stamp (current worker tests use v3 fixtures only; if none asserts the fresh-catalog stamp, add one small assertion so the stamp is covered).
- **Where:** `tools/worker/worker.js`, `tools/dev-server.mjs`, `tools/dev-server.test.js`, optionally `tools/worker/worker.test.js`.
- **Approach:** Literal swap; no new constant. Leave `data/custom-items.json`, `scripts/sync-local-data.sh`, archived tools and v3 test fixtures alone (documented in Discoveries).
- **Dependencies:** I1.
- **Acceptance criteria:** `grep -rn "EFFECT-TAXONOMY.md (v4)"` over `tools/ engine/ store*.js ui/ rules/ docs/` (excluding `TAXONOMY-AUDIT.md`, `REVIEW-FINDINGS.md`, historical changelog prose) returns nothing; `tools/dev-server.test.js` and worker tests green.
- **Risks / unknowns:** `tools/worker/worker.js` change means the owner must redeploy the Cloudflare worker at release (FEATURE-WORKFLOW draft-release warning); flag it in the build log and release notes. A deployed v4 worker will keep stamping v4 on freshly created catalogs until redeployed; the conformance test only reads `rules/custom-items.json`, which CI folds, so this does not break the test, but the fold should keep or restamp v5 (check `tools/fold-custom-items.mjs`, which does not reference taxonomy today, so it keeps the existing rules ref).

### I4 — Conformance: new vocabulary and `action-modifier` value check (Tier 2 step 3, part b)
- **Covers tickets:** T1
- **Rules:** R1, R2
- **Tier:** 2
- **What:** Extend `tools/rules-conformance.test.js`: (a) parse `ACTION` vocab from the §5.1 prose (backticked tokens in the paragraph(s) between the `### 5.1` heading and the next heading); (b) add a pure helper `actionModifierProblems(e)` returning a list of violations for an `action-modifier` effect: `operation` must be `set`, `measure` must be `action`, `target.domain` must be `ability` with a non-empty `name`, `value` must be a string in `ACTION`; (c) call it for every `action-modifier` effect in the existing "every effect uses the documented vocabulary" walk; (d) add a test that feeds the helper invalid effects (value `Sustained`, `NA`, `Instant`, a number, missing value, `operation: add`, wrong measure, wrong domain) and asserts each is rejected, and a valid one (`Simple`) is accepted. Add a doc-level test that `ACTION` is non-empty and equals exactly `Free, Simple, Standard`.
- **Where:** `tools/rules-conformance.test.js`.
- **Approach:** Keep vocab read from the doc (the file's stated design) rather than hard-coding; the exact-set assertion pins the owner's decision. The helper is defined in the test file (the test is the guard; no engine import needed). The drift test (engine `ACTION_SPEED` equals the doc's action set) lives in I5's `engine/ability-actions.test.js`, not here, so I4 imports nothing from I5.
- **Dependencies:** I1 (doc §5.1) only.
- **Acceptance criteria:** `npm test` green; temporarily setting a rules effect to `value: "Sustained"` makes the conformance test fail (verified by the negative unit tests rather than by editing data); `measure` vocab does not contain Free/Simple/Standard.
- **Risks / unknowns:** `proseVocab` regex is `[a-z-]+` lower-case only; action words are capitalised, so use a dedicated parser (`/\`([A-Za-z]+)\`/g`).

### I5 — Engine: pure action-modifier resolver
- **Covers tickets:** T2
- **Rules:** R1, R2
- **Tier:** 3
- **What:** New pure module `engine/ability-actions.js` exporting `ACTION_SPEED` (ordered fastest first: `['Free', 'Simple', 'Standard']`) and `resolveAbilityAction(abilityName, baseAction, effects)` returning `{ action, actionBase, actionSources }` (sources are `{ name, action, applied }`) or `null` when nothing changes. Rules: consider effects with `type === 'action-modifier'`, `operation === 'set'`, `target.domain === 'ability'`, `target.name === abilityName`, string `value` in `ACTION_SPEED`, and `autoApplies(e)` (from `engine/characteristics.js`: condition `always`/absent, not `gmDiscretion`). Pick the fastest value (lowest index; ties by first). A value equal to `baseAction` is not a change (return `null` if the resolved action equals the base, even when effects exist). `actionSources` lists **all** contributing effects (de-duplicated, order of appearance; name = `e.origin?.name ?? e.source ?? 'effect'`), not only the winner, because the hover must "list contributing sources" (qa-log); each as `{ name, action, applied }` where `applied` is the winner flag computed in the engine: `true` for every source whose value equals the resolved action (sources that agree on the winning value are all applied; this tie rule is a **planner default**, not an owner-recorded decision, accepted by the owner in pass 2), `false` for the rest (overridden, slower). The UI only renders this flag; it never compares speeds. Unknown/invalid values are ignored (conformance guards data). A base action not in the list (None, Sustained, NA, missing): an `action-modifier` still sets it (override), `actionBase` keeps the raw string or null-safe value.
- **Where:** `engine/ability-actions.js` + `engine/ability-actions.test.js` (node:test, mirroring `engine/ability-ranks.test.js` style).
- **Approach:** Pure function over plain data; no store/session access; no label parsing.
- **Dependencies:** none (the doc-drift test below reads `docs/EFFECT-TAXONOMY.md` §5.1, so I1 must have landed).
- **Acceptance criteria:** unit tests: Simple vs Standard base gives action Simple / base Standard / source Death's Head; Simple + Free gives Free with both sources, Free `applied: true` and Simple `applied: false`; two sources with the same winning value are both `applied: true`; exactly one winner group always exists; Free + Simple on Standard talent gives Free; a value slower than the base (Simple effect on a Free talent) is pinned as an override: returns action Simple, actionBase Free (override semantics, R2); drift test: `ACTION_SPEED` equals the action set parsed from the doc's §5.1 (same parser as I4); value equal to base returns null; `gmDiscretion` or `condition: situational` effect ignored; effect targeting another ability ignored; invalid value ignored; empty effects returns null; module imports no DOM/store.
- **Risks / unknowns:** A talent and a skill sharing a name would both be folded by one effect (target is `{domain:"ability", name}`); this mirrors `applyTestMods` and is accepted (documented, not separately tested). Representation of "contributing sources" when a slower effect loses (still listed, `applied: false`; hover wording handled in I7).

### I6 — Store: fold onto derived talents (and skills)
- **Covers tickets:** T2
- **Rules:** R2
- **Tier:** 3
- **What:** In `store.js`, next to `applyTestMods` (L1583-1597), call `resolveAbilityAction(ability.name, ability.action, activeEffects)` for each discipline talent and, with the same helper, each skill (`for (const sk of skills)`, as at L1597), so skills have full parity (owner decision 2026-10-03). On a non-null result write `ability.action = action`, `ability.actionBase = actionBase`, `ability.actionSources = actionSources`; otherwise leave the ability untouched (no new keys, so unaffected talents are byte-identical). Knack action display is out of scope.
- **Where:** `store.js` (import from `./engine/ability-actions.js`), test in a store test (new `store-action-modifier.test.js` modelled on `store-combat.test.js` / `store-knack.test.js`).
- **Approach:** Use `activeEffects` (origin-tagged, includes `activeSpellEffects`), so expiry (`tickActiveSpells`) reverts automatically on the next derive. Do not mutate shared rules objects: check that `t` here is already the derived per-character copy the existing test-mod fold mutates (it is, since `applyTestMods` writes `step` on it).
- **Dependencies:** I5; end-to-end test needs I9.
- **Acceptance criteria:** with Death's Head in `session.activeSpells` Frighten derives action Simple, actionBase Standard, actionSources `[{name:"Death’s Head", action:"Simple", applied:true}]`; a test skill target (synthetic active effect `action-modifier` on an owned skill) derives the same fields as a talent, including the `applied` flags with two effects (Free applied, Simple overridden); after removing the active spell it reverts (no `actionBase`); two effects (Simple, Free) give Free; value equal to base is not flagged; other talents unchanged; stored character data unchanged (nothing persisted).
- **Risks / unknowns:** The store test needs a character fixture owning Frighten (Nethermancer); reuse an existing fixture helper from `store-*.test.js`.

### I7 — UI: Disciplines talent and skill rows and modals (full parity)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3 (UI-GUIDELINES; confirm against the guideline text before building, per the ed-change-guardrail skill)
- **What:** `ui/ed-disciplines.js`: when `a.actionBase != null` (`a` = talent or skill), render the action cell in `color: var(--accent)` with a `title`. Four surfaces: talent row cell (L274), talent modal chip (L356), skill row cell (L402), skill modal chip (L591); chip still labelled `${a.action} action`. Hover text is one shared formatter `actionHoverText(a)` (used by all four), a pure string builder over the resolved fields: first line `Standard → Free`, then one line per entry of `actionSources` in engine order: `Free: Spell A (applied)` / `Simple: Death’s Head (overridden)`, using `src.applied` (no speed comparison in the UI). Example: `Standard → Free\nFree: Spell A (applied)\nSimple: Death’s Head (overridden)`. Native `title` renders newlines in current browsers. Unchanged abilities render exactly as before (same markup and classes).
- **Where:** `ui/ed-disciplines.js` (a small `.action.changed { color: var(--accent); }` rule plus the title; modal chip descriptor extended to `{ v, c, title }` for talents and skills, other chips untouched). Put the formatter in the existing UI helpers location only if one exists for pure formatters; otherwise a module-level function in this file, with a unit test if the repo has a UI-formatter test pattern (otherwise cover via the store/engine tests plus owner review).
- **Approach:** Existing `--accent` for light/dark (`light-dark()` already in the component CSS); no new tokens/weights; native `title` like the neighbouring `.eff` cell (L271). The narrow-viewport rule that hides `.action` (L223) is unaffected. **Accepted limitation (owner, qa-log last entry):** the hover is desktop-only; native `title` never shows on touch and the row `.action` cell is hidden at narrow widths, so on phones only the modal chip colour is visible. No mobile UI in this feature. The skill row reuses the same `.trow` grid cell.
- **Dependencies:** I6.
- **Acceptance criteria:** with Death's Head active, Frighten's row cell and modal chip are accent-coloured and the hover reads `Standard → Simple` then `Simple: Death’s Head (applied)`; with a (test or real) skill-targeting effect, the skill row and skill modal show the same treatment; multi-source case lists every source, winner `(applied)`, others `(overridden)`; without any effect, markup is identical to today for talents and skills; when the resolved action equals the base action (I5 returns `null`) there is no accent and no hover, even if an active effect exists (for example a Standard effect on a Standard talent), which is correct, not a bug; same-name talent/skill folding mirrors `applyTestMods` (an effect targeting a name folds onto every ability with it). Owner verifies manually in light and dark (do not open the preview unless asked, per project memory).
- **Risks / unknowns:** No shipped rule targets a skill yet, so the skill UI path is verified by the store test with a synthetic effect and by owner review; check the modal chip renderers (`_talentModal` L350+, skill modal ~L585) for where `title` can attach without altering other chips.

### I8 — UI: Combat attack picker (colour only)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** `ui/ed-combat.js`: carry `actionBase` into the attack options built at L545-580 (talents and skills, both explicitly in scope), and in the picker `<option>` (L1460) colour a changed action. Colour only, per the owner decision (qa-log): (1) set `class="chg"` on the changed `<option>` with CSS `option.chg { color: var(--accent); }`, and (2) because the closed `<select>` only reflects the selected option, toggle a `chg` class on the `<select>` itself when the selected option is changed so the accent colour shows in the control. No marker, no suffix, no hover/title (per owner). Option text is unchanged apart from the action word itself now being the resolved action. Skill options colour through the same data flag (`o.actionBase != null`), an explicit requirement (owner full parity), not just a side effect; no skill-specific code. Unchanged options render exactly as before.
- **Where:** `ui/ed-combat.js` (option objects ~L552-580, option template L1460, CSS block).
- **Approach:** Data-driven only: `o.actionBase != null` is the flag; no recomputation in the UI.
- **Dependencies:** I6.
- **Acceptance criteria:** a changed action's option (talent or skill) is accent-coloured where the browser allows; the select shows accent when that option is selected; no marker, no hover text; unchanged options identical; no new tokens or weights. Owner verifies manually.
- **Risks / unknowns:** macOS Safari native option menus ignore `option` colour, so the dropdown list may show no colour there (the closed select still does, via the `chg` class). The owner has ruled colour only and explicitly accepted this (2026-10-03): no marker, no custom picker, no cross-browser cue.

### I9 — Data: Death's Head uses `action-modifier`
- **Covers tickets:** T4
- **Rules:** R3
- **Tier:** 3
- **What:** In `rules/spells.json` `Death’s Head` base `effects`, add before or after the existing `note` (keep the note unchanged):
  `{ "type": "action-modifier", "target": { "domain": "ability", "name": "Frighten" }, "operation": "set", "value": "Simple", "measure": "action", "duration": "sustained", "source": "spell", "summary": "Use Frighten as Simple Action" }` (no `condition`, no `gmDiscretion`). Keep the +2 Frighten extra-thread option and success level unchanged; keep the spell `summary`.
- **Where:** `rules/spells.json` (~L1330-1337). Update `engine/spells-standalone-option.test.js` ("Death’s Head data" test, L27 onward) to assert the new base effect and that the extra-thread option is unchanged; add an assertion that `buildActiveSpell` with 0 picks includes the action-modifier (Frighten stays at +0 step) and that 1/2 picks still yield +2/+4 with the action-modifier present.
- **Approach:** Direct edit, 2-space JSON, matching neighbouring indentation. The `Death’s Head` key uses U+2019.
- **Dependencies:** I1-I4 (vocab must exist or conformance fails), I5/I6 for end-to-end behaviour.
- **Acceptance criteria:** conformance green; self-cast with 0 and N threads gives Frighten action Simple (via I6 store test); step bonus behaviour (+2 per thread) unchanged; `effectLabel` with 0 picks still equals `dh.summary`; Active Effects card still renders the spell row sensibly.
- **Risks / unknowns:** Known transient: `activeSpellEffects` reads effects from the session `activeSpells` record, a snapshot taken at cast time, so a Death's Head already active in a saved session when this ships will not gain the `action-modifier` until it is recast. Session-only and short-lived; accepted. `isSustainedSelfEffect` now true for Death's Head (already trackable via `duration`); grep its callers (`engine/spells.js`, `ui/ed-spells.js`) to confirm no change in behaviour such as a "folds onto caster" flag now showing. Check ed-overview Active Effects row text for a string-valued effect.

### I10 — Tests, changelog, guardrail/doc hygiene
- **Covers tickets:** T1-T4
- **Rules:** none
- **Tier:** 3
- **What:** Run `npm test` (rules-conformance, dev-server, worker, spells, store tests) and fix fallout. Add one line to `data/changelog.json` `unreleased.changes` in the established style (user-visible: a changed action on talents and skills is shown in accent with a hover listing sources; Death's Head Frighten now Simple; type `added`). Confirm the PR checklist in GUARDRAILS.md L126 (Tier-2 refs updated). Do not touch `docs/TAXONOMY-AUDIT.md`.
- **Where:** `data/changelog.json`, whole test suite.
- **Dependencies:** all above.
- **Acceptance criteria:** full suite green; changelog line present; no remaining `(v4)` stamp where code/doc should say v5.
- **Risks / unknowns:** `tools/plans-status.test.js` checks plan frontmatter; plan stays `status: draft` until the build flips it.

## Sequencing
1. **I1** doc to v5 (vocabulary must exist before anything references it).
2. **I2, I3, I4** migration, stamping code, conformance, in the same change as I1 (Tier 2: all or none; the conformance test fails on a half-migration, so land them together). The `ACTION_SPEED` drift test lives in I5, so I1-I4 have no forward dependency.
3. **I5** pure engine resolver + unit tests (independent of data).
4. **I6** store fold (depends on I5).
5. **I9** Death's Head data (needs v5 vocab; gives I6/I7/I8 a real consumer).
6. **I7, I8** UI (read the folded `actionBase`/`actionSources`; independent of each other).
7. **I10** full test run, changelog.
Rationale: vocabulary then pure logic then data flow then presentation; the Tier-2 unit (I1-I4) is never split across commits.

## Open questions
- Worker redeploy: `tools/worker/worker.js` changes, so the owner must redeploy at release (I3). Informational, not blocking.
- Resolved by the owner (2026-10-03, qa-log): skills get full UI parity; hover lists base → final plus every source with applied/overridden; Safari option-colour limit accepted.

## Review responses
- F1 (blocker, I8 `*` marker contradicts owner): fixed. Marker/suffix removed from I8 What, Acceptance, Risks and Open questions; I8 is colour only (`option.chg` plus `chg` on the `<select>`); Safari limitation recorded as accepted by the owner.
- F2 (skills colour in picker): fixed. I8 states skill options colour via the same data flag; open question kept for owner confirmation.
- F3 (override can slow a faster base): fixed. I5 gains a pinned test for a slower-than-base value (override); I1 doc prose states it.
- F4 (I4 drift-test forward dependency): fixed. Drift test moved to I5; I4 depends on I1 only.

- Owner pass 2026-10-03 (qa-log, last 4 entries, tickets.md updated): (1) skills have full UI parity: I6 folds skills (tested), I7 now covers skill rows and skill modal alongside talents, I8 colours skill options explicitly; the earlier skills-UI non-goal and the open question on it removed (F2 closed). (2) Hover lists `base → final` then every source with its value, winner `(applied)`, others `(overridden)`: engine `actionSources` entries now carry `applied` (I5/I6), UI only formats (I7); replaces the earlier proposed hover wording. (3) Safari option-colour limit accepted, no marker/custom picker (I8 risk updated). Tests and acceptance criteria in I5-I8 updated accordingly.

## Review responses (pass 2)
- F1 (tickets lag owner pass): fixed by the orchestrator in tickets.md; plan already matches.
- F2 (tie rule not owner-recorded; hover wording differs from qa-log example): tie rule (equal values all `applied`) recorded in I5 as a planner default, accepted by the owner. Hover wording kept as planned (`Free: Spell A (applied)` / `Simple: Death’s Head (overridden)`, no ", slower"); the qa-log example was illustrative.
- F3 (hover unreachable on touch/narrow): owner decided to accept desktop-only hover, no mobile UI; recorded in I7 Approach.
- F4 (existing active-spell snapshots): fixed. Noted as a known transient in I9 Risks (effect appears on next cast).
- F5 (name collisions; null return hides overridden sources): fixed. I7 acceptance states no hover when resolved action equals base and that same-name talent/skill folding mirrors `applyTestMods`; I5 Risks notes the collision.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
