# Rules brief: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

**No Earthdawn rule dependencies.** This feature changes UI plumbing only: modal
keyboard handling, focus, layout and styling. It adds no game value, formula,
cost, step or dice table, and no test asserts a rules value.

Existing rule-driven app behaviours that the migrated modals must **preserve
unchanged** (they are app behaviour already documented in UI-GUIDELINES, not new
rulings, so no `rule-agent` query was needed):

- Strain on roll is charged **once** per ordinary roll, when the roll modal opens
  and auto-rolls; True Shot (set-dice) and Mystic Aim charge at commit
  (UI-GUIDELINES "Other conventions" → Strain on roll).
- Karma is charged once per roll interaction (`ed-roll-modal` `_karmaCharged`).
- A hit five or more over the Wound Threshold hands off from the Take-damage modal
  to the Knockdown roll (MODALS.md, `close({ restoreFocus: false })`).

If planning or review finds a real rules question, it is raised as
`NEEDS_RULES:` and answered by the `rule-agent` before planning continues.
