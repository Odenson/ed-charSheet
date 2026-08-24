# Plan: Adding talents per Discipline (learn / fill Talent Option slots)

This plan defines the **Add a talent** flow for the Disciplines tab — today the
edit mode can only change **ranks** of talents that already exist on the
character (`ui/ed-app.js` `_editTalentRank`/`_editSkillRank`, persisted via
`saveAdvancementEdits`). There is no way to *add* a talent. This feature lets a
player fill an open **Talent Option** slot (and acquire newly-offered
**Discipline Talents** on Circle-up) by picking from the discipline's catalog
pools in `rules/disciplines.json`. **Plan only — no implementation yet**, for
owner review; decisions not locked (§5).

- **Owner:** repo owner. **Created:** 2026-08-22. **Status:** decisions locked
  (2026-08-23, §5) — ready for the Phase-1 design/implementation spec.
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

## 5. Owner decisions (resolved 2026-08-23)

All design questions are answered; this section is the locked reference for
implementation.

| # | Question | Decision |
|---|---|---|
| Q1 | Scope | **Talent Option slots + Circle-up Discipline Talents.** New-Discipline initiation and Versatility are out (see Q5). Circle-up introduces the first Circle-changing operation: a controlled "train to next Circle" action that grants that Circle's Discipline Talent, bumps the stored `circle`, and opens that Circle's new option slot. |
| Q2 | Slot enforcement | **One optional talent per Circle — hard cap, rules-aligned.** Options are editable, but each Circle carries exactly one option slot; adding a second option to a Circle that already has one is blocked. |
| Q3 | Learned-Circle recording | **Default the current Circle; allow choosing an open earlier Circle.** A deferred fill picks an earlier Circle whose option slot is empty. The recorded `circle` drives the pricing tier, so the choice is explicit. |
| Q4 | Specific Training tutor gate | **Ignore — GM territory.** Not enforced or noted; consistent with the un-enforced Circle-up training requirement. |
| Q5 | Versatility-learned talents | **Out of scope this pass.** Separate acquisition path (+1 tier, count cap, Circle cap, no Karma) — a later pass. |
| Q6 | Picker surface | **Inline "+" per open Circle slot, opening a scoped modal.** In edit mode a Circle group with an open slot shows a "+ add option" affordance; it opens the shared modal picker filtered to that Circle's eligible pool. |
| Q7 | Pool data coverage | **Restrict to available pools (Novice/Journeyman, Circles 1–8); muted "pool data not yet added" note for Warden+ (9–15)** until that data lands (a later Tier-3 data add). |

## 6. Verification (placeholder — finalize with design)

1. Full suite green (`npm test`).
2. Added option prices by its learned-Circle band in `auditLegendSpent`;
   affordability guard blocks unaffordable picks.
3. Save round-trip: added talent persists as `{name, rank, circle}`, reloads
   cleanly under `ed-character/2`, no fabricated tier anywhere.

---

## 7. Phase-1 implementation spec

Locked to the §5 decisions. Two sub-features: **learn a Talent Option** (fill an
open per-Circle slot) and **train to the next Circle** (grant the new Discipline
Talent, bump the stored Circle, open the new slot). Both persist only inputs.

### 7.1 Reuse — nothing new needed here

- **Persistence:** `store.js` `saveAdvancementEdits({ disciplines, skills }, id)`
  replaces the disciplines arrays wholesale (`applyEdits`). Learning an option =
  append `{ name, rank: 1, circle }` to that discipline's `talents`; training a
  Circle = the same append (for the granted DT) plus the discipline's `circle`
  bumped. No new overlay category, no schema change (`ed-character/2`).
- **Pricing:** acquire-at-Rank-1 cost = `talentRankStepCost(t, ordinal,
  lowestCircle, costs, /*toRank*/ 1)` — the existing per-step function with
  `toRank: 1` (0→1). Tier derives from the recorded `circle` (`tierForCircle`).
  Additional-Discipline shift and affordability reuse the current rank-edit path.
- **Advancement facts:** `engine/advancement.js` `circleStatus` already gives
  `attained` / `supported` / `eligible` / `nextRequirement` for the Circle-up gate.

### 7.2 New pure engine helpers (`engine/talent-options.js`, DOM-free, tested)

Terminology (§3): use `optionSlots` / `learnableTalents`, never `talentOptions`.

- `disciplineTalentSet(ref)` → the Set of gating Discipline-Talent names
  (`UNIVERSAL_TALENTS` ∪ `circles[].talents`; free talents excluded). Shared with
  the store's `requiredTalents` logic — factor it out so both agree.
