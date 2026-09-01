# Plan: Adding a knack to a character (learn a new Knack)

This plan defines the **Add a knack** flow — letting a player learn a knack from the catalog
`rules/knacks.json` (145 catalogued), gated by the Companion's knack-acquisition rules, and
recorded as a character input `{ name, via? }` under `character.knacks`. Today knacks are
**read-only**: they render nested under their governing parent (talent or skill) and can only
be hand-authored in the JSON files. There is no acquire path, no dispatch, and no persistence
wiring for knacks (unlike talents/skills). **Plan only — no implementation yet**, for owner
review; decisions locked (§5).

- **Owner:** repo owner. **Created:** 2026-08-28. **Status:** draft, decisions captured (§5) — ready for implementation spec (§7).
- **Branch of record:** `dev`.
- **Rule sources:** Earthdawn 4E Companion — "Learning Talent Knacks" (pp. 75–78) — verified
  against the local `rulebook extracts/` (`text-RB-companions-guide.txt:2753–2832`) by the
  rule-agent; ledger entry **Q002** in [docs/RULES-FAQ.md](../docs/RULES-FAQ.md). Legend cost
  = "a Novice talent of the required Rank" (Companion p. 76, PG Talent Cost Table p. 450),
  modelled by `engine/legend-spent.js` `knackCost`.
- **Reference:** [PLAN-LEARN-SKILLS.md](PLAN-LEARN-SKILLS.md) (the close sibling this extends —
  catalog-pick + editable silver fee + guard-then-persist), [PLAN-LEARN-TALENTS.md](PLAN-LEARN-TALENTS.md),
  [PLAN-ANTICIPATE-SPELL.md](PLAN-ANTICIPATE-SPELL.md) (extends `resolveKnack` shape),
  [ARCHITECTURE.md](../ARCHITECTURE.md), [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md).

---

## 1. What we want to do

In the Disciplines tab's edit mode, let the player **add a knack they are eligible to learn**:

1. Pick any knack from `rules/knacks.json` the character **qualifies for**: the governing
   **parent talent** is known **through a Discipline** at the knack's **required actual rank**,
   and the character is **under the max** knacks-per-parent. Record it as `{ name, via? }`.
   (Every catalogued knack is governed by a **talent**; there are no skill-only knack parents —
   see §2 and §3, so v1 gates on Discipline-taught talents alone.)
2. Pay the **Legend cost** = a **Novice talent at the knack's required Rank**
   (`knackCost(requiredRank, costs.talentRank)`), checked against Available Legend with the
   same guard philosophy as rank editing (`_canAffordRank`).
3. Pay an **editable silver training fee** seeded from a new `rules/legend.json`
   `costs.knackTraining[rank]` table (rulebook: Rank days of training at ~50 sp/day →
   fee = `requiredRank × 50 sp`), paid from the purse across any coin denomination via
   `payFromPurse`, refused if the purse cannot cover it — mirrors the skill/circle-training UX.
4. Persist only **inputs** (the new knacks array entry + optional wealth change) via the
   existing advancement overlay — no shape change (`ed-character/2` stays
   `knacks: [{ name, via? }]`).
5. Log the outcome to the standard device-local Log (`logSystem`), same as Skill/Circle.
6. Unparseable catalog `restrictions` (e.g. `"Wizard"`, `"STR 14, Dwarf"`, `"Melee Weapons Rank 5"`)
   are shown as a **ⓘ note** on each candidate — **not enforced** (GM territory), consistent
   with how the skill/circle flows surface training time.

**Scope line:** v1 is the **parent-talent knack form only** — a one-time, non-improved knack
("knacks are not improved"; Companion p. 75). The separate **"Knack as Skill"** economy
(Skill Use: Yes → a ranked skill at Skill Training Table cost; Companion p. 76) is **out of
scope** for v1 and flagged as a follow-up (§8).

## 2. The ED4 rules (verified against the rulebook extracts)

- **Not improved:** "Unlike talents, knacks are **not improved**. Once learned, a knack may be
  used whenever appropriate, and usually uses the associated talent for any required tests."
  (`text-RB-companions-guide.txt:2757–2760`) → a knack has **no advancement ranks**; recorded
  once, `{name, via?}`.
- **Governing parent + minimum rank:** each knack "specifies a Talent and a Rank"; only the
  **actual (unaugmented) talent rank** matters — thread/magical bonuses don't count
  (`:2770–2775`) → gate on the **stored raw rank**, never `effectiveRank` incl. grant bonuses.
- **Discipline-taught talents only:** "Adepts may only learn knacks for talents they know
  through their Discipline. Talents learned through Versatility … may not be used to qualify
  for a knack." (`:2776–2780`) → the parent must be in `character.disciplines[].talents[]`
  (exactly the set `deriveModel` already builds into `talentNames`, store.js:1142-1144).
