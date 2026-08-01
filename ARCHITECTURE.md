# Earthdawn Character Sheet — Architecture

A static, GitHub-Pages-hostable web app for viewing, editing, and *running* an
Earthdawn character. Starts as a simple stat display; grows into a full rules
engine (dice rolling, attribute cascades, talent dice derivation) without the
page becoming enormous.

Modelled on the existing "Chakka" Google Sheet, which is really a rules engine
built on a property store. This design preserves that core idea in a form that
scales as code instead of formulas.

---

## 1. What we learned from the spreadsheet

The spreadsheet is not a form — it is a small engine. Three concepts drive it:

### 1.1 A property store (Entity-Attribute-Value)
Every fact is a keyed property:

```
Key = Target + Characteristic + Property   →   Value

AttributeToughnessValue   = 17
AttributeToughnessStep    = 7
AbilityAwarenessResult    = 8
Ork StingerDamageTarget   = 0
AbilityAvoid BlowCircle   = 1
```

Properties come in **layers** (from the `Properties`, `Action`, and `EDTables`
sheets):

| Layer | Source in sheet | Meaning |
|-------|-----------------|---------|
| **Base** | `Properties` | The character definition (attributes, abilities, circles, ranks) |
| **Reference / Rules** | `EDTables` | Game data + rules (Step→Dice, talents, disciplines, races, triggers) |
| **Derived** | computed | Values produced by rules from Base + Reference |
| **Scripted / Runtime** | `Action` | State written by actions (roll results, targets, use counts) |
| **Post-processing** | `Action` | Display-only overlays applied after rules run |

### 1.2 A tiny expression / rules language
`EDTables` defines operations: `ADD MINUS MULTIPLY DIVIDE REF FIB MAX MIN IF
GE GR LS LE EQ NE STR DEFAULT`, plus **triggers**
(`Trigger Target/Characteristic/Property/Condition/Value`). Rules read
properties and write derived properties. `REF` is a reference to another
property — this is the dependency graph that produces the *cascade*.

### 1.3 Actions resolved through the Step→Dice table
The canonical Earthdawn mechanic: an attribute/talent **Value** → **Step** →
a **dice expression**.

```
Step  3 = D4        Step  8 = 2D6       Step 13 = D12+D10
Step  4 = D6        Step  9 = D8+D6     Step 14 = 2D12
Step  5 = D8        Step 10 = 2D8       Step 17 = D12+2D8
Step  6 = D10       Step 11 = D10+D8    ...
Step  7 = D12       Step 12 = 2D10
```

Dice "explode" (max roll re-rolls and adds). Actions roll the expression,
compare to a target, and write result properties back into the store.

**Design consequence:** if we model the app the same way — a property store, a
rules engine over a small expression language, and an action/dice system — we
get the cascade behaviour and the talent-dice derivation *for free*, and adding
new talents/spells becomes adding **data**, not code.

---

## 2. Design goals & constraints

1. **Static hosting only** (GitHub Pages) — no server, no build step required to run.
2. **Small initial page** — v1 just displays stats.
3. **Scales without bloat** — new talents/spells/rules are data files; new
   *behaviours* are small engine modules loaded on demand.
4. **View + edit + persist** character data.
5. **Separation of concerns**: engine logic is pure and DOM-free, so it is
   testable and reusable (a future dice-roller bot, a mobile view, etc.).

---

