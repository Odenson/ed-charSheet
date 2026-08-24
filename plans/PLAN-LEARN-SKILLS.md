# Plan: Adding skills (learn a new Skill)

This plan defines the **Add a skill** flow for the Disciplines tab's Skills sub-tab — today edit mode can change **ranks** of skills that already exist on the character (`ui/ed-app.js` `_editSkillRank`, persisted via `saveAdvancementEdits`), but there is no way to *add* a new skill. This feature lets a player learn any skill from the catalog `rules/skills.json` at Rank 1, paying the Skill Training Table Legend cost for that skill's own tier plus an editable silver training fee **derived from `rules/legend.json`** (data, not code). **Plan only — no implementation yet**, for owner review; decisions locked (§5).

- **Owner:** repo owner. **Created:** 2026-08-24. **Status:** decisions locked (§5) — ready for implementation spec (§7).
- **Branch of record:** `dev`.
- **Rule sources:** Earthdawn 4E Player's Guide — Improving Skill Ranks (pp. 450–451, Skill Training Table), skill categories (pp. 183–184), Skill Use (p. 124), creation skill ranks (pp. 69–71), language learning (p. 191); Companion talent/knack references for context only. Verified against the local `rulebook extracts/` by the rule-agent; ledger entries **Q001/Q002** in [docs/RULES-FAQ.md](../docs/RULES-FAQ.md) extended by this plan's Skill Training Table research. Tier mechanics are Q001 / [PLAN-TALENT-TIER-DERIVATION](PLAN-TALENT-TIER-DERIVATION.md) (talent analogue; skills differ — tier is intrinsic per skill).
- **Reference:** [PLAN-RANK-EDITING.md](PLAN-RANK-EDITING.md) (existing rank-edit flow this extends), [PLAN-LEARN-TALENTS.md](PLAN-LEARN-TALENTS.md) (sibling catalog-pick pattern — simpler here: no slots/circles), [PLAN-LEARN-SPELLS.md](PLAN-LEARN-SPELLS.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md).

---

## 1. What we want to do

In the Disciplines tab's Skills sub-tab edit mode, let the player **learn a new skill**:

1. Pick any skill from `rules/skills.json` the character does not already know (154 skills: `tier` 1=Novice / 2=Journeyman, `attribute`, `action`, `strain:0`, `summary`, `presentation.shortEffect`). Record it as a character input `{ name, rank: 1, tier }`.
2. Pay the **Legend cost for Rank 1** at that skill's tier (`rules/legend.json` `costs.skillRank[1][tier]` — Novice 200 / Journeyman 300) checked against derived Available Legend, same guard philosophy as rank editing.
3. Pay an **editable silver training fee derived from `rules/legend.json`**, seeded to that file's `costs.skillTraining[rank]` (Rank 1 → 10 sp by default, the rulebook's `new Rank × 10 sp`; negotiable like Circle training — `costs.circleTraining`) — paid from the purse across any coin denomination via `payFromPurse`, refused if the purse cannot cover it. Mirrors the Circle-training fee UX, but the default lives in data so it can be retuned without a code change.
4. Persist only **inputs** (the new array entry + optional wealth change) via the existing `saveAdvancementEdits` / `saveWealthEdits` overlay — no shape change (`ed-character/2` stays `skills: [{name, rank, tier}]`).
5. Log the outcome to the standard device-local Log (`store-log.js`) so Legend + silver + per-coin delta are auditable, same as Talent Option / Circle training.

Deliberately **simpler** than Talents/Spells: no per-Circle option slots, no eligibility pools by status, no gating Discipline Talents, no Versatility, no new-Discipline initiation, no Warden/Master tier — any catalog skill is learnable by anyone who can afford it.

## 2. The ED4 rules (verified against the rulebook extracts)

### Cost — by the skill's own tier, not the character's Circle

> "Improving a Skill Rank … The character has sufficient Current Legend Points to pay the full cost of the new Skill Rank (see the Skill Training and Cost Table). The cost is determined based on the tier (Novice, Journeyman, etc) listed with the skill description." — `text-RB-players-guide.txt:18156–18158` (p. 451)

> "Characters can spend Legend Points to add Ranks to existing skills, or to learn new skills (by purchasing Rank 1)." — `text-RB-players-guide.txt:18111–18112` (p. 450)

