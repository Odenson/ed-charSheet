# Plan: Learning new spells (Grimoire → Learn)

This plan defines the **Learn a spell** flow for the Spells tab — the edit-mode
modal the Spells work already stubs (PLAN-SPELLS §6: "Learning new spells will be
a modal … capture the spell from the discipline, its difficulty to learn, any
bonuses to the learning test and then roll for successes … the success level is
recorded"). It is a **plan only — no implementation yet**, for owner review.

- **Owner:** repo owner.
- **Created:** 2026-08-19. **Status:** decisions resolved (Q1–Q7); ready to build.
- **Branch of record:** `dev` (current production is v1.15.1).
- **Rule source:** Earthdawn 4E Player's Guide, **"Learning Spells" / "Spell
  Learning Cost" / "Spell Legend Point Cost" (pp. 251–252)** —
  `rulebook extracts/manual/text-player-guide-spell-concepts.txt`. Mechanics only,
  distilled to structured data; no verbatim prose in the app.
- **Reference:** [PLAN-SPELLS.md](PLAN-SPELLS.md) (the `spells.known[]` +
  `learntSuccess` shape, already owner-signed-off), [ARCHITECTURE.md](../ARCHITECTURE.md),
  [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md), the Legend-spent audit
  ([[legend-spent-audit]], `engine/legend-spent.js`, `rules/legend.json`).

---

## 1. The ED4 rules (distilled)

A magician learns a new spell from **another magician or a grimoire other than
their own**, by studying it and copying it into their own grimoire.

- **Who can learn what.** A magician can learn spells of **any Circle** — even
  higher than their own — provided they know the **Thread Weaving talent for that
  spell's Discipline**. (They may not be able to *cast* a higher-Circle spell with
  their matrices, but they can still learn it.)
- **Prerequisite state.** The magician must be **rested and in good health** — a
  character with **any Damage or Wounds may not learn** a new spell.
- **The test.** Make a **Patterncraft test** (Perception-based talent) against the
  spell's **Learning Difficulty = Circle + 5** (table: C1 → 6, C2 → 7, … C15 → 20).
  On success, the spell is interpreted and written into the grimoire — learned.
- **Frequency.** Only **one Patterncraft learning test per day**, but the magician
  may **sacrifice Recovery tests** for extra attempts (1 Recovery test = 1 extra
  Patterncraft test that day).
- **Teacher assist (optional).** With a teacher who knows the spell, first make a
  **Spellcasting test** vs the Learning Difficulty; on success, **add the
  teacher's Thread Weaving rank** to the Patterncraft test.
- **Costs.**
  - **Legend Points** (to incorporate the spell into the pattern): equal to a
    **Novice talent bought to Rank = the spell's Circle** — already tabulated in
    `rules/legend.json` `costs.talentRank[circle].Novice` (C1 = 100, C5 = 800,
    C15 = 98 700). The magician must have that much **Available Legend** at the
    time of the test.
  - **Silver** (to buy the copy): typically **Circle × 100 sp** (may double/triple
    for personal tuition; GM-set). Circle 11+ spells usually can't be purchased.

---

## 2. Tier classification

| Area | Tier | Why |
|---|---|---|
| Character `spells.known[]` + `learntSuccess` | **Tier 1 — already signed off** | The Learn flow only *appends* an input the approved shape already defines (PLAN-SPELLS §4). No new shape. |
| Learning as a **Legend sink** in the audit | **Tier 3 (additive engine)** | Extends `engine/legend-spent.js` to count learned spells; no schema change. Resolves PLAN-SPELLS **A5** (spell Legend cost was deferred — learning makes it real). |
| `engine/spells.js` learn helpers | **Tier 3** | Pure derivations (difficulty, cost, prereqs). |
| `ui/ed-spells.js` Learn modal | **Tier 3** | New edit-mode modal honoring the Tier-1 UI rules. |
| Silver cost → wealth spend | **Tier 3** | Uses the existing wealth input; optional (see Q3). |

No Tier-1 shape change and no taxonomy change. The one **Tier-2-adjacent** note:
the Learning Difficulty (Circle + 5) and silver cost (Circle × 100) are **rules
data**, not engine hard-coding — they belong in a small `learning` block in
`rules/spells.json` or `rules/legend.json` (§4), consistent with the "engine reads
structured data, never a formula baked in code" rule (ARCHITECTURE §5.5).

