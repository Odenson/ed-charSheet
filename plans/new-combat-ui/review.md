# Plan Review: New-Combat-UI (new-combat-ui)

## Summary
The plan is sound. Tier-1 sign-off is recorded, no rules are asserted, all tickets are covered, and the cited code (`_collapsed`, `SCRATCH`, `clearCombatScratch`, `_logRow`, `_standUpLine`, the Spells `.kchip`) matches the repo. There are 6 findings: 0 blockers, 1 major (the Stand-up default) and 5 minor.

## Findings

### F1 — I2 / I3 / Open question 1 — Stand-up default hides a live condition and departs from the approved prototype
- **Severity:** major
- **Problem:**
  - The plan keeps the Knocked Down Stand-up row inside the Situational segment. The selected segment starts on Combat options, so a knocked-down character sees no Knocked Down row or Stand-up button until they open Situational.
  - T1 of tickets.md ("Goal" list) names "Stand-up bar" as part of the Damage taken card. The owner-approved prototype (design-option-a.html L205) renders it inside Damage taken.
  - The plan's own acceptance line for I2 is confusingly worded ("Stand-up row in the damage card ... is not duplicated"). It contradicts the plan's own decision.
  - The "keep it as it is" default is not behaviour-preserving in practice, because the old Situational section was visible (not tabbed). The Situational badge (count includes the locked Knocked Down) only hints that something is there.
- **Fix:**
  - Default to the approved prototype and the ticket wording: render `_standUpLine()` inside the Damage taken card. It is the same handler, so there is no behaviour change.
  - Otherwise render it above the segmented control, outside the segments, so it is always visible.
  - Rewrite the I2 acceptance bullet to match whichever you choose. Keep the owner question, but flip the default.

### F2 — I3 — Empty-state wording is left open ("if the build prefers")
- **Severity:** minor
- **Problem:** Only Blood charms has an existing empty message. The plan offers two alternatives for Combat options and Situational and defers the choice to the build. qa-log entry 6 approved "the existing empty message", and none exists for these two. That leaves the build with an open choice, and `_allOptions()` / `_situations()` may rarely be empty anyway.
- **Fix:** Pick one. The default is acceptable: a new one-line `.empty` message for each, with the exact wording fixed in the plan. Keep the open question so the owner can veto it.

### F3 — I5 — Detail-cell composition leaves a leading separator
- **Severity:** minor
- **Problem:** The mapping says Detail is `detail` plus " · N Legend", " · N sp" and " · coinDelta". When `detail` is empty (a common advancement or system row), this produces a leading " · ". The old `_logRow` used the same strings but the separator had a preceding label.
- **Fix:** Specify that `logRowCells` builds an array of non-empty parts (`detail`, `N Legend`, `N sp`, `coinDelta`) and joins them with " · ". Add a test case for a system row with no `detail`.

### F4 — I2 — Art-box-on-mobile default needs a concrete layout
- **Severity:** minor
- **Problem:** Keeping the art box (as today) is the right default. However, `.artbox` is `aspect-ratio:1; height:100%`, and the prototype's ≤720px rule collapses `.attacktop` to one column. If the plan follows that rule while keeping the art box, it becomes a full-width square image. The plan only says "collapse only if 375px overflows", which is vague.
- **Fix:** State that at ≤720px `.attacktop` stays `auto 1fr` (as in the current app, L165). Cap the art box with an explicit small size (for example `height:96px`) and do not copy the prototype's one-column rule or `display:none`.

### F5 — Sequencing — Intermediate states and the I5/I6 loop
- **Severity:** minor
- **Problem:** I2 removes the `log`, `dab` and `mods` grid areas while the old log, modifiers and potions are still composed in `render()` until I3-I6. The tab is visually broken between steps. Separately, I5 lists I6 as a dependency while I6 depends on I5.
- **Fix:** Land I2-I6 as one build unit (state this in Sequencing), or keep the old areas until I6 composes the final `render()`. Drop "I6" from I5's Dependencies and say the fold is part of I6. This is a documentation fix only.

### F6 — I3 — Day-reset and mounted-element wiring needs a checklist entry
- **Severity:** minor
- **Problem:** The plan correctly names `clearCombatScratch` (L40-49) and `_clearDayState` (L454). The plan states `_collapsed` is only used in `ed-combat.js`, and that matches (grep). However, the acceptance criterion "resets on character switch" relies on `_resetSession` being called from the `characterId` branch, and the plan only lists `_resetSession` in the Where list. Also, remembering the segment per character while resetting it on day reset is correct per qa-log entry 2.
- **Fix:** In the acceptance criteria and the PR notes, list the three reset paths (`_resetSession`, `_clearDayState`, the cached `SCRATCH` entry in `clearCombatScratch`) as a manual check. The pure-helper test already covers `normalizeModTab`, so no further test is needed.

## Assessment of the four defaults
- **Stand-up row location:** reject the default. See F1.
- **Art box on mobile:** keep the default (art box kept). Tighten the layout per F4.
- **Desktop log height:** accept uncapped. `store-rolllog.js` caps entries at 20 by default (max 50), so the table cannot grow unboundedly. The 320px cap applies at ≤720px only, as in the ticket.
- **Empty messages for two segments:** accept a short new `.empty` message, but fix the wording in the plan (F2).

## Checks passed
- **Guardrails:** Tier-1 sign-off is recorded (qa-log entry 1). No engine, store, schema or taxonomy change, so no Tier-2 ceremony. No UI-computed game values. The remembered segment is session-only UI state, which is consistent with "store only inputs".
- **Rules grounding:** `rules.md` lists 0 rules, and the plan makes no rules claim. No `NEEDS_RULES`.
- **Tokens:** `--karma`, `--bg-chip` and `--danger-bg` are already defined in the `ed-combat` `:host`, so the ported `.kchip` and `.standrow` styles work.
- **Testability:** The two pure modules are node:test coverable. The UI-only parts are called out for owner verification.
- **Tests:** The "no existing layout tests" claim is correct: only three `ui/*.test.js` files exist, and none covers Combat.

No NEEDS_RULES.
No NEEDS_HUMAN. The Stand-up location (F1) is already an owner-facing open question in the plan, with a recommended default flip.
