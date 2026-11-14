---
status: building
---
# Delivery Plan: Update Health overview (update-health-overview)

## Context & learnings
The owner chose "Version 1" of a redesign of the Overview tab's Health card.
Damage and Wounds are the two character-affected inputs; Unconscious, Death,
Wound Threshold and Recoveries are derived stats.

- **Layout.** Damage and Wounds become two neutral-chip highlighted rows above a
  divider. The four stats sit below as a plain list. The card keeps today's
  footprint. There is no coloured left accent bar. The Damage row carries an
  inline gauge: fill is Damage out of Death, tick at Unconscious.
- **Colour.** The card is muted when there is no danger. Damage number and gauge
  fill go amber from Unconscious−10 and red at or past Unconscious. The Wounds
  number is red at 1+. These are owner UI choices, not rules (rules.md R3).
- **Interaction.**
  - Read mode: clicking Damage opens a damage-only modal shared with the Combat
    tab's Damage taken card. It applies the hit via the existing engine helpers,
    including the Knockdown roll.
  - The ✚ header button and the free-entry Take/Heal/"Recovery tests used" modal
    are removed.
  - Healing happens only through a ⚄ Recovery test on the Recoveries row, like
    Combat (rules R4).
  - Edit mode: rows are direct number fields; no modal, no ⚄.
- **Implementation constraints.** Use font-weight 500, never the mock's 600. Use
  `--fs-*` tokens only. Use `light-dark()` colours, not the mock's hard-coded hex.
- **Mock-up references** (copied into `plans/update-health-overview/mock/`):
  - `mock/health-v1-calm.png`, `mock/health-v1-risk.png`: the approved images.
  - `mock/v1calm.html`, `mock/v1risk.html`, `mock/common.css`: structure and
    spacing source. Row height 25px, chip radius 7px, thin 6px track, 2px tick,
    stats at `--fs-small` with muted labels.
  - Do NOT copy the mock's `font-weight:600` (`.hl .v`), its raw hex colours
    (`#d9944e`, `#e0846f`, `#12151b`, `#93a0b3`, `#3a2320`), its `.zone` red band,
    or its fixed `width:50px` label. Map them to existing tokens (`--bg-chip`,
    `--accent`, `--muted`, `--border`) and the `light-dark(#a63a2b, #e0846f)` /
    `light-dark(#f6e4e0, #3a2320)` red pair already used in `ed-overview.js`.
    For amber, reuse the `--warn: light-dark(#8a5a00, #e0b35c)` /
    `--warn-bg: light-dark(#f6ecd6, #33290f)` pair from `ui/ed-custom-item.js:576-577`
    (see I2). The mock's `#d9944e` equals the dark `--accent`, so it must not be
    mapped to `--accent`; the amber state maps to `--warn`.

## Discoveries
- `ui/ed-overview.js`:
  - Health block markup at ~L1017-1044: `.hhead` with `_healthChip()`, the ✚
    `.info` button (L1021), the reset-day button, then six `.line`s in the order
    Damage, Unconscious, Death, Wound Threshold, Wounds, Recoveries.
  - `_healthField` (L472) renders `.val` or an `.hfield` input.
  - `_recoveries` (L497) renders "used / max", editable in edit mode.
  - The old modal is spread across `_openHealth` (L524), `_applyHealthDraft`
    (L533), `_recoveryTest` (L574, used only by the old modal),
    `_healthModalBody` (L593), `_closeHealthModal` (L667), the render block
    (L1064-1081), the `_healthModal` state (L25), the document Escape handler
    (L634-645) and CSS (`.hrow .hnum .hbtn .hrec .hfoot .hint .hbtn.plain`).
    `_healthDraft` is not declared as a reactive prop.
  - Imports `applyHealth, woundsFromHit, knockdownTriggered, knockdownDifficulty,
    recoveriesRemaining` (L7). Only `recoveriesRemaining` will still be needed
    after the refactor.
  - Overview has its own `.overlay/.modal/.mhead/.mclose/.mbody` styles (L150-156).
    It does not use `ModalController` for the health modal.
