# Plan Review: Active effects window (active-condition-window)

## Summary
The plan is well grounded in the code, and the Tier-1 sign-off and the R3 house decision are recorded. There are 10 findings: 2 major, 8 minor, and no blockers. The main gaps are a `model.activeEffects` name collision, Taunt/arm plumbing that is only half specified, and the "replace by name" behaviour, which contradicts the opponent-name feature and R1.

## Findings

### F1 — I1/I2 — `model.activeEffects` already exists (Overview strip)
- **Severity:** major
- **Problem:** T1 says the unified list is `model.activeEffects`. That key already holds the folded always-on, condition and situation rows that the Overview strip renders (store.js ~l.2195). The owner ruled that the Overview strip stays unchanged. Reusing the key would change Overview or break the new list. The plan also never says who calls `buildActiveEffects`. The store is the natural place, and it needs the session lists, the toggled options and `situationRows`.
- **Fix:** Name a new model key, e.g. `model.activeEffectsList` or `model.effectWindow`. Say that store.js calls the pure builder at model assembly. Say the Overview strip is read-only input and is untouched. Add an acceptance criterion that `model.activeEffects` is unchanged.

### F2 — I2/I3/I5 — Entries keyed by name collide across opponents
- **Severity:** major
- **Problem:** The existing arm handler (ed-app l.393) does `filter(a => a.name !== arms.name)`, so one entry exists per talent name. I3's risk list and I2 say a re-cast "replaces" the entry. The point of the opponent name field is several opponents. A second Taunt on Orc B would silently erase the Taunt on Orc A. R1 in rules.md says "display shows one entry per cast", which contradicts replace-by-name. R1 stacking is NOT-COVERED, and the plan's own decision text says one entry per cast.
- **Fix:** Pick one rule and state it. Either key by (name + targetName), where a blank name is treated as "target" and replaces, or keep one entry per cast. Add a unit test for two different named targets. Reconcile R1 and the plan. Also say how an Aim re-arm (on you, no target) is handled, since it must keep the by-name replace.

### F3 — I3 — Taunt arm plumbing is only partly listed
- **Severity:** minor
- **Problem:** The arms descriptor is built in two UI places. ed-disciplines `_rollDetail` (l.409) builds `{name, rounds, appliesTo, effects}`. ed-combat l.804 builds the same shape, and Taunt reaches that path because the Combat talent picker passes `arms: t.arms` (l.560/l.831). Neither carries the display text or the opponent marker. The plan lists only ed-disciplines, and says it "already passes rounds". It does not mention ed-combat. Other consumers of `armedTalents` will also see Taunt: store l.2053, combat l.649/1027/1294 (armed badge and count) and ed-spells l.1271. They must ignore or filter it, or Taunt shows as an armed buff on you. Taunt's roll modal also shows the copy "Each success arms a per-success bonus for a later roll", which is wrong for Taunt.
- **Fix:** List both descriptor builders plus the roll-modal hint. Define where `text` and `opponent` live on the armed record. List the armedTalents consumers to audit. Add tests that Taunt folds nothing into rolls and is not counted as an armed-for-you bonus.

### F4 — I3 — `"rank"` resolution and validator claims are unverified
- **Severity:** minor
- **Problem:** store.js l.1191 is `rounds: cat.arms.rounds ?? 1`, so a string `"rank"` would flow through as-is and break `roundsLeft - 1` in `tickArmedTalents`. The plan says tools/rules-conformance.test.js has arms validators. A grep finds no `arms` reference in tools/. The only arms schema text is the `talents.json` l.11 header note, which says rounds is "how many rounds". The I7 text "EFFECT-TAXONOMY §6 only if I3 adds a field" contradicts I3, which always adds a value note. The arms text sits near docs/EFFECT-TAXONOMY.md l.350-363.
- **Fix:** Require the store to resolve to a number (talent rank, min 1) before it reaches `session.armedTalents`, with a store test. Drop the conformance-test claim, or add a check if one is needed. Update the `talents.json` header note and the taxonomy value note. Make I7 consistent.

### F5 — I2/I5 — Target name does not reach Disciplines or other surfaces
- **Severity:** minor
- **Problem:** I5 keeps the name in Combat SCRATCH and says it "rides Aim/Taunt/cast events". Taunt rolled from Disciplines has no access to the Combat field. The Spells cast flow has its own field (I6). Two inputs mean two sources of truth. The roll modal's `ed-roll` / `arms` detail has no name slot.
- **Fix:** Lift a single session "current target name" to ed-app (event up, model down), or state that Disciplines-rolled Taunt entries are labelled "target". Add the name to the arms descriptor and the ed-app handler explicitly.

