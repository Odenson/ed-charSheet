# Q&A log: Unarmed Combat missing short effect (unarmed-short-effect)

Backlog: B-001 · bug · Warrior discipline / talents

> While testing the Fighter Test (Troll) character on dev, the Warrior's Unarmed
> Combat talent, an optional pick at Circle 1, shows no short effect. Other
> talents carry a `shortEffect`, so this one looks incomplete next to them.
> Unarmed Combat needs its short effect added.

Interrogator finding (setup): `rules/talents.json` "Unarmed Combat" is a bare
stub — only `name`, `action`, `attribute`; no `strain`, `skillUse`, `tier`,
`versus`, `summary`, `effects` or `presentation.shortEffect`. The other Warrior
Novice optionals Shield Bash, Tactics and Fireblood are stubs too; 385 of 456
talent entries lack a shortEffect. Melee Weapon is the closest full sibling.

## 2026-11-26T21:57:23Z — asked by interrogator
**Q:** Unarmed Combat's rules entry is a bare stub (and so are Shield Bash, Tactics, Fireblood). What scope: full Unarmed entry, shortEffect only, or all four Warrior stubs?
**A:** Full Unarmed entry — fill Unarmed Combat out to match Melee Weapon (shortEffect, strain, skillUse, tier, versus, summary, effects). Other stubs stay for later.

## 2026-11-26T21:57:50Z — asked by interrogator
**Q:** Wording for the talent's shortEffect: "Attacks with body" (matches the skill), "Unarmed attack", or "Unarmed close-combat attack"?
**A:** "Unarmed close-combat attack".

## 2026-11-26T21:58:26Z — asked by interrogator
**Q:** Plan: fill the Unarmed Combat talent to match Melee Weapon (shortEffect "Unarmed close-combat attack", strain, skillUse, tier, versus, summary noting Strength-step damage, on-success note effect), rule values verified by rule-agent, plus a data test. Other stubs out of scope. Anything else?
**A:** No, that's it.