## 3. Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  UI Layer (thin)                                               │
│  - render views from state    - bind clicks → dispatch action │
│  - NO game logic lives here                                    │
├──────────────────────────────────────────────────────────────┤
│  Application / Store Layer                                     │
│  - holds current CharacterState (the property store)          │
│  - dispatch(action) → engine → new state → notify UI          │
│  - persistence (load/save)                                    │
├──────────────────────────────────────────────────────────────┤
│  Engine Layer (pure, DOM-free, lazy-loaded modules)           │
│  - Property resolver + dependency graph (the cascade)         │
│  - Expression evaluator (ADD/REF/MAX/IF/…)                    │
│  - Step/Dice system + roller (+ optional dddice adapter)      │
│  - Action executor                                            │
├──────────────────────────────────────────────────────────────┤
│  Data Layer                                                   │
│  - character.json   (this character's data)                  │
│  - rules/*.json     (game reference: steps, talents, races…) │
└──────────────────────────────────────────────────────────────┘
```

The golden rule: **data flows down through render; events flow up through
`dispatch`.** The UI never mutates state or computes game values directly.

---

## 4. Data model

Two kinds of data, kept strictly separate.

### 4.1 Character data (`character.json`) — per character, editable
The character's own facts. Human-friendly nested JSON that the app flattens
into the property store at load:

```jsonc
{
  "meta": { "name": "Chakka", "race": "Ork", "version": "8.0" },
  "attributes": {
    "Dexterity":  { "base": 10, "points": 8, "increases": 2 },
    "Toughness":  { "base": 11, "points": 4, "increases": 2 }
    // value/step are DERIVED, not stored
  },
  "disciplines": [
    { "name": "Archer", "circle": 4,
      "talents": [ { "name": "Avoid Blow", "rank": 4 },
                   { "name": "Missile Weapon", "rank": 5 } ] }
  ],
  "skills":  [ { "name": "Tracking", "rank": 3 } ],
  "items":   [ /* weapons, armor, magic items */ ],
  "spells":  [ /* … */ ],
  "resources": { "karma": 18, "damage": 4, "recoveriesUsed": 0 }
}
```

> Rule of thumb: **store only inputs; never store what a rule can recompute.**
> `Attribute Value` and `Step` are derived, so they are not in the file — this
> is what keeps edits consistent and avoids the "I changed X but Y is stale"
> problem.

### 4.2 Game rules data (`rules/*.json`) — shared, versioned reference
Static Earthdawn data, split so the browser only fetches what a view needs:

```
rules/
  steps.json          # Step → dice expression + explode flag
  attributes.json     # value/step curve, point costs, karma costs
  characteristics.json# the ED4 Characteristics Table: Value → Step, Defense,
                      #   Carrying Capacity, Uncon/Death/Wound/Recovery (a table,
                      #   not formulas — Carrying Capacity has no closed form)
  talents.json        # talent → linked attribute, action type, strain, tier
  disciplines.json    # discipline → talents per circle (+ per-circle effects)
  skills.json
  races.json          # racial abilities, each carrying effects[] (+ movement, karma)
  spells.json         # (loaded only when the Magic view opens)
```

Adding a talent = one entry in `talents.json`. No code change.

**Modifiers are data, embedded, not a separate `rules.json`.** Rather than a
central declarative rules file, each ability/item/spell carries its own
`effects` array in the controlled vocabulary of
[docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md). The engine gathers the
active effects from every source and layers them onto base values. This is the
model actually in use (see `races.json`, `disciplines.json`); it superseded the
earlier "`EDTables` expression language in one `rules.json`" sketch.

**Base characteristics are a table, computed by code.** Earthdawn's derived
characteristics come from a printed lookup table (`characteristics.json`), not
arithmetic — and Carrying Capacity is non-linear, so no formula would do. The
data is the table; a thin code module (`engine/characteristics.js`) holds the
*logic* — which attribute drives which characteristic, +Circle on Death Rating,
and applying the taxonomy `effects` on top. **Table as data, logic as code.**

### 4.3 The property store (in-memory, runtime)
At load, character + rules are flattened into a single map keyed exactly like
the sheet (`AttributeToughnessValue`, …). This is the substrate the engine
reads and writes. Views subscribe to the slices they display.

---

## 5. The engine (where the "functions" live)

Four pure modules. Each is independently testable and lazy-loaded.

### 5.1 Effect application + (later) a small expression evaluator
The engine's modifier model is the taxonomy `effects` array (§4.2): it gathers
active effects and folds them onto base values by `operation`/`measure`. Only
**always-on, non-`gmDiscretion`** effects auto-apply; situational and triggered
ones are surfaced for the player/GM, never silently baked into a static rating.

A small expression evaluator is still expected **later**, but with a narrowed
near-term job: resolving `{ "ref": … }`-valued effects (e.g. a talent step that
references another ability's rank). The full `EDTables` language
(`ADD/REF/MAX/IF/…`) is deferred until a rule actually needs it — we don't build
the interpreter ahead of the data that would use it.

### 5.2 The cascade — **recompute-all, not a dependency graph** (DECIDED)
> *"If I update an attribute, the effect cascades across everything derived."*

For a single character (a few dozen properties) the cascade is a pure
`derive(inputs) → derived` that **recomputes everything** on any change —
simple, obviously correct, and instant. Change `Toughness.points` and the whole
derived set (Death Rating, Wound Threshold, Recovery, Physical Defense, any
dependent talent) is recomputed from inputs.

The `REF`-driven **dependency graph** in the original design is a performance
optimization (recompute *only* affected downstream properties). It is **not**
built yet and only earns its place if profiling ever shows recompute-all is too
slow — unlikely at this scale. See §10.

### 5.3 Step / Dice system + roller  ← *dice rolling*
`valueToStep(value)` → `stepToDice(step)` → `roll(expr)` with Earthdawn
exploding dice. Returns a structured result (per-die values, total, vs target).
A thin **dddice adapter** (optional) can mirror rolls to 3D dice, matching the
`dddice` config already in your sheet — but the core roller has zero external
dependencies.

### 5.4 Action executor  ← *talent/attack use*
An action is data: *which* step-value to use, target number, strain, karma
option, and what result properties to write.

> *"If I add a new talent, how it can be used and what dice are associated."*
> A talent's action references its linked attribute + rank from `talents.json`;
> the executor derives the step, rolls, and records the result. Adding a talent
> needs no new action code — only its data entry.

---

## 6. Keeping the page small as it grows

This is an explicit requirement, so it's a first-class design concern:

1. **ES modules + dynamic `import()`** — v1 ships the store + display only. The
   dice roller, rules engine, and magic system load **on demand** the first
   time they're used. The initial page stays tiny.
2. **Data, not code** — talents/spells/rules live in JSON fetched per-view.
   `spells.json` isn't downloaded until the Magic tab opens.
3. **Feature = module** — each capability (combat, magic, karma, thread items)
   is a self-contained engine+view pair, added without touching existing ones.
4. **Lit as the UI layer** — chosen for its ~5–6KB runtime, standards-based Web
   Components, and **no build step**. Lit is **self-hosted** (`vendor/lit-*.js`,
   a single self-contained bundle) and resolved via an import map, so the
   "edit → push → live on Pages" workflow is preserved *and* there is no external
   runtime dependency — a failed third-party fetch can no longer blank the app,
   and it works offline (see §10). Each view is a
   self-contained Lit component; reactive properties auto-update the DOM when the
   engine reports a change, which is exactly what the attribute cascade needs.
   The engine stays pure and framework-agnostic, so Lit only ever touches the UI
   layer.

---

## 7. Persistence (no backend)

Options, roughly in order of how far v1 should go:

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **localStorage** | auto-save state in the browser | zero setup, instant | single device/browser |
| **File export/import** | download/upload `character.json` | portable, git-friendly, backups | manual |
| **GitHub as store** | commit `character.json` via GitHub API + a Personal Access Token | versioned, syncs across devices | needs a token; care with secrets |
| **URL state** | share/bookmark encoded state | shareable snapshots | size-limited |

Recommended v1: **localStorage + file export/import** (works offline, no
secrets). The GitHub-API option is a clean later add-on because state is already
just `character.json`.

---

## 8. Proposed repository layout

```
/                     # served by GitHub Pages
  index.html          # tiny shell: mount point + module entry
  app.js              # store, dispatch, persistence, view router
  ui/                 # Lit components (Web Components)
    stats-view.js     # v1: display attributes/stats
    combat-view.js    # later
    magic-view.js     # later (lazy)
  engine/                    # pure, DOM-free, independently testable
    derive.js                # attribute value/step, talent step, step→dice map
    characteristics.js       # derived characteristics: table lookup + effects
    dice.js                  # step + dice + exploding roller
    characteristics.test.js  # node --test (see `npm test`)
    # planned: expr.js (ref resolution), actions.js (action executor),
    #          dddice.js (optional 3D dice adapter)
  data/
    character.json    # Chakka (inputs only)
  rules/
    steps.json attributes.json characteristics.json talents.json
    disciplines.json skills.json races.json …             # hand-curated
  vendor/
    lit-3.2.1.js         # self-hosted Lit bundle (no external runtime dep)
    README.md            # provenance + how to refresh/upgrade
  docs/
    EFFECT-TAXONOMY.md   # controlled vocabulary for rule effects
    UI-GUIDELINES.md     # locked UI/UX contract
  CLAUDE.md              # tiered working agreement (protected-surface control)
  tools/archive/
    import-xlsx.mjs   # ARCHIVED bootstrap importer (provenance only; not run)
  ARCHITECTURE.md
```

---

## 9. Delivery phases

- **Phase 0 — Importer.** *(Complete, now archived.)* A one-off script read
  `Chakka-v7.13.xlsx` and emitted `character.json` + `rules/*.json` to bootstrap
  real data. Those JSON files are now the source of truth and are hand-maintained
  per `docs/EFFECT-TAXONOMY.md`; the importer lives in `tools/archive/` for
  provenance and is no longer run.
- **Phase 1 — Read-only stat display.** `index.html` + store + `stats-view`.
  Loads `character.json`, shows attributes/values/steps, health, karma,
  disciplines. *Hostable on GitHub Pages immediately.*
- **Phase 2 — Editing + persistence.** Edit inputs; localStorage + file
  export/import.
- **Phase 3 — Engine: cascade.** *(In progress.)* Derived characteristics from
  `characteristics.json` + taxonomy `effects`, via recompute-all (§5.2). First
  vertical slice landed: **Physical Defense** end-to-end (table base + discipline
  effect), verified against the rulebook in `characteristics.test.js`. Remaining
  characteristics (other defenses, health ratings, carry) repeat the pattern.
- **Phase 4 — Dice.** *(Landed early, ahead of Phase 3.)* `dice.js` exploding-dice
  roller with a result modal is wired. Optional dddice adapter still later.
- **Phase 5 — Actions & talents.** `actions.js`; talents/attacks become
  clickable actions driven entirely by data.
- **Phase 6+** — Magic, thread items, karma management, combat tracker — each a
  lazy module.

---

## 10. Decisions

- **Tech stack — DECIDED: Lit.** Web Components, ~5–6KB runtime, no build step,
  reactive properties for the cascade UI. Engine remains framework-agnostic; Lit
  only touches the UI layer. See §6.4.
- **Lit hosting — DECIDED: self-hosted, was CDN.** Originally loaded from
  `esm.sh` via import map; that made every cold page load depend on a third party
  being reachable, and a failed/slow fetch rendered the whole app as a blank
  (dark) screen with no fallback. Now vendored as a single self-contained bundle
  in `vendor/` (see `vendor/README.md` for source + refresh steps) and resolved
  by a **relative** import-map entry so it works at both `/` and `/dev/`. Keeps
  the no-build ethos, removes the blank-screen failure mode, works offline, and
  is deterministic/reproducible. Trade-off accepted: a ~16KB vendored file in the
  repo and a manual re-fetch to upgrade Lit (rare, since the version is pinned).
- **Persistence — DECIDED: localStorage + file export/import.** Auto-save to the
  browser plus download/upload of `character.json`. No secrets, works offline.
  GitHub-API sync remains a clean later add-on since state is just
  `character.json`. See §7.
- **Rules fidelity — DECIDED: core rules first, flag house rules.** During the
  Phase 0 import, port standard Earthdawn rules and **flag any custom/house-rule
  formulas** found in the sheet for confirmation before porting them. Faster path
  to a working v1 without silently dropping your customizations.
- **Scope — DECIDED: single character (Chakka).** Data layout and UI target one
  character for now; the `character.json` structure stays clean enough to
  generalize to multi-character later without a rewrite.
- **Cascade — DECIDED: recompute-all, not a dependency graph.** For one
  character, a pure `derive(inputs) → derived` that recomputes everything is
  simple and instant; the `REF` dependency graph is a later optimization only if
  profiling demands it. See §5.2.
- **Derived characteristics — DECIDED: table as data, logic as code.** Ship the
  ED4 Characteristics Table verbatim as `rules/characteristics.json` (it *is* a
  rulebook table, and Carrying Capacity has no formula); keep attribute→
  characteristic mapping, +Circle, and effect application in
  `engine/characteristics.js`. See §4.2, §5.
- **Modifiers — DECIDED: embedded `effects` arrays, not a central `rules.json`.**
  Each ability/item/spell carries its own effects per
  [docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md); the engine gathers and
  applies them. Only always-on, non-`gmDiscretion` effects auto-apply.
- **Testing — DECIDED: `node --test`, zero deps.** Engine modules ship `*.test.js`
  run by `npm test` (Node's built-in runner), preserving the no-build ethos.
```