Each skill's tier is fixed in its catalog entry. Only two tiers exist for skills; there are no Warden/Master skills and skills **cap at Rank 10** (talents go to 15 across four tiers):

> "Characters cannot improve a skill beyond Rank 10." — `text-RB-players-guide.txt:18150` (p. 451)

### Skill Training Table — Legend numbers (exactly as authored in `rules/legend.json:80-91`)

| Skill Rank | Train Time (weeks) | Wait Time (weeks) | Novice | Journeyman |
|---|---|---|---|---|
| 1 | 1 | 2 | 200 | 300 |
| 2 | 2 | 3 | 300 | 500 |
| 3 | 3 | 5 | 500 | 800 |
| 4 | 4 | 8 | 800 | 1,300 |
| 5 | 5 | 13 | 1,300 | 2,100 |
| 6 | 6 | 21 | 2,100 | 3,400 |
| 7 | 7 | 34 | 3,400 | 5,500 |
| 8 | 8 | 55 | 5,500 | 8,900 |
| 9 | 9 | 89 | 8,900 | 14,400 |
| 10 | 10 | — | 14,400 | 23,300 |

Cumulative sum over ranks gives a skill's total spent — already modelled by `engine/legend-spent.js` `skillRanksCost` / `skillRankStepCost` and audited at `legend-spent.js:363` (`cost: skillRanksCost(s.rank, s.tier ?? 'Novice', costs.skillRank)`).

For comparison the Talent Cost Table has four columns (Novice/Journeyman/Warden/Master) and caps at Rank 15 — irrelevant to skills but explains why `skillRank` has only two keys per rank.

### Time, teacher, money

Same procedure for "a new skill at Rank 1" and for raising an existing skill — the rule bullets cover both cases (`text-RB-players-guide.txt:18111–18167`):

