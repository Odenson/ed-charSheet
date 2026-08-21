# Plan: Talent & Skill Rank Editing

Rank editing lets the player raise or lower a talent's and a skill's **rank** in
edit mode. Increasing a rank **consumes** Legend (the next step's cost, from the
same cost tables the Legend-spent audit prices with); decreasing one
**refunds** the step that bought the current rank. Available Legend is a derived
figure (`totalEarnt − audit total`), so no new stored value is invented — a rank
change simply moves the derived `available`. This file is the **living status
page**: tick a step `[x]` and set its **Status** when it lands, append to
[Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner (locked decisions below confirmed 2026-08-10).
- **Created:** 2026-08-10. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `5a9edaf` — clean working tree, **336/336 tests pass**.
- **Source rules:** Earthdawn 4E Players' Guide p.112–113 (Talent step table —
  ranks cost legend per the Talent Rank table), p.402 (Skill Training Table).
  The app's own audit (`engine/legend-spent.js`) already prices every recorded
  advancement against `rules/legend.json`; rank editing is built on that same
  engine so a step always costs exactly `audit(after) − audit(before)`.
- **Slice:** edit-mode steppers on the Disciplines tab (talents + the Skills
  view); an "Available Legend" budget chip; no Legend-earned editor in this
  change (a character with no Total Legend earned simply can't price changes).

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Editing the existing `rank` input field | ✅ Tier 3 | Rank is already a stored input on every talent/skill; no schema or field renames. |
| Legend-spent engine: new pure step-cost helpers | ✅ Tier 3 | Pure, DOM-free; built from the existing cumulative functions, same return contracts. |
| Edits overlay: new `advancements` category | ✅ Tier 3 | New overlay category, existing pattern (items/wealth/health). Stores the **full** ranked `disciplines`/`skills` input arrays — never a derived value. |
| Store/derive: `pricing` on derived talents/skills | ✅ Tier 3 | Attached post-audit, derived each render, never persisted. |
| UI: steppers + budget chip | ✅ Tier 3 | Honors the UI-GUIDELINES (two weights, theme-aware, modals unchanged, derived shows placeholder pills). |
| Effect taxonomy | ✅ Untouched | No vocabulary change; no bump. |

**Tier-1 invariants this plan must not break:** store only inputs; data down /
events up; the engine stays pure and DOM-free; derived values render as muted
dashed placeholder pills, never a fabricated number; relative `./…` fetch paths.

---

## Confirmed decisions (owner answers, 2026-08-10)

1. **No Total Legend earned → block rank editing.** With no
   `resources.legend.totalEarnt`, `available` is unknown, so every stepper is
   disabled and the tab shows a hint — *"Enter Total Legend earned to price
   rank changes."* There is no Legend-earned editor in this change.
2. **Unpriceable rows are blocked, never guessed.** A talent with no tier (or
   whose next rank lies beyond the cost tables — talent Rank 15, skill Rank 10)
   shows **—** and disables both steppers. No fallback to the talent catalog's
   tier: the audit prices raw stored inputs, and rank editing must match the
   audit line-for-line. Existing recorded spend totals are untouched.

   > **Superseded 2026-08-21** (plans/PLAN-TALENT-TIER-DERIVATION.md): talent
   > `tier` is no longer a stored input at all — it derives from the learned
   > Circle (`rules/legend.json` `costs.tiers`, PG pp. 85, 457–458), so there is
   > likewise nothing to fall back to from the talent catalog. The never-guess
   > contract stands unchanged: a missing or out-of-band circle still prices
   > null, shows **—**, and disables both steppers.
3. **Rank bounds: floor 1, ceiling = the cost tables.** A decrease stops at
   Rank 1 (nothing below to refund); an increase is disabled once the next step
   has no table entry. No new circle-based caps.

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--engine-legend-spentjs) | Step-cost helpers (`talentRankStepCost` / `skillRankStepCost`) | ✅ Done |
| [B](#phase-b--store-storejs) | `advancements` overlay, `pricing` on the model, affordability guard | ✅ Done |
| [C](#phase-c--ui) | Steppers + Available Legend chip on the Disciplines tab | ✅ Done |
| [D](#phase-d--tests) | Engine + store tests | ✅ Done |
| [E](#phase-e--docs) | Docs, changelog | ⏳ Left local — no commit until the owner tests |

---

## Phase A — Engine (`engine/legend-spent.js`)

- [x] A1. `talentRankStepCost(t, ordinal, lowestCircle, costs, toRank)` — the
      Legend cost of the single step that brings a talent **to** `toRank`. First
      Discipline: `talentRanksCost(toRank) − talentRanksCost(toRank−1)`.
      Additional Discipline: `additionalDisciplineTalentCost(toRank) −
      additionalDisciplineTalentCost(toRank−1)` (the New-Discipline R1 surcharge
      and the equivalent tier apply). `null` when either side is unpriceable
      (missing tier, rank beyond the table); `0` for `toRank ≤ 0`.
- [x] A2. `skillRankStepCost(s, costs, toRank)` — same shape via
      `skillRanksCost`, with a missing tier defaulting to **Novice** exactly as
      the audit prices skills. `null` beyond Rank 10.
- [x] A3. Contract documented in the JSDoc: a step always equals
      `audit(after) − audit(before)` for that one rank change (proved by test,
      see Phase D).

## Phase B — Store (`store.js`)

- [x] B1. `saveAdvancementEdits({ disciplines, skills }, id)` → overlay category
      `advancements`, storing the **full** ranked input arrays (a later save
      replaces them — the items/wealth precedent, so a partial patch can never
      drop recorded ranks on replay). `'advancements'` joins `SAVED_CATEGORIES`;
      `applyEdits` replaces `character.disciplines`/`skills`; `hasPendingEdits`
      and `reconcileOverlay` reason over it unchanged.
- [x] B2. `deriveModel` attaches `pricing: { increaseCost, refund, affordable }`
      to every derived talent and skill **after** the audit:
      `increaseCost` = the step to `rank + 1` (null when unpriceable), `refund`
      = the step that bought the current rank (null at Rank 1 — the floor),
      `affordable` = `available != null && increaseCost != null &&
      increaseCost <= available`. Reads the raw inputs (tier/circle) exactly as
      the audit does; derived each render, never stored.
- [x] B3. App-layer guard (`ui/ed-app.js`): the `ed-edit-talent-rank` /
      `ed-edit-skill-rank` handlers re-audit a **clone** carrying the tentative
      rank (`auditLegendSpent` with the resolved knacks + `legendAvailable`) and
      reject an increase that would push Available Legend below 0. Decreases
      always pass (they refund). Defense-in-depth — the view only offers
      affordable steps.

## Phase C — UI

- [x] C1. `<ed-disciplines>` receives `.editMode` (ed-app.js, Disciplines tab).
- [x] C2. In edit mode each rank cell becomes a **− rank +** stepper
      (`_rankCtl`), the grid's rank column widening to fit (mobile included).
      `+` is disabled unless the step is priced **and** affordable; `−` is
      disabled at Rank 1 or when unpriceable. Tooltips name the cost/refund and
      the "not enough Available Legend" / "enter Total Legend earned" reasons.
      Clicking a stepper dispatches `ed-edit-talent-rank` / `ed-edit-skill-rank`
      (data flows up; the row never mutates state).
- [x] C3. "Available Legend" chip at the tab top while editing: the derived
      number when known, the muted dashed placeholder pill (**—**) when not, and
      the no-Legend hint beneath it. Two weights, theme-aware, no new modals.

## Phase D — Tests

- [x] D1. `engine/legend-spent.test.js`: step == audit-diff for a first- and an
      additional-Discipline talent (rank 1 and 2+), skills, and null paths
      (missing tier, beyond-table ranks, `toRank ≤ 0`).
- [x] D2. `store-advancement.test.js`: overlay round-trip + `applyEdits`
      replacement + preservation of other inputs, dirty/pending/reconcile,
      full-array replace semantics, `pricing` on the model (step up / refund /
      affordability, surcharge tier, unpriceable nulls, no-Legend lock), and a
      rank change moving `legend.available` by exactly the step cost.
- [x] D3. `npm test` green (**353/353** — 336 baseline + 7 engine + 10 store),
      `node --check` on every touched JS.

## Phase E — Docs

- [x] E1. This plan (phases A–D ticked).
- [x] E2. `data/changelog.json` `unreleased` `added` entry (rank editing).
- [x] E3. `docs/REVIEW-FINDINGS.md`: note the pre-existing skill-tier
      numeric/string quirk deliberately **not** fixed here.
- [ ] E4. **Not committed** — the owner tests the feature locally first, then
      decides on a commit/push.

---

## Issues & learnings

| Date | Issue / learning | Resolution |
|------|------------------|------------|
| — | — | — |

---

## Progress log

| Date | Step | Note |
|------|------|------|
| 2026-08-10 | — | Plan agreed with the owner (three locked decisions). Baseline `5a9edaf` (336/336), clean tree. |
| 2026-08-10 | A | `talentRankStepCost` / `skillRankStepCost` landed in `engine/legend-spent.js`; 7 tests (step == audit-diff, first/additional Discipline, skills, null paths) green. |
| 2026-08-10 | B | `saveAdvancementEdits` + `SAVED_CATEGORIES` + `applyEdits` (`advancements`), post-audit `pricing` pass in `deriveModel`, and the `ed-app` handlers with the affordability guard. |
| 2026-08-10 | C | Edit-mode steppers and the Available Legend chip in `ui/ed-disciplines.js`; `.editMode` wired from ed-app. |
| 2026-08-10 | D | `store-advancement.test.js` (10 tests) landed; full suite **353/353**. |
| 2026-08-10 | E | Plan + changelog + REVIEW-FINDINGS note written. Work left **local** (no commit/push) for owner testing. |