- **Requirements + restrictions:** "The adept must meet all requirements and one restriction
  (if the knack has restrictions) … Skills cannot meet requirements, only talents and knacks /
  Skills cannot meet restrictions." (`:2818–2823`) → the requirement is the **parent-talent gate**;
  a **skill never stands in** for the governing talent. Confirmed against the catalog: **every one
  of the 65 distinct knack parents is a talent name — zero are skill-only** (§3). 35 parents happen
  to share a name with a same-named skill (e.g. Unarmed Combat, Stealthy Stride), but the governing
  ability is the **talent** — owning only the skill does **not** qualify (it would violate the
  Discipline-talent rule above). So v1 gates on Discipline-taught talents only; there is no
  `parentSkills` path. `restrictions` are prose → **shown as a note, not enforced** (decision §5-Q2).
- **Cap per talent:** "You can have a number of knacks for each talent equal to your
  **unaugmented rank** in the talent." (`:2793–2794`) → max knacks-per-parent = parent raw rank.
- **Legend cost:** "Knacks cost the same as a **Novice talent of the required Rank**" (PG
  Talent Cost Table p. 450, `:2816–2817`) → `knackCost(requiredRank, costs.talentRank)`.
- **Training time & fee:** "four hours a day … Training lasts for a number of days equal to the
  Rank requirement and the adept can only learn one knack at a time. Mentors typically charge
  50 sp a day." (`:2795–2801`) → v1 tracks only the **silver fee** as a data-driven, editable
  default (`requiredRank × 50 sp`); time/finding a mentor is GM territory (note, not enforced).
- **Timing:** knacks "can be learned at any time" (`:2765–2769`) → the add flow is always
  available in edit mode; **no Circle option-slot gating** (unlike Talent Options).
- **Multi-parent:** a knack "always uses the talent it was learned through" when learnable via
  multiple talents (`:2814–2815`) → the stored `via` records which parent (decision §5-Q5).
- **One knack per use:** "You can use one knack per use of a talent." (`:2792`) — a *use-time*
  rule, not an acquisition constraint → out of scope (v1 is acquisition only).

## 3. Current state — why this needs wiring (verified against code)

- **Knacks are read-only today.** `deriveModel` resolves owned knacks
  (`store.js:1145`, `resolveKnack` store.js:80-123) and `ui/ed-disciplines.js` renders them
  nested under their governing parent (`_knackRow` :464-478, `_skillsView` :416-443, talent
  grouping :959-965, modal :483-505). No `ed-learn-knack`, no `saveKnackEdits`.
- **Character storage:** top-level `knacks: [{ "name": "Anticipate Spell" }, …]` — plain
  objects; `via` selects the parent for multi-parent knacks (`resolveKnack` store.js:91-94).
  Legacy `"Knack (Parent)"` string form is parsed transitionally (store.js:96-100).
- **Gate inputs already on the model:** `character.disciplines[].talents[]` gives the
  Discipline-taught parental set + raw rank; `character.skills[]` gives skill parents + rank;
  `character.knacks[]` gives owned knacks for the per-parent cap. All derivable, none stored.
- **Cost engine already present:** `engine/legend-spent.js` `knackCost(requiredRank, rankTable)`
  (:134-137) prices a knack as a Novice talent at the required rank; the Legend audit already
  prices owned knacks via it, so `_canAffordRank(nextCharacter)` works once the knack is added.
- **Persistence gap:** knacks are **not** in the edits overlay. `saveAdvancementEdits`
  (store.js:395) writes only `{disciplines, skills}` into `edits.advancements`; `SAVED_CATEGORIES`
  (store.js:464) has no knacks slot. But `forSave(this._character)` spreads the whole character,
  so a knack would already ride along on a GitHub save — the gap is only the *local draft* +
  dirty-dot + reload-replay. **Fix:** carry `knacks` inside the existing `advancements` overlay
  slot (§7.3) — no new `SAVED_CATEGORY`, no `reconcileOverlay` change, dirty dot works.
