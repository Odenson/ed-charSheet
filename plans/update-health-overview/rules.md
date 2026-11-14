# Rules brief: Update Health overview (update-health-overview)

All citations: `rulebook extracts/rulebook extracts/text-RB-players-guide.txt`. No rule differs from the app; the feature changes presentation and interaction only.

## R1 — One Wound per hit at or above the Wound Threshold
- **Status:** FAQ-HIT
- **Ruling:** One Wound if a single attack's damage, after armour, is at least the Wound Threshold — one per attack, never multiple. Still recorded if the hit also makes the character unconscious/dead. (The owner's "wound(s)" is satisfied by one Wound per hit; repeated hits add more.)
- **Sources:** RULES-FAQ Q010; :14265-14273 (p. 379/380); :2061-2063 (p. 65)
- **Decision:** none
- **Used by:** T3

## R2 — Knockdown at WT + 5
- **Status:** ANSWERED
- **Ruling:** Knockdown test when damage exceeds the Wound Threshold by 5 or more (damage ≥ WT+5); Strength test against Difficulty = damage − Wound Threshold; failure = knocked down.
- **Sources:** RULES-FAQ Q031 (Q010); :14274-14289 (p. 380); :14396-14403 (p. 383)
- **Decision:** none
- **Used by:** T3

## R3 — Unconscious / Death thresholds
- **Status:** ANSWERED
- **Ruling:** Unconscious when Current Damage ≥ Unconsciousness Rating (below Death); dead when ≥ Death Rating. Ratings are derived by the engine (Unconsciousness = 2 × Toughness value; Death = Unconsciousness + Toughness Step + Circle). The gauge scale (Death) and tick (Unconscious) use these.
- **Sources:** RULES-FAQ Q031; :14290-14307 (p. 380); :2054-2060 (p. 65)
- **Decision:** Amber warning margin ("within 10 of Unconscious") is an owner UI choice, not a rule (qa-log 2026-11-15).
- **Used by:** T1, T2

## R4 — Recovery test, healing only via Recovery
- **Status:** ANSWERED
- **Ruling:** Recovery test is rolled at the Toughness Step; the result is subtracted from Current Damage; limited per day (Toughness-derived), no carry-over; each Wound reduces the result by 1 (minimum 1 recovered). Damage is healed only through Recovery tests, certain talents/spells, or healing aids — no free-entry healing.
- **Sources:** RULES-FAQ Q031; :14312-14338 (pp. 380-381); :14339-14348 (p. 381); :2064-2067 (p. 65)
- **Decision:** none
- **Used by:** T4

## R5 — Healing Wounds
- **Status:** FAQ-HIT
- **Ruling:** One Wound heals per day, only at 0 Current Damage and via the Recovery test after a full night's rest. (Existing day-reset flow; unchanged.)
- **Sources:** RULES-FAQ Q010; :14355-14364 (p. 382)
- **Decision:** none
- **Used by:** T4 (context only)
