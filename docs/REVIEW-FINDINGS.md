# Review Findings — living document

A working list of issues found during the full codebase sweep, kept in this file
so findings can be assessed, fixed, and re-verified iteratively. Each finding has
an ID, a status, the tier it touches (CLAUDE.md), evidence (`file:line`), and a
suggested fix. When a finding is re-checked after changes, **update its status
and add a line to [Re-review log](#re-review-log)**.

- **Baseline at first review:** `dev` @ `9278c1c` — 56/56 tests pass.
- **Baseline at re-review (2026-08-06):** `dev` @ `aaf7ce8` — **62/62 tests pass** (v1.5.0 shipped: serverless GitHub save + Export; runbook added).
- **Baseline at re-review (2026-08-07):** `dev` @ `d298519` — **62/62 tests pass** (v1.5.1 shipped: save-key password managers + Discard local changes).

---

## Status summary

| ID | Finding | Tier | Status |
|----|---------|------|--------|
| [B1](#b1-broken-talent-reference-in-disciplines-data) | Broken talent ref `Summon [Ally Spirits]` | 3 | ✅ RESOLVED |
| [G1](#g1-stored-derived-values--karmaavailable-legendavailable) | Derived values stored in `character.json` | 1 | 🔴 OPEN (owner) |
| [G2](#g2-font-weight-700--dev-pill) | `font: 700` on `.dev-pill` | 3 | ✅ RESOLVED |
| [T1](#t1-derivedicejs-have-no-tests) | `derive.js` / `dice.js` untested | — | ✅ RESOLVED |
| [SC1](#sc1-untagged-rules-files) | `attributes/skills/steps.json` untagged | 3 | ✅ RESOLVED |
| [SM1](#sm1-effects-missing-summary) | 18 effects missing `summary` | 3 | ✅ RESOLVED |
| [C4a](#c4a-ui-guidelines-4-gear-still-later) | UI-GUIDELINES §4 Gear "(later)" stale | 3 | ✅ RESOLVED |
| [C4b](#c4b-architecture-8-layout-sketch-stale) | ARCHITECTURE §8 layout sketch stale | 3 | ✅ RESOLVED |
| [R1](#r1-dangling-runbook-references) | `wrangler.toml`/`worker.test.js` cite runbook §s that don't exist | 3 | ✅ RESOLVED |
| [R2](#r2-main-doc-43-still-says-save_key-optional) | Main doc §4.3 still labels `SAVE_KEY` "Optional" | 3 | ✅ RESOLVED |
| [C1](#c1-feature-doc-status--shipped-resolved) | Feature doc "not built" | 3 | ✅ RESOLVED (v1.5.0) |
| [C2](#c2-auth-decision-recorded-resolved) | Auth decision not recorded | 3 | ✅ RESOLVED |
| [C3](#c3-runbook-created-resolved) | Runbook cross-refs missing | 3 | ✅ RESOLVED (partially, see R1) |

---

## 🐛 B1 — Broken talent reference in disciplines data

**Status:** ✅ RESOLVED (2026-08-07, manual data edit) · **Tier:** 3

`rules/disciplines.json:125` — Nethermancer circle 5 listed talent
`"Summon [Ally Spirits]"`, but `rules/talents.json` only has `"Summon"`
(plus `Summoning Circle`, `Beast Summons`). It was the **only** unresolved
cross-file reference in the rules set; no other `[bracket]` rulebook names
linger, so it missed the normalization the file header promises.

**Resolution:** `rules/disciplines.json:125` now reads `"talents": ["Summon"]`.
All 27 circle-talent references resolve (previously 26 + 1 broken); no
bracket-style talent names remain. Regression guard deliberately **not** added —
the user considers `rules/*.json` a static document, not prone to change.

---

## 🛡️ G1 — Stored derived values: `karma.available` / `legend.available`

**Status:** 🔴 OPEN · **Tier:** 1 (data-model invariant — **owner sign-off**)

`data/character.json:286` — `karma.available: 18` = `converted` 123 − `spent`
105; `data/character.json:295` — `legend.available: 654` = `totalEarnt` 45315 −
`totalSpent` 44661. Both are **derived values stored in the data file**; the
store passes them straight through (`store.js:373`) and nothing recomputes them.
A future edit to `spent`/`converted` with a stale `available` would silently
drift the Karma readout. Currently consistent, so latent — but it violates
"store only inputs; never store what a rule can recompute." (`karma.legend: 290`
is also recomputable at `converted × 7`.)

**Options:** (a) drop the fields and derive in the store; (b) accept them as
sheet-imported inputs and document the exception. Either needs owner sign-off
(Tier 1).

---

## 🛡️ G2 — Font weight 700 on `.dev-pill`

**Status:** ✅ RESOLVED (2026-08-07) · **Tier:** 3

`ui/ed-app.js:117` — `.dev-pill { font: 700 0.7rem/1 system-ui, sans-serif; … }`
violated UI-GUIDELINES §3 (two font weights only, 400/500). Previously the tab
label carried the 700; that was fixed and the 700 moved onto the DEV pill.

**Resolution:** weight changed `700 → 500` at `ui/ed-app.js:117`. No 700 weight
remains anywhere in `ui/`; syntax + 62/62 tests still pass.

---

## 🧪 T1 — `derive.js` / `dice.js` have no tests

**Status:** ✅ RESOLVED · **Test-gap**

No test file imported `engine/derive.js` or `engine/dice.js`
(`characteristics.test.js`, `wealth.test.js`, `store-server.test.js`,
`tools/worker/worker.test.js` cover everything else). Both are core:
`derive.js` (`attributeValue`, `valueToStep`, `talentStep`, `makeDiceForStep`)
drives the store (`store.js:8`) and `dice.js` powers the roll modal.

**Fix:** added `engine/derive.test.js` + `engine/dice.test.js` under `node --test`
(following the existing test conventions — no deps, no config change):

- `derive.test.js` (14 tests) — attributeValue sums base+points+increases with
  Chakka anchors and missing-field guards; valueToStep boundary sweep + Chakka's
  six attribute steps; talentStep composition and guards; makeDiceForStep over
  the **real** `rules/steps.json`, asserting the wrapped `ed-steps/1` shape (the
  regression net the SC1 wrap lacked), spot dice for steps 1/8/13/20/40, a
  full-table round-trip, and `""` for unknown/step-0.
- `dice.test.js` (10 tests) — rollDie via an injected deterministic RNG:
  single/multi-explosion chains and range bounds; rollStep over real step rows:
  group construction, largest-die-first ordering, exploded-subtotal summing,
  modifier application, and total = Σsubtotals + modifier across the table.

Baseline grew 62 → **84 tests, all passing** (one initial assertion corrected:
`valueToStep(undefined)` is `NaN`, not `0` — the function's `<= 0` guard is
number-only and it's never called with a non-number in store.js, so the engine
was left unchanged).

---

## SC1 — Untagged rules files

**Status:** ✅ RESOLVED · **Tier:** 3 (steps.json wrap is a Tier-1 shape change — owner approved)

`rules/attributes.json`, `rules/skills.json`, `rules/steps.json` carried no
`schema` tag; the other five do (`ed-*/1|2`). Shape was stable, so it was a
consistency gap against the Tier-1 schema-tag convention, not a correctness bug.

**Fix:** 
- `attributes.json` — added `"schema": "ed-attributes/1"` (object already, no wrap).
- `steps.json` — wrapped into `{ schema: "ed-steps/1", steps: [...] }`. Steps is
  load-bearing; `store.js` now unwraps with `stepsFile.steps ?? stepsFile`
  (array fallback keeps an unwrapped file working). Verified pre/post: snapshot of
  `makeDiceForStep` + `stepByNumber` + seeded `rollStep` identical for all 41
  steps, 62/62 tests pass.
- `skills.json` — wrapped into `{ schema: "ed-skills/1", skills: [...] }`. No
  runtime consumer (reference data generated by archived
  `tools/archive/import-xlsx.mjs`, which still writes the old shape but is not run).
- All 8 rules files now carry schema tags.

---

## SM1 — Effects missing required `summary`

**Status:** ✅ RESOLVED · **Tier:** 3

Taxonomy §1 marks `summary` required on effect objects; 18 effects omitted it
while every other effect in the data carried one (parent objects had summaries,
so cosmetic — the UI tolerates it, e.g. `ed-overview.js:299`):
- `rules/talents.json` — 4 effects: Anticipate Blow ×2, Frighten, Mystic Aim (all
  `on-success` modifiers).
- `rules/races.json` — 14 race-ability effects: Dwarf ×2 (Heat Sight, Strong
  Back), Elf (Low-Light Vision), Human (Versatility), Obsidiman ×2 (Increased
  Wound Threshold, Natural Armor), Ork ×2 (Gahad, Low-Light Vision), Troll (Heat
  Sight), T'skrang ×2 (Tail Combat: grant-attack + enable-option), Windling ×3
  (Astral Sight, Flight, Increased Physical Defense).

**Fix:** added a `summary` to each of the 18 effects (Option A — data only, no
taxonomy change). Wording is a concise effect-scoped restatement of each parent's
original-wording summary, following taxonomy §1. Ad-hoc scan (not committed)
now reports **0 effects missing `summary`** across all `rules/*.json`; 62/62
tests pass.

---

## 📄 Doc consistency

### C4a — UI-GUIDELINES §4 Gear "(later)" stale

**Status:** ✅ RESOLVED · **Tier:** 3 · `docs/UI-GUIDELINES.md:31`

Gear row read "Weapons, armour, thread items, kit **(later)**" — Gear shipped
(changelog 1.2.0/1.3.0, `ui/ed-equipment.js`). Spells is the remaining
placeholder (matches the stub in `ed-app.js`).

**Fix:** dropped the "(later)" on Gear.

### C4b — ARCHITECTURE §8 layout sketch stale

**Status:** ✅ RESOLVED · **Tier:** 3 · `ARCHITECTURE.md:387`

The "Proposed repository layout" named `ui/stats-view.js`, `combat-view.js`,
`magic-view.js`; actual is `ed-*.js`. It was an explicitly-proposed early sketch.

**Fix:** refreshed §8 as "Repository layout" with the actual tree and accurate
annotations (ui/ed-*.js, store*.js, engine/, tools/worker, data/, docs/), and
updated the Phase 1 `stats-view` reference in §9 to `ui/ed-overview.js`.

### R1 — Dangling runbook references

**Status:** ✅ RESOLVED · **Tier:** 3

The new `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` fixed most cross-refs (worker.js
`§2.1`/`§5.2` and design-doc `§4.2` resolve), but four comments cited runbook
sections that don't exist. **Root cause:** the runbook's §2 stops at `§2.2`, and
inside the §4 runsheet the Phase 2 steps are numbered `2.1–2.6` — the comments
wrote those *step* numbers as if they were top-level §2 sub-sections:
- `tools/worker/wrangler.toml:2` — cited runbook `§2.4` for deploy; actual is
  §4 Phase 2 step 2.4. (Also found: `wrangler.toml:10` cited a bogus "runsheet
  §2.5" for `wrangler tail` debugging — actual is §4 Phase 2 step 2.5; the word
  "runsheet" was wrong too.)
- `tools/worker/wrangler.toml:4` — cited runbook `§2.3` for secrets; the secrets
  inventory is `§2.2` (off-by-one).
- `tools/worker/worker.test.js:4` — cited runbook `§4.1`; the runbook's §4 uses
  "Phase 1–6" headings. Tests coverage is Phase 4. (Its `design §4.6` reference
  resolves.) The runbook itself seeded this: Phase 2 step 2.1 said "covers
  Phase 4 (§4.1)" — corrected to "(step 4.1)".

**Fix:** all four citations rewritten to the real anchors (§2.2, §4 Phase 2
steps 2.4/2.5, Phase 4); runbook's own `(§4.1)` corrected. Verified: no runbook
or runsheet `§` citation remains that doesn't resolve; 62/62 tests pass.

### R2 — Main doc §4.3 still labels `SAVE_KEY` "Optional"

**Status:** ✅ RESOLVED · **Tier:** 3

`docs/GITHUB-SERVERLESS-SAVE.md:279` (secrets table) said "Optional shared
endpoint key", and line 285 said "optionally SAVE_KEY" — but §5 (lines 408-409)
and §6 (line 333) correctly record it as **required as shipped (fail-closed)**.
The doc agreed with the code in §5 but §4.3 wasn't updated.

**Fix:** updated every *shipped-state* description of the key to required:
- §3.2 request/response contract — `optional x-save-key` → `x-save-key (required — fail-closed, §5)`.
- §4.3 secrets table — `Optional shared endpoint key` → `**Required** shared endpoint key — fail-closed`.
- §4.4 deploy snippet — `optionally SAVE_KEY` → `and SAVE_KEY`.
- §6.2 settings toggle — `optional SAVE_KEY` → `required SAVE_KEY`.

Left untouched on purpose: the §4.2 **design sketch** (explicitly labelled "design
sketch, not shipped", line 169) still shows the key as optional — it is the
baseline the §5 decision record ("this design floated the key as optional, but
the shipped build requires it") and the runbook's §5.2 deviation note quote.

---

## ✅ RESOLVED since first review (2026-08-06, v1.5.0)

### C1 — Feature doc status → "shipped"

`docs/GITHUB-SERVERLESS-SAVE.md:8` and §7 now say **shipped** (v1.5.0); the
ARCHITECTURE §7.3 save-target table marks the serverless endpoint ✅ shipped
and File export ✅ shipped. Previously both said "documented, not built" while
`tools/worker/worker.js` was already implemented.

### C2 — Auth decision recorded

`docs/GITHUB-SERVERLESS-SAVE.md:408-409` now documents the shipped decision:
"`SAVE_KEY` — **required as shipped (fail-closed)**", including that the design
had floated it as optional. Matches the worker's behavior. (Residual: see R2.)

### C3 — Runbook created

`docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` added with the security/secrets model
(§2.1 `SAVE_KEY`, §2.2 inventory), the runsheet phases (§4), and §5.2 deviations
from the design sketch. worker.js's runbook references now resolve. (Residual
dangling refs: see R1.)

---

## ✅ Verified clean (no finding — re-checked)

- **Engine pure & DOM-free** in all four modules; `rng` injectable in `dice.js`.
- **Taxonomy compliance:** all 13 effect types, operations
  (`add/subtract/set/ref`), measures, sources, and domains match
  EFFECT-TAXONOMY v3; `set`-as-base refs resolve (`attribute|Strength|Step`,
  `resource|Karma|Max`). items.json: 179 entries, all with kind + summary.
  `effectTaxonomy` refs all point at v3.
- **Character cross-refs:** race (Ork), both disciplines, all 24 talents, all
  items, all skills resolve; skills.json covers language variants.
- **Worker/CI:** deploy workflow watches `main`+`dev` only; live-read uses the
  GitHub contents API (`store.js:53`) with raw fallback; CORS allow-list,
  env-pinned branch/path, constant-time key compare, bounded 409 retry.
- **Vendor:** Lit bundle self-contained; SHA-256 matches `vendor/README.md`.
- **Tests:** 62/62 pass, tree clean.

---

## Re-review log

| Date | Change | Result |
|------|--------|--------|
| 2026-08-06 | First full sweep, all phases 0–9 | 10 findings + baseline 56/56 |
| 2026-08-06 | Re-review after v1.5.0 (serverless save + Export + runbook) | C1, C2, C3 → RESOLVED; R1, R2 added (residual doc drift); all others still valid; baseline now 62/62 |
| 2026-08-07 | Re-review after v1.5.1 (save-key password managers + Discard local changes) | No findings changed status. G2 line moved `115→117`. SM1 count corrected to **18** (14 race + 4 talent — earlier "16" was a miscount; data unchanged). Baseline still 62/62 |
| 2026-08-07 | B1 fixed by owner edit (`rules/disciplines.json:125` → `"Summon"`) | All 27 circle-talent refs resolve, 0 bracket-style names. B1 → RESOLVED. Regression test not added (static data, per owner) |
| 2026-08-07 | G2 fixed (`ui/ed-app.js:117` `700 → 500`) | No 700 weight remains in `ui/`; 62/62 tests pass. G2 → RESOLVED |
| 2026-08-07 | SC1 fixed (all three files tagged; steps/skills wrapped into `{schema,…}`; `store.js` unwraps with array fallback) | Pre/post snapshot of `makeDiceForStep` + `stepByNumber` + seeded `rollStep` identical for all 41 steps; 62/62 tests pass. SC1 → RESOLVED. Note: `tools/archive/import-xlsx.mjs` (not run) still writes the old shapes |
| 2026-08-07 | SM1 fixed (added `summary` to 18 effects: 4 in talents.json, 14 in races.json) | Ad-hoc scan: 0 effects missing `summary` across all `rules/*.json`; 62/62 tests pass. SM1 → RESOLVED (Option A, data-only) |
| 2026-08-07 | C4a fixed (`docs/UI-GUIDELINES.md` §4 Gear "(later)" dropped) | Gear now reads "Weapons, armour, thread items, kit"; Spells keeps its placeholder. C4a → RESOLVED |
| 2026-08-07 | C4b fixed (ARCHITECTURE §8 refreshed to actual tree) | §8 renamed "Repository layout", lists ui/ed-*.js + store*.js + tools/worker + data/ + docs/; §9 Phase 1 `stats-view` → `ui/ed-overview.js`. C4b → RESOLVED |
| 2026-08-07 | R1 fixed (runbook cross-refs rewritten) | wrangler.toml: `§2.4`→§4 Phase 2 step 2.4, `§2.3`→§2.2, bogus "runsheet §2.5"→§4 Phase 2 step 2.5; worker.test.js: `§4.1`→Phase 4; runbook's own "Phase 4 (§4.1)"→"(step 4.1)". All runbook citations now resolve; 62/62 tests pass. R1 → RESOLVED |
| 2026-08-07 | R2 fixed (design doc §4.3 `SAVE_KEY` → required) | §3.2 contract, §4.3 secrets table, §4.4 deploy snippet, §6.2 settings row all updated to "required/fail-closed"; §4.2 design sketch intentionally left as the historical "floated as optional" baseline (runbook §5.2 quotes it). R2 → RESOLVED |
| 2026-08-07 | T1 fixed (`engine/derive.test.js` + `engine/dice.test.js` added) | 24 new tests over the pure derivation/dice helpers, incl. the real steps.json round-trip (locks the `ed-steps/1` shape). Suite 62 → **84, all passing**. T1 → RESOLVED |