- **All 65 knack parents are talents; 5 parent NAMES don't match any talent-catalog key.**
  Cross-referencing every `parents[]` entry against `rules/talents.json`: **65 distinct parents —
  60 resolve to a `talents.json` key, 5 are orphan shorthand**, and **zero skill-only** (so no
  `parentSkills` gate — §2). 35 of the 60 resolvable parents happen to share a name with a
  same-named skill (e.g. Unarmed Combat, Stealthy Stride), but the governing ability is the
  **talent** — owning only the skill does **not** qualify (it would violate the Discipline-talent
  rule above). BUT five parent names are **colloquial shorthand** that don't match the catalog's
  `Thread Weaving (<Discipline>)` naming — so they resolve to no key **as written**. All five have
  an **existing** target talent (none are missing; the earlier "absent from `talents.json`" note was
  wrong — the target keys are present, just under the `Thread Weaving (…)` convention):

  | Orphan parent (knacks.json) | Real talent key (talents.json) | Confidence |
  |---|---|---|
  | `Thief Weaving` | `Thread Weaving (Thief)` | high (mechanical) |
  | `Scout Weaving` | `Thread Weaving (Scout)` | high (mechanical) |
  | `Thread Smithing` | `Thread Weaving (Weaponsmith)` | high (Weaponsmith's weaving talent) |
  | `Nethermancy` | `Thread Weaving (Nethermancer)` | high |
  | `Elementalism` | `Thread Weaving (Elementalist)` | high |

  **7 knacks** reference these. They split two ways:
  - **Fully orphaned** (no valid parent — invisible in the picker until fixed): **Craft Poison** (5),
    **Create Orichalcum** (10), **Detect Spirit** (5), **Detect True Element** (4),
    **Harvest True Element** (5).
  - **Partially orphaned** (already learnable via a valid alternate parent `Patterncraft`; the fix
    only restores the second weaving path): **Design Enchanting Pattern** (8), **Handle Elements** (5).

  Pre-existing data, surfaced (not caused) by this feature. The only non-mechanical question is
  whether the magic knacks are governed by **Thread Weaving** vs **Spellcasting** — the `X Weaving`
  naming says Thread Weaving with high confidence; a one-line rule-agent check confirms it before the
  rename (§7.1a).
- **Skills-tab knack display REMOVED (owner decision 2026-08-30).** `resolveKnack` still tags a
  parent `'skill'` when the character owns a same-named **skill** but not the talent, but
  `_skillsView` no longer renders knacks — knacks display ONLY beneath their governing talent on the
  discipline tables (talent-governed display, matching the talent-only acquire gate). A pre-existing
  hand-authored knack whose character owns only the skill therefore no longer appears on the Skills
  tab; a character who owns the governing TALENT still sees it under that talent. `_knackModal`'s
  defensive "Skill:" parent label is retained.

## 4. Guardrail classification (ed-change-guardrail)

| Area | Tier | Why |
|---|---|---|
| Character data (`character.knacks` new entry) | **Tier 3** | Appends `{name, via?}` — an input within the existing `ed-character/2` shape; no field rename or schema change. `forSave` (whole-object spread) already passes it through. |
| `rules/knacks.json` | **Tier 3** | Parent-name normalisation only (§7.1a) — value edits within the existing entry shape (no field rename, no schema-tag bump); the picker otherwise reads entries unchanged. |
| `rules/legend.json` `costs.knackTraining` | **Tier 3** | Additive data within the existing `ed-legend/1` `costs` shape (`{"1":50,"2":100,…,"15":750}`), same role as `skillTraining`/`circleTraining`; no schema-tag bump. |
| New pure engine `knack-options.js` | **Tier 3** | New pure helper; no DOM; reads structured catalog + costs; no taxonomy read. |
| Store wiring (model.knackOptions, overlay advance) | **Tier 3** | Data-down/dispatch-up intact; store persists only inputs. |
| Add-knack picker UI | **Tier 3** | New edit-mode content honouring UI-GUIDELINES (Escape/Enter, placeholder pills, theme-aware, two weights). |

No Tier-1 invariant is touched; nothing re-decides a locked surface. Re-run the
**ed-change-guardrail** pre-flight when implementation starts.

## 5. Owner decisions (resolved 2026-08-28)

| # | Question | Decision |
|---|---|---|
| Q1 | Add affordance placement | **Per-discipline footer, scoped picker.** A "＋ add knack" control renders under each discipline's talent card in edit mode, opening a picker scoped to that discipline's knacks (knacks whose governing parent talent belongs to the current discipline — pure `scopeKnackOptions` filter, §7.5). No per-parent inline affordance; the global Skills-tab slot is removed. |
| Q2 | Gating scope | **Enforce the hard rules; note the prose.** Enforce in the pure engine: parent known as a **Discipline-taught talent** (talent parents only — no skill path; see §2/§3), parent **actual** rank ≥ `requiredRank`, knacks-per-parent < parent rank (the cap), Legend affordability, and silver fee. Show each candidate's `restrictions` (e.g. `"Wizard"`, `"STR 14, Dwarf"`) as a ⓘ note — **not enforced** (GM territory). No fragile prose-parser. |

> **Update (PLAN-KNACK-RESTRICTIONS):** the prose `restrictions` are now structured objects
> (`rules/knacks.json` `ed-knacks/2`; docs/RESTRICTION-TAXONOMY.md v1), and the engine **enforces the
> `discipline` type** (a Spellcasting knack restricted to a discipline only appears for a character who
> owns that discipline, at the required circle). The former "not enforced / ⓘ note" decision is superseded
> for `discipline`; `attribute`/`race`/`ability`/`note` restrictions remain ⓘ notes the GM adjudicates.
| Q3 | Silver training fee | **Data-driven fee, editable.** New `rules/legend.json` `costs.knackTraining[rank]` table (`fee = requiredRank × 50 sp` per the rulebook), seeded as an editable default in the confirm modal and paid from the purse via `payFromPurse` — mirroring `circleTraining`/`skillTraining` (data, not code). |
| Q4 | Knack-as-skill scope | **Parent-talent knack form only in v1.** One-time, non-improved knack at `knackCost`. The "Knack as Skill" economy (ranked skill, Skill Training Table) is a separate follow-up feature (§8), not in v1. |
| Q5 | Multi-parent `via` | **Let the user pick a qualifying parent in the picker.** When a multi-parent knack qualifies via more than one parent, the picker lets the user choose which parent it is learned under, storing that choice in `via` (the existing field). Single-parent or single-qualifying knacks need no extra step. |
| Q6 | Off-catalog / free-text knacks | **Picker-only (implicit).** Only the 145 catalog knacks are offered; the UI does not expose a free-text name field (consistent with skill Q3). Unknown hand-edited names still degrade gracefully (rendered as `known:false`, no fabrication). |

## 6. Verification (to finalize with implementation)

1. Full suite green (`npm test`) — including new engine + store + log tests (§7.6).
2. `learnableKnacks` excludes: already-known knacks; knacks whose parent `rank < requiredRank`;
   knacks whose parent isn't a **Discipline-taught talent** (owning a same-named skill does **not**
   qualify — talent-only gate); knacks over the per-parent cap (the character already holds
   `parentRank` knacks under that parent).
