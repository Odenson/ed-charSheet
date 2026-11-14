# Plan Review: Update Health overview (update-health-overview)

## Summary
The plan is sound. It covers T1-T5, is correctly sequenced, and is grounded in the real code. I verified the Combat `_applyDamage`, `_recoveryTest` and `_damageModalTpl` code, `ModalController`, `healthState` in store.js, and the `ed-roll` / `ed-edit-health` handlers in ed-app. All items are correctly Tier 3 and every rule traces to a rules.md entry (R1-R5). There are 0 blockers, 0 major and 5 minor findings.

## Findings
### F1 — I1 — Null shape and partial-rating cases are not fully pinned
- **Severity:** minor
- **Problem:** tickets.md T1 says "null/placeholder result when a rating is missing". The plan prefers `{damage:null, fill:null, tick:null, wounds}` but leaves it as an open question. It also does not say what happens when only Unconscious is missing: Death is present, so `fill` is computable, but `tick` and the damage level are not. It also does not say what happens when only Death is missing.
- **Fix:** Settle the shape in I1 now, and note in the plan that it refines T1's wording. Specify each field per missing rating. Suggested rule: `damage` level needs Unconscious; `fill` needs Death; `tick` needs both. Add one test per partial case. Drop the "decide" wording from the open questions.

### F2 — I2 — Amber token: a precedent exists and the mock-colour mapping is ambiguous
- **Severity:** minor
- **Problem:** The plan says there is "no existing amber token". `ui/ed-custom-item.js:576-577` already defines `--warn: light-dark(#8a5a00, #e0b35c)` and `--warn-bg: light-dark(#f6ecd6, #33290f)`, local to that component. The plan's mock-colour list also maps the mock hex `#d9944e` to a token. That hex is exactly the dark value of `--accent` (`light-dark(#7a3e12, #d9944e)`), so "amber" and the accent may be indistinguishable. This risks the amber state looking like ordinary accent text.
- **Fix:** Say which mock colour is the amber (warn) one. Reuse the `--warn` pair values from ed-custom-item for consistency, or justify a different pair. State that amber must be visibly distinct from `--accent` in both themes. Keep the contrast check.

### F3 — I3 — Component lifecycle and placement details missing
- **Severity:** minor
- **Problem:** Several details are unspecified:
  - `show(trigger)` should reset the draft amount to 0 each time. Combat does this in `_openDamage`.
  - The `.overlay` is `position:fixed`, so `<ed-damage-modal>` must be rendered at the host component's root, not inside the Health `.blk`. The old modal block at L1064 sits at the root, so the same placement is needed.
  - Combat's `_roll` guards `step == null`. The modal's Knockdown dispatch must keep that guard, which the plan covers via `kd.value != null`.
  - I3 lists "`resolveHit` (or the extracted pure logic)" as the tested unit, but the plan leaves resolveHit optional in I1 and I3.
- **Fix:** Add the draft-reset and root-placement notes to I3. Decide `resolveHit` is in. It is the only way the Wound and Knockdown boundaries are unit-testable without DOM. Make I3's dependency on I1 unconditional and close that open question.

### F4 — I2/I3/I5 — Manual owner verification not called out
- **Severity:** minor
- **Problem:** The card redraw, theme appearance, the 1280×720 viewport fit, the mobile fold, modal focus and Escape behaviour, and the ⚄ fit cannot be covered by `node:test`. The plan says "verify" and "measure" but does not name these as a manual owner checklist. The guardrails require re-checking the Tier-1 UI rules.
- **Fix:** Add a short "Manual verification (owner)" list to I6 or a plan-level section. It should cover both themes, the viewport fit, the mobile fold, Escape/Enter/focus in the shared modal on both tabs, and the ⚄ disabled state at 0.

### F5 — Open questions / I5 — Resolved by the code
- **Severity:** minor
- **Problem:** The open question "is `arming` already passed to ed-overview" is answered. `ed-app.js:1907` passes `.arming=${this._arming()}`, and ed-overview already declares `arming` (L20) and imports `armedRecoveryBonus` (L8). I5's "add it if not" branch is dead. Also, the ✚ is currently visible in edit mode as well. Its removal in both modes is consistent with the qa-log, but the plan should say so.
- **Fix:** Close that open question and drop the conditional `ui/ed-app.js` edit from I5's "Where". Note explicitly that the ✚ is removed in edit mode too.