---

## 3. What the flow does (happy path)

From the **Grimoire** view in **edit mode**, a **＋ Learn spell** button opens the
Learn modal:

1. **Pick the spell.** Choose from the **learnable set** — every spell in a
   Discipline the character has a `Thread Weaving (X)` talent for, of any Circle,
   **not already in `known[]`** — grouped by Discipline then Circle. Higher-Circle
   spells are offered but flagged "can't cast yet" when the matrix rank is short.
2. **Prerequisite panel** (read-only, from derived state):
   - **Rested & healthy** — blocks the roll if `resources.health.damage > 0` or
     `wounds > 0` (rule: no Damage/Wounds).
   - **Patterncraft** step (the roll) and **Thread Weaving (discipline)** present.
   - **Learning Difficulty** = Circle + 5.
   - **Legend cost** (Circle → `talentRank[circle].Novice`) vs **Available Legend**
     — blocks if unaffordable.
   - **Silver cost** — a **suggested** price (Circle × 100 sp) the player can
     **override**, item-buy style (Q3), paid from the purse on confirm.
3. **Teacher assist (optional).** A toggle + a "teacher's Thread Weaving rank"
   input. When on, the flow first rolls a **Spellcasting test** vs the Learning
   Difficulty (through the shared roll modal); on success it **arms** a bonus
   equal to the teacher's TW rank, which is **added to the Patterncraft roll**.

   This is the **same two-step "outcome arms the next roll" pattern as the Combat
   tab's aim → attack** (Mystic Aim: a precursor Perception test vs Mystic
   Defence whose success arms +2 steps per success on the following Attack, then
   is consumed by that roll). The teacher-assist precursor is the aim; the
   Patterncraft roll is the attack; the armed teacher-rank bonus is the aim
   bonus. Reuse that mechanism — an armed-precursor success feeding a `mods`/step
   bonus into the main roll — rather than inventing a new one.
