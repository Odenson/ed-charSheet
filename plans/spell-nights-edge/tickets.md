# Feature: Night's Edge (spell-nights-edge)

## Summary
Night's Edge in `rules/spells.json` is missing its book extras and cannot express its main effect: a D4 Bonus Die added to a chosen weapon's Damage test. This feature aligns the entry to the Player's Guide, adds two taxonomy concepts (dice-valued effects and an `object` selector), and wires the Spells cast flow and the Combat damage pool so a self-cast attaches the D4 to one equipped weapon for the duration.

## Goals / Non-goals
- Goal: Night's Edge data matches the book (stats, success level, extra threads, -2 Mystic Defense note).
- Goal: Taxonomy v6 defines dice-notation values and an `object` field (kind + `require`).
- Goal: Cast on This character, the player picks one equipped/wielded weapon (any type); the Combat tab adds the D4 to that weapon's Damage pool for every Damage test while the spell is active and the weapon is equipped.
- Goal: Cast on another target, the effect is text under Target effects, no picker.
- Non-goal: Night's Blade knack (-4 penalty).
- Non-goal: Using `object` kinds `character` / `item` / `melee-weapon` / `missile-weapon` in any spell now. They are defined in the vocabulary, but only `weapon` + `require: equipped` is exercised by data.
- Non-goal: Applying R7 (a willing target may lower its Mystic Defense to 2): classification only, not applied.
- Non-goal: Modelling the target-side -2 Mystic Defense penalty (stays a gmDiscretion note, like Arrow of Night).

## Guardrail alignment
Touches docs/EFFECT-TAXONOMY.md (Tier 2), `rules/*.json` (Tier 2 migration + Tier 3 data), `engine/*` and `ui/*` (Tier 3). No Tier 1 surface changes: the chosen weapon lives only in the session-only active-spell record (nothing new persisted, "store only inputs" intact); the engine stays pure and reads structured effects; the picker honors UI-GUIDELINES (theme, Escape/Enter in any modal). No Tier-1 sign-off needed.

## Tickets
### T1 — Taxonomy v6: dice values and `object` field
- **What:** Update EFFECT-TAXONOMY.md: bump v5 to v6; define dice-notation string values for `measure: "dice"` (e.g. `"D4"`, `"2D6"`, `"D4+D6"`); add optional `object` field `{ kind: weapon|melee-weapon|missile-weapon|character|item, require?: "equipped" }`; add a worked example. Migrate every `rules/*.json` `effectTaxonomy` ref v5 to v6 and any schema tags, update stamping code (save worker, dev server), and extend `tools/rules-conformance.test.js` to validate `object` and dice values.
- **Why:** The new effects need vocabulary; Tier 2 requires all three steps together.
- **Tier:** 2 (all three migration steps committed)
- **Acceptance criteria:** Doc says v6; all `rules/*.json` reference v6; `npm test` conformance passes and rejects a malformed `object` kind or dice string.
- **Open questions:** none

### T2 — Night's Edge data aligned to the book
- **What:** In `rules/spells.json` set: threads 0, weaving 6/11, Touch, Rank+5 rounds, casting vs target's Mystic Defense; Success Level "Increase Duration (+2 rounds)"; extra threads "Increase Effect (+2 Damage Step)" (attack-modifier step), "Increase Range (+10 yards)", "Additional Target (+Rank)"; top-level sustained `attack-modifier` {attack, Damage} add `"D4"` dice with `object: { kind: weapon, require: equipped }`; gmDiscretion note for -2 Mystic Defense until the end of the next round; fix the truncated `summary`.
- **Why:** Entry is missing book extras and its note is a stub.
- **Tier:** 3 (uses T1 vocabulary)
- **Acceptance criteria:** Entry matches rules.md R1/R4; passes conformance; Target effects text renders the D4 and the penalty for another target.
- **Open questions:** none

