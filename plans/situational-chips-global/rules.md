# Rules brief: Situational chips global (situational-chips-global)

All sources: `rulebook extracts/text-RB-players-guide.txt` (Player's Guide, Situation Modifiers pp. 386-390; table lines 14578-14595). Ledger: docs/RULES-FAQ.md Q027.

## R1 — Blindsided
- **Status:** ANSWERED
- **Ruling:** −2 Physical & Mystic Defence **against the attack** (GM may apply to Social). Per attack, no timed duration; attacker must see target. Fully Surprised target takes Surprised instead.
- **Sources:** Q027; lines 14546-14554, 14595
- **Decision:** App models it as a free toggle chip (owner, 2026-10-05).
- **Used by:** T2

## R2 — Surprised
- **Status:** APP-DIFFERS
- **Ruling:** No actions this round; −3 Physical & Mystic Defence until end of round (GM may apply to Social). Book gives a numeric −3 Defence; app `rules/combat.json` encodes only a note.
- **Sources:** Q027; lines 14684-14688, 14593-14594
- **Decision:** Owner 2026-10-05: follow the book — add −3 Physical & Mystic Defence effect; no-actions stays a note.
- **Used by:** T2

## R3 — Cover
- **Status:** ANSWERED
- **Ruling:** Partial cover +2 Physical & Mystic Defence; Full cover: cannot be attacked (Defence n/a). Mutually exclusive in practice.
- **Sources:** Q027; lines 14557-14567, 14584
- **Decision:** none
- **Used by:** T2

## R4 — Darkness / Blindness
- **Status:** ANSWERED (scope gap resolved by owner)
- **Ruling:** Partial −2, Full −4 to any sight-based tests (Low-Light Vision / Heat Sight modify). Book does not say which tests are sight-based.
- **Sources:** Q027; lines 14585-14586, 14596-14618
- **Decision:** Owner (2026-10-05): scoped penalties offered as a per-roll toggle on non-combat rolls; owner/player decides applicability.
- **Used by:** T3, T4

## R5 — Range / Impaired Movement
- **Status:** APP-DIFFERS (Impaired Movement)
- **Ruling:** Range Long −2 to Attack and Damage tests; Short none. Impaired Movement is GM discretion: Light −5 Movement Rate or −2 to *movement-based tests*; Heavy −10 or −4; app encodes −2/−4 to all Action tests.
- **Sources:** Q027; lines 14670-14678, 14636-14647
- **Decision:** Owner 2026-10-05: treat as scoped per-roll toggle like Darkness/Range; Movement Rate reduction stays a note.
- **Used by:** T3

## R6 — Stacking
- **Status:** ANSWERED (gap: inference)
- **Ruling:** No rule forbids stacking; Harried+Blindsided worked example is additive (Defence 10→8→6). Test mods apply to Step, min Step 1.
- **Sources:** Q027; lines 14624-14634, 887-889
- **Decision:** Owner 2026-10-05: additive, no cap. Consequence: Surprised + Blindsided can both be toggled (−5); the book makes a fully Surprised target take Surprised instead of Blindsided — player-managed, not enforced.
- **Used by:** T1

## R7 — Harried / Knocked Down test scope
- **Status:** ANSWERED
- **Ruling:** Harried −2 and Knocked Down −3 apply to tests generally (Knocked Down hits next Initiative per example); plus −2 / −3 Physical & Mystic Defence.
- **Sources:** Q027; lines 14623-14624, 14650-14661, 891-893
- **Decision:** none
- **Used by:** T1

## R8 — Harried / Knocked Down: which tests, Step vs Result
- **Status:** ANSWERED (inference for non-Action tests)
- **Ruling:** Harried −2 and Knocked Down −3 read as "his tests" generally (no scope; table header "Action Test Modifier" is a generic column label; Knocked Down explicitly hits Initiative). Default is a **Step** modifier (applied before dice, min Step 1); Harried's own example reduces test Steps. GM may instead apply a Result modifier. Recovery/Knockdown/spell/skill tests: unnamed, covered only by inference. Range Long applied to the Step.
- **Sources:** Q027 (scope refinement); lines 886-897, 14579-14595, 14623-14624, 14650-14661, 14675-14678
- **Decision:** none (reviewer F1/F2: planner must define step vs result handling; app's Knocked Down currently uses a flat result mod)
- **Used by:** T1, T3, T5

## R9 — Range Long applies to Attack and Damage; Short has no modifier
- **Status:** APP-DIFFERS (app applies Long to attack pools only)
- **Ruling:** Long: −2 penalty to Attack and Damage tests (each Step reduced separately); Short: no modifier. Table row does not name the tests; prose does.
- **Sources:** Q027; text-RB-players-guide.txt:14667-14678 (p.390), 14591-14592
- **Decision:** Owner 2026-10-05: remove the Range — Short chip (no effect). Long on damage: follow book (applies to Damage too) — pending owner veto at review.
- **Used by:** T2, T3, T5