- `ui/ed-combat.js`:
  - `_damageTbl` (L1339-1369) is the Damage taken card, with the ✗ `_openDamage`
    button and the ⚄ `_recoveryTest` button.
  - `_applyDamage` (L1374-1397) is the exact behaviour to share: `woundsFromHit` →
    `applyHealth` → `_dispatchHealth` → `_roll('Knockdown test', kd.value, null,
    'knockdown', {difficulty:{value: knockdownDifficulty}, apply:{action:
    'knockdown-result'}})`.
  - `_recoveryTest` (L1398-1408) dispatches
    `{label:'Recovery test', step: Toughness step, apply:{action:'recovery-heal',
    label:'Heal this amount'}}`. It is guarded by `recoveriesRemaining`, and the
    button shows the `armedRecoveryBonus(this.arming?.pending).stepBonus` boost.
  - `_damageModalTpl` (L1612-1639) is the markup to extract. The modal is
    hand-rolled: `_damageModal` state, own Escape handler at L330-333, backdrop
    close. It does **not** use `ModalController`. Combat already imports
    `armedRecoveryBonus`; check the Overview import path for it.
- `engine/health.js` already exports `damageState`, `applyHealth`,
  `woundsFromHit`, `knockdownTriggered`, `knockdownDifficulty` and
  `recoveriesRemaining`. `store.js:1781` wires `healthState: damageState(...)`
  into the model. `ratingValue` is the private helper that accepts `{value}` or a
  number. Tests: `engine/health.test.js`, `store-health.test.js`,
  `store-combat.test.js`.
- `ui/modal-controller.js` exports `ModalController` (`opened(trigger)` /
  `close()`, owns the Escape listener, Tab trap and focus restore), plus
  `currentModality`, `deepActiveElement` and `returnFocusToTrigger`. `ed-spells.js`
  and `ed-disciplines.js` are usage examples. `docs/MODALS.md` is the authority.
  Overview and Combat both register their own document Escape handlers today.
- The ⚄ rolls dispatch `ed-roll`. `ed-app.js` handles the `recovery-heal` and
  `knockdown-result` applies (ed-app L388). Edits go up as `ed-edit-health`
  (ed-app L422).
- The changelog is `data/changelog.json`. Unreleased entries go in
  `unreleased.changes` as `{type, text}` objects (docs/FEATURE-WORKFLOW.md L118).
- `docs/UI-GUIDELINES.md` line 57 describes the Overview tab. It does not
  describe the Health card in detail, so T5 adds the card description and edits
  the Combat description only if it names the damage modal.
- **Gotchas.**
  - The Overview must still fit the viewport with no vertical scroll. The Health
    card must not grow.
  - Today's six lines are about 6 × (line + 4px). The new layout is two 25px rows
    plus four small lines plus a divider. This needs a measured check, not an
    assumption.
  - Both read-mode ⚄ and Damage click must be inert in edit mode.
  - `_healthField` and `_recoveries` already handle the edit-mode inputs; keep
    them.

## Guardrail classification
Per docs/GUARDRAILS.md. Nothing here changes a Tier-1 surface.

| Item | Tier | Note |
|---|---|---|
| I1 engine danger fn + `resolveHit` | 3 | New pure function; no schema or taxonomy change; nothing stored. |
| I2 Overview card redraw | 3 | In-guideline styling. Keeps Tier-1 rules: no vertical scroll, weights 400/500 only, `--fs-*` only, placeholder pill, `light-dark()`. |
| I3 shared damage modal | 3 | New view component; adopts the shared `ModalController`. Data-down/dispatch-up kept (`ed-edit-health`, `ed-roll`). |
| I4 Combat onto shared modal | 3 | Refactor, no behaviour change. |
| I5 ⚄ Recovery, remove ✚ and old modal | 3 | Removal of a UI path; healing rule unchanged. |
| I6 tests, docs, changelog | 3 | Doc edits to UI-GUIDELINES describe shipped behaviour. They do not change the contract. |

