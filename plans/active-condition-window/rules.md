# Rules brief: active-condition-window

All answers from the rule-agent; ledger entry Q048 in docs/RULES-FAQ.md (Q042 holds a one-line Taunt).
Files: `rulebook extracts/rulebook extracts/` (talents = text-talents-players.txt; PG = text-RB-players-guide.txt).

## R1 — Taunt (opponent effect, timed)
- **Status:** ANSWERED
- **Ruling:** Rank+CHA, Simple, 1 Strain, vs target's Social Defense; target must understand the adept. Each success: −1 to the target's tests and −1 Social Defense, for rounds = the adept's own Taunt rank. One target. Resist Taunt (Free, Journeyman) negates. Re-use/stacking on the same target not stated.
- **Sources:** talents:636-639, 506-509; RULES-FAQ Q042/Q048
- **Decision:** none (stacking NOT-COVERED; display shows one entry per cast)
- **Used by:** opponent-effect entries

## R2 — Mystic Aim duration
- **Status:** ANSWERED (APP-AGREES)
- **Ruling:** +2 per success to ranged attacks vs that opponent until END OF THE ROUND, not rank rounds. App `arms.rounds: 1` already matches.
- **Sources:** PG:5621-5629; rules/talents.json arms
- **Decision:** none
- **Used by:** armed-talent entries

## R3 — Spell duration counting and early end
- **Status:** ANSWERED (units/"Rank"); NOT-COVERED (round-count start, voluntary early end)
- **Ruling:** "Rank" = caster's Spellcasting rank; durations in rounds/minutes/etc.; extra successes add duration. Books silent on which round counting starts and on ending a sustained spell voluntarily; only dispelling covered.
- **Sources:** spell-concepts:447-454, 731-756, 924-929, 980-982
- **Decision:** House ruling 2026-11-24: rounds tick per Initiative roll (app behaviour); ✕ manual end always available.
- **Used by:** spell entries, ✕ end control

## R4 — Other timed opponent effects (candidates)
- **Status:** ANSWERED (partial)
- **Ruling:** Rank-round: Frighten (−2 tests/success, Willpower test each round to shake), Fearsome Charge (−1 tests vs adept/success), Arcane Mutterings (Harried + Social Def), Astral Interference, Elemental/Spirit Hold; Spells (Rank rounds): Slow, Vertigo, Shadow Tether, Stampede, Slow Weapon. Until end of next round: Battle Bellow (−1/success), Battle Shout (−2/success). Same round: Distract (−1 PD/success, Blindsided), Bank Shot (that attack only). Engaging Banter: Rank minutes. No "Entangle" spell in the table (mock name was a placeholder). Many spells list no duration in the table.
- **Sources:** talents file lines in rule-agent report; text-spell-table-all.txt
- **Decision:** 2026-11-24: first version ships Taunt only; others are later Tier-3 data.
- **Used by:** opponent-effect entries

## R5 — Combat options are single-round
- **Status:** ANSWERED
- **Ruling:** Declared before Initiative; Aggressive Attack/Defensive Stance last "that round" (mutually exclusive); Called Shot per attack. No option has a multi-round duration.
- **Sources:** PG:14375-14481 (pp. 382-385)
- **Decision:** none
- **Used by:** "This attack" group (round-count-free entries; cleared on a new round/day reset)