### T3 — Engine: dice-valued bonus for a chosen weapon
- **What:** Engine (pure) folds a sustained spell `attack-modifier` with a dice value into the Damage pool of the weapon recorded on the active-spell record, for every Damage test while active; the +2 Damage Step extra thread folds as a step on the same weapon. If the chosen weapon is not equipped, the dice are not folded; they return on re-equip. The active record stores the chosen weapon as `chosen: { name, index }`, where `index` is the 0-based occurrence among equipped items of that name (session-only; no saved-data change, no item ids). Duplicate-name weapons are therefore distinguishable. Item ids would be a separate Tier-1 feature.
- **Why:** The D4 must reach the Damage roll, not just display.
- **Tier:** 3
- **Acceptance criteria:** Unit tests: D4 added for the chosen equipped weapon only; absent for other weapons, including a same-name duplicate with a different index; absent while unequipped, present again on re-equip; countdown unaffected; extra-thread step folds.
- **Open questions:** none

### T4 — Spells cast flow: weapon + target-number modal and no-weapon state
- **What:** For a spell whose effects carry an `object` cast on This character: 1) weave as today; 2) pressing Cast opens a standard modal (`ui/modal-controller.js`, docs/MODALS.md) listing the character's equipped/wielded weapons (any type); 3) the same modal has an editable target-number field prefilled with the chosen weapon's Mystic Defense (the item's `mysticDefense` property if present, else 2; the user can change any default); 4) confirming rolls the cast with the chosen weapon and the edited number and dispatches `ed-spell-activate` with the choice as `{ name, index }`. Escape cancels with no roll; Enter confirms. If two or more equipped weapons share a name they are labelled "Spear", "Spear (2nd)", "Spear (3rd)"; plain names otherwise. No equipped weapon: the modal shows "No equipped weapon" with an explicit "Cast on nothing" action that wastes the woven threads and the spell exactly as an ordinary completed cast consumes them (the existing post-cast progress reset in the Spells tab), with no cast roll, no active effect, and a Roll Log row saying the spell was wasted. Escape cancels the modal with nothing spent. Changing the weapon re-prefills the number only while the user has not edited it; a manual edit is kept. The existing "vs" box is not used for these spells on This character (hidden; the modal owns the number). Cast on Other is unchanged: no modal, effect shown as text under Target effects, "vs" box as today. The active-effect list names the chosen weapon. THREAD-ITEMS.md's "display-only" note on `mysticDefense` gets a small update (also read as the cast modal's default target number).
- **Why:** The owner chose selection in the cast flow, with the target number set at Cast time.
- **Tier:** 3 (UI-GUIDELINES honored: theme-aware, Escape/Enter via the shared modal controller)
- **Acceptance criteria:** As described; dispatch-up only, no state mutated in the view. Store-level test: `equippedWeapons` carries `mysticDefense` from the item's `thread` block (thread weapon 10, plain weapon null). "Cast on nothing" leaves any armed Anticipate Spell bonus armed (no roll happens); its Cast row uses a defined wasted marker `{total: null, levels: 0, outcome: {word: 'Wasted'}}`. Confirm hands off to the roll modal without returning focus to Cast. Pure-helper tests: a thread weapon uses its `mysticDefense`; an ordinary weapon gives 2; no weapon gives none; the number re-prefills on weapon change only while untouched; `castWeaponChoices` labels and empty state; the wasted-cast log entry builder; Cast on nothing leaves no active effect and clears woven threads, Escape leaves them.
- **Open questions:** none

### T5 — Combat tab: show the D4 in the weapon's Damage pool
- **What:** The Combat tab's Damage pool for the chosen weapon includes the D4 while active and equipped, with an audit label naming Night's Edge, consistent with how Arrow of Night's bonus is shown.
- **Why:** The player must see and roll the bonus die.
- **Tier:** 3
- **Acceptance criteria:** Selecting the chosen weapon shows the added die; other weapons do not; log rows record it.
- **Open questions:** none

### T6 — Docs, changelog, tests
- **What:** Update ARCHITECTURE.md/UI-GUIDELINES.md references as needed (spell cast flow), changelog entry, and tests across T1 to T5.
- **Why:** Docs must stay truthful to shipped behavior.
- **Tier:** 3
- **Acceptance criteria:** Docs match the shipped behavior; `npm test` green.
- **Open questions:** none