- `optionSlots(ref, characterTalents)` → per-Circle slot state for Circles
  `1..attained`: `[{ circle, filledBy: name|null, open: boolean }]`. A Circle's
  slot is *filled* when a learned talent whose `circle === that Circle` is **not**
  in `disciplineTalentSet` and not free (i.e. it's an option); else *open*.
  Enforces Q2 (one option per Circle) by construction. `openSlots` = the `open`
  entries.
- `circleStatusToTier(circle)` / reuse `tierForCircle` → Novice 1–4, Journeyman
  5–8, Warden 9–12, Master 13–15.
- `learnableTalents(ref, circle, { talentCatalog, knownNames })` → the pickable
  pool for an open slot at `circle`:
  - eligible pools = every pool at **or below** the slot's status tier
    (Q: lower allowed, higher forbidden). Data has `talentOptions.novice` and
    `.journeyman` only.
  - **exclude** any name already in `knownNames` (learned as DT or option) — no
    duplicates.
  - **Warden+ (Circle ≥ 9):** no pool data → return `{ available: false, items: [] }`
    so the UI shows the "pool data not yet added" note (Q7).
- `nextCircleGrant(ref, attained)` → the Discipline Talent(s) newly available at
  `attained + 1` (`circles[circle === attained+1].talents` minus already-known),
  each to be granted at Rank 1 by the train action.

### 7.3 Store wiring (`store.js`)

- Emit per discipline: `optionSlots` (from 7.2) and, for the Combat-tab-style
  gate, the already-present `circleStatus`. Attach `learnable` lazily via a model
  method or compute in the UI from the exposed `ref` + `optionSlots` (prefer a
  pure engine call the UI invokes with the catalog it already holds).
- Continue to expose each talent's `circle` (shipped in v1.19.0).

### 7.4 Events & app handlers (`ui/ed-app.js`) — data up, engine acts

- `ed-learn-talent` `{ discipline, name, circle }`: guard (slot open at `circle`,
  `name` in `learnableTalents`, affordable), then append `{ name, rank: 1, circle }`
  to the overlay's disciplines array and `saveAdvancementEdits`.
- `ed-advance-circle` `{ discipline }`: guard (`circleStatus.eligible`, the DT
  grant affordable), then in the overlay bump that discipline's `circle` to
  `next` and append each `nextCircleGrant` DT at Rank 1; save. The new Circle's
  option slot then renders open for a follow-up `ed-learn-talent`.
- Both mirror `_editTalentRank`'s guard-then-persist shape; both reject
  unaffordable actions like the rank stepper does (never write past Available
  Legend).

### 7.5 UI (`ui/ed-disciplines.js`)

- **Inline "+" per open slot (Q6):** in edit mode, a Circle group whose
  `optionSlots` entry is `open` shows a `+ add option` row in that group's body.
  Click → open the shared **ModalController** picker scoped to that Circle's
  `learnableTalents` (or the muted "pool data not yet added" note for Warden+).
  Selecting dispatches `ed-learn-talent`.
- **Train to next Circle (Q1):** in edit mode, the track's green "ready" next
  pill becomes the trigger — click → an `ed-confirm` modal ("Train to Circle N —
  grants <DT> at Rank 1 for <cost> Legend") → `ed-advance-circle`. Read mode is
  unchanged (colour is just a signal).
- All new controls honour the Tier-1 UI rules: Escape/Enter on the modal,
  placeholder pills for any unpriceable cost, theme-aware, two weights.

### 7.6 Tests (engine-first; no DOM harness exists)

- `optionSlots`: open vs filled per Circle; free/universal talents never consume
  a slot; a second option at a filled Circle is flagged (guard input).
- `learnableTalents`: journeyman slot pulls novice+journeyman; novice slot pulls
  novice only; already-known names excluded; Warden+ returns `available: false`.
- Acquire pricing: `talentRankStepCost(..., 1)` prices Rank-1 by the recorded
  Circle's tier; additional-Discipline shift applies; affordability guard blocks.
- `nextCircleGrant` + advance: correct DT set at `attained+1`; after advance the
  Circle bumps, the DT is present at Rank 1, the new slot is open, and
  `circleStatus.consistent` holds.
- Overlay round-trip: a learned option and an advanced Circle persist as inputs,
  reload under `ed-character/2`, `forSave` clean (no fabricated tier).

### 7.7 Build order

1. `engine/talent-options.js` + tests (7.2, 7.6).
2. Store wiring (7.3).
3. `ed-learn-talent` handler + inline "+" + scoped modal (7.4–7.5, learn only).
4. `ed-advance-circle` handler + track trigger + confirm modal (Circle-up).
5. Verification (§6), changelog, release.

### 7.8 Guardrail

Tier-3 throughout (data within the `ed-character/2` shape, new pure engine, new
edit-mode UI honouring Tier-1). The stored `circle` change is still an input, not
a schema change. Re-run the **ed-change-guardrail** pre-flight before step 2.

---

## Log

| Date | Change |
|---|---|
| 2026-08-22 | Plan created (goal + verified rules; FAQ Q002). Design questions Q1–Q7 open; no implementation. |
| 2026-08-23 | Owner answered Q1–Q7 (§5). Scope: option slots + Circle-up DTs; one option/Circle hard cap; default-current/allow-earlier learned Circle; tutor gate ignored; Versatility out; inline "+" per open slot → scoped modal; restrict to Novice/Journeyman pools with a Warden+ note. Decisions locked; still plan-only. |
| 2026-08-23 | Added §7 Phase-1 implementation spec (reuse of overlay + `talentRankStepCost(...,1)` pricing; new `engine/talent-options.js` helpers `optionSlots`/`learnableTalents`/`nextCircleGrant`; `ed-learn-talent` + `ed-advance-circle` handlers; inline "+" + scoped modal + track train-trigger; engine-first test list; build order). Plan-only; no implementation. |
