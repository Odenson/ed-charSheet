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
  talents.json        # talent → linked attribute, action type, strain, tier
  disciplines.json    # discipline → talents per circle
  skills.json
  races.json          # racial mods, movement, karma
  spells.json         # (loaded only when the Magic view opens)
  rules.json          # declarative modifier/trigger rules
```

Adding a talent = one entry in `talents.json`. No code change.

### 4.3 The property store (in-memory, runtime)
At load, character + rules are flattened into a single map keyed exactly like
the sheet (`AttributeToughnessValue`, …). This is the substrate the engine
reads and writes. Views subscribe to the slices they display.

---

## 5. The engine (where the "functions" live)

Four pure modules. Each is independently testable and lazy-loaded.

### 5.1 Expression evaluator
Interprets the small language from `EDTables`
(`ADD/MINUS/MULTIPLY/DIVIDE/REF/FIB/MAX/MIN/IF/GE/GR/LS/LE/EQ/NE/DEFAULT/STR`).
`REF` reads another property — the mechanism behind cascades.

### 5.2 Property resolver + dependency graph  ← *the attribute cascade*
Builds a dependency graph from `REF`s. When an input changes, it recomputes
**only** the affected downstream properties in dependency order.

> *"If I update an attribute, the effect cascades across all other attributes."*
> This is exactly that: change `Toughness.points` → recompute `ToughnessValue` →
> `ToughnessStep` → Death Rating, Wound Threshold, Recovery Test dice,
> Physical Defense, any talent that `REF`s Toughness.

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
   Components, and **no build step** (loads straight from a CDN via import maps,
   so the "edit → push → live on Pages" workflow is preserved). Each view is a
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
  engine/
    properties.js     # store + flatten/unflatten
    resolver.js       # dependency graph + recompute
    expr.js           # expression evaluator
    dice.js           # step + dice + roller
    actions.js        # action executor
    dddice.js         # optional 3D dice adapter
  data/
    character.json    # Chakka
  rules/
    steps.json talents.json disciplines.json races.json …  # hand-curated
  docs/
    EFFECT-TAXONOMY.md   # controlled vocabulary for rule effects
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
- **Phase 3 — Engine: cascade.** `expr.js` + `resolver.js`. Editing an
  attribute recomputes derived values live. Steps shown from the engine.
- **Phase 4 — Dice.** `dice.js` roller; click a step to roll (exploding dice);
  roll log. Optional dddice adapter.
- **Phase 5 — Actions & talents.** `actions.js`; talents/attacks become
  clickable actions driven entirely by data.
- **Phase 6+** — Magic, thread items, karma management, combat tracker — each a
  lazy module.

---

## 10. Decisions

- **Tech stack — DECIDED: Lit.** Web Components, ~5–6KB runtime, no build step
  (CDN + import maps), reactive properties for the cascade UI. Engine remains
  framework-agnostic; Lit only touches the UI layer. See §6.4.
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
```
