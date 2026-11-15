# Rules brief: roll-knacks (roll-knacks)

## R1 — A knack's test step is its own "Rank+ATTR" formula, using the parent talent's Rank
- **Status:** ANSWERED
- **Ruling:** A knack's printed Step/Action/Strain replace those of the associated talent when the knack is used. Knacks have no rank of their own; "Rank" is the governing talent's Rank (a skill-learned knack uses the skill rank). The attribute may differ from the parent's.
- **Sources:** RULES-FAQ Q033; companions-guide:2757-2760, 2805-2815, 2824-2825 (pp.76-77)
- **Decision:** none
- **Used by:** T1

## R2 — Karma on a knack roll
- **Status:** NOT-COVERED (inference: the talent's Karma rules apply, since a knack test is the governing talent's test)
- **Ruling:** Knack stat blocks have no Karma line; players-guide:4141-4157 (p.121) lets Karma be spent on a rolled talent, one point per use.
- **Sources:** RULES-FAQ Q033
- **Decision:** Owner 2026-11-15: knack rolls are Karma-eligible exactly as the parent talent (house ruling).
- **Used by:** T1

## R3 — Strain
- **Status:** ANSWERED
- **Ruling:** The knack's printed Strain replaces the parent talent's Strain (not additive).
- **Sources:** RULES-FAQ Q033; companions-guide:2824-2825
- **Decision:** none
- **Used by:** T1

## R4 — "N/A" / [Special Maneuver] knacks are not rolled
- **Status:** ANSWERED
- **Ruling:** Step N/A knacks (e.g. Roll With the Punches, Absorb Spell, crafting knacks) have no Action test; [Special Maneuver] knacks print no Step. No roll button.
- **Sources:** RULES-FAQ Q033; companions-guide:3034-3041, 2838-2846
- **Decision:** none
- **Used by:** T1

## R5 — Parent-talent bonuses applying to a knack test
- **Status:** NOT-COVERED (inference: plausibly yes, not book-explicit)
- **Ruling:** Nothing explicit.
- **Sources:** RULES-FAQ Q033
- **Decision:** Owner 2026-11-15: parent-talent roll mods carry to the knack roll (house ruling).
- **Used by:** T1

## R6 — Strain is paid per use of a talent, as full unmodified Health damage
- **Status:** ANSWERED (per-use regardless of outcome is an inference from the wording + Claw Frenzy)
- **Ruling:** Strain = damage taken each time the talent is used (each test). Full damage, no armor, never causes Wounds, counts toward Unconscious/Death ratings. Strain 0 talents cost nothing; NA/always-active talents are not rolled.
- **Sources:** RULES-FAQ Q034; PG:4192-4194, 4232-4243 (p.123), 4647-4653 (p.134)
- **Decision:** none
- **Used by:** T2

## R7 — Karma costs no Strain
- **Status:** ANSWERED
- **Ruling:** Spending Karma has no Strain cost (Battle Rites is the sole exception, out of scope).
- **Sources:** RULES-FAQ Q034; PG:4130-4132, 3900-3905
- **Decision:** none
- **Used by:** T2

## R8 — Strain data formats differ between book and app
- **Status:** APP-DIFFERS
- **Ruling:** rules/talents.json `strain` is numeric 0/1/2 (47 entries; variable-Strain talents like Claw Frenzy have no field). rules/skills.json is 0 everywhere. rules/knacks.json `strain` is a string: "0".."3", "N/A", null, "1 per minute", "1 per attack", "1+ (see below)", "0+ (see text)", "2+ (Special)", "1 Blood Magic Damage".
- **Sources:** RULES-FAQ Q034; rules/talents.json, rules/knacks.json
- **Decision:** Owner 2026-11-15: strain is a plain-number string on rollable knacks; normalize Swinging Move to "0" and Take the Hit to "2" (Tier 3 data edit). Non-rollable knacks keep their strings (never charged).
- **Used by:** T2

## R9 — Granted/Versatility talents keep their printed Strain
- **Status:** ANSWERED (inference)
- **Ruling:** Nothing removes printed Strain from granted/Versatility/racial talents (they get no Karma, but Strain applies).
- **Sources:** RULES-FAQ Q034; PG:4155-4157
- **Decision:** none
- **Used by:** T2
