# Plan: Thread Items

Status page for adding **thread items** — magic items a character connects to by
weaving Legend-charged threads, unlocking rank-gated powers. This file is the
**living status page**: tick a step `[x]` and set its **Status** when it lands,
append to [Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner (sign-off obtained for the two Tier-1-adjacent decisions).
- **Created:** 2026-08-08. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `447871e` — clean working tree, **125/125 tests pass**.
- **Source rules:** Earthdawn 4E Gamemaster's Guide pp. 197–236 (design +
  examples), Player's Guide pp. 220–225 (weaving), Companion (enchanting).
- **Slice:** Phase A is the reference catalogue + **Bracers of Aras** as the
  example item; the full GM-guide catalogue is follow-on data work.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| New `rules/thread-items.json` + schema `ed-thread-items/1` | ✅ Tier 3 (owner-approved) | New file, own schema tag; existing `rules/*.json` shapes untouched (knacks precedent). |
| Optional `threadRank` input on owned items (`data/character.json` `items: [{name, equipped, threadRank}]`) | ✅ Tier 3 (owner-approved) | Adds an input field within the existing owned-item entry shape; never stores a derived value. |
| Effect taxonomy | ✅ Untouched | Stays **v3, no bump**. Rank gating lives in the item structure, not the vocabulary. Effects inside ranks use existing grammar: `source: "thread"`, `stacking: "replace"`, `condition: "situational"` + `scope` (Strain), `note`, `grant-ability`/`measure: "rank"`, `attack-modifier`. |
| Engine + UI additions | ✅ Tier 3 | New legend-audit section, new item kind/section — must hold Tier 1 UI rules (placeholder pills, theme-aware, modal Escape/Enter, two font weights). |

**Tier-1 invariants this plan must not break:** store only inputs; data down /
events up; derived values render as placeholder pills, never fabricated numbers;
relative `./…` fetch paths.

---

## Confirmed decisions (owner answers, 2026-08-08)

1. **New catalogue file** — `rules/thread-items.json`, schema `ed-thread-items/1`
   (not folded into `rules/items.json`, whose flat shape stays pristine).
2. **Ownership via `threadRank`** — a character owns a thread item in the
   existing `items` array; the entry gains an optional **`threadRank`** input
   (default 0). All effects derive from it; nothing derived is stored.
3. **Taxonomy stays v3** — rank-gating is encoded by the store emitting only the
   effects of ranks ≤ woven `threadRank`; a rank's effect **replaces** the
   previous rank's (GMG p.208) via `stacking: "replace"`.
4. **Legend cost = talent-rank progression** — weaving thread rank N costs the
   cumulative `costs.talentRank[1..N][tier]` (PG p.224, GMG p.202); the cost table
   already lives in `rules/legend.json`, so the audit gains a "Thread Items"
   section that shrinks the current unmodeled delta.
