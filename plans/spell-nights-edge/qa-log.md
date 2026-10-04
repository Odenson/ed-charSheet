# QA log: spell-nights-edge

## 2026-10-04 — asked by interrogator
**Q:** When Night's Edge is cast on This character, where does the player pick the weapon: (A) in the Spells cast flow, stored on the active-effect record; (B) all eligible weapons get it and pick on Combat tab; (C) other?
**A:** A — in the spell cast flow.

## 2026-10-04 — asked by interrogator
**Q:** Which weapons can be chosen when casting on This character: any weapon, only equipped/wielded, or melee only?
**A:** B — only weapons currently equipped or wielded, regardless of type (melee or missile). (Ruling for R3.)

## 2026-10-04 — asked by interrogator
**Q:** Does the D4 apply to every Damage test with the chosen weapon during the duration, or only the first?
**A:** A — every Damage test. (Ruling for R2.)

## 2026-10-04 — asked by interrogator
**Q:** Taxonomy shape for the object selection: separate optional `object` field (kind weapon|melee-weapon|missile-weapon|character|item, plus `require: "equipped"`), or a new `target.domain`? Dice proposal: reuse `attack-modifier` {attack, Damage} + `measure: "dice"` with a dice-notation string value ("D4", "2D6", "D4+D6"), v6 defines the grammar.
**A:** Separate `object` field. (Dice proposal not objected to; treated as accepted, reconfirm in final check.)

## 2026-10-04 — asked by interrogator
**Q:** Edge cases: (1) no equipped/wielded weapon at cast time: picker shows "No equipped weapon", no active effect created. (2) Chosen weapon unequipped/swapped mid-spell: effect stays on the record and counts down; D4 shows in the Combat damage pool only while that weapon is equipped. Accept?
**A:** Yes, accept both.

## 2026-10-04 — asked by interrogator
**Q:** Dice grammar ("D4", "2D6", "D4+D6") acceptable? Anything else or any ticket changes?
**A:** Dice grammar fine, nothing else, go ahead.

## 2026-10-04 — asked by reviewer (relayed via rule-agent)
**Q:** Does the D4 Bonus Die explode on its max roll, and is it separate from step and Karma dice?
**A:** rule-agent: ANSWERED. Yes explodes by the general rule; separate die (RULES-FAQ Q020). No owner input.

## 2026-10-04 — asked by interrogator
**Q:** Items have no ids. Add ids to the saved character file (Tier 1, schema /3), or identify the chosen weapon by name plus occurrence index among equipped items of that name (session-only, no data change), or name only?
**A:** A — name plus occurrence index. No saved-data change. (Item ids, if wanted, would be a separate Tier-1 feature.)

## 2026-10-04 — asked by interrogator
**Q:** Self-cast of a TMD spell: use caster's own Mystic Defense (prefill), leave as is (typed), or treat as weapon enchant vs a flat MD?
**A:** Night's Edge is cast on the weapon, so the target number is the weapon's Mystic Defense. Separately, as rules classification only (not applied to Night's Edge now): a willing target may lower their own Mystic Defense to 2 for the purposes of a spell cast on them.

## 2026-10-04 — asked by interrogator
**Q:** What number should the "vs" box hold for the chosen weapon: prefill 2 for ordinary weapons and use the item's Mystic Defense property for thread/magic items if present?
**A:** Yes. Non-thread items prefill 2. Thread items (or some magic items) carry a property denoting the item's Mystic Defense; if it exists, the prefill uses it. (Code check: thread-items.json entries already have a `mysticDefense` number, e.g. 8, 10, 12, documented in THREAD-ITEMS.md as "display-only"; this feature reads it as input.)

## 2026-10-04 — asked by interrogator
**Q:** If the player edits the "vs" box and then changes the weapon, should the new weapon's Mystic Defense overwrite the edit?
**A:** Owner described the flow instead: 1) weave the spell, 2) Cast opens the weapon selection, 3) set the target number in an editable field (prefilled default, user can change any default), 4) roll the cast using the selected weapon and the edited target number. (Weapon choice happens at Cast time; the target number is a step after it.)

## 2026-10-04 — owner-directed revision (planner)
**Q:** (none) Owner restated self-cast flow: weave, Cast opens a standard modal with weapon selection and an editable target number (prefilled from the weapon, user can change any default; manual edit kept on weapon change), confirm rolls and dispatches {name,index}; Escape cancels, Enter confirms; existing "vs" box not used for object spells on This character (planner: hidden, modal owns the number).
**A:** Applied to plan.md I6 and tickets.md T4.

## 2026-10-04 — asked by interrogator
**Q:** (open point) Where should the "No equipped weapon" state live, and does it block the cast?
**A:** It should be solved with an escape (way out) where the thread is consumed (wasted) and the spell is cast on nothing (wasted). Interpretation recorded: the modal shows "No equipped weapon" with an explicit action (e.g. "Cast on nothing") that spends the woven threads and the spell as a normal cast outcome, no roll target, no active effect. The Escape key still just cancels the modal with nothing spent (modal contract).

## 2026-10-04 — owner-directed revision (planner)
**Q:** (none) No-equipped-weapon resolved as 'Cast on nothing' (consume threads and spell via the existing post-cast _prog reset, no roll, no effect, wasted log row via ed-spell-wasted + saveRollLog); Escape cancels with nothing spent.
**A:** Applied to plan.md I6 and tickets.md T4.
