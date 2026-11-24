# QA log: frighten-uplift

## 2026-11-24T11:50Z — asked by interrogator
**Q:** Taunt is display-only in the Active effects window (arms on talent, auto-adds an opponent entry on success for Rank rounds). Should Frighten work the same way (vs Mystic Defense, -2 per success to all the target's tests, Rank rounds, display-only, one entry per cast)?
**A:** Mirror Taunt, plus end-test (target's per-round Willpower test to end it).

## 2026-11-24T11:52Z — asked by interrogator
**Q:** For the end-test (target makes Willpower test each round vs your Frighten step), what should the app do?
**A:** Reminder text + existing X. Entry text states the end-test and the Frighten step to beat; owner resolves at the table and presses the existing X. No new roll UI.

## Owner's original request (feature input)
Rolling a successful Frighten should show an active effect on the target: -2 to all their tests per success level vs their Mystic Defense. Update the talent so it works in the Active effects window.

## 2026-11-24T11:58Z — asked by interrogator (Tier-1 sign-off)
**Q:** Taunt is flagged opponent only because roll is `vs: "Social"` (hardcoded in store.js); Frighten rolls vs Mystic like self-buff Mystic Aim. rules/*.json schema shapes are Tier 1. How to mark Frighten as an opponent arm?
**A:** "we need to uplift both to use the optional arm.opponent:true and remove the hardcoded component". => Owner SIGN-OFF (2026-11-24): add optional `arms.opponent: true` to rules/talents.json; migrate Taunt and Frighten to it; remove the `vs === 'Social'` hardcode in store.js.

## 2026-11-24T12:00Z — asked by interrogator
**Q:** How should the computed penalty appear on the target entry (computed total / computed for Taunt too / static)?
**A:** Computed total (Frighten only; Taunt keeps its static text and only moves to arms.opponent).

## 2026-11-24T12:03Z — asked by interrogator
**Q:** Anything else? Non-goals proposed: auto-applying the penalty to target rolls, in-app target Willpower end-test roll, stacking multiple Frightens, changing Taunt's display.
**A:** Those are non-goals.
