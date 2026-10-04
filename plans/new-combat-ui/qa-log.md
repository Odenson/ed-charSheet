# Q&A log: New-Combat-UI (new-combat-ui)

## 2026-10-04 — asked by interrogator
**Q:** Tier 1 sign-off — UI-GUIDELINES §4 defines the Combat tab as "equipped weapon + attack talent, attack/damage/strain stat-lines with a target-# field, collapsible combat-option / situational / blood-charm chip sections, a damage-taken rail, and the device-local roll log". The approved Option A design changes this: the three collapsible chip sections become one tabbed segmented control (no collapse chevrons); Defence, Armour and Initiative leave their card and float as a header line with Available Karma added; the log becomes a full-width table; Damage taken sits beside the attack card instead of a right rail. Sign-off to change the Combat tab UI contract this way and update the Combat row of UI-GUIDELINES §4 to match?
**A:** Yes, I give sign-off. (Tier-1 sign-off recorded for the Combat-tab layout/contract change; design reference: the approved Option A prototype, scratchpad `combat-option-a.html`, summarised in tickets.md.)

## 2026-10-04 — asked by interrogator
**Q:** Modifier segmented control: which segment starts selected and is the choice remembered? (a) start on Combat options, remember last pick per character in the session scratchpad, reset on reload/day reset; (b) start on first segment with an active chip; (c) always Combat options, never remembered.
**A:** a) start on combat options.

## 2026-10-04 — asked by interrogator
**Q:** Log table columns — (a) glyph · Roll · Step · Total · vs · Outcome · Detail (nothing the current log shows is lost; system/advancement rows put label detail + Legend/silver/coin in Detail; action rows show "—" for numeric columns), (b) prototype four columns, (c) other.
**A:** a) nothing the current log shows is lost.

## 2026-10-04 — asked by interrogator
**Q:** Narrow screens (≤720px) — proposal: header line wraps (Defence, Armour, Initiative, Karma stay together as plain text); sections stack Attack, Damage taken, Modifiers, Potions, Log; log rows fold into two-line stacked rows (line 1 glyph/Roll/Step/Total/vs/Outcome, line 2 muted Detail), log still capped at 320px and scrolls internally; modifier segments share the row and wrap. Approve?
**A:** I approve this proposal.

## 2026-10-04 — asked by interrogator
**Q:** Karma pill — same source and format as the Spells tab ("Available Karma N" from model.characteristics.karma.available, hidden when null, static, no max, no click), at the right end of the floating header line; shows 0 when available is 0. Approve?
**A:** I approve it as the Spells tab does it.

## 2026-10-04 — asked by interrogator
**Q:** Empty modifier segments — keep all three segments (Combat options, Situational, Blood charms) always visible and show the existing empty message when a selected segment has no content, vs hiding empty segments?
**A:** I approve keeping all three segments visible with the existing empty message.

## 2026-10-04 — asked by interrogator
**Q:** Anything else material missing from the scope (header line, Attack + Damage taken cards, tabbed modifiers, Potions card, log table, mobile fold, UI-GUIDELINES §4 update; view-only change to ui/ed-combat.js)?
**A:** done.

## 2026-10-04 — asked by dev-lead
**Q:** Confirm the plan's three open-question defaults: (1) keep the weapon art box visible at ≤720px at a small fixed size (prototype hid it); (2) log table uncapped on desktop (store keeps ≤20 entries by default), capped at 320px at ≤720px; (3) empty-segment messages — Combat options "No combat options apply to this pick.", Situational "No situations apply right now.", Blood charms keeps its existing text.
**A:** I approve all three defaults.