4. **Roll Patterncraft** vs the Learning Difficulty via the shared `ed-roll-modal`
   (Karma offered per the talent's eligibility, difficulty shown as pass/fail).
5. **On success** — the modal records `learntSuccess` and, on confirm:
   - **`learntSuccess` = EXTRA successes = `successCount(patterncraftTotal,
     learningDifficulty) − 1`, floored at 0** — matching the PLAN-SPELLS §4
     definition (extra successes above the first, the same `levels − 1` convention
     the cast flow uses for its Success-Levels boosts). The Patterncraft roll
     yields **total** success levels; the dispatch stores **total − 1**, never the
     total. (A bare success = 1 level → `learntSuccess: 0`.)
   - appends `{ name, learntSuccess }` to `spells.known[]` (dispatch up, saved via
     the existing `saveSpellEdits`);
   - the Legend sink is now reflected (the audit counts the new spell, §5);
   - deducts the **agreed silver** (the suggested price, or the player's override)
     from the purse via **`ed-edit-wealth`** (Q3). Learning has **no item side**,
     so it is a wealth-only edit — **not** `ed-trade` (which writes items *and*
     wealth atomically). The `known[]` append (`ed-edit-spells`) and the silver
     deduction (`ed-edit-wealth`) are two independent input writes, each
     re-derived; there is nothing to make atomic (spells and wealth are unrelated
     inputs).
   On a **miss**, nothing is learned. (No daily-attempt limit in this version — Q4.)

---

## 4. Data — Learning tables (rules data, not code)

Everything the flow needs already exists **except** the two small tables, which
should be authored as data (ARCHITECTURE §5.5):

```jsonc
// rules/spells.json — a top-level "learning" block (ed-spells/1, additive):
"learning": {
  "difficultyByCircle": "circle + 5",   // or an explicit 1..15 table if we avoid formulas
  "silverPerCircle": 100,               // Circle × 100 sp
  "legendCostSource": "legend.json costs.talentRank[circle].Novice"
}
```

- **Learning Difficulty** — the rule is exactly Circle + 5. Store it as an
  explicit `{circle: difficulty}` table (C1 → 6 … C15 → 20) so the engine reads a
  value, not a formula — matching how `threadCap` and the step tables are data.
- **Legend cost** — reuse `rules/legend.json` `costs.talentRank[circle].Novice`
  (already present and correct). No new table.
- **Silver cost** — `Circle × 100`; store `silverPerCircle: 100` (the multiplier
  as data), the GM's ×2/×3 tuition is an at-time modifier (Q3).

**Resolved (Q1):** the difficulty is an **explicit `{circle: difficulty}` table**
(C1 → 6 … C15 → 20), not the `circle + 5` formula — the engine reads a value,
data-first, no arithmetic on rule structure (ARCHITECTURE §5.5).

---

## 5. Engine — `engine/spells.js` (pure additions)

- `learnableSpells(ctx, rules)` → spells the character *could* learn: catalog
  spells whose Discipline the character has `Thread Weaving (X)` for, minus
  `known[]` (apostrophe-insensitive, reusing `normName`). Tagged with a
  `castable` flag (matrix rank ≥ Circle) for the "can't cast yet" note.
- `learningDifficulty(rules, circle)` → the table value (Circle + 5).
- **Legend cost — reuse the existing `spellCost(circle, rankTable)`** already
  exported from `engine/legend-spent.js:89` (its doc: "exported now so tests and
  later phases share one definition"). **Do not add a second `spellLegendCost` in
  `spells.js`** — import/reuse the one function so the Learn modal, the audit
  sink, and tests all price a spell the same way.
- `spellSilverCost(rules, circle)` → `circle × silverPerCircle`.
- `patterncraftStep(model)` → the character's Patterncraft talent step (from the
  derived talents; null if not owned → cannot learn).
- `canLearn(character, model, rules, spell)` → `{ ok, reasons[] }` — the prereq
  gate: healthy (no Damage/Wounds), has Patterncraft, has the Discipline's Thread
  Weaving, enough Available Legend. Pure; the UI renders the reasons.

The Patterncraft roll and the (optional) Spellcasting precursor go through the
existing shared roll flow (`ed-roll`), so Karma / difficulty / success counting
come for free — the view computes no game values (golden rule).

## 5.1 Legend integration (resolves PLAN-SPELLS A5)

Learning **spends Legend**. Rather than store a "spent" number (store-only-inputs),
the learned spell in `known[]` **is** the input, and the **Legend-spent audit**
(`engine/legend-spent.js`) gains a **spells sink**: sum over `known[]` of
`spellLegendCost(circle)`. So Available Legend drops automatically when a spell is
learned, and the audit reconciles — the same pattern as talents/skills/attributes.
This is the piece PLAN-SPELLS deferred (A5); the Learn flow is what makes it
required. **Owner-confirmed (Q2): count every `known[]` spell** as a sink
(regardless of how it got onto the sheet), matching how the audit already
recomputes talents/skills/attributes from the sheet. The reconciliation anchor
([[legend-spent-audit]]) absorbs any gap for imported characters.

**Catalog wiring (was underspecified — the audit can't price a spell without its
Circle).** `known[]` stores only `name` + `learntSuccess`; a spell's **Circle**
lives in the catalog. This is the *exact same problem* the audit already solves
for thread items, which don't store their tier: `auditLegendSpent(character,
costs, opts)` receives **`opts.threadItemCatalog`** and looks each owned item up
in it. Spells follow that precedent:

- **`auditLegendSpent` gains `opts.spellCatalog`** — the `rules/spells.json`
  `spells` map — parallel to `opts.threadItemCatalog`. The audit reads
  `character.spells?.known`, resolves each `name` in `spellCatalog` (**apostrophe-
  insensitive**, reusing the same normalisation as `joinSpell`) to get its
  `circle`, and adds the **existing `spellCost(circle, costs.talentRank)`**
  (`legend-spent.js:89`, `= talentRank[circle].Novice`). An unknown name (not in
  the catalog) contributes 0 and is skipped, never a fabricated cost.
- **The `store.js` `deriveModel` call site** (the existing
  `auditLegendSpent(character, legendFile?.costs, { knacks, threadItemCatalog,
  karmaRitualCost, tierShift })` — currently ~`store.js:1057`) **already has
  `spellsFile` in scope** (it builds `model.spells` right below), so it just adds
  **`spellCatalog: spellsFile?.spells`** to that opts object. This call site is a
  required file change (it was missing from §6's list — see below).

So the data flow is: catalog (`spellsFile.spells`) → `deriveModel` opts →
`auditLegendSpent` → per-spell Circle → `spellCost` → summed sink. No Circle is
ever stored on the character (store-only-inputs holds); it is always looked up.

---

## 6. UI — `ui/ed-spells.js` (Learn modal)

- The **＋ Learn spell** control sits in the Grimoire view, **edit mode only**
  (matches PLAN-SPELLS: learn/remove are edit-mode; attune is any-time).
- The modal: learnable-spell picker (grouped, searchable if the list is long, with
  the same fixed-height scroll as the Raw cast list); the prerequisite panel with
  clear blockers; the teacher-assist toggle + rank input; the roll button(s); and
  a confirm that commits the learned spell.
- **Tier-1 UI:** Escape-closes / Enter-confirms; derived numbers show placeholder
  pills when unavailable, never fabricated; theme-aware; two weights; mobile
  single column. Unaffordable / unhealthy states **disable** the roll with a
  reason, never a silent no-op.
- Dispatches: `ed-roll` (the Patterncraft test and, when teacher assist is on, the
  Spellcasting precursor); and on success `ed-edit-spells` (the new `known[]`,
  reusing the existing save path) plus **`ed-edit-wealth`** for the **agreed
  silver** (suggested price or the player's override). It is `ed-edit-wealth`
  (wealth only) because a spell-learn has **no item side** — `ed-trade` is for
  atomic item + wealth changes and does not apply here.

---

## 7. Open decisions (for the review pass)

| # | Decision | Owner answer |
|---|---|---|
| Q1 | Learning Difficulty as an explicit `{circle: difficulty}` **table** vs. the `circle + 5` formula in the engine. | **✅ Explicit table** — `{circle: difficulty}` (C1 → 6 … C15 → 20) in the `learning` block; the engine reads a value, never computes `circle + 5` (ARCHITECTURE §5.5, data-not-formula). |
| Q2 | Legend-spent audit counts **every** `known[]` spell as a sink vs. only in-app-learned spells. | **✅ Every spell** — the audit sums a Legend sink over every `known[]` spell (resolves PLAN-SPELLS A5). |
| Q3 | **Silver cost** — deduct on learning vs informational; model the ×2/×3 tuition. | **✅ Item-buy style** — a modal shows the **suggested** price (Circle × 100 sp) that the player can **override** before paying from the purse (mirrors the item-buy / trade modal). The ×2/×3 tuition is just the player editing the suggested amount. |
| Q4 | **Once-per-day + sacrifice-Recovery** limit — model it vs omit. | **✅ Omit for this version** — no daily-attempt limit; the player self-governs. |
| Q5 | **Teacher assist** — build the two-step in v1 vs fast-follow. | **✅ In v1** — the Learn modal includes a teacher-assist option (Spellcasting precursor vs Learning Difficulty → on success adds the teacher's Thread Weaving rank to the Patterncraft test). |
| Q6 | **Higher-Circle learning** — offer spells above the character's Circle with a "can't cast yet" flag, or restrict to castable Circles? | **✅ Offer with flag** — the picker lists spells of any Circle the character can learn (has the Discipline's Thread Weaving), flagging the ones the matrices can't yet cast ("can't cast yet"). |
| Q7 | **Source of the spell** — player's assertion of access, or a light note field? | **✅ Player's assertion** — no source object; the player is assumed to have access (found a grimoire / a teacher). Nothing modelled about other characters' grimoires. |

---

## 8. Delivery phases

1. **Decisions** — resolve Q1–Q7 (especially Q2 the Legend sink, Q3 silver, Q4 daily limit).
2. **Data** — author the `learning` block (`rules/spells.json`) — difficulty table + `silverPerCircle`.
3. **Engine + Legend audit** —
   - `engine/spells.js`: `learnableSpells`, `learningDifficulty`, `spellSilverCost`, `patterncraftStep`, `canLearn` (+ tests). **Legend cost reuses the existing `spellCost` from `legend-spent.js` — no new pricing function.**
   - `engine/legend-spent.js`: `auditLegendSpent` gains **`opts.spellCatalog`** and the **spells sink** — sum the **existing `spellCost(circle, rankTable)`** over `character.spells.known`, Circle resolved from the catalog (apostrophe-insensitive), unknown names → 0 (§5.1) (+ tests).
   - `store.js`: the existing `auditLegendSpent(...)` call site (~`store.js:1057`) adds **`spellCatalog: spellsFile?.spells`** to its opts (it already holds `spellsFile`). **This call site is a required change** and was previously omitted.
4. **UI** — the Learn modal in `ui/ed-spells.js` (edit mode): learnable picker +
   prerequisite panel + **teacher-assist option** (Q5 — Spellcasting precursor →
   +TW-rank) + Patterncraft roll + commit; the **overridable silver-price** step
   (Q3, item-buy style); wire `ed-edit-spells` and the wealth/purse edit.
5. **Polish** — light/dark + mobile; Tier-1 re-check; changelog.

---

## 9. Tier-1 guardrail re-check

- Data down / dispatch up: the modal computes no game values (engine does);
  learning dispatches the new `known[]` up, saved as an input.
- Store only inputs: `known[]` + `learntSuccess`; the Legend "spend" is **derived**
  by the audit, never stored.
- Difficulty / cost are **rules data**, never regex-parsed or formula-baked
  (ARCHITECTURE §5.5).
- Derived values → placeholder pills; modal Escape/Enter; theme-aware; two weights.

---

## 10. Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-08-19 | Plan created from ED4 Player's Guide pp. 251–252 (Learning Spells). Mechanics distilled: Patterncraft test vs Learning Difficulty (Circle + 5); rested/healthy prereq; Thread Weaving gates the learnable set (any Circle); Legend cost = Novice-talent-at-Circle (`legend.json`, exists); silver = Circle × 100; teacher assist (Spellcasting precursor → +TW rank); once/day + sacrifice Recovery. Verified data hooks (Legend table, Patterncraft/Thread Weaving/Spellcasting talents) all present. | Draft for review |
| 2026-08-19 | Owner answers folded in: **Q2** Legend audit counts **every** `known[]` spell (resolves A5); **Q3** silver is an **item-buy-style overridable suggested price** paid from the purse; **Q4** the once/day + sacrifice-Recovery limit is **omitted** this version; **Q5** **teacher assist ships in v1** (in the Learn modal). Q1/Q6/Q7 remain open (leans stand). | Draft for review |
| 2026-08-19 | Owner review — **reuse `spellCost`, don't duplicate.** `spellCost(circle, rankTable)` is already exported from `engine/legend-spent.js:89` (doc: "later phases share one definition"). The plan's proposed `spellLegendCost` in `spells.js` is dropped; the Learn modal, the audit sink, and tests all call the one `spellCost` (§5, §5.1, §8). | Ready for build |
| 2026-08-19 | Owner review — **`learntSuccess` indexing made explicit.** PLAN-SPELLS §4 defines it as EXTRA successes (`levels − 1`). The Patterncraft roll returns TOTAL success levels (`successCount`), so the modal stores **`total − 1` (floored at 0)**, not the total — a bare success → `learntSuccess: 0` (§3 step 5). Keeps the dispatch consistent with the schema and the cast-flow `levels − 1` convention. | Ready for build |
| 2026-08-19 | Owner review — **silver-deduction event named explicitly:** `ed-edit-wealth` (wealth-only), not `ed-trade` (atomic item + wealth) — a spell-learn has no item side. The `known[]` append (`ed-edit-spells`) and silver deduction (`ed-edit-wealth`) are two independent input writes; nothing to make atomic (§3 step 5, §6). | Ready for build |
| 2026-08-19 | Owner accepted the leans: **Q1** explicit `{circle: difficulty}` table; **Q6** offer higher-Circle spells with a "can't cast yet" flag; **Q7** access is the player's assertion (no source object). **Teacher assist** noted to reuse the Combat tab's **aim → attack two-step** ("outcome arms the next roll"): the Spellcasting precursor is the aim, the Patterncraft roll the attack, the armed teacher-rank bonus the aim bonus. **All decisions now resolved.** | Ready for build |
| 2026-08-19 | Owner review — **Legend-audit catalog wiring was underspecified.** `known[]` stores only name/learntSuccess, so the audit needs the catalog for each spell's Circle. §5.1 now specifies: `auditLegendSpent` gains **`opts.spellCatalog`** (parallel to the existing `opts.threadItemCatalog`, which exists because thread items don't store their tier), and the **`store.js:~1057` call site** passes `spellCatalog: spellsFile?.spells` (it already holds `spellsFile`). This call site + `engine/legend-spent.js` are now named in the §8 engine phase (were missing). | Draft for review |
