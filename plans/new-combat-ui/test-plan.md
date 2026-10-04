# Test Plan: New-Combat-UI (new-combat-ui)

## Test files
- ui/combat-mods-state.test.js
- ui/combat-log-rows.test.js

## Coverage
### ui/combat-mods-state.test.js
- MOD_TABS order/labels; modTabCounts: non-arms toggled, arms armed-only, sits = toggled + locked, charms length, undefined/empty inputs = 0; normalizeModTab valid ids and fallback to 'opts'.
- **Validates:** spec combat-mods-state contract (T3). **Rule:** n/a (rules.md: 0 rules). **Why:** wrong badge counts or bad cached segment.

### ui/combat-log-rows.test.js
- system/log/advancement rows (full, no detail, silver 0 omitted, legend 0 shown, default label), action row, roll rows (full, sparse, difficulty 0, no fabricated numbers), glyph rule, outcome pass-through.
- **Validates:** spec log cell mapping (T5). **Rule:** n/a. **Why:** lost or fabricated log fields, stray separators.

## Not covered (and why)
UI has no test harness; owner verifies by hand: 375px (no horizontal scroll, wrapped segments, two-line log rows, 320px log scroll, capped art box); light/dark; modals (audit, take damage, drink, clear: Escape/Enter); each segment with live counts; modTab reset on character switch, day reset, reload; Stand-up bar in Damage taken card once; Karma pill at 0 and null; header line values and delta badges.

## How to run
`npm test`
