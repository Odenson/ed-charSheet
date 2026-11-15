# Test Plan: Roll knacks (roll-knacks)

## Test files
- knacks-catalog.test.js (appended roll-knacks block)
- engine/derive.test.js (appended knackRoll block)
- store-knack.test.js (appended roll-knacks model block; adds a talentStep import)
- engine/discord-roll.test.js (appended Strain line block)
- engine/discord-embed.test.js (appended Strain field block; adds an escapeDiscord import)

## Coverage
### knacks-catalog.test.js
- **every rollable-step knack has a full-name attribute agreeing with its step** — validates I1/T5: 100 rollable knacks, attribute matches the step abbreviation. Rule: R1, R8. Catches missed/wrong data.
- **every rollable-step knack has a plain-number strain** — validates T5. Rule: R8.
- **Swinging Move "0", Take the Hit "2", summaries still mention Strain** — validates T5. Rule: R8.
- **non-rollable knacks gain no attribute; Improvised Pattern / Make Concession unchanged** — Rule: R4, R8. Catches the data edit leaking.
- **Bribery -> Charisma, Lip Reading -> Perception**; **notes line mentions `attribute`**.

### engine/derive.test.js (knackRoll)
- Same-attribute step equals parent step; dice via diceForStep; strain. Rule: R1.
- Own attribute: step = parent.step - parentAttrStep + knackAttrStep. Rule: R1.
- Parent folded step-mod / rank grant carries. Rule: R5.
- No-attribute parent fallback talentStep(knackAttr, rank) + step rollMods. Rule: R1, R5.
- Floor at 1.
- Null for N/A, NA, null step; null for missing attribute/parent/non-finite attribute step. Rule: R4.
- Knack strain replaces parent's (0 under 1-parent); numeric/string/non-numeric/empty/null strain. Rule: R3, R8.
- Karma follows parent; null for Versatility-style null and skill parents. Rule: R2.
- resultMods carried, default []. Rule: R5.

### store-knack.test.js
- Lip Reading model roll: step = Awareness rank + PER step (and equals parent step), dice, strain, karma, resultMods. Rule: R1, R2, R3.
- Make Concession roll === null. Rule: R4.
- Skill-learned Hunting with knackParents on: skill rank step, karma null. Rule: R1, R2.
- talent.rollStrain equals the talents.json numeric strain, null/finite otherwise. Rule: R6, R9.

### engine/discord-roll.test.js
- Strain absent when missing/0/negative; present as `Strain N` after Mods, before Total; markdown knack name escaped; long-detail cap keeps header/Total (<=2000).

### engine/discord-embed.test.js
- Strain field absent when missing/0; present as `{name:'Strain', value:'N', inline:true}`; escaped title; stays within the 6000 guard.

## Not covered (and why)
No browser harness, so the owner verifies by hand:
- Roll button on knack rows (Lip Reading, a skill-learned knack with knackParents on); none on Make Concession; aria/title "Roll <knack>" (+ " (Karma available)"); keyboard activation; light/dark; mobile width; Overview fit.
- Modal titled with knack name; Strain charged once on open (Strain-1 talent, Swinging Move 0, Take the Hit 2); "N Strain on roll." hint only when N > 0; Karma toggle and Step-mod toggle do not re-charge; Mystic Aim charged once via aim, set-dice as before, neither gets a log Strain chip; Strain never creates a Wound.
- Roll Log "Strain N" chip only when > 0; one row per interaction.
- Escape/Enter on the modal.

## How to run
`npm test`
