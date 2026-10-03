# Plan Review 2: Taxonomy on action type (taxonomy-on-action-type)

## Summary
The post-owner-pass changes (skills parity, `applied` flag, tie rule, Safari limit) are sound and grounded: `skills` is the derived array at store.js L1326 and is folded at L1597, and the four Disciplines surfaces and the Combat option builders exist where cited. First-pass findings F1-F4 are resolved. There are no blockers. I found 5 minor findings, mostly ticket drift and unrecorded edge cases.

## Findings
### F1 — tickets.md T2 / T3 — Tickets lag the owner pass
- **Severity:** minor
- **Problem:** The T2 title and What still say "onto talents". The T2 acceptance has no skill case and no `applied` flag. The Summary and the T3 "Open questions" still carry the stale "plan must pick a workable approach" for option colouring, although the owner accepted colour-only and the Safari limit. I3/I7 completeness is judged against the tickets, so the tickets should match what the plan builds.
- **Fix:** Update T2 to say talents and skills and to include `actionSources` entries with an `applied` flag. Close the T3 open question with the Safari decision.

### F2 — I5 — Tie rule is not an owner-recorded decision
- **Severity:** minor
- **Problem:** qa-log says "mark the winner" (singular). The plan decides that equal values are all marked `applied`. This is reasonable, but nothing in qa-log or rules.md R2 records it. R2's Decision covers only "fastest wins".
- **Fix:** Add a line to rules.md R2 or to the plan, labelled as a planner default pending owner nod. The hover example in qa-log, "Standard → Free. Free: Spell A (applied). Simple: Death's Head (overridden, slower)", differs from I7's newline and `(overridden)` wording (no ", slower"). Confirm that I7's wording is intended, or align it to the owner's text.

### F3 — I7 — Hover is unreachable on touch and on narrow viewports
- **Severity:** minor
- **Problem:** The only "why" explanation is a native `title` hover. Touch devices show no `title`. The row `.action` cell is hidden below the narrow breakpoint (ed-disciplines L223). So on phones the colour is visible only in the modal chip, and the source list is never visible. The plan notes only that the narrow rule is "unaffected".
- **Fix:** State this limitation explicitly as accepted, or ask the owner. If the owner wants the sources reachable, add a visible line in the modal body, which would be new scope.

### F4 — I9 / I6 — Existing active-spell records will not carry the new effect
- **Severity:** minor
- **Problem:** `activeSpellEffects` reads `s.effects` from the session `activeSpells` record, which is a snapshot taken at cast time. A Death's Head already active in a saved session when v-next ships will not gain the `action-modifier`. This is session-only and short-lived, but the plan does not mention it.
- **Fix:** Note it as a known transient in I9 Risks (the effect appears on the next cast), or check whether the record rebuilds effects on load.

### F5 — I5 — Name collisions and the null return hide overridden sources
- **Severity:** minor
- **Problem:** (a) An effect targets `{domain:"ability", name}`. A talent and a skill that share a name would both be folded. This is the same behaviour as `applyTestMods`, so it is acceptable, but it is unpinned. (b) When the resolved action equals the base, I5 returns `null`, so the hover does not appear even if slower effects exist. That is correct, but say so in the I7 acceptance, so a reviewer does not read "no hover with an active effect" as a bug.
- **Fix:** Add a one-line note for (a). Add an I7 acceptance bullet for (b).

No `NEEDS_RULES` or `NEEDS_HUMAN` lines. Rules grounding is intact: R1-R4 trace to entries with sources, and R2 has a recorded owner Decision.
