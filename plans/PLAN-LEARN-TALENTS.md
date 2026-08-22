# Plan: Adding talents per Discipline (learn / fill Talent Option slots)

This plan defines the **Add a talent** flow for the Disciplines tab — today the
edit mode can only change **ranks** of talents that already exist on the
character (`ui/ed-app.js` `_editTalentRank`/`_editSkillRank`, persisted via
`saveAdvancementEdits`). There is no way to *add* a talent. This feature lets a
player fill an open **Talent Option** slot (and acquire newly-offered
**Discipline Talents** on Circle-up) by picking from the discipline's catalog
pools in `rules/disciplines.json`. **Plan only — no implementation yet**, for
owner review; decisions not locked (§5).

- **Owner:** repo owner. **Created:** 2026-08-22. **Status:** draft — goal +
  rulebook rules captured; design questions open.
- **Branch of record:** `dev`.
- **Rule sources:** Earthdawn 4E Player's Guide (talent options pp. 85–87,
  improving pp. 449–454, multi-Discipline pp. 455–459), Earthdawn Companion
  (Warden/Master options pp. 21–22, knacks pp. 75–77). Verified against the
  local `rulebook extracts/` by the rule-agent; ledgered as **Q002** in
  [docs/RULES-FAQ.md](../docs/RULES-FAQ.md) (tier mechanics are Q001 /
  [PLAN-TALENT-TIER-DERIVATION](PLAN-TALENT-TIER-DERIVATION.md)).
- **Reference:** [PLAN-RANK-EDITING.md](PLAN-RANK-EDITING.md) (the existing
  advancement-edit flow this extends), [PLAN-LEARN-SPELLS.md](PLAN-LEARN-SPELLS.md)
  (sibling catalog-pick pattern), [ARCHITECTURE.md](../ARCHITECTURE.md),
  [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md).

---

## 1. What we want to do

In the Disciplines tab's edit mode, let the player **add a talent to one of
their disciplines**:

1. **Fill a Talent Option slot** — pick a talent from that discipline's option
   pools (`rules/disciplines.json` → `disciplines[].talentOptions.novice /
   .journeyman`), subject to the pool/status rules in §2, and record it as a
   character input `{ name, rank: 1, circle: <learned-at> }`.
2. **Learn a new Discipline Talent** offered by a Circle the character just
   attained (and, out of scope unless the owner says otherwise: initiating a
   whole new Discipline).
3. Enforce/advise the **rule constraints** (open slots, eligible pools,
   affordability) with the same guard philosophy as rank editing: increases are
   checked against derived Available Legend before persisting.
4. Keep every stored value an **input**: tier stays derived from the learned
   Circle (`tierForCircle`, PLAN-TALENT-TIER-DERIVATION — never written back);
   the new talent is just another entry in the existing
   `disciplines[].talents[]` array — no shape change.

## 2. The ED4 rules (verified against the rulebook extracts)

### When you get slots
- **One Talent Option per Circle, including First Circle** — "at each Circle,
  an adept can choose one talent from a pool of optional talents, keyed to his
  status level in the Discipline (Novice, Journeyman, Warden, Master)"
  (PG p. 85, `text-RB-players-guide.txt:3945–3947`; one-per-Circle sidebar
  p. 87, `:4027–4040`). ⇒ total option slots per Discipline = its current Circle.
- A slot **may stay empty and be filled later** — stated at character creation
  (PG p. 68, `:3273–3276`) and via the optional *Specific Training for Talent
  Options* rule: learning an option later requires a tutor who knows it, "same
  time and effort as learning a talent via Versatility" (PG p. 454,
  `:18274–18280`).
- On reaching a new Circle the adept "purchase[s] the Discipline Talent and one
  of the Talent Options available at the new Circle" (PG p. 454,
  `:18268–18273`).

### Which pool a pick may come from
- Pools are keyed to **status level**; "Talent Options can be chosen from pools
  of **lower** status … Characters **cannot** fill a talent slot with a talent
  available in a **higher** pool" (PG p. 85, `text-RB-players-guide.txt:3945–3949`).
- PG covers Circles 1–8 (Novice + Journeyman option lists, e.g. Air Sailor
  p. 88, `:4078`, `:4099`); the **Companion** extends to Circles 9–15 with
  Warden/Master option lists per Discipline (Companion pp. 21–22,
  `text-RB-companions-guide.txt:777–782`, e.g. `:803–807`, `:827–829`).
- Multi-Discipline: all option slots of a new Discipline must be chosen from
  *that* Discipline's options (PG p. 456, `:18349–18353`).

### Discipline Talents vs options
- Discipline Talents are "always available at the indicated Circle"; five at
  First Circle, one more each Circle after (PG p. 85, `:3941–3944`). They alone
  gate advancement (all DT ranks ≥ target Circle; options never count —
  PG p. 453, `:18196–18202`).
- New Discipline initiation: learn all unknown First-Circle DTs at Rank 1,
  paid simultaneously (PG p. 456, `:18343–18348`).

### Pricing (already largely built)
- An option's advancement cost keys off **the Circle at which it was learned**
  (PG p. 85) — i.e. the tier band of the recorded `circle`, exactly what
  `engine/legend-spent.js` `tierForCircle` derives since
  PLAN-TALENT-TIER-DERIVATION. Talent Cost Table: PG pp. 449–450
  (`:18057–18135`; max rank 15).
