# Feature: Active effects window (active-condition-window)

## Summary
One shared "Active effects" element (the Spells-tab card look: ✦ mark, name · effect, round bar, rounds pill) shown on both the Combat tab (above the Combat log, Option D) and the Spells tab (single stacked column), fed by a single session-level list. It collects spells (self and cast on Other, with countdown), armed talents (Aim), timed opponent effects (Taunt), toggled combat options/blood charms, and read-through Situational chips / Knocked Down. Mock: `mock-d.html` (to be corrected: group by lifetime, Aim under "Lasting · on you", Taunt rounds = rank, no "Entangle").

## Goals / Non-goals
- Goal: one list, one component, identical on Combat and Spells; effects created in either tab appear in both.
- Goal: Taunt auto-added on a successful roll (rounds = Taunt rank; −1 tests / −1 Social Defense per success shown as text).
- Goal: optional opponent name labels entries; blank shows "target".
- Goal: spells cast on Other tracked per entry with countdown (ticks each Initiative roll); ✕ ends any entry.
- Non-goal: Overview Active Effects strip unchanged (owner, 2026-11-24).
- Non-goal: engine folding of opponent penalties or any taxonomy change (display-only).
- Non-goal: other opponent talents (Frighten, Battle Bellow, …) — later Tier-3 data.
- Non-goal: persisting entries to the character file (session-only like armedTalents/activeCharms).

## Guardrail alignment
Docs touched: UI-GUIDELINES §4 (Combat and Spells contents), ARCHITECTURE (session state note if needed), THREAD/TAXONOMY untouched. Data down / events up kept: UI renders a model-supplied list; end/name actions dispatch events; countdown stays in ed-app/engine. Tier-1 sign-off for tab-content changes: qa-log 2026-11-24 "Tier-1 sign-off" — signed off.

## Tickets
### T1 — Engine: unified active-effects list
- **What:** Pure engine function that builds `model.activeEffects` entries ({id, kind: spell|talent|option|situation, side: atk|you|tgt, name, effectLabel, rounds/total or null, chips, targetName, endable}) from spells.active, other-cast records, armedTalents, toggled options/charms, situations/Knocked Down. Grouping rule: no round count → This attack; rounds → Lasting on you/target.
- **Why:** One source of truth for both tabs; UI never computes.
- **Tier:** 3 (new engine module, pure, DOM-free)
- **Acceptance criteria:** unit tests per source kind and grouping; deterministic order; rounds bar/low (≤3) flag derived.
- **Open questions:** none

### T2 — Session state: opponent entries (Taunt, cast-on-Other) with countdown
- **What:** Session-only list of effects placed on opponents (spell casts on Other with duration, Taunt), each with optional name, rounds left/total; ticked on each Initiative roll with existing tickers; cleared by Day reset; ended via ✕.
- **Why:** Spells on Other currently show only the latest cast; Taunt needs a record.
- **Tier:** 3 (session-only; no character data stored — "store only inputs" kept)
- **Acceptance criteria:** cast on Other adds entry; Taunt success adds entry with rounds = rank; tick/removal tests; Day reset clears.
- **Open questions:** none

### T3 — Taunt data (arms on the Taunt talent)
- **What:** Add `arms: { roll: { vs: "Social" }, rounds: "rank" }` to the Taunt TALENT in rules/talents.json (not the skill); store resolves `"rank"` to the talent's rank; the roll creates an armed/opponent entry, opponent-side text comes from the existing `note` effect. Taunt skill excluded from v1.
- **Why:** Rule R1.
- **Tier:** 3 (reuses `arms`; no new field; owner decision qa-log 2026-11-24 last entry). Value note added to EFFECT-TAXONOMY section 6, no version bump.
- **Acceptance criteria:** conformance test passes; no taxonomy version change.
- **Open questions:** none

### T4 — Shared UI component
- **What:** Lit element `ed-active-effects` rendering the model list in the Spells-card look: heading + count, `.aecard`, ✦/◆/• marks, name · effect, round bar (amber ≤3), rounds pill, chips, "this attack" pill for round-free, ✕ end, empty state. Layout: three side-by-side groups in Combat; single stacked column in Spells (no truncation). Needs `--spell`, `--amber` tokens in Combat.
- **Why:** Same element in both tabs.
- **Tier:** 1 (UI contract) — signed off
- **Acceptance criteria:** light/dark; placeholder rules respected; Escape/modal rules unaffected; phone width.
- **Open questions:** none

### T5 — Combat tab placement + target name field
- **What:** Mount the component between the Modifiers/Potions row and the Combat log; add optional opponent name field to the attack row.
- **Tier:** 1 (Combat contents) — signed off
- **Acceptance criteria:** matches mock-d; name labels new opponent entries.

### T6 — Spells tab integration
- **What:** Replace the existing Active effects card with the shared component (single column); remove the Target effects card; show combat entries in Spells.
- **Tier:** 1 (Spells contents) — signed off
- **Acceptance criteria:** self and Other casts show, count down, ✕ ends; no regression of cast flow.

### T7 — Docs
- **What:** Update UI-GUIDELINES §4, ARCHITECTURE session-state note, RULES-FAQ already updated (Q048); correct mock-d.html grouping.
- **Tier:** 3
