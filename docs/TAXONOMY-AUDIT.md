# TAXONOMY-AUDIT — Effect taxonomy vs. rules data vs. engine code

Tracking doc for the audit of how the **effect taxonomy** is actually used across
`rules/*.json`, `data/*.json`, `engine/*`, and `ui/*`, measured against the
documented architecture. Same spirit as [RULEBOOK-AUDIT.md](RULEBOOK-AUDIT.md):
record a discrepancy here *before* fixing it, and cite the finding id (`T-nnn`)
in the fixing commit.

> Status: **scaffold — no findings collected yet.**

## Scope & authority

| Role | Document / file |
|---|---|
| Authority (vocabulary) | [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md) (currently **v4**) |
| Authority (restrictions) | [RESTRICTION-TAXONOMY.md](RESTRICTION-TAXONOMY.md) |
| Authority (architecture rules) | [ARCHITECTURE.md](../ARCHITECTURE.md) §3, §4.1, §5.5 |
| Authority (working agreement) | [CLAUDE.md](../CLAUDE.md) — Tier 1 / Tier 2 |
| Audited (data) | `rules/*.json` (`effects` arrays, `schema` tags, `effectTaxonomy` refs), `data/character.json`, `data/characters/*.json`, `data/changelog.json` |
| Audited (code) | `engine/*.js` (effect handlers, fold, derive), `ui/*.js` (no game-value computation), `store.js` |
| Audited (tests) | `engine/*.test.js` — does coverage match each documented `type`? |

Out of scope unless a finding requires it: rulebook text accuracy (that is
RULEBOOK-AUDIT / the rule-agent), visual styling.

## Method

1. **Inventory the documented vocabulary** — every value of `type`, `target`,
   `operation`, `measure`, `condition`, `scope`, `stacking`, `duration`, `source`
   (taxonomy §2–§9). Record in *Appendix A*.
2. **Inventory what the data uses** — enumerate the distinct values per field
   across all `rules/*.json` and character data (script it; keep the script in
   the scratchpad, paste the counts into *Appendix B*).
3. **Inventory what the engine handles** — for each `type`/`operation`/`measure`
   the code branches on (grep `engine/`), note file:line. *Appendix C*.
4. **Diff the three sets** (doc ↔ data ↔ code) and record each gap as a finding.
5. **Check the architecture rules** against the code (checklist below).
6. **Classify every finding** by tier (CLAUDE.md) and severity, and propose a
   remedy — *without applying it*. Tier 1/2 remedies need owner sign-off.

## Severity & tier key

| Severity | Meaning |
|---|---|
| **S1** | Wrong game value can be shown/computed today |
| **S2** | Latent: data/code disagree but no current wrong output |
| **S3** | Doc drift / naming / housekeeping |

Tier: **1** locked · **2** taxonomy ceremony · **3** free (per CLAUDE.md).
Status: `open` · `accepted` (deliberate, documented) · `fix-proposed` · `fixed (sha)` · `wontfix`.

## Checklist A — Documented vocabulary ↔ data

- [ ] Every `type` used in `rules/*.json` is defined in taxonomy §2
- [ ] Every `target` (incl. dotted/parametrised forms) is defined in §3
- [ ] Every `operation` is defined in §4 (incl. the `set`-as-base damage pattern, §4.1)
- [ ] Every `measure` is defined in §5
- [ ] Every `condition` / `scope` is defined in §6
- [ ] Every `stacking` / `duration` / `source` value is defined in §7–§9
- [ ] No rules file uses a field name absent from §1 (typos, legacy names)
- [ ] Every `rules/*.json` carries a `schema` tag and `effectTaxonomy: "…(v4)"` that matches the doc's current version
- [ ] Documented vocabulary that **no data uses** is listed (dead vocabulary)
- [ ] Display strings carrying rules meaning that should be structured effects (free-text `description`/`effect` fields the engine parses)

## Checklist B — Documented vocabulary ↔ engine

- [ ] Every documented `type` has an engine handler (or is explicitly marked "reserved/not yet handled")
- [ ] Every handler corresponds to a documented `type` (undocumented vocabulary in code)
- [ ] `operation` / `measure` / `stacking` semantics in code match §4, §5, §7 (spot-check with tests)
- [ ] Unknown/unsupported effect values fail visibly (or are skipped deliberately) — not silently mis-computed
- [ ] Each documented `type` has at least one test in `engine/*.test.js`
- [ ] "Open questions" in taxonomy §11 — which are now resolved by shipped code but still listed?

## Checklist C — Architecture rules (Tier 1) ↔ code

- [ ] **Engine is pure and DOM-free** — no `document`/`window`/`localStorage`/`fetch` in `engine/*`
- [ ] **Engine reads structured taxonomy, never regex-parses display strings** (ARCHITECTURE §3, §5.5) — list every `RegExp`/`.match`/`.replace` over rule text; `spells.js` is the only grandfathered parser
- [ ] **UI never computes game values** — no arithmetic on rule data in `ui/*` beyond layout; values come from engine output via render
- [ ] **Data down / events up** — UI mutates only via `dispatch`; grep `ui/*` for direct state writes
- [ ] **Store only inputs** (§4.1) — `character.json` / `characters/*.json` hold no derived `Value`/`Step`/totals
- [ ] **Derived values render as placeholder pills**, not invented numbers, when an input is missing
- [ ] Homebrew rules ([HOMEBREW-RULES.md](HOMEBREW-RULES.md)) use the same taxonomy vocabulary as built-in rules (no parallel dialect)
- [ ] Thread-item effects ([THREAD-ITEMS.md](THREAD-ITEMS.md)) and restriction vocabulary are consistent with the taxonomy docs

## Findings

Copy the template for each finding. Keep them evidence-first (file:line).

```
### T-000 — <concise title>
- Severity: S1 / S2 / S3          Tier: 1 / 2 / 3          Status: open
- Area: data | engine | ui | doc | tests
- Documented: <taxonomy/architecture section + quoted rule>
- Observed: <what the data/code actually does>
- Evidence: <file:line, file:line …>
- Impact: <what breaks / could break>
- Proposed remedy: <doc change | data migration | code change>  (Tier 1/2: needs owner sign-off)
```

### Open findings

_None recorded yet._

### Accepted / deliberate deviations

_None recorded yet._ (Known grandfathered item to verify, not assume: the
`spells.js` display-string parser — ARCHITECTURE §3/§5.5.)

## Summary table

| Id | Title | Sev | Tier | Area | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Appendix A — Documented vocabulary

_To fill from EFFECT-TAXONOMY.md §2–§9: one table per field, one row per value._

## Appendix B — Vocabulary observed in data

_To fill: distinct values per field with occurrence counts per `rules/*.json` file; values not in Appendix A are flagged._

## Appendix C — Engine handler map

_To fill: documented value → `engine/<file>.js:line` handler → test file:line (or "none")._

## Log

| Date | Note |
|---|---|
| 2026-09-30 | Scaffold created; no findings yet. |
