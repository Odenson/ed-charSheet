# Q&A log — active-condition-window

## 2026-11-24 — asked by interrogator
**Context:** Owner approved mock-d.html (Option D, shared Active effects element styled like the Spells card; Combat = 3 groups side by side above the log, Spells = single stacked column). Spells "Target effects" card folded into the "on target" group (owner did not object).
**Q:** The Overview tab already has a compact Active Effects strip. How should the new shared element relate to it?
**A:** Leave Overview alone. New element lives only in Combat and Spells.

## 2026-11-24 — asked by interrogator
**Q:** Which sources should feed the shared list?
**A:** All four: active spells (self + cast on Other); armed talents (Aim etc.); timed talent effects on opponents (Taunt); toggled combat options + blood charms.

## 2026-11-24 — asked by interrogator
**Q:** Should Situational chips and Knocked Down also be listed?
**A:** Yes, read-through (listed under "on you" with an end/clear control; chips and Overview strip remain the source).

## 2026-11-24 — asked by interrogator
**Q:** How should an opponent effect like Taunt get into the list?
**A:** Auto on a successful roll (rounds = rank, like Aim arms today); owner can end it with ✕.

## 2026-11-24 — asked by interrogator
**Q:** Taunt's entry is only a prose `note` effect, no duration. How structured should opponent effects be?
**A:** Display-only from existing data: show note text + successes + rounds (= rank) via small data addition that fits today's taxonomy; no engine folding of opponent penalties, no taxonomy change.

## 2026-11-24 — asked by interrogator
**Q:** How should spells cast on Other be handled in the shared list?
**A:** Track each successful duration cast as an "on target" entry with countdown (ticks each Initiative, can be ended); the old one-off "Target effects" card is removed.

## 2026-11-24 — asked by interrogator
**Q:** How should "on target" entries be labelled (several opponents, app knows only a target number)?
**A:** Optional name field (e.g. "Orc Raider") on the Combat attack row / spell cast; blank shows "target".

## 2026-11-24 — asked by interrogator
**Q:** Grouping rule — Aim (armed, counts rounds) sat under "This attack" in the mock.
**A:** Group by lifetime + side: This attack = toggled options/charms with no round count; anything with rounds goes to Lasting · on you / on target (Aim moves to Lasting · on you). Mock to be corrected.

## 2026-11-24 — asked by interrogator
**Q:** Tier-1 sign-off: add Active effects section to Combat, rebuild Spells "Active effects" card as the shared element, remove Spells "Target effects" card (UI-GUIDELINES §4 tab contents; docs updated in the same change).
**A:** Signed off.

## 2026-11-24 — rules grounding (rule-agent, Q048)
Findings recorded in rules.md R1–R5. Notes: Mystic Aim lasts until end of round (app arms.rounds=1 agrees; mock's "Aim 2 rds" was placeholder); spell round-count start and voluntary early end NOT-COVERED; no "Entangle" spell in books.

## 2026-11-24 — asked by interrogator
**Q:** Books are silent on spell round counting and voluntary early end. How to rule?
**A:** Keep app behaviour — rounds tick down on each Initiative roll; ✕ always available as a manual end (house decision, GM/table convenience).

## 2026-11-24 — asked by interrogator
**Q:** Which opponent talent/skill effects ship in the first version?
**A:** Taunt only. Other abilities (Frighten, Battle Bellow, etc.) are later Tier-3 data additions. Spells cast on Other use the generic tracking already decided.

## 2026-11-24 — asked by interrogator
**Q:** Anything else material before tickets?
**A:** Nothing else.

## 2026-11-24 — asked by planner (relayed by interrogator)
**Q:** Taunt does not fit the `arms` shape (rounds = rank, opponent side, skill+talent hook). New optional field (Tier 1) or code-only table?
**A:** Owner asked why anything must change. Clarified: Taunt talent lacks an `arms` block (Aim has one) and `arms.rounds` is numeric only; spells carry a `duration` string parsed by the grandfathered `durationRounds()`, and talents have no equivalent roll-creates-record hook except `arms`.
**Decision:** Reuse `arms` on the Taunt talent only: `arms: { roll: { vs: "Social" }, rounds: "rank" }`; store resolves "rank" to the talent rank; no new fields; Taunt skill left out of v1; documented as a value note in EFFECT-TAXONOMY §6 (no version bump). Tier 3.
