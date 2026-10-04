# Build log: Night's Edge (spell-nights-edge)

## Run 1 — 2026-10-04
- Slug: spell-nights-edge. Start (token report `<since>`): 2026-10-04T04:49:58Z.
- Alignment gate:
  1. Guardrails: PASS. I1 is Tier 2 (all three migration steps in-plan); I2 to I8 are Tier 3. No Tier-1 item, so no sign-off needed (tickets.md, plan.md).
  2. Rules coverage: PASS. R1 to R7 in rules.md carry sources; R2, R3, R6, R7 carry owner Decisions (2026-10-04); R5 is an ANSWERED inference at moderate confidence (owner may confirm).
  3. Technical questions: none outstanding. The one conditional note (I5 roll-modal approach) becomes NEEDS_HUMAN at build time only if existing mods/Karma mechanisms do not fit.
  4. Tree: `git status` shows `docs/RULES-FAQ.md` modified (rule-agent entries Q019 to Q021 and decisions for this feature) and `plans/spell-nights-edge/` untracked. Local `dev` equals `origin/dev` (b4ef822). Both are part of this feature: stage by explicit path in the feature commit; nothing else is dirty.
- plan.md set to `status: building`.

## Build — 2026-10-04
- Mode: build. I1 to I8 implemented in one pass; all tester tests pass; `npm test` green (942 pass, 0 fail). No dispute raised.
- I1: `docs/EFFECT-TAXONOMY.md` v6 (section 1.1 `object`, section 5.2 dice grammar, Night's Edge example, history line); every `rules/*.json` ref, `tools/worker/worker.js`, `tools/dev-server.mjs`, `docs/THREAD-ITEMS.md`, `docs/HOMEBREW-RULES.md`, `docs/GUARDRAILS.md` bumped to v6.
- I2: `Night’s Edge` entry aligned (success level, three extra threads, D4 dice effect with `object`, gmDiscretion -2 MD note, summary).
- I3/I4: `engine/spells.js` (`spellObjectRequirement`, `weaponOccurrence`, `castWeaponChoices`, `weaponMysticDefense`, `nextCastNumber`, `wastedCastLogEntry`, label rule, `chosen`, stamping, Target-effects D4 + note); `engine/dice.js` (`parseDice`, `rollDiceList`); `engine/combat.js` (`bonusDice`, dice audit part, `activeSpellBundlesFor` with weapon + index).
- I5 (no NEEDS_HUMAN: the existing Karma-group pattern fit): `ui/ed-roll-modal.js` takes `.bonusDice`, rolls it as its own exploding group with the step roll (not on a Karma toggle), shows a "Bonus" row, adds it to the grand total and the `ed-roll-logged` event; `ui/ed-app.js` adds it to the logged total and stores `bonusResult` on the entry; `_rollConfig` accepts `bonusDice`.
- I6: `ui/ed-spells.js` cast modal (ModalController, `close({restoreFocus:false})` added for the hand-off), `_castOnNothing`, "vs" box hidden for object-bearing self-casts, Cast row shows "Wasted", Active effects row names the weapon, Target effects shows D4 chip and the MD note; `ui/ed-app.js` `ed-spell-wasted` handler and `object` forwarded to `buildActiveSpell`; `store.js equippedWeapons[].mysticDefense`.
- I7: `ui/ed-combat.js` weapons carry occurrence `index` and a unique `key` (select value), `_activeSpellBundles` passes the weapon, `_rollDamage` passes `bonusDice`, Damage pill "Step N + D4", audit lists the dice part.
- I8: THREAD-ITEMS (mysticDefense note), MODALS, ARCHITECTURE, changelog line.
- Reader audit (I1): store fold at `activeSpellEffects` spreads effects only (string value never coerced; no-NaN test passes); `buildActiveSpell` numeric branches are `typeof value === 'number'` gated; `foldPool` handles `dice` via `parseDice`, other measures unchanged; `effectReadout` sustained branch gated on `typeof value === 'number'`.
- Roll Log readers checked: `ui/combat-log-rows.js` (updated: "Bonus die +N" in Detail; null step/total dash), `ui/ed-notes.js` Roll Log row (null total shows placeholder, outcome chip; added a Bonus chip), `ui/ed-spells.js` `_lastInitTotal` and `ui/ed-combat.js` `_lastInitTotal` / `/^Attack/` lookup (label-based, no arithmetic on the wasted entry), `store-rolllog.js` (stores the entry opaquely). No Spells "Log view" does arithmetic on `total`/`dice`.
- Not unit-tested / owner manual: modal flow and focus, roll-modal bonus row, wasted state, Combat pill/audit, theme.

## Dev Lead review (Phase 4)
- Tests untouched: the tester's 9 files are byte-identical to the Phase 2 snapshot. Gate: `npm test` 942 pass, 0 fail.
- Golden rule, tiers, cast-modal contract (ModalController, Escape/Enter), engine purity: OK.
- **Finding 1 (must fix):** `ui/ed-app.js` registers the `ed-spell-wasted` listener twice (lines ~398 and ~406, identical bodies). "Cast on nothing" would write two Roll Log rows. Remove the duplicate; keep one. Not caught by tests (UI wiring only).

- Revision: removed the duplicate `ed-spell-wasted` listener in ui/ed-app.js (one remains). No other doubled blocks found. Gate: 942 pass, 0 fail.

## Doc sync (Phase 5)
Design-agent report applied: D2, D3 (EFFECT-TAXONOMY wording that completes v6; no field or term added, no new bump), D4, D5 (ARCHITECTURE), D6 (THREAD-ITEMS), D7 (code fix: `_castOnNothing` now closes with `close()` so focus returns to Cast; MODALS.md reworded), D1 (plan status, Phase 6). Deferred: D8 (UI-GUIDELINES tab-table wording; Tier-1 doc, optional, current wording still accurate). Gate after edits: 942 pass, 0 fail.

## Owner handoff

### GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (UI-GUIDELINES rules, data-down/dispatch-up, pure DOM-free engine, schema shapes) — chosen weapon is session-only on the active-spell record; nothing new persisted; no `schema` tag changed.
- [ ] Overview still fits the desktop viewport with no vertical scroll — not touched; owner to confirm.
- [x] Derived values still show placeholder pills, never fabricated numbers (wasted cast shows "Wasted"/dash, not a number).
- [ ] Works in both light and dark mode; modals still Escape-closes/Enter-confirms — owner verifies (cast modal uses ModalController).
- [x] Taxonomy change: v6 bumped AND every `rules/*.json` migrated AND worker/dev-server stamps updated; conformance test enforces it.
- [x] Asset/fetch paths relative — no new paths.

### Manual UI verification
See "UI test requirements" in the final report.