2a. After the §7.1a parent-name normalisation, the **7 affected knacks resolve to a real talent**
   and surface for a character who owns that talent at rank ≥ `requiredRank`. Split: **5 fully
   orphaned** (Craft Poison, Create Orichalcum, Detect Spirit, Detect True Element, Harvest True
   Element — invisible before the fix) gain their only parent; **2 partially orphaned** (Design
   Enchanting Pattern, Handle Elements — already learnable via `Patterncraft`) restore their second
   weaving parent. A regression check asserts **every** knack parent name maps to a `talents.json`
   key (no orphans remain).
3. Legend cost = `knackCost(requiredRank, costs.talentRank)` exactly (e.g. requiredRank 5 →
   800 Legend Novice); affordability guard (`_canAffordRank`) blocks an unaffordable pick.
4. Silver fee: default `costs.knackTraining[rank]` (e.g. requiredRank 5 → 250 sp) — derived
   from `rules/legend.json`, editable, `payFromPurse` refuses when purse total < fee, persisted
   wealth round-trips, Log shows per-coin delta. Retuning = a data-file edit, not code.
5. Multi-parent knack that qualifies via >1 parent offers the choice and persists `via`; the
   re-derived row nests under the selected parent.
6. Overlay round-trip: a learned knack persists as `{name, via?}` under `ed-character/2`,
   `forSave` clean, dirty dot lights, GitHub save carries it, reload replays it. **Drop/wipe
   guards:** (a) learn a knack, then bump a talent/skill rank via the rank path (which calls
   `saveAdvancementEdits` without knacks) — the staged knack **remains** in the overlay (not
   dropped); (b) a disciplines-only overlay (no `knacks` in the slot) replays onto a character
   that owns knacks — the character's knacks are **preserved** (not wiped).
7. UI: picker modal honours Escape/backdrop/✕ close, Enter confirms (autofocus primary),
   placeholder pills for unpriceable cases, theme-aware, two weights; read mode unchanged.
8. No Tier-1 regression (ARCHITECTURE §3/§5.5, docs/UI-GUIDELINES).

---

## 7. Phase-1 implementation spec

Locked to the §5 decisions. One sub-feature: **add a parent-talent knack**. It reuses the
existing advance-edit / wealth-edit / log / `_canAffordRank` plumbing and the skill-learn
picker+fee UX; the only new moving parts are the learnable-set derivation and the picker.

### 7.1 Data — one new table (data, not code)

- **`rules/legend.json`** — add `costs.knackTraining[rank]` = `rank × 50` for `rank 1..15`
  (`{"1":50,"2":100,"3":150,…,"15":750}`), the rulebook's "Rank days × 50 sp/day" average,
  negotiable default — same shape/role as `skillTraining` (an average, seeded as an editable
  default in the modal; only silver is tracked). Update the `costs` document note to describe
  it. **Schema tag `ed-legend/1` unchanged** — additive within the shape.
- **`rules/knacks.json`** — no change to entry *shape*; but see §7.1a (parent-name normalisation)
  — a prerequisite data fix, not a schema change.

### 7.1a Prerequisite data fix — normalise orphan knack parents (§3)

