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

## Dev Lead review
Clean. Diff matches spec; Social inference removed from store.js; test files byte-identical to the tester's snapshot; descriptors forward `perSuccess` + top-level `step`; opponent arms get `effects: []`.

## Doc sync
Applied: PLAN-TALENT-COMBAT-OPTIONS §13.2 `arms` table (opponent, "rank"); superseded banners on plans/active-condition-window plan.md and spec.md.
Deferred (owner's call, protected doc): docs/EFFECT-TAXONOMY.md:355 one-line shape `{ roll:{vs}, rounds }` -> add `opponent?` (prose only, no version bump). Skipped as low value: docs/TAXONOMY-AUDIT.md:609 (dated audit), ARCHITECTURE.md:316 wording ("Taunt, Frighten and cast-on-Other").

## GUARDRAILS PR checklist
- Tier 1 (I1 `arms.opponent` schema field): owner sign-off qa-log 2026-11-24T11:58Z. PASS
- Tier 2: no taxonomy vocabulary change, no version bump. PASS
- Golden rule: engine pure/DOM-free; UI only forwards descriptor fields; derived values (`perSuccess`) computed in store, none stored. PASS
- Rules values match rules.md (-2 per success, Rank rounds, Willpower end-test vs Frighten Step). PASS
- Gate: `npm test` green.

## Manual UI verification (owner, on dev)
1. Disciplines tab: roll Frighten with a hit. Combat or Spells tab Active effects shows a target entry "Frighten", "N successes", "-2 x N = -2N to all tests. Target may make a Willpower test ... Frighten Step S.", countdown = Frighten rank.
2. Miss: no entry. X on the entry removes it. Round advance ticks it down; it drops at 0.
3. Roll Frighten twice: two entries (one per cast).
4. Roll Taunt: unchanged static text, Rank rounds, X works. Mystic Aim still arms on you (Lasting on you), not on target.
5. Roll modal for Frighten shows no "+-2 steps" aim summary.
6. Combat dropdown: if Frighten is listed, roll from there and confirm the same entry; target number presets from Mystic Defense.
7. Light and dark mode; mobile fold; Overview fit unaffected (no layout change).
