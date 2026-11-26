# Plan Review: Talent info bubbles (talent-info-bubbles)

## Summary
The plan is sound and well grounded. I checked every cited file, line and API against the code, and they match: `talentDetail` in `store.js:933`, the four picker sources, the `_talentModal`, `_learnModal`, `_startModal` and `_creationOptionModal` markup, the `.lrow` sibling pattern, kit dialog lookup by `data-modal`, and routeKey R13/R15. All tickets are covered, sequencing is valid, Tier 3 holds and no rules claim is made. There are 3 findings and no blockers: 1 major (manual-verification callout) and 2 minor.

## Findings
### F1 — I2-I6 — UI behaviour not routed to owner manual verification
- **Severity:** major
- **Problem:** Only I1 (model) can be tested with `node:test`. Most acceptance criteria for I2-I6 are DOM/kit behaviour that no unit test in the repo exercises:
  - stacked modal on top;
  - Escape closes only the detail;
  - focus returns to the bubble, with the ring suppressed for a pointer open and kept for a keyboard open;
  - Tab trapped in the detail;
  - Enter on the bubble opens the detail, and Enter inside the detail does not confirm Start Discipline;
  - a bubble click does not toggle the radio or pick the talent;
  - the Effects list is legible in light and dark mode.

  The plan states these as acceptance criteria but never says they need manual verification by the owner. It also does not say which criteria `npm test` will cover.
- **Fix:** Add a "Manual verification (owner)" checklist to the plan, or to I3-I6 and I2, that lists the UI checks above for each of the three pickers. Also check the Disciplines-tab detail modal: its Effects list replaces the karma-tinted `.mnote` lines. State clearly that automated coverage is I1 (store test), `check-ui-kit`, and the unchanged `grants: string[]` / `{name, brief}` tests.

### F2 — I2 — Rename of `detail.notes` left optional
- **Severity:** minor
- **Problem:** I2 renames the derived `detail.notes` to `detail.effects` but then says "keeping `notes` is acceptable". I1's store test, I2's acceptance criterion ("no remaining reader of `detail.notes`") and the I7 docs all depend on which name ships, so leaving the choice to the implementer makes those criteria ambiguous.
- **Fix:** Pick one name. The grep shows `ui/ed-disciplines.js:789` is the only reader and no test asserts the field, so the rename to `effects` is safe. Drop the "either is acceptable" escape hatch and make the I1 test assert the chosen field.

### F3 — I3 — Teardown risk can be closed out
- **Severity:** minor
- **Problem:** I3 leaves an open risk to "verify the controller's `hostDisconnected`" on a tab switch. The code already answers it:
  - `ui/ed-app.js:2712-2713` renders `<ed-disciplines>` inside the tab `switch`, so leaving the tab destroys the instance. A stale `_talentInfo` cannot survive into a later render.
  - `ModalController.hostDisconnected` (`ui/kit/modal-controller.js`) removes each open controller from the kit stack independently.

  Leaving it as an unknown invites unneeded work, such as a `disconnectedCallback` that resets state.
- **Fix:** Replace the risk with this finding. No extra teardown code is needed beyond the two controllers.