Five parent names are colloquial shorthand (`X Weaving`, `Nethermancy`/`Elementalism`) that don't
match the catalog's `Thread Weaving (<Discipline>)` naming, so they resolve to no `talents.json`
key **as written**. **Every target talent already exists** — this is a pure rename, not a
talent-authoring task. Fix the **data** (Tier 3 — value edits within the existing knacks shape, no
field rename, no schema bump) using the **mapping table in §3** (the single authority): each of the
5 shorthand names → its `Thread Weaving (…)` key in the affected `parents[]` arrays — Craft Poison
(5), Create Orichalcum (10), Detect Spirit (5), Detect True Element (4), Harvest True Element (5)
gain their only parent; Design Enchanting Pattern (8) and Handle Elements (5) restore their second
weaving parent. Preserve the other, already-valid parents in each array.

- **One rule-agent check before the rename** (single yes/no, not open-ended): confirm the two magic
  knacks (`Nethermancy`/`Elementalism` group) are governed by the discipline's **Thread Weaving**
  talent, not **Spellcasting**. High-confidence per §3; if it comes back Spellcasting, retarget
  `Nethermancy`/`Elementalism` to `Spellcasting` — same mechanical rename, different key.
- Add a **guard test** (§7.6): every `knacks.json` parent name is a key in `talents.json`, so a
  future catalog edit can never reintroduce an orphan (and an unlearnable knack).

Fix the **data**, not an engine alias map (code normalisation would hide the mismatch and drift
from the catalog). If the owner prefers an alias layer, it belongs in the data
(a `parentAliases` block in `knacks.json`), not the engine.

### 7.2 New pure engine helper (`engine/knack-options.js`, DOM-free, tested)

Single-file sibling to `engine/skill-options.js`.

- `learnableKnacks(knackCatalog, { ownedKnacks, parentTalents }, costs)` →
  candidate list for the picker. Inputs are the already-loaded catalog, the owned knacks, and a
  map of **Discipline-taught talent** parents → `{ rank }` (raw actual rank), plus
  `rules/legend.json` costs for pricing + fee preview. **No `parentSkills`** — every knack parent
  is a talent (§2/§3); owning a same-named skill never qualifies. Each candidate:
  ```js
  {
    name,
    brief,                      // presentation.shortEffect ?? summary (or null)
    summary,                    // full catalog description (the bonuses text) — for the info icon
    action, strain,             // structured mechanics (shown in the info preview when present)
    restriction,                // the structured restrictions object (see PLAN-KNACK-RESTRICTIONS / RESTRICTION-TAXONOMY v1)
    requiredRank,
    qualifies: [ { name, rank } ],  // qualifying talent parents (≥1)
    viaDefault,                 // first qualifying parent (for single-qualifying)
    cost,                       // knackCost(requiredRank, costs.talentRank) — null → placeholder
    trainingFee,                // costs.knackTraining[requiredRank] — null → placeholder
  }
  ```
- **Gating (all pure, all in the engine):**
  - skip if the knack is already owned (by name);
  - a parent **qualifies** iff the character owns the **Discipline-taught talent** of that name at
    **actual rank ≥ `requiredRank`**; rank is `null` when unknown. Parents come **only** from
    `parentTalents` (the caller passes `character.disciplines[].talents[]` ranks, never
    Versatility/other, never skills);
  - the **per-parent cap**: skip a knack unless at least one qualifying parent has
    `owned-count-under(parent) < parent.rank` (count = owned knacks whose parent name matches);
    the candidate's `qualifies` omits over-cap parents, and with none left it drops.
  - multi-parent: `qualifies` may hold several talents; the picker lets the user pick one (§7.5).
- Sorting: by governing parent that qualifies (alphabetical), then knack name; the order only
  affects display. No slot/circle concept — "learn at any time".
- The numeric fee comes from `costs.knackTraining`, **never `rank * 50` in code**.

### 7.3 Store wiring (`store.js`)

- Import `learnableKnacks` from `engine/knack-options.js`.
- In `deriveModel`, after the knacks resolution (store.js:1145 — where `talentNames` and the owned
  knacks are already in hand), build a `parentTalents` rank map from
  `character.disciplines[].talents[]` (raw `.rank`; Discipline-taught only), then attach derived
  `model.knackOptions = learnableKnacks(knackCatalog, { ownedKnacks: character.knacks ?? [], parentTalents }, legendFile?.costs)`.
  Always derived, never stored. No `parentSkills` map (talent-only gate — §2/§3).
