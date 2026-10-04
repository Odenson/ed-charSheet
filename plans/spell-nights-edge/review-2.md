# Plan Review 2: Night's Edge (spell-nights-edge)

## Summary
The revised plan is largely sound and its rules grounding is complete (R1-R7 all traced; R2/R3/R6/R7 carry owner Decisions; R5 is an inference, flagged as such). One major grounding defect would silently break R6 (the Mystic Defense prefill), plus a few minor gaps. 5 findings: 0 blockers, 1 major, 4 minor. No NEEDS_RULES, no NEEDS_HUMAN.

## Findings
### F1 — I6 — `equippedWeapons` copies a field that does not exist on the item
- **Severity:** major
- **Problem:** I6 says to add `mysticDefense: it.mysticDefense ?? null` to `store.js equippedWeapons`, and Discoveries says owned items "already carry `mysticDefense` (`store.js:872`)". Line 872 is inside the item's `thread: {...}` block, so the value is `it.thread.mysticDefense`. There is no top-level `it.mysticDefense`. As written, the copy is always null, `weaponMysticDefense` always returns 2, and R6 (thread weapon prefills its own Mystic Defense) fails. A test of `weaponMysticDefense` on a hand-built `{mysticDefense: 10}` would pass and hide this.
- **Fix:** Use `it.thread?.mysticDefense ?? null` in `equippedWeapons`. Correct the Discoveries wording. Add a store-level test (a built model with an equipped thread weapon carrying `mysticDefense: 10` yields `equippedWeapons[i].mysticDefense === 10`, and a plain weapon yields null). Without that test, the I6 `weaponMysticDefense` unit tests do not prove R6.

### F2 — I6 — Cast modal to roll modal hand-off is unspecified
- **Severity:** minor
- **Problem:** Confirm closes the cast modal and immediately opens the roll modal (`_dispatchRoll`). `docs/MODALS.md` contract item 5 (focus returns to the trigger on close) and the "Escape closes" rule apply to both. The plan defines focus return only for cancel paths. It does not say what happens to focus and the controller on Confirm. A Karma re-roll must also not reopen the cast modal.
- **Fix:** State that Confirm closes the cast modal without restoring focus to Cast (the roll modal takes over, then follows its own contract), and that the roll modal's Karma re-roll uses the `_castPicks` snapshot only. Add both to the owner manual verification list.

### F3 — I6 — "Cast on nothing" and an armed Anticipate Spell bonus
- **Severity:** minor
- **Problem:** `ctx.castingArmed` (an armed Spellcasting step bonus, `ed-spells.js:1098-1102`) is applied only inside the cast roll. "Cast on nothing" makes no roll, so the armed bonus is neither applied nor consumed, while threads and the spell are spent. The plan says it matches "an ordinary completed cast" but does not address this.
- **Fix:** Add one sentence stating the intended behaviour. The simplest is that the armed bonus is left armed, since no Spellcasting roll happened. Note it in Risks.

### F4 — I6 — The `cast` marker rendered by `_rollRes` is undefined
- **Severity:** minor
- **Problem:** `_castOnNothing` sets `cast: <wasted marker>`, but `_rollRes(prog.cast)` and the success banner read the cast result (`levels`, `total`) from it. The plan does not define the shape, so the Cast row could render NaN or crash, and `ed-spells.js:455` also reads `this._prog.cast`.
- **Fix:** Define the marker shape (for example `{total: null, levels: 0, outcome: {word: 'Wasted', ok: false}}`). Verify `_rollRes`, the success banner and the persisted-state snapshot (`ed-spells.js:~320-355`) tolerate a null `total`. Add this to the manual verification list.

### F5 — I6 — Wasted-entry reader tolerance is partly already true
- **Severity:** minor
- **Problem:** `ui/combat-log-rows.js` already renders null step and total as a dash, so a null-step entry needs no formatter change there. The plan lists three reader surfaces but gives no evidence for the Spells Log view and the Notes Roll Log. Also, the `ed-roll-logged` total math (`ed-app.js:~290`) is not involved, which is correct and should stay that way.
- **Fix:** In the build, record which readers were checked. Add a `combat-log-rows` test for a wasted entry. The Spells and Notes readers need a check only if they do arithmetic on `total` or `dice`.