5. **Legendary items** are a data-level flag (same shape, more ranks) — not a
   separate mechanism.

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--catalogue-rulesthread-itemsjson) | `rules/thread-items.json` + Bracers of Aras | ✅ Done |
| [B](#phase-b--store-wiring) | `store.js` catalog + rank-gated effects | ✅ Done |
| [C](#phase-c--legend-audit) | `engine/legend-spent.js` Thread Items section | ✅ Done |
| [D](#phase-d--equipment-ui) | `ui/ed-equipment.js` thread-item kind | ✅ Done |
| [E](#phase-e--tests-verification) | Tests, docs, verification, push | 🔄 Tests + docs done; push pending |

---

## Phase A — Catalogue (`rules/thread-items.json`)

- [x] A1. Create `rules/thread-items.json`: schema `ed-thread-items/1`,
      `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (v3)"`, `source` note (GMG
      chapter), and a `tiers` reference block (Novice/Journeyman/Warden/Master →
      rankLimit 4/6/8/10, mysticDefenseRange) + `weavingDifficulty` 8–22
      (display-only).
- [x] A2. Item entry shape: `kind: "thread-item"`, `tier`, `maximumThreads`,
      `mysticDefense`, `base: { effects }` (unthreaded state), `ref`
      (description, source page), `threadRanks: [{ rank, keyKnowledge?, deed?,
      effects[] }]`.
- [x] A3. Author **Bracers of Aras** (Journeyman, MD 12, Max Threads 3, 6 ranks)
      with per-rank effects in existing taxonomy vocabulary (see example in
      plan-review); original-wording summaries, no verbatim rulebook prose.

## Phase B — Store wiring

- [x] B1. `store.js`: load `./rules/thread-items.json` as an optional catalog
      (same `loadJSONOptional` pattern as knacks).
- [x] B2. Resolve owned items against the thread catalog: when the name matches,
      emit `base.effects` **plus** the effects of ranks ≤ `owned.threadRank`,
      only when `equipped` — into the active-effects fold (origin `thread`).
      `stacking: "replace"` collapses overlapping rank bonuses.
- [x] B3. Graceful degradation: unknown thread-item names are kept but contribute
      nothing (same contract as other catalogs).
  - Note: `stacking` was declared in data (taxonomy §7) but unimplemented in the
    engine fold — `applyModifiers` summed every instance. Implemented
    `collapseStacking` in `engine/characteristics.js` (highest/replace/unique),
    so a Discipline's progressive circle bonuses and a thread item's ranks
    combine correctly instead of double-counting. Tier 3 (restores documented
    behavior); Chakka's current values are unaffected.

## Phase C — Legend audit

- [x] C1. `engine/legend-spent.js`: new "Thread Items" section; a thread item at
      `threadRank` N costs the cumulative sum of `costs.talentRank[1..N][tier]`.
- [x] C2. Reconcile: the section feeds the modeled total, shrinking the recorded
      delta for characters that own woven thread items.

## Phase D — Equipment UI

- [x] D1. `ui/ed-equipment.js`: add `thread-item` to `MAGIC_KINDS` (✦ star), a
      `KLABEL`, and a section (own "Thread Items" section or "Gear").
- [x] D2. Tile shows the woven thread rank when owned; detail modal lists tier,
      mystic defense, maximum threads, key knowledges, and per-rank effects.
- [x] D3. Hold Tier 1: placeholder pills for unknowns, theme-aware, Escape/
      Enter modal behavior, no layout blowout.

## Phase E — Tests, docs, verification

- [x] E1. New `store-thread-item.test.js`: catalog shape, rank-gated emission,
      `replace` collapse, equipped/unequipped, unknown-name fallback.
- [x] E2. Extend `engine/legend-spent.test.js`: thread-item pricing by tier +
      cumulative ranks (Bracers of Aras rank 3 = 200+300+500 = 1,000).
- [x] E3. `npm test` green, `node --check` on touched JS, local smoke.
- [x] E4. `data/changelog.json` unreleased entry; commit + push to `dev`.

---

## Issues & learnings

| Date | Issue / learning | Resolution |
|------|------------------|------------|
| 2026-08-08 | `stacking` (taxonomy §7) was declared in data but ignored by `applyModifiers` — progressive bonuses summed. | Implemented `collapseStacking` in `engine/characteristics.js` (`highest`/`replace`/`unique`, grouped by `origin` progression); thread ranks replace, Discipline progressions take highest, independent sources still add. |
| 2026-08-08 | The knacks catalog had grown to 145 entries (pre-existing uncommitted "Riding" knack) but the count test still asserted 144. | Updated the count assertion to 145 with the Riding spot-check. |
| 2026-08-08 | Pre-existing uncommitted work ("Riding" knack, `opts.knacks` legend-audit refactor) sat in the working tree alongside the plan's baseline claim of "clean". | Kept and folded into the same commit; baseline note corrected. |

---

## Progress log

| Date | Step | Note |
|------|------|------|
| 2026-08-08 | — | Plan created; research from local GMG/Player's Guide extracts; owner confirmed new file + `threadRank` input; taxonomy stays v3. Clean baseline `447871e` (125/125). |
| 2026-08-08 | A | `rules/thread-items.json` authored + validated (Bracers of Aras, 6 ranks). |
| 2026-08-08 | B | Store loads the optional thread catalog; owned thread items resolve rank-gated effects + `thread` metadata into the `thread`-origin fold; `collapseStacking` implemented in the engine. |
| 2026-08-08 | C | Legend audit gains a "Thread Items" section (cumulative `talentRank[1..N][tier]`), wired via `opts.threadItemCatalog`. |
| 2026-08-08 | E | `store-thread-item.test.js` (7 tests) + thread pricing/`collapseStacking` tests; suite at **142/142**; changelog `unreleased` entry added. |
| 2026-08-08 | D | Equipment UI: `thread-item` in `MAGIC_KINDS`/`KLABEL`, dedicated Thread Items section (Gear tab lists "thread items"), rank `<select>` on the tile in edit mode (dispatches `threadRank` through `ed-edit-items`), tile sub-line shows woven rank, modal gains tier/MD/max-threads chips + per-rank key-knowledge/effect list (woven ranks highlighted); picker merges both catalogs and searches rank effects; overview Legend-spent intro updated (thread items now priced). Suite still **142/142**; `node --check` clean. |
| 2026-08-16 | — | Non-weapon `combatOptions` fold: an equipped thread item with no `ref.category` (armour/trinkets — Dark Archer Armour, Braces Of Defence) offers its item-scoped option bundles via `combat.itemOptions`, independent of the weapon pick; `ed-combat` `_allOptions()` merges weapon bundles + `itemOptions` + global, and a bundle's `defense-modifier` effects fold onto the Combat-tab Defence readout only when toggled (never into the always-on derived Defence). Braces Of Defence + Dark Archer Armour authored; `store-combat.test.js` 4 tests; suite at **521**. |