- **Persistence — carry knacks in the existing `advancements` overlay slot** (no new category).
  ⚠️ **Overlay-merge hazard (must be handled, not glossed):** `saveAdvancementEdits` rebuilds the
  `advancements` slot **wholesale** (`edits.advancements = { disciplines, skills }`, store.js:397)
  and `applyEdits` replaces `disciplines`/`skills` unconditionally (store.js:538). A naive knacks
  append would break both ways — **drop** (learn a knack, then bump a rank: the rank path calls
  `saveAdvancementEdits` without knacks, rebuilds the object, and the staged knack vanishes) and
  **wipe** (an unguarded `next.knacks = advancements.knacks` with an undefined `knacks` clears the
  character's knacks on replay). Specify the two guards explicitly:
  - Extend `saveAdvancementEdits({ disciplines, skills, knacks }, id)` (store.js:395) to
    **preserve** an already-staged `knacks` when the caller omits it:
    `edits.advancements = { ...edits.advancements, disciplines, skills, ...(knacks !== undefined ? { knacks } : {}) }`.
    The `...edits.advancements` spread keeps any prior `knacks`; the conditional spread writes the
    new value only when provided, so a rank-bump never drops a staged knack (existing callers that
    omit `knacks` are unchanged and backward compatible).
  - In `applyEdits`, the `edits.advancements` block (store.js:525) merges knacks **guarded**:
    `if (advancements.knacks) next = { ...next, knacks: advancements.knacks }` — so a
    disciplines-only overlay (no `knacks` in the slot) never wipes the character's knacks. Knacks
    are `{name, via?}` pure inputs — no stripping, unlike talent `tier`.
  - `SAVED_CATEGORIES`, `reconcileOverlay`, `hasPendingEdits` are **unchanged** — knacks ride
    `advancements`, so the dirty dot and save/reconcile already cover them.
- `forSave(this._character)` needs no change (whole-object spread carries `knacks`).

### 7.4 Events & app handler (`ui/ed-app.js`) — data up, engine acts

- New event **`ed-learn-knack`** `{ name, via? }`:
  - guard — character loaded; `name` non-empty; `name` not already in `character.knacks`;
    the knack exists in `rules/knacks.json`; if `via` is given it must be a qualifying parent
    (re-derive via `learnableKnacks` to confirm eligibility — engine remains the gate);
  - build `nextCharacter = { ...character, knacks: [...(character.knacks ?? []), via ? { name, via } : { name }] }`;
  - pay the editable silver fee via `payFromPurse` (refuse if `!spent.ok`), computing the
    default from `costs.knackTraining[requiredRank]` and allowing a user override (same UX as
    skill/circle);
  - then `_canAffordRank(nextCharacter)` guard (the Legend audit prices the added knack via
    `knackCost`), then `saveAdvancementEdits({ disciplines, skills, knacks })` + `saveWealthEdits`
    (fee > 0), `_markDirty()`, `this._model = this._derive()`, and `logKnackLearned(...)`.
- Both guards reuse `_learnSkill`'s shape (ed-app.js:1206-1248) and `_learnTalent`'s
  guard-then-persist; both reject unaffordable actions like the rank stepper.

### 7.5 UI (`ui/ed-disciplines.js`)

- **"＋ add knack" affordance:** a **per-discipline footer** under each discipline's talent card
  (a `_addKnackSlot(d)` button, same placement/style as `_addOptionSlot`), visible in edit mode
  whenever that discipline has ≥1 candidate. The picker it opens is **scoped to the knacks whose
  governing parent talent belongs to that discipline** via the pure `scopeKnackOptions` helper
  (engine/knack-options.js — same `qualifies` gate, filtered by the discipline's talent names in
  the view). The old global "＋ add knack" slot on the Skills tab card is removed: every knack is
  talent-governed (§2/§3), so its entry point lives with the governing talent's discipline.
- **Picker modal (`_learnKnackModal`)** — modeled on `_learnSkillModal` (ed-disciplines.js:876-931):
  - header "Learn a knack"; a muted ⓘ line: "A knack is learned at the governing talent's rank,
    costs Legend = a Novice talent of that rank, and takes Rank days of training (~50 sp/day).
    Time/finding a mentor is the GM's call; only Legend and silver are tracked here. Restrictions
    are listed but the GM adjudicates them."
  - search input (name / parent / brief);
  - editable silver fee row seeded from `costs.knackTraining[requiredRank]`, `✓/✕` vs purse
    via `payFromPurse` (mirrors the skill fee row, ed-disciplines.js:899-906);
  - candidate rows: an **info icon (i)** per row that expands the knack's full catalog `summary`
    inline beneath the row (the bonuses you get) plus its action/strain when present; name, governing
    parent talent(s) (`Talent: X · Rank N`), a small pill for `requiredRank`, the `restrictions` as
    a muted ⓘ subline, and `N Legend · M sp` price (placeholder `—` when unpriceable). Rows are
    disabled when Legend or silver unaffordable (with a tooltip reason, like skill rows);
  - for a candidate that qualifies via **more than one** talent parent, show a chooser (a small
    `<select>` or inline parent buttons) seeded to `viaDefault`; the chosen parent is sent as
    `via` on pick;
  - first option autofocused; Escape/backdrop/✕ close via the shared `_modalCtl`; Enter confirms;
    focus returns to the trigger on close.
- All new controls honour the Tier-1 UI rules.

### 7.6 Tests (engine-first; no DOM harness exists)

- `engine/knack-options.test.js`: `learnableKnacks` —
  excludes already-known knacks; requires a **Discipline-taught talent** parent (owning a
  same-named **skill** does **not** qualify — a dedicated case asserts this); gates on actual rank
  (`rank < requiredRank` dropped); caps at `parentRank` knacks per parent (the `parentRank+1`-th
  drops / that parent stops qualifying); multi-parent knacks list all qualifying talent parents and
  set `viaDefault` to the first; `cost`/`trainingFee` null → placeholder when a table row is missing
  (never fabricated); talent rank map built from raw (unaugmented) ranks.
- **Catalog-integrity guard (§7.1a):** a test asserting **every** `knacks.json` parent name is a
  key in `talents.json` — fails loudly if a future edit reintroduces an orphan (unlearnable knack).
- Store: `model.knackOptions` present, excludes owned knacks and ineligible parents; pricing
  preview null when the cost table is missing.
- App handler: `_learnKnack` blocked when duplicate, unknown name, ineligible parent, over-cap,
  unaffordable Legend, or unaffordable silver; when allowed it persists `{name, via?}`, pays the
  purse, and the re-derived `legend.spent.total` rises by exactly `knackCost`; multi-parent via
  round-trips.
- Log: `logKnackLearned` renders with `legendCost`, `silverFee`, `coinDelta`, `purseBefore/After`.
- Overlay round-trip: learned knack persists as `{name, via?}` under `ed-character/2`,
  `forSave` clean, reload replays via the `advancements.knacks` overlay merge. **Guard tests:**
  (a) a subsequent rank-path `saveAdvancementEdits({disciplines, skills})` (no knacks) preserves
  the staged knack (the `...edits.advancements` + conditional-spread keeps it); (b) an
  `applyEdits` run on a disciplines-only overlay (no `advancements.knacks`) leaves an owning
  character's `knacks` intact (the `if (advancements.knacks)` guard).

### 7.7 Build order

1. **`rules/knacks.json` parent-name normalisation (§7.1a)** — rename the 5 orphan parents to the
   existing `Thread Weaving (<Discipline>)` talent keys per the §7.1a table (all targets exist — a
   pure rename; one yes/no rule-agent check that the magic knacks are Thread-Weaving- not
   Spellcasting-governed). Add the catalog-integrity guard test. Prerequisite: without it, 5 knacks
   never surface and 2 are missing a parent.
2. `rules/legend.json` — add `costs.knackTraining` table + update the `costs` note (7.1; data,
   not code; no schema-tag bump).
3. `engine/knack-options.js` + tests (7.2, 7.6 engine) — reads the new table for the fee preview.
4. `store-log.js` `logKnackLearned` (sibling to `logSkillLearned`, store-log.js:106) + store
   wiring for `model.knackOptions` + `saveAdvancementEdits`/`applyEdits` knacks passthrough (7.3).
5. `ui/ed-app.js` `ed-learn-knack` handler (7.4) — fee default from `costs.knackTraining`.
6. `ui/ed-disciplines.js` "＋ add knack" + picker modal (7.5) — seeds from the same table.
7. Store/app/log tests + full suite green (7.6), changelog `unreleased` entry, release.

### 7.8 Guardrail

Tier-3 throughout (data within the `ed-character/2` / `ed-legend/1` shapes, new pure engine,
new edit-mode UI honouring Tier-1, one new additive data table). The stored `knacks` entry is a
pure input (`{name, via?}`); no derived value is stored. Re-run the **ed-change-guardrail**
pre-flight before step 1.

## 8. Out of scope (v1, follow-up candidates)

- **Knack-as-skill** economy (Skill Use: Yes → a ranked skill at Skill Training Table cost).
- **Enforcement of prose `restrictions`** (Discipline / attribute-minimum / race) — note only.
- **Training-time / tutor / one-at-a-time** enforcement — GM territory (silver tracked only).
- **One-knack-per-use** runtime rule — a *use-time* constraint, not acquisition.
- **Off-catalog / free-text knacks** — picker-only.

---

## Log

| Date | Change |
|---|---|
| 2026-08-28 | Plan created (goal + verified Companion knack-acquisition rules; Q1–Q6 resolved by owner; no implementation). |
| 2026-08-28 | Revised per owner: a **skill-governed knack surfaces only when the character owns the parent skill at `rank ≥ requiredRank`** — the parent skill stands in as the knack's governing ability (a skill does not satisfy another *talent's* requirement, but a skill-governed knack's own governing parent is the skill). Updated §1, §2, §5-Q2, §6, §7.2, §7.6. |
| 2026-08-28 | Corrected a **persistence-gap bug in §7.3**: the wholesale `edits.advancements = { disciplines, skills }` replace (store.js:397) + unconditional merge (store.js:538) would **drop** a staged knack on a later rank-path save and **wipe** knacks on a disciplines-only replay. Spec'ed the two required guards — `saveAdvancementEdits` preserves a prior `knacks` via spread + conditional (`...edits.advancements, disciplines, skills, ...(knacks !== undefined ? { knacks } : {})`), and `applyEdits` merges guarded (`if (advancements.knacks)`). §6-6 and §7.6 updated with drop/wipe guard tests. |
| 2026-08-28 | **Reverted the skill-governed-knack gate (finding #2).** Catalog audit: all 60 knack parents are talents, **zero skill-only**; 35 merely share a name with a skill, but the governing ability is the talent (owning only the skill would violate the Discipline-talent rule). Removed `parentSkills` from §1/§2/§5-Q2/§6.2/§7.2/§7.3/§7.5/§7.6 — v1 gates on Discipline-taught talents only, resolving the prior Q4 contradiction. |
| 2026-08-28 | **Added parent-name normalisation (finding #3, new §7.1a + build step 1).** 5 knack parent names (`Thief Weaving`, `Scout Weaving`, `Thread Smithing`, `Nethermancy`, `Elementalism`) are colloquial shorthand that don't match the catalog's `Thread Weaving (<Discipline>)` naming, leaving 7 knacks unlearnable under the exact-name gate. Spec'ed a data fix + catalog-integrity guard test. |
| 2026-08-28 | **Corrected #3 with the concrete mapping table (§3/§7.1a).** All 5 orphan parents map to **existing** `Thread Weaving (Thief/Scout/Weaponsmith/Nethermancer/Elementalist)` talents — none are missing (the earlier "absent from talents.json" note was wrong). Downgraded to a pure rename + one yes/no rule-agent check (Thread Weaving vs Spellcasting for the magic knacks). Added the fully- vs partially-orphaned split (5 invisible, 2 missing a second parent via Patterncraft). |
| 2026-08-28 | Review round (owner reverted to talent-only knacks): audited the catalog — **65 distinct parents, 60 resolvable + 5 orphans, zero skill-only**, 35 share a skill name. Corrected the §3 count from "60 distinct talent parents" to the accurate 65/60/5 breakdown; confirmed the orphan mapping targets all exist (`Thread Weaving (Thief/Scout/Nethermancer/Elementalist/Weaponsmith)`), no character data references the old orphan parent names in `via`, and added a **known display-nuance note** (the read path can still route a skill-but-not-talent parented knack under Skills — pre-existing, out of scope). |
| 2026-08-28 | Tightening pass: corrected the catalog count to **145** throughout (§1, §5-Q6 — was 144); aligned **§6.2a** with §3/§7.1a (5 fully orphaned invisible-in-picker knacks + 2 partially orphaned already learnable via `Patterncraft`, not "7 previously-orphaned"); made §7.1a reference the single mapping table in §3 instead of duplicating it and folded the affected-knacks list into one sentence; fixed the stale "60 distinct parents" count in §2 to 65. |
| 2026-08-30 | **Implemented + verified.** Engine (`engine/knack-options.js` `learnableKnacks`), store wiring (`model.knackOptions`, `saveAdvancementEdits`/`applyEdits` knacks passthrough with the drop/wipe guards), log (`logKnackLearned`), app handler (`ed-learn-knack` in `ed-app.js`), UI picker/`_learnKnackModal` (`ed-disciplines.js`), and data (`costs.knackTraining` 1..15 in `legend.json`, §7.1a parent rename in `knacks.json`). Full suite green: **689 pass / 0 fail**, incl. the two overlay guards and the no-orphans catalog guard. |
| 2026-08-30 | **§7.1a rule-agent check resolved — keep data.** Owner confirmed (2026-08-30) the magic knacks are governed by **Thread Weaving**, not Spellcasting: `Nethermancy`→`Thread Weaving (Nethermancer)`, `Elementalism`→`Thread Weaving (Elementalist)`. The applied rename stands. Recorded in RULES-FAQ Q004. This was the last open plan item — the plan is complete. |
| 2026-08-30 | **Placement refinement (Q1 revised).** Manual test found the "＋ add knack" entry point unreachable from a discipline's talent table — it sat only on the Skills tab card, wrong for talent-governed knacks. Owner chose: **per-discipline footer** under each talent card + **scope the picker to that discipline's knacks**. Implemented: new pure `scopeKnackOptions` helper (engine/knack-options.js, +4 unit tests); `_addKnackSlot(d)` renders under the talent card in edit mode; the Skills-tab global slot is removed; the modal takes the scoped list. 693 tests green. |
| 2026-08-30 | **Skills tab clean-up + picker preview (owner).** (1) Removed knacks from the Skills sub-tab: `_skillsView` no longer nests skill-parented knacks — knacks display ONLY under their governing talent on the discipline tables, matching the talent-only gate (owner confirmed: no skill-linked add flow). (2) Added an **info icon (i)** per candidate row in the knack picker that expands the knack's full catalog `summary` (the bonuses) + action/strain inline (inline, not a stacked modal — the shared controller owns one dialog). Engine: `learnableKnacks` now also returns `summary`/`action`/`strain` (+1 unit test). 694 tests green. |
