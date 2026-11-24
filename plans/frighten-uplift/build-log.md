# Build log: frighten-uplift

## Run 1 — 2026-11-24 (since 2026-11-24T11:58:52Z)
**Alignment: PASS**
- Guardrails: I1 Tier 1, owner sign-off recorded (qa-log 2026-11-24T11:58Z). I2-I4 Tier 3. No Tier-2.
- Rules: R1-R5 all FAQ-HIT/ANSWERED; R2 APP-DIFFERS carries owner Decision (Rank rounds, one entry per cast).
- Open questions: only two non-blocking ones in plan.md (base step in reminder; leave `duration: "special"`). Accepted as planned.
- Tree: `docs/RULES-FAQ.md` modified (Q050, from this feature's rule-agent; included in the commit). `plans/frighten-uplift/` untracked (feature folder; included).
# Build log: frighten-uplift
- Added `arms.opponent` to Taunt and Frighten (rules/talents.json); Frighten arms + note effect.
- store.js: opponent from explicit flag, derived perSuccess, effects [] for opponent arms.
- engine/active-effects.js armOpponent composes perSuccess/note/Step text.
- ui/ed-disciplines.js, ui/ed-combat.js forward perSuccess + step.
- docs/EFFECT-TAXONOMY.md, data/changelog.json updated. validate-item.js has no arms allow-list.
- Gate: npm test green (2552 pass, 0 fail). No disputes.