No Tier-1 item, so no owner sign-off is needed (tickets.md "Guardrail alignment").
If implementation finds that the card cannot fit without growing, that would
touch the Tier-1 viewport rule: stop and ask the owner.

## Rules dependencies
All from `rules.md`. No NEEDS_RULES are open.

| Rule | rules.md id | Status | Used by |
|---|---|---|---|
| One Wound per hit at or above the Wound Threshold (the "wound(s)" wording is satisfied by one per hit) | R1 | FAQ-HIT | I3, I4 |
| Knockdown when damage ≥ WT+5; difficulty = damage − WT | R2 | ANSWERED | I3, I4 |
| Unconscious / Death thresholds; the amber margin is an owner UI choice, not a rule | R3 | ANSWERED | I1, I2 |
| Healing only via Recovery test | R4 | ANSWERED | I5 |
| Wound healing via the existing day-reset flow (context only) | R5 | FAQ-HIT | I5 |

## Implementation items

### I1 — Engine: health danger classification
- **Covers tickets:** T1
- **Rules:** R3
- **Tier:** 3
- **What:** Add a pure `healthDanger(inputs, ratings)` to `engine/health.js`.
  - `inputs` is `{damage, wounds}` and `ratings` is `{unconsciousness, death}`,
    the same signature style as `damageState`, reusing `ratingValue`.
  - It returns `{ damage: 'none'|'warn'|'bad', wounds: 'none'|'bad', fill, tick }`.
  - `fill` = clamp(damage / Death, 0, 1). `tick` = clamp(Unconscious / Death, 0, 1).
  - Damage `warn` when `damage >= Unconscious − 10 && damage < Unconscious`. `bad`
    when `damage >= Unconscious`, including past Death. Wounds `bad` at ≥1.
  - Null shape (settled; refines T1's "null/placeholder result when a rating is
    missing"): the result is always `{damage, fill, tick, wounds}`, never a bare
    `null`. Each field is computed independently:
    - `wounds` needs no rating, so it is always available.
    - `damage` level needs Unconscious; otherwise `null`.
    - `fill` needs Death (> 0); otherwise `null`.
    - `tick` needs both Unconscious and Death (> 0); otherwise `null`.
    So Unconscious missing gives `fill` but `damage`/`tick` null; Death missing
    gives `damage` but `fill`/`tick` null. Document in the JSDoc.
  - Guard `warn` with `damage > 0` so a low-Unconscious character at 0 damage is
    not amber.
  - Wire into `store.js` next to `healthState` as `healthDanger` on the model
    (L1781). The model stays derived only; nothing stored.
  - Small helper (in scope, not optional) `resolveHit(health, take, woundThreshold)` returning
    `{ next, knockdown: {difficulty}|null }`, so I3/I4 can unit-test the shared
    apply path without DOM. It composes `woundsFromHit`, `applyHealth` and
    `knockdownDifficulty`. Do not change those functions.
- **Where:** `engine/health.js`, `store.js`, `engine/health.test.js`,
  `store-health.test.js`.
- **Approach:** Pure, DOM-free, no mutation, matching the file's recompute-all style.
- **Dependencies:** none.
- **Acceptance criteria:** Unit tests cover:
  - calm (3/58/72) is `none`, with fill 3/72 and tick 58/72;
  - 47 is `none`, 48 is `warn`, 57 is `warn`, 58 is `bad`;
  - damage past Death clamps fill to 1 and level to `bad`;
  - both ratings missing: damage/fill/tick null, wounds still computed;
  - only Unconscious missing: fill set, damage and tick null;
  - only Death missing (or Death ≤ 0): damage set, fill and tick null;
  - wounds 0 is `none`, 1 and 2 are `bad`;
  - damage 0 with Unconscious ≤ 10 is not `warn`;
  - inputs are not mutated;
  - a store test shows `model.healthDanger` present and derived from stored inputs
    only.
- **Risks / unknowns:** The margin is the fixed
  constant 10 and should be a named constant with a comment citing the owner
  decision, not a magic number.

### I2 — Overview Health card redraw (V1)
- **Covers tickets:** T2
- **Rules:** R3
- **Tier:** 3 (within UI-GUIDELINES)
- **What:** Replace the Health block markup and styles in `ui/ed-overview.js`
  (L1017-1044 plus the Health CSS) with the V1 layout.
  - Header: HEALTH label, state chip (`_healthChip`), reset-day button. The ✚ is
    removed in I5; leave the header ready for that.
  - Two highlighted rows (`.hl`) using the `--bg-chip` neutral background, with no
    left accent bar:
    - Damage: label, inline gauge (track, fill, Unconscious tick), number.
    - Wounds: label, number.
  - A divider, then the four stat lines: Unconscious, Death, Wound Threshold,
    Recoveries. Use `.line` in `--fs-small`, with muted labels.
  - Numbers and the gauge fill take colour from `model.healthDanger` (I1): neutral
    default, amber for `warn`, red for `bad`. Use `light-dark()` values. Reuse the
    existing red pair. For amber, reuse the `--warn` / `--warn-bg` pair already in
    `ui/ed-custom-item.js:576-577`, defined locally in `ed-overview.js` with the same
    values (or justify a different pair). Amber must be visibly distinct from
    `--accent` in both themes. Check contrast in both.
  - The Damage number and gauge fill share one level class. The Wounds number takes
    red from `healthDanger.wounds`.
  - Number weight is 500 (not 600), font sizes from `--fs-*` only, no raw rem/px
    font sizes. Heights and radii in px are fine; the guideline restricts font
    sizes.
  - Gauge width comes from `fill` as an inline percentage. The tick position comes
    from `tick`. Do not compute fractions in the view.
  - Missing ratings (`fill === null`): render a dashed `.pend` placeholder pill
    where the gauge would be. Never draw a fabricated bar. Keep `_pend()` for the
    stat lines as today.
  - Read mode: the Damage row is a button (role, `aria-label`, `title` with
    `_healthTitle()`) that opens the shared modal (I3). The Wounds row is not
    clickable.
  - Edit mode: Damage and Wounds (and Recoveries used) show `_healthField` /
    `_recoveries` direct number fields as today. The gauge may still render
    read-only. No click handler is active.
  - Mobile single-column fold must still work; row layout must not overflow at
    narrow widths (gauge `flex:1; min-width:0`).
  - Colour must not be the only signal: keep the state chip, and add a `title` that
    carries the headroom text.
- **Where:** `ui/ed-overview.js`; reference `mock/v1calm.html`, `mock/v1risk.html`,
  `mock/common.css`.
- **Approach:** Port structure and spacing from the mock HTML, replace raw hex with
  tokens, remove `font-weight:600` and the `.zone` band, keep markup semantic.
  Verify against the two PNGs in both themes.
- **Dependencies:** I1 (the danger model). The click wiring depends on I3.
- **Acceptance criteria:**
  - Matches `mock/health-v1-calm.png` and `mock/health-v1-risk.png` in dark and
    light.
  - Card height is not greater than today's, and the Overview still fits the
    desktop viewport with no vertical scroll (measure at 1280×720 and the
    smallest supported desktop size from UI-GUIDELINES).
  - Mobile single column folds correctly.
  - Placeholder rule is honoured with missing ratings.
  - `grep` shows no `font-weight: 600` and no raw rem or px font sizes in the new
    CSS.
- **Risks / unknowns:**
  - The amber pair is a local duplicate of ed-custom-item's `--warn`; check contrast
    and distinctness from `--accent` in both themes.
  - The fit of 2 highlighted rows plus 4 stats plus divider in today's height is
    unproven (the mock was drawn at that size, but verify).

### I3 — Shared take-damage modal component
- **Covers tickets:** T3
- **Rules:** R1, R2
- **Tier:** 3
- **What:** New `ui/ed-damage-modal.js`, a Lit custom element `<ed-damage-modal>`
  that is the single damage-entry modal for Overview and Combat.
  - Props: `model` (data down), `open`. It owns the draft amount.
  - Body is lifted from Combat's `_damageModalTpl`: current damage plus state word,
    Unconscious and Death ratings (placeholder pills if missing), a number input,
    the Wound Threshold hint, and an Apply button inside a `<form>` so Enter
    submits.
  - On Apply, it uses the shared pure path `resolveHit` from I1
    and dispatches `ed-edit-health` with the new health. If a Knockdown is
    triggered and `characteristics.knockdown.value != null`, it dispatches `ed-roll`
    `{label:'Knockdown test', step, kind:'knockdown', difficulty:{value},
    apply:{action:'knockdown-result'}}`. Both events use `bubbles: true,
    composed: true`. This is the same behaviour as Combat's `_applyDamage`.
  - Uses `ModalController` per docs/MODALS.md. Escape, ✕ and backdrop route through
    `close()`. The input has initial focus and Enter applies. Focus returns to the
    trigger. The host passes the trigger via `opened(trigger)`, so expose an
    `show(trigger)` method.
  - Self-contained shadow-DOM styles for `.overlay/.modal/.mhead/.mclose/.hrow/
    .hbtn/.hfoot/.hint`: weights 400/500 only, `--fs-*` tokens only,
    `light-dark()` colours.
  - Placement: the `.overlay` is `position:fixed`, so each host renders
    `<ed-damage-modal>` at its component root (as the old modal block at
    ed-overview L1064 does), not inside the Health `.blk`.
  - Keep Combat's `step == null` guard: dispatch Knockdown only when
    `kd.value != null`.
  - Amount handling: ignore or disable Apply for 0 or an invalid amount (matches
    the existing `take > 0` guard). Clamp negatives to 0 as today.
- **Where:** new `ui/ed-damage-modal.js`; import where used in `ui/ed-overview.js`
  and `ui/ed-combat.js`; `resolveHit` is in `engine/health.js` (I1);
  `docs/MODALS.md` (I6).
- **Approach:** Keep the component thin: render, collect the amount, call the
  engine, dispatch up. No game maths in the view beyond calling the engine.
- **Dependencies:** I1 (`resolveHit` is in; the dependency is unconditional).
- **Acceptance criteria:**
  - `show(trigger)` resets the draft amount to 0 on every open (as Combat's
    `_openDamage` does).
  - A hit below WT adds damage only.
  - A hit ≥ WT adds one Wound.
  - A hit ≥ WT+5 also dispatches the Knockdown roll with difficulty = hit − WT.
  - Escape, ✕ and backdrop close; Enter applies; focus is trapped and restored.
  - Both themes work; two font weights only.
  - A unit test covers `resolveHit` at the
    WT−1/WT/WT+4/WT+5 boundaries, with a missing WT giving no Wound and no
    Knockdown.
- **Risks / unknowns:**
  - Lit shadow DOM styling is separate from the host, so the CSS is duplicated by
    necessity. Keep it minimal.
  - Event retargeting: `ed-roll` / `ed-edit-health` must be `composed` to cross
    the nested shadow roots up to `ed-app`.

### I4 — Combat adopts the shared modal
- **Covers tickets:** T3
- **Rules:** R1, R2
- **Tier:** 3
- **What:** In `ui/ed-combat.js`, replace `_damageModalTpl`, `_applyDamage`,
  `_damageDraft`/`_damageModal` state, the Escape branch (L333), the two
  `_damageModal = false` resets (L434, L448), the render block (L1522) and the
  damage-modal CSS (L281) with `<ed-damage-modal>`. `_openDamage` becomes a call
  to the component's `show(e.currentTarget)`.
- **Where:** `ui/ed-combat.js` (L85, L281, L318, L329-336, L434, L448, L1370-1397,
  L1522, L1612-1639).
- **Approach:** Delete rather than comment out. Remove now-unused imports
  (`woundsFromHit`, `knockdownTriggered`, `knockdownDifficulty`, `applyHealth`)
  only if no other use remains. Check with grep first.
- **Dependencies:** I3.
- **Acceptance criteria:**
  - The Combat ✗ button opens the shared modal and behaves exactly as before for
    damage, Wound and Knockdown.
  - Existing tests (`store-combat.test.js`, `engine/health.test.js`) pass
    unchanged.
  - No orphaned CSS or state.
  - The one intended difference is the added focus contract (trap and restore).
    Call it out in the changelog and PR notes as a side benefit, not a regression.
- **Risks / unknowns:** Combat's existing Escape handler dismisses several overlays
  in sequence; make sure removing the damage branch does not change the others.

### I5 — Recoveries ⚄ roll button; remove ✚ and the free-entry health modal
- **Covers tickets:** T4
- **Rules:** R4, R5 (context only)
- **Tier:** 3
- **What:** In `ui/ed-overview.js`:
  - Read mode: add a ⚄ button to the Recoveries row, next to the "used / max"
    value. Behaviour is the same as Combat's `_recoveryTest`.
    - It dispatches `ed-roll` with `{label:'Recovery test', step: Toughness step,
      apply:{action:'recovery-heal', label:'Heal this amount'}}`.
    - It is disabled with an explanatory title at 0 remaining
      (`recoveriesRemaining`).
    - It shows the armed-potion boost, `armedRecoveryBonus(this.arming?.pending)
      .stepBonus`, in the title and aria-label. `arming` is already passed
      (`ed-app.js:1907`) and declared in ed-overview (L20, import at L8); no
      `ed-app.js` change is needed.
    - Reuse the existing `_recoveryTest` method body (L574), but without the
      `_healthModal = false` line.
  - Remove: the ✚ `.info` button (L1021), in both read and edit mode (it is
    visible in both today; removal in both matches the qa-log), `_healthModal` and `_healthDraft` state,
    `_openHealth`, `_applyHealthDraft`, `_healthModalBody`, `_closeHealthModal`,
    the render block (L1064-1081), the Escape branch (L640), now-unused imports
    (`applyHealth`, `woundsFromHit`, `knockdownTriggered`, `knockdownDifficulty`),
    and now-unused CSS (`.hrow .hnum .hbtn .hrec .hfoot .hint .hbtn.plain` and any
    `.hhead .info` rule specific to ✚). Grep every selector before deleting, as
    `.overlay/.modal/.mhead/.mclose/.mbody/.mpara` are still used by the info
    modal.
  - Edit mode: no ⚄, no modals; direct number fields (including Recoveries used)
    remain.
  - Read mode: the "Recovery tests used" free entry disappears. "Used" changes only
    through the ⚄ roll and the day reset.
- **Where:** `ui/ed-overview.js`.
- **Approach:** Delete dead code outright; keep the reset-day button as is.
- **Dependencies:** I2 (layout), I3 (the Damage click now opens the new modal).
- **Acceptance criteria:**
  - ⚄ opens the roll modal with the recovery-heal apply context and uses one
    Recovery on apply.
  - ⚄ is disabled with a title at 0 remaining.
  - No ✚ and no free-entry Heal remain in read mode.
  - Edit mode is otherwise unchanged.
  - `grep` for the removed identifiers and selectors returns nothing.
- **Risks / unknowns:**
  - The Recoveries row is tight in a narrow card; check that the ⚄ fits at the
    mobile fold and at the smallest desktop size.
  - Removing the read-mode free entry of "used" means a mistaken recovery count can
    only be fixed in edit mode. This is consistent with the owner decision; flag it
    in the changelog.

### I6 — Tests, docs, changelog
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:**
  - Tests: I1 and I3 tests as above. Run the full `npm test`.
  - `docs/UI-GUIDELINES.md`: describe the Overview Health card (highlighted
    Damage/Wounds rows, gauge with Unconscious tick, amber within 10 / red at
    Unconscious, Wounds red at 1+, click-Damage-to-take-damage in read mode, ⚄
    Recovery test, no free-entry heal, direct fields in edit mode). Update the
    Combat description only if it names the damage modal.
  - `docs/MODALS.md`: add `ed-damage-modal` as a `ModalController` user, if the doc
    lists modals.
  - `data/changelog.json`: add `unreleased.changes` entries as `{type, text}`
    objects (for example `changed` for the redrawn card and shared modal, `fixed`
    or `changed` for the removed free-entry heal).
- **Where:** `engine/health.test.js`, `store-health.test.js`, a new test for the
  shared modal's pure logic if extracted, `docs/UI-GUIDELINES.md`,
  `docs/MODALS.md`, `data/changelog.json`.
- **Approach:** Docs describe shipped behaviour only; no future wording.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** `npm test` passes; docs match the code; the changelog
  has an unreleased entry in the required object shape.
- **Risks / unknowns:** `tools/release.mjs` rejects bare-string entries, so use
  objects.

#### Manual verification (owner)
`node:test` cannot cover these; the owner checks them before release:
- Card redraw matches both mock PNGs in dark and light themes; amber is distinct
  from the accent.
- Overview fits 1280×720 and the smallest supported desktop size with no vertical
  scroll; the Health card is no taller than before.
- Mobile single-column fold: no overflow, ⚄ fits on the Recoveries row.
- Shared modal on both Overview and Combat: Escape, ✕, backdrop close; Enter
  applies; focus trapped and restored to the trigger.
- ⚄ is disabled at 0 Recoveries remaining; ✚ gone in read and edit mode; edit
  mode has direct fields and no click/⚄ behaviour.

## Sequencing
1. **I1** (engine). It is pure and unblocks the UI and the tests.
2. **I3** (shared modal). It must exist before either tab consumes it.
3. **I4** (Combat adopts it). This proves the component with a behaviour-preserving
   refactor against existing tests before Overview depends on it.
4. **I2** (Overview redraw). It consumes `healthDanger` and the Damage click opens
   the shared modal.
5. **I5** (⚄ and removals). The old modal is deleted after the new path is live.
6. **I6** (docs, changelog, full test run, theme/viewport checks).

Rationale: engine first, shared component proven in Combat, then the larger visual
change, then the deletions, then docs. I2 and I5 touch the same file; do them as
separate, reviewable changes.

## Open questions
- Where the amber pair lives long-term (local to `ed-overview.js` vs a shared token
  sheet). Non-blocking; start local, matching `ed-custom-item.js`.

## Review responses
All five findings were valid and fixed; none disputed.
- **F1** (null shape): fixed. I1 now settles the per-field shape, adds partial-rating
  tests, and notes it refines T1's wording. Open question dropped.
- **F2** (amber): fixed. Reuses `--warn`/`--warn-bg` from `ed-custom-item.js`;
  states amber must be distinct from `--accent`; Context and I2 corrected.
- **F3** (modal lifecycle): fixed. Draft reset, root placement, `step == null`
  guard added; `resolveHit` is now in scope and I3's dependency on I1 unconditional.
- **F4** (manual checks): fixed. "Manual verification (owner)" added under I6.
- **F5** (arming): fixed. Open question closed, conditional `ed-app.js` edit
  removed, ✚ removal in edit mode stated.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