- **Training time** = number of weeks equal to the new Rank, rested and in good health (no Current Damage/Wounds except Blood Magic) — `:18151–18155`. New skill → **1 week**. Not modeled (no time system exists in the app; same as talent Circle-up's 40-hour/3-week requirement which is noted but not enforced).
- **Teacher/tutor**: "To add ranks later in life, the character must find and learn from a suitable tutor." — `:7670–7675` (p. 184). Ranks at creation assume adolescent pickup — no tutor needed then. Not enforced (GM territory, same as Specific Training / Circle-up tutor).
- **Silver fee**: "Training a skill costs money. An average week of training costs a character a fee equal to the new Rank × 10 silver pieces." — `:18159–18160`. New Rank-1 skill: **1 week × 10 sp = 10 sp**. The fee is **data, not code**: it lives in `rules/legend.json` as `costs.skillTraining[rank]` (new table `{"1":10,"2":20,…,"10":100}` mirroring the rulebook's Rank × 10, same shape/role as `costs.circleTraining` which is also an average, negotiable default). The `rules/legend.json:36` note will be updated to describe the new table (§7.1); no schema-tag change, only additive data.
- **Wait time ("practice")**: after training the character must wait before raising that same skill again — the Wait Time column — meanwhile they "may adventure, raise talent ranks, train for a new Circle, improve other skills" — `:18161–18167`. Not modeled.

### Language skills — extra step, out of scope

> "To learn a new language, the character increases his rank in the appropriate skill (see Improving Skills, p. 450). He then spends at least one month studying the language with a teacher or native speaker… At the end of this time, he makes a skill test against the Learning Difficulty of the language. If successful, he learns the language. If the test fails, he may make an additional attempt after studying the language for another month." — `manual/text-player-guide-skill-concepts.txt:345–352` (p. 191)

Out of scope for the app — GM adjudication. Learning the underlying Speak/Read-Write Language skill at Rank 1 follows the normal Skill Training Table like any other skill.

### Categories, prerequisites, limits

- Four types — Artisan, General, Knowledge, Language (`:7646–7650`, p. 183) — but acquisition economics (LP, weeks, fees, wait) are **identical across categories**. Catalog fields `tier`/`attribute`/`action`/`strain` are per-skill; `strain` is always 0 for the skill version (`rules/skills.json:7`).
- **No prerequisites** for learning any skill — attribute dependence is built into *use* (Step = Rank + attribute Step, `:7677–7681`), not acquisition. No maximum number of skills is stated in the extracts.
- **No Discipline gating** — there is no concept of a skill being "on/off" a Discipline list; no surcharge/discount per Discipline. Skills are explicitly the escape hatch out of Discipline limits: "Learning skills is harder, takes longer, and costs more, but does allow a character to use a talent without magic. This is the most common way for characters to learn talents that are not available to their Discipline." — `:5312–5314` (p. 124; the `(Novice)/(Journeyman)` tag on each talent is the tier for its skill version).
- **Creation-only free ranks** (Knowledge 2, Artisan 1, Speak 2, Read/Write 1 + 8 free points across all categories, PG pp. 69–71) are outside this flow — this feature is post-creation learning only.

## 3. Terminology warning

`talentOptions` is already taken in this codebase for combat option bundles (`combat.talentOptions` scoped to a talent — True Shot etc., [PLAN-TALENT-COMBAT-OPTIONS.md](PLAN-TALENT-COMBAT-OPTIONS.md)). The catalog pools `rules/disciplines.json:talentOptions` use the same key in a different sense. Skills have no such ambiguity — keep the skill picker terminology distinct: `learnableSkills` / `skillOptions` / `ed-learn-skill`, never `talentOptions`.

## 4. Preliminary tier classification (to confirm during design)

| Area | Tier | Why |
|---|---|---|
| Character data (`character.skills` new entry) | **Tier 3** | Appends `{name, rank:1, tier: 'Novice'|'Journeyman'}` to the existing `ed-character/2` shape — data within shape, no schema/field-name change. Existing files already carry `tier` per skill; `forSave` preserves it (skills tier is intrinsic per catalog name, not derived from Circle like talents). |
| Catalog read (`rules/skills.json`) | **Tier 3** | Existing file/shape `ed-skills/1`; no catalog change in this feature. |
| `rules/legend.json` `costs.skillTraining` | **Tier 3** | Additive data within existing shape (`ed-legend/1`): new `costs.skillTraining[rank]` table (`{"1":10,…,"10":100}`) plus updated `costs` note text so docs match the newly-tracked fee. Schema tag unchanged — adding data within the shape is free. |
| Eligibility derivations (engine, pure) | **Tier 3** | New pure helper; no DOM, reads structured catalog; no taxonomy read. |
| Add-skill picker + fee modal UI | **Tier 3** | New edit-mode content honouring UI-GUIDELINES (Escape/Enter, placeholder pills, theme-aware, two weights). |

No Tier-1 invariant is touched; nothing re-decides a locked surface. Re-run the **ed-change-guardrail** pre-flight when implementation starts. The feature is to skill rank editing what filling a Talent Option slot is to talent rank editing — same guard-then-persist pattern, one simpler acquisition path.

## 5. Owner decisions (resolved 2026-08-24)

| # | Question | Decision |
|---|---|---|
| Q1 | Scope | **Learn any catalog skill at Rank 1.** No slots, no circles, no pool restrictions — any skill in `rules/skills.json` not already on the character is learnable. Already-known names are excluded (no duplicates). |
| Q2 | Silver training fee | **Track as editable, negotiable fee derived from `rules/legend.json` — `costs.skillTraining[1]` (10 sp default for Rank 1, `new Rank × 10 sp`; `costs.skillTraining` holds `{"1":10,…,"10":100}`).** Seeded from that table (not hardcoded), editable in the confirm modal, paid from the purse across any coin denomination via `payFromPurse` (making change, refused if total cannot cover). Same UX/plumbing as Circle training (`ui/ed-disciplines.js:758-763` + `costs.circleTraining`). Logged with per-coin delta. To retune the price, edit the table in `rules/legend.json` — no code change. Rank up beyond 1 stays via the existing `+` stepper — this flow is Rank-1 acquisition only. |
| Q3 | Custom/off-catalog skills | **Picker-only in v1.** Only the 154 catalog skills are offered. Unknown-name graceful degradation keeps working for hand-edited JSON (a name not in the catalog still renders as a derived row with `known:false`, step —, no brief), but the UI does not offer a free-text name field. A later Tier-3 add could add free-text if needed. |
| Q4 | Empty-state visibility | **Show the Skills sub-tab in edit mode even at 0 skills.** Today `ui/ed-disciplines.js:847,870` hides the tab when `skills.length === 0`; in edit mode it will render anyway (with the "＋ add skill" affordance) so the first skill can be added without hand-editing the file. Read mode keeps the current hiding when empty. |
| Q5 | Language-skill extra study/test | **Out of scope — GM territory.** Learning the underlying Speak/Read-Write Language skill at Rank 1 costs the normal Skill Training Table price; the subsequent month of study + test is not modelled. |
| Q6 | Wait time / training time enforcement | **Not enforced.** Same as Circle-up's 40-hour/3-week note — surfaced in the confirm modal's ⓘ line if desired, but no blocker. |

## 6. Verification (to finalize with implementation)

1. Full suite green (`npm test`) — including new engine + store + log tests below.
2. Learned skill at Rank 1 prices exactly `skillRank[1][tier]` (200/300) in `auditLegendSpent`; total spent = sum of step costs. Affordability guard blocks an unaffordable pick; affordable pick persists and reloads cleanly under `ed-character/2` (`{name, rank:1, tier}`) with `forSave` clean.
3. Silver fee: default from `costs.skillTraining[1]` (10 sp for Rank 1) — derived from `rules/legend.json`, not hardcoded; editable; `payFromPurse` refuses when purse total < fee; persisted wealth round-trips; Log shows `paid 10 sp (-10 silver) · purse A → B` with per-coin delta. Updating the fee is a data edit to `rules/legend.json`, not a code change.
4. Picker excludes already-known skill names; catalog `tier` maps 1→Novice, 2→Journeyman for the stored string and pricing lookup.
5. UI: picker modal honours Escape/backdrop/✕ close, Enter confirms (autofocus primary), placeholder pills for unpriceable cases, theme-aware, two weights; Skills tab appears at 0 skills in edit mode; read-mode hiding unchanged.
6. No Tier-1 regression (Arch §3/§5.5, docs/UI-GUIDELINES).

---

## 7. Phase-1 implementation spec

Locked to the §5 decisions. One sub-feature: **learn a new Skill at Rank 1**. It reuses the existing advance-edit and wealth-edit plumbing and the `logCircleTraining`/`logTalentLearned` logging pattern; the only new moving parts are the learnable-set derivation and the picker+fee modal.

### 7.1 Reuse — plus one new data table (data, not code)

- **Persistence:** `store.js` `saveAdvancementEdits({ disciplines, skills }, id)` replaces the full arrays via `edits.advancements` (`store.js:382-387`). Learning a skill = append `{ name, rank: 1, tier }` to that discipline's `skills` array. Silver fee = existing `saveWealthEdits(wealth, id)` (`store.js:308`). No new overlay category, no schema change (`ed-character/2`). **Confirmed via grep:** `forSave` (`store.js:397-406`) only strips `tier` from `disciplines[].talents[]` — `...character` spread leaves `skills[].tier` as a passthrough (see also comment `store.js:516` "Skills keep their stored tier" and `applyEdits` at `:525` replacing `skills` wholesale). Existing saves already carry `{"name":"Tracking","rank":3,"tier":"Novice"}`. No migration or `forSave` tweak needed.
- **Pricing:** acquire-at-Rank-1 Legend cost = `skillRankStepCost({ tier }, costs, /*toRank*/ 1)` — the existing per-step helper already used for skill rank-ups (store.js:1237; engine/legend-spent.js:279). The tier string comes from the catalog (`tier: 1 → 'Novice', 2 → 'Journeyman'`), exactly as existing stored rows do (e.g. `data/characters/test-char.json: {"name":"Tracking","rank":3,"tier":"Novice"}`).
- **Silver fee default — derived from `rules/legend.json`, not hardcoded:** new table `costs.skillTraining` at `rules/legend.json:93` holds `{"1":10,"2":20,"3":30,"4":40,"5":50,"6":60,"7":70,"8":80,"9":90,"10":100}` (the rulebook's `new Rank × 10 sp`, same derivation style as `costs.circleTraining` which is also an average, negotiable default). The picker+fee modal seeds its editable input from `costs.skillTraining["1"]`; to retune the price, edit that table — no code change.
- **Affordability:** same single gate as talent/skill rank editing — build `nextCharacter` with the appended skill (and paid purse) and `_canAffordRank(nextCharacter)` (`ui/ed-app.js:1030`, which re-derives and checks `legend.available`).
- **Wealth:** `engine/wealth.js` `payFromPurse(coins, fee)` + `coinsSilver` already used for Circle training — reused unchanged.
- **Logging:** `store-log.js` `logTalentLearned` / `logCircleTraining` already render in Notes → Log + Combat log via `_rollRow` / `_logRow`. Add a sibling `logSkillLearned` with the same wealth fields so coin deltas appear identically.
- **Docs note:** update `rules/legend.json:36` note text to describe the new `skillTraining` table alongside `circleTraining` (both "average — negotiable, app seeds as editable default; only silver is tracked"). Schema tag `ed-legend/1` and `effectTaxonomy` unchanged — adding data within the shape is Tier 3.

### 7.2 New pure engine helpers (`engine/skill-options.js`, DOM-free, tested)

Single-file sibling to `engine/talent-options.js` (or a narrow export there — prefer a dedicated file to keep skill vs talent concerns separate, same import style as `talent-options.js:39`).

- `learnableSkills(skillCatalog, knownNames, costs)` → `[{ name, tier: 'Novice'|'Journeyman', tierNumeric: 1|2, attribute, action, brief, rank1Cost, trainingSilver }]` where `rank1Cost = skillRank[1][tier]` and `trainingSilver = skillTraining["1"]` (or `null` if the table is absent → placeholder, no hardcoding). Inputs are the already-loaded `rules/skills.json` catalog, a `Set` of known skill names, and `rules/legend.json` costs for pricing + fee preview. Alphabetical within tier groups (Novice first, then Journeyman) — same brevity source as talents (`presentation.shortEffect ?? summary`). No slot concept, no Warden/Master, no gating. The fee value comes from `costs.skillTraining` — never `* 10` in code.

This is the full set of engine work — no `optionSlots`/`circleStatus` analogue needed for skills.

### 7.3 Store wiring (`store.js`)

- Import `learnableSkills` from `engine/skill-options.js`.
- After the `skills` derivation (`store.js:1070-1097`) and pricing attachment (`store.js:1234-1247`), attach derived `skillOptions: learnableSkills(skillCatalogArray, knownSkillNames, legendCosts)` to the model (lazily or eagerly — eagerly is fine; always derived, never stored). Follows the same pattern as `engine/talent-options.js:39` import in `store.js:39` and the per-discipline `optionSlots`/`nextGrant`/`advanceCost` enrichment at `store.js:718-735`.
- No new derived flag beyond `skillOptions`; the existing `skills[].pricing` already gates the Rank-1 affordability preview per candidate.

### 7.4 Events & app handlers (`ui/ed-app.js`) — data up, engine acts

- `ed-learn-skill` `{ name, silver }`: guard (character loaded; `name` non-empty; `name` not already in `character.skills`; `name` exists in `rules/skills.json` catalog; `silver` is a finite non-negative integer), build `nextCharacter` with `skills: [...(character.skills ?? []), { name, rank: 1, tier }]` where `tier` string is mapped from catalog `tier` numeric (1→Novice, 2→Journeyman), pay the fee via `payFromPurse` into `nextWealth` when `silver > 0` (refuse if `!spent.ok`), then `_canAffordRank(nextCharacter)` guard, then `saveAdvancementEdits` (+ `saveWealthEdits` when fee > 0), `markDirty`, re-derive, then `logSkillLearned`.

Both guards reuse `_editSkillRank`'s shape (`ui/ed-app.js:1176`) and `_learnTalent`'s guard-then-persist shape (`ui/ed-app.js:1087-1115`); both reject unaffordable actions like the rank stepper does (never write past Available Legend).

### 7.5 UI (`ui/ed-disciplines.js`)

- **Empty-state:** in `render()` where the Skills tab is gated, change the guard from `skills.length` to `skills.length || this.editMode` so the tab appears at 0 skills when editing (read mode still hides it). Keeps the segment button always-rendered vs conditional logic minimal.
- **"＋ add skill" affordance:** edit-mode footer row in `_skillsView`'s card (same placement/style as `_addOptionSlot`, `ui/ed-disciplines.js:717-724`), visible in edit mode whenever there is at least one learnable candidate. Click → open the shared `ModalController` picker scoped to `model.skillOptions`.
- **Picker + fee modal** (`_learnSkillModal`): reuses the `_advanceModal` fee-row pattern (`ui/ed-disciplines.js:758-763`) — editable silver input seeded from `costs.skillTraining["1"]` (data, not `10` hardcoded), `✓/✕` vs purse via `payFromPurse`, disabled Learn when either Legend or silver unaffordable. Candidate list is the `skillOptions` array, each row showing name, tier chip, attribute, brief/shortEffect, and "Rank 1 · N Legend" price (placeholder `—` when unpriceable). First option autofocused; Escape/backdrop/✕ close via the shared `_modalCtl`; Enter confirms. Selecting dispatches `ed-learn-skill`.
- All new controls honour the Tier-1 UI rules: Escape/Enter on the modal, placeholder pills for any unpriceable cost, theme-aware, two weights (400/500), focus returns to the trigger on close.

### 7.6 Tests (engine-first; no DOM harness exists)

- `engine/skill-options.test.js`: `learnableSkills` excludes known names; includes tier/attribute/brief; tier numeric → label mapping; rank1Cost matches `skillRank[1][tier]`; alphabetical within tier groups; empty known set yields full catalog (minus known); Warden/numeric-3 never appears (catalog has none, but guard if present).
- Store: `model.skillOptions` present and excludes known skills; pricing preview null when tier unknown.
- App handler (`store-advancement.test.js` style or a narrow unit): `_learnSkill` is blocked when duplicate, unknown name, unaffordable Legend, unaffordable silver; when allowed it persists the new entry at rank 1 with correct tier string and the paid purse, and the re-derived `legend.spent.total` increases by exactly `skillRank[1][tier]`.
- Log: `logSkillLearned` entry renders in the Log store with `legendCost`, `silverFee`, `coinDelta`, `purseBefore/After` — same assertions as Circle training's log tests.
- Overlay round-trip: a learned skill persists as `{name, rank:1, tier}` and reloads under `ed-character/2`, `forSave` clean.

### 7.7 Build order

1. `rules/legend.json` — add `costs.skillTraining` table + update note text (7.1 data, not code) — no schema-tag bump, additive within shape.
2. `engine/skill-options.js` + tests (7.2, 7.6 engine) — reads the new `skillTraining` table for fee preview.
3. `store-log.js` `logSkillLearned` sibling + store wiring for `model.skillOptions` (7.3–7.4 log helper).
4. `store.js` model enrichment + `ui/ed-app.js` `ed-learn-skill` handler (7.3–7.4) — fee default from `costs.skillTraining`.
5. `ui/ed-disciplines.js` empty-state + "＋ add skill" + picker+fee modal (7.5) — seeds from the same table.
6. Store/app/log tests + full suite green (7.6), changelog `unreleased` entry, release.

### 7.8 Guardrail

Tier-3 throughout (data within the `ed-character/2` / `ed-legend/1` shapes, new pure engine, new edit-mode UI honouring Tier-1, one new data table + note-text amendment — both within-shape). The stored `skills` tier follows the existing convention (string label from catalog numeric); the silver fee is never hardcoded. Re-run the **ed-change-guardrail** pre-flight before step 1.

---

## Log

| Date | Change |
|---|---|
| 2026-08-24 | Plan created (goal + verified Skill Training Table rules; Q1–Q6 open; no implementation). |
| 2026-08-24 | Owner answered Q1–Q4: track editable Rank×10 sp fee (10 sp for Rank 1) via purse; picker-only (154 catalog, no free-text); show Skills sub-tab in edit mode even at 0 skills; language-study test out of scope. Decisions locked; added §7 Phase-1 spec (reuse of saveAdvancementEdits + skillRankStepCost + payFromPurse + _canAffordRank; new engine/skill-options.js learnableSkills; store skillOptions model; ed-learn-skill handler + picker+fee modal reusing Circle-training fee UX; logSkillLearned; engine/store/log tests; build order). Plan-only; no implementation. |
| 2026-08-24 | Plan revised per review: silver fee is now **data, not code** — derived from new `rules/legend.json` `costs.skillTraining[rank]` table (`{"1":10,…,"10":100}`) instead of hardcoded `rank * 10`; §1/§2/§4/§5-Q2/§6/§7.1-7.3/7.5/7.7 updated so retuning the fee is a data-file edit. Still Tier 3 (additive data within `ed-legend/1` shape). |
| 2026-08-24 | Grep check (§7.1): `forSave` (`store.js:397-406`) strips only talent `tier`; `skills[].tier` is passthrough — confirmed existing saves carry `tier` and no migration/forSave change needed. |