- Additional-Discipline shift (buy Circle 1–4 as if 5–8 for a 2nd Discipline,
  etc.) and the Equivalent Talent Circle Table: PG pp. 457–458
  (`:18397–18409`, `:18449–18459`) — already modeled in the audit.
- An option known through Discipline A keeps A's pricing even if cheaper
  elsewhere; if it later becomes a DT of a new Discipline it reprices there and
  **frees the old option slot** (Mica example, PG p. 458, `:18420–18425`,
  `:18466–18472`).
- Initiation into a new Discipline also costs silver: 100 sp × each Circle held
  elsewhere × each talent learned (PG p. 455, `:18326–18331`).

### Versatility (human racial route — likely out of scope, noted for completeness)
- Out-of-Discipline talents only via training by a member of the granting
  Discipline; Legend cost **+1 tier**; count cap = Versatility rank; talent's
  Circle capped at (and equal to the tutor's known-at Circle of) the adept's
  highest Discipline Circle; **no Karma may ever be spent** on them; own
  Discipline's DTs excluded, its options allowed (PG pp. 68, 86–87;
  `text-talents-players.txt:696–699`; relearn-at-Rank-1 on later
  multi-Disciplining: PG p. 459, `:18495–18509`).

### What does NOT consume an option slot
- **Free Talents** (advance free with Circle; don't qualify toward the next
  Circle — PG p. 86, `:3970–3980`), **two free Spell Matrices** for magicians
  (matrix *options* however are bought normally — PG p. 86, `:3981–3988`),
  the universal **Karma Ritual** (PG p. 83, outside the circle lists),
  and **racial abilities** (human Versatility R0, windling Astral Sight R0 —
  PG pp. 67–68, `text-race-players.txt:26`, `:71`). Free skill points
  (Speak Language ×2, Read/Write ×1) are **skills, not talents** (PG p. 70,
  `:3404–3413`). App corollary: free talents auto-scale with Circle — compute,
  never store (ARCHITECTURE §4.1).
- There is **no general between-Circles talent buying** — new talents enter
  only via creation, Circle-up, Versatility, or new-Discipline initiation
  (+ the optional Specific Training deferral above). No "Study" mechanic exists
  in the extracts; don't invent one.

### Adjacent, probably out of scope
- **Knacks** (Companion pp. 75–77): require the governing talent at a minimum
  *actual* rank, learned **through the Discipline** (Versatility/racial copies
  don't qualify); max knacks per talent = unaugmented rank; cost = Novice
  talent of the required rank; `store-knack.test.js` suggests partial support
  already exists.

## 3. Terminology warning

`talentOptions` is **already taken** in this codebase: `combat.talentOptions`
are *combat option bundles* scoped to a talent (True Shot etc.,
[PLAN-TALENT-COMBAT-OPTIONS.md](PLAN-TALENT-COMBAT-OPTIONS.md)). The catalog
pools in `rules/disciplines.json` use the same key for the *pickable* sense.
Implementation must not conflate the two; prefer a distinct model/UI name for
the pick flow (e.g. `optionSlots`, `learnableTalents`).

## 4. Preliminary tier classification (to confirm during design)

| Area | Tier | Why |
|---|---|---|
| Character data | **Tier 3** | Appends entries to the existing `disciplines[].talents[{name, rank, circle}]` shape (`ed-character/2`) — data within shape, no schema bump. |
| Catalog read (`rules/disciplines.json` pools) | **Tier 3** | Existing file/shape; extending pools (e.g. Warden/Master later) would also be Tier 3 additive. |
| Eligibility/slot derivations (engine, pure) | **Tier 3** | New pure helpers; no DOM, reads structured taxonomy. |
| Add-talent modal / picker UI | **Tier 3** | New edit-mode content honoring UI-GUIDELINES (Escape/Enter, placeholder pills, theme-aware). |

No Tier-1 invariant appears to be touched; nothing here re-decides a locked
surface. Re-run the ed-change-guardrail pre-flight when implementation starts.

## 5. Open questions for the owner

| # | Question |
|---|---|
| Q1 | Scope: Talent Option slots only, or also Circle-up Discipline Talents and/or new-Discipline initiation? |
| Q2 | Slot enforcement: hard-block picks beyond `circle` open slots, or advisory warning? (Rules say one per Circle, deferrable — PG pp. 68, 85, 454.) |
| Q3 | Learned-Circle recording: default the new talent's `circle` to the discipline's current Circle (standard case)? Allow back-dating for deferred fills? |
| Q4 | Include the optional Specific Training gate (tutor required) as flavor/validation, or ignore as GM territory? |
| Q5 | Versatility-learned talents in or out of scope for this pass? |
| Q6 | Picker surface: Disciplines-tab modal (like PLAN-LEARN-SPELLS' Learn modal) vs inline row-add? |
| Q7 | `rules/disciplines.json` only carries Novice/Journeyman pools (Circles 1–8) — restrict the picker accordingly until Warden/Master data lands? |

## 6. Verification (placeholder — finalize with design)

1. Full suite green (`npm test`).
2. Added option prices by its learned-Circle band in `auditLegendSpent`;
   affordability guard blocks unaffordable picks.
3. Save round-trip: added talent persists as `{name, rank, circle}`, reloads
   cleanly under `ed-character/2`, no fabricated tier anywhere.

---

## Log

| Date | Change |
|---|---|
| 2026-08-22 | Plan created (goal + verified rules; FAQ Q002). Design questions Q1–Q7 open; no implementation. |