### F6 — I2 — Cast-on-Other record timing and duration source
- **Severity:** minor
- **Problem:** ed-spells sets `effectTotal` after the cast (l.487), so the outcome's effect text is stale if the entry is built at cast time. `duration` is a string parsed by `durationRounds()`. "Rank" needs the caster's Spellcasting rank, and the minute/hour round-conversion is left as a "display choice". The plan also says ed-app builds the record from raw inputs, but the `ed-other-cast` payload (spell, target name, levels, total, effect total) is not defined.
- **Fix:** Define the event payload. Say whether the entry updates when the effect total arrives. Decide the minute/hour behaviour now (taxonomy §5 gives 10 rounds per minute). Say what happens with a non-parsable duration (no entry, or a text-only non-counting entry).

### F7 — I2/I5 — Options lift risks duplicate state
- **Severity:** minor
- **Problem:** The plan lifts toggled options to the session while ed-combat's `_opts` stays in SCRATCH. SCRATCH is restored per character, cleared in `clearCombatScratch`, reset locally on Initiative (l.904), and also holds the legacy `_charmsOn`. The lifted list must be cleared in lockstep on round advance, Day reset, character switch and SCRATCH restore, or the window shows stale "This attack" entries. The same applies to charms, which ed-app already clears in `_advanceRound`. The plan notes the `combat-mods-state` risk but gives no sync direction.
- **Fix:** State that ed-combat pushes `_opts` on every change (and on restore and reset), and that ed-app only mirrors it. Say whether the toggles should also be cleared by ed-app `_advanceRound`. Add a pure helper and tests for option-entry building and clearing.

### F8 — Sequencing — Circular dependencies
- **Severity:** minor
- **Problem:** I1 depends on "I2 state shapes", while I2 depends on "I1 shapes", and I2 also depends on I3 for Taunt. Sequencing runs I1, I2, I4, I6, I5, I3, I7, so I2's Taunt acceptance cannot be exercised until after I3.
- **Fix:** Define the entry and record shapes in I1 as the contract. Make I2 depend only on I1. Move the Taunt-specific acceptance to I3. Drop "I3 for Taunt" from I2.

### F9 — Testability and scope — Orchestration is outside node:test, and I2 is large
- **Severity:** minor
- **Problem:** Add, tick, end-routing and Day-reset logic is written in ed-app (a Lit class). Only `tickOpponentEffects` is pure. "X removes any kind", "re-cast replaces" and "Day reset clears" have no unit-test home. I2 spans ed-app, store, engine, ed-spells and ed-combat, so it is too large for one focused change. The plan never calls out manual owner verification for I4, I5 and I6 (light/dark, phone width, no truncation in stack, modal/Escape). Moving the `.aecard/.aerow` CSS and adding a new component may also affect tools/check-ui-kit.mjs and its baseline (`ui-kit-baseline.json`).
- **Fix:** Put reducers in the engine: `addOpponentEffect`, `endEffect(kind, id)` and `clearAll`. Test them there. Split I2 into (a) the state, tick and end reducers and (b) the options lift and the cast-on-Other event. Add an explicit owner manual-check list. Run the check-ui-kit and check-imports tools, and update the baseline if needed.

### F10 — I1/I2 — Endability of situation, Knocked Down and encumbrance rows
- **Severity:** minor
- **Problem:** The `ed-end-effect` router "by kind" covers spell/arm/charm/situation/opponent. Knocked Down is "locked until Stand up" (UI-GUIDELINES §4, which involves the Stand-up roll). The encumbrance Harried is locked on. Neither is an `ed-toggle-situation` case. "X ends any entry" is wrong for those two. The charm "end" semantics (does it unequip, like the spend, or only deactivate?) are also undefined.
- **Fix:** Set `endable=false` for Knocked Down and encumbrance rows, or route Knocked Down to the existing Stand-up flow. Specify what ✕ does for a charm and for a toggled option, and test it.

## Rules grounding
R1, R2, R3 and R5 each trace to a rules.md entry with a citation. The NOT-COVERED parts (R3 round-count start and early end, R1 stacking) are covered by the recorded 2026-11-24 house decision, except for the F2 inconsistency. No NEEDS_RULES.

## Guardrails
- Tier-1 sign-off for the Combat and Spells contents is recorded.
- The I3 reuse of `arms` with a new value is recorded as an owner decision, with no taxonomy bump. This is accepted, subject to the F4 doc updates.
- Data-down and events-up are respected, apart from the F5 and F7 points where state ownership is ambiguous.
- The plan has no Tier-2 items.
