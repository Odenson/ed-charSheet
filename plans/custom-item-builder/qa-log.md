# Q&A log: custom-item-builder

## 2026-10-05T01:20Z — asked by interrogator
**Q:** What is the full scope of the builder change? Only add `unarmed` to the weapon Category dropdown, or also other builder changes for the unarmed-gauntlet scenario (hide range fields, sync Damage Step with the quick-template effect)?
**A:** Consider all the changes needed.

## 2026-10-05T01:24Z — asked by interrogator
**Q:** Gap: for a plain weapon the Combat tab reads `ref.damageStep`; the weapon's `attack-modifier` Damage effect is not folded (engine/combat.js:325). How should the builder relate the Damage Step field and the Damage effect? (a) field is single input, builder generates/updates the effect; (b) both independent + warning; (c) keep as is.
**A:** (a) the Damage Step field is the single input.

## 2026-10-05T01:27Z — asked by interrogator
**Q:** Short/Long range fields when category is `unarmed`? (a) hide both for unarmed and clear stored range on switching to unarmed; (b) hide for unarmed and melee; (c) leave visible.
**A:** (a) hide both for unarmed.
(Interrogator note: Damage Step 0 dropped by cleanItemForm treated as a Tier-3 bug fix; owner did not object.)

## 2026-10-05T01:30Z — asked by interrogator
**Q:** Existing custom weapons saved under the old model (effect and field may disagree/missing)? (a) seed empty field from Damage add effect on open; on save the field is authoritative and rewrites the effect; empty field = no generated effect; (b) no migration; (c) field always authoritative even on open.
**A:** (a) seed the field from the effect on open.

## 2026-10-05T01:33Z — asked by interrogator
**Q:** Hand-added `attack/Damage add step` effect on a weapon duplicates the generated one. (a) show generated effect read-only labelled "from Damage Step" + validation error on save for a hand-added duplicate; (b) silently drop; (c) allow duplicates.
**A:** (a) read-only generated effect plus validation error.

## 2026-10-05T01:36Z — asked by interrogator
**Q:** Anything else / does scope (category unarmed; Damage Step single input w/ generated read-only effect; validation of hand-added duplicate; seed on open; store 0; hide range for unarmed; tests+docs+changelog) match? Seed Gauntlet data?
**A:** Scope looks right, go ahead. (No seed data: owner builds it in the UI.)

## 2026-10-05T01:40Z — asked by interrogator (rule-agent R3, NOT-COVERED / Q026)
**Q:** Books do not say how an attached weapon's (gauntlet) Damage Step combines with Strength. Treat an unarmed-category weapon's Damage Step as additive to Strength (house convention)?
**A:** (a) yes, additive house convention.

## 2026-10-05T01:41Z — asked by interrogator (rule-agent R4, NOT-COVERED / Q026)
**Q:** Books silent on whether weapon Damage Step 0 is valid. Accept and store 0?
**A:** (a) yes, store 0 (app convention).
