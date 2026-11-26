---
status: implemented
shipped: unreleased
---
# Delivery Plan: Talent info bubbles (talent-info-bubbles)

## Context & learnings
Backlog B-002 and B-003, planned together (qa-log 2026-11-26T23:17). The three
talent pickers on the Disciplines tab list a talent by name and a terse effect
only, so a player cannot tell what a talent does, what it is tested against, or
what bonuses it gives before picking it:

- the edit-mode **Add-talent-option picker** (Circle slot "+ add option", B-002);
- the **Add Discipline / Seed Circle 1** confirm modal (required Circle 1 talents
  and the optional Circle 1 Talent Option radio list, B-003);
- the creation-mode **"+ add option"** picker (owner scope decision, qa-log 23:25).

Owner decisions that shape the build:
- The bubble opens the **same talent detail modal the Disciplines tab uses**,
  stacked above the picker; Escape closes only it and focus returns to the
  bubble (qa-log 23:20). No inline expand.
- The detail modal gains an **Effects list** (each `effects[].summary`), shown
  everywhere the modal opens, including the Disciplines tab's own bubbles
  (qa-log 23:23).
- Bubbles **look like the Disciplines tab**: filled (`.tinfo.req`) on the required
  Circle 1 talents in Add Discipline / Seed, outlined (`.tinfo.opt`) on every Talent
  Option in all three pickers. Clicking a bubble **never selects** the talent
  (qa-log 23:27).
- Nothing else in scope (qa-log 23:29). Picker selection, prices and gating are
  unchanged; no new talent data; no character-specific Step/rank for unlearned
  talents.

## Discoveries
- **The detail modal** is `_talentModal(t)` in `ui/ed-disciplines.js:766`. It reads
  `t.name`, `t.required`, `t.free`, `t.brief`, `t.action`, `t.actionBase`,
  `t.attribute`, `t.rank`, `t.grantSources` and `t.detail` (`summary`, `strain`,
  `tier`, `skillUse`, `versus`, `notes`). With no `detail.summary` it shows
  "Full details coming." It is rendered through the single host controller
  `this._modalCtl` (layer 2000) from the `_modal` dispatch chain at
  `ui/ed-disciplines.js:1880-1903`; any `_modal` without a known `type` falls
  through to `_talentModal`.
- **Effect summaries are already in the modal, unlabelled.** `talentDetail()` in
  `store.js:933` sets `notes: (cat.effects || []).map((e) => e.summary).filter(Boolean)`,
  and the modal renders each as a bare `.mnote` line (`ui/ed-disciplines.js:789`).
  `rules/talents.json` has **no talent-level `notes` field** (0 of 456 talents;
  71 have effect summaries). So the ticket's "notes" is these effect summaries; T2
  is a relabelling into an "Effects" heading + list, not new data. The only reader
  of `detail.notes` is `ui/ed-disciplines.js:789` (grep; no test asserts it).
- **One modal at a time today.** `ed-disciplines` has a single `ModalController`
  (`ui/ed-disciplines.js:320`, `kind` from `DISC_KIND`, line 23: `learn` and
  `creation-option` are `picker`, `start-discipline` is `confirm`). A stacked
  detail needs its own controller and its own state. Precedent for several kit
  controllers in one shadow root, each finding its dialog by id:
  `ui/ed-spells.js:246-262` ("Four kit controllers in one shadow root"),
  `ui/ed-equipment.js:153-162`. The controller finds its dialog by
  `[data-modal=<id>]` (`ui/kit/modal-controller.js:153-155`), so two frames in one
  root do not collide. The kit stack routes Escape/Enter to the top modal only
  (docs/MODALS.md §2 rule 1, §3); DOM order plus a higher layer puts the detail
  on top.
- **Key routing in the pickers.** The bubble is a non-primary `<button>`, so Enter
  on it passes (R13) and natively clicks it: in a `picker` it opens the detail,
  in the `confirm` Start modal it does not confirm. Inside the open detail modal
  (`kind: 'info'`), Enter closes it (R14/R15), so it never reaches Start
  Discipline's confirm.
- **Picker row markup.**
  - Learn picker (`_learnModal`, `ui/ed-disciplines.js:1483`): each option is one
    `<button class="lopt">` (name + `.lbrief`), the first `?autofocus`; the list is
    `m.learnable`, snapshotted from `slot.learnable` at open
    (`ui/ed-disciplines.js:1290`).
  - Creation picker (`_creationOptionModal`, `ui/ed-disciplines.js:566`): the same
    `.lopt` shape over `this._cr.talents.option.candidates`.
  - A bubble cannot nest inside `.lopt` (button in a button). The established
    sibling pattern is `.lrow` (`ui/ed-disciplines.js:213-214`, used by the
    skill picker `plainRow`, ~line 1563): `<div class="lrow"><button class="lopt">…</button><button class="ibadge">…</button></div>`.
  - Start modal (`_startModal`, `ui/ed-disciplines.js:1419`): grants render
    `cand.grants.map((g) => …<span class="ck">${g}</span>…)` (name strings);
    options are `<label class="startopt"><input type="radio">…</label>` over
    `cand.optionPool.items` (`{name, brief}`). A bubble must sit **outside** the
    `<label>` so a click cannot toggle the radio.
- **Model sources** (all in `store.js` `deriveModel`, the derived view-model;
  `talentCatalog = talentsFile.talents ?? talentsFile`, line 963):
  - `slots[].learnable` → `{name, brief}` at `store.js:1295`;
  - `addableDisciplinesModel` → `optionPool.items` `{name, brief}` at
    `store.js:1754-1762`; `grants` stays `string[]` (pure engine
    `engine/talent-options.js:108` `initiationQuote`);
  - creation `talents.option.candidates` → `{name, brief}` at `store.js:2140`;
  - the Disciplines-tab rows already carry `brief`, `action`, `attribute`
    (`cat.attribute || null`) and `detail: talentDetail(cat, circle, legendFile)`
    (`store.js:1239`, creation rows `store.js:2143-2150`).
- `cand.grants` as strings is load-bearing elsewhere: `ui/ed-app.js:1984`
  (`[...cand.grants, …]` builds the talents to add) and
  `store-start-discipline.test.js:68,178`. Do not change its shape; add a sibling.
- `.tinfo` / `.tinfo.req` / `.tinfo.opt` styles are in the component's static
  styles (`ui/ed-disciplines.js:184-193`), so they apply inside every modal this
  component renders.
- `tools/check-ui-kit.mjs` (pretest) forbids `font-size` outside `--fs-*` tokens
  and inline `style=` on a `<button>`; new CSS must use tokens and classes.
- docs/MODALS.md §5 host table lists Disciplines at layer 2000; read-only info
  modals stacked over a 2000 picker sit at 2100 (Spells info, confirm).

## Guardrail classification
All items **Tier 3** (tickets.md "Guardrail alignment"; no Tier-1 sign-off needed):
- I1 adds derived fields to the view-model (`store.js`), never stored; character
  schema and `rules/*.json` shapes untouched. Renaming the *derived*
  `detail.notes` to `detail.effects` (I2) is a view-model field, not a schema
  shape (GUARDRAILS Tier 1 covers `data/characters/*.json` and `rules/*.json`).
- I2-I6 are new content in an existing modal and pickers through `ui/kit/`,
  `--fs-*` tokens, light-dark colours; Escape/Enter contract honoured
  (UI-GUIDELINES §7, MODALS.md §2).
- Data down / events up preserved: the view reads model fields only; no catalog
  lookup in the view (T1), no new dispatch.
- No effect-taxonomy change (no Tier 2).

## Rules dependencies
None. `rules.md` records that no Earthdawn rule is computed or asserted: the
feature only displays text already in `rules/talents.json`. Eligibility, prices
and gating are unchanged.

## Implementation items

### I1 — Catalog detail on every picker talent (model)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Each talent a picker lists carries the same detail shape a
  Disciplines-tab row carries for the detail modal.
- **Where:** `store.js` (`deriveModel`: `talentDetail` at 933, slots at 1293-1296,
  `addableDisciplinesModel` at 1754-1762, creation candidates at 2140); new test
  `store-talent-picker-detail.test.js` (or extend `store-advancement.test.js`,
  `store-start-discipline.test.js`, `store-creation-model.test.js`).
- **Approach:** Add one closure inside `deriveModel`, next to `talentCatalog`:
  `pickerTalent(name, circle, required = false)` →
  `{ name, required, brief, action, attribute, detail }`, where
  `cat = talentCatalog[name]`; `brief = cat?.presentation?.shortEffect ?? null`
  (unchanged value), `action = cat?.action || null`,
  `attribute = cat?.attribute || null`,
  `detail = cat ? talentDetail(cat, circle, legendFile) : null`. Use it for:
  - `slots[].learnable` (circle = `s.circle`);
  - `addableDisciplinesModel[].optionPool.items` (circle 1);
  - a **new** `addableDisciplinesModel[].grantItems = c.grants.map((n) => pickerTalent(n, 1, true))`
    (keep `grants: string[]` as is);
  - creation `talents.option.candidates` (circle 1).
  Tier uses `tierForCircle(circle, costs)` exactly like the creation rows; the
  homebrew `tierShift` is a pricing shift and does not change the displayed tier.
- **Dependencies:** none.
- **Acceptance criteria:** for every picker list, each item has `detail` whose
  `summary`/`strain`/`versus`/`tier`/`skillUse`/`effects` match
  `rules/talents.json` (the store test asserts `detail.effects` for Anticipate
  Blow: both effect summaries, and that `detail.notes` is absent); a name missing from the catalog yields `detail: null`
  (and null brief/action/attribute); `grants` is still `string[]`; existing
  `{name, brief}` consumers and tests pass unchanged; nothing is written to the
  character.
- **Risks / unknowns:** model size grows slightly (pools are tens of talents);
  acceptable.

### I2 — Effects list in the talent detail modal
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** The shared detail modal shows a labelled "Effects" list (one item per
  effect summary) below the summary text; omitted when there are none. Replaces
  the current unlabelled `.mnote` lines for the same strings.
- **Where:** `store.js:933-943` (`talentDetail`), `ui/ed-disciplines.js:766-793`
  (`_talentModal`) and its static styles.
- **Approach:** Rename the derived `detail.notes` to `detail.effects` (same
  value: `(cat.effects || []).map((e) => e.summary).filter(Boolean)`) so the name
  says what it is; update the comment. This name is settled: `detail.effects`
  ships (the only reader is `ui/ed-disciplines.js:789`, and no test asserts
  `detail.notes`). The Effects list replaces the karma-tinted `.mnote` lines
  (`.mnote` uses `var(--karma)` / `var(--karma-bg)`, `ui/ed-disciplines.js:293`)
  for these strings; `.mnote` stays for the grant-sources note. In `_talentModal`, after the summary/"Full
  details coming." line, render when `dt.effects?.length`: an eyebrow heading
  "Effects" (reuse the existing `h4` eyebrow style or a small class using
  `var(--fs-eyebrow)`, weight 500, `var(--muted)`) and a `<ul class="meffects">`
  of `<li>` at `var(--fs-small)` with theme colours (`var(--fg)` /
  `light-dark()`); no new font weights. The grant-sources note stays after it.
- **Dependencies:** I1 not required (rows already carry `detail`), but do I1 first
  so picker items get the renamed field from one helper.
- **Acceptance criteria:** Anticipate Blow's modal (Disciplines tab and any
  picker) shows "Effects" with both summaries; a talent with no effect summaries
  shows no Effects heading; light and dark both legible; `npm test`
  (incl. `check-ui-kit`) passes; no remaining reader of `detail.notes`
  (`grep -rn "detail.notes\|dt.notes"` is empty). Visual checks: see Manual
  verification M1.
- **Risks / unknowns:** low.

### I3 — Stacked talent detail: second controller and bubble helper
- **Covers tickets:** T3, T4, T5 (shared plumbing)
- **Rules:** none
- **Tier:** 3
- **What:** The component can open the talent detail modal *above* any picker
  without closing or disturbing it.
- **Where:** `ui/ed-disciplines.js` (constructor ~line 306-331, `_talentModal`,
  `render()` ~line 1880-1906).
- **Approach:**
  - New reactive state `_talentInfo` (declare in `static properties` with
    `state: true`, init `null`) and a second controller
    `this._talentInfoCtl = new ModalController(this, { kind: 'info', onClose: () => { this._talentInfo = null; } })`.
  - `_openTalentInfo(item, e)`: `e.stopPropagation(); e.preventDefault();`
    set `_talentInfo = item`, then `this._talentInfoCtl.opened(e.currentTarget)`.
  - Parametrise the frame: `_talentModal(t, ctl = this._modalCtl, layer = 2000)`;
    the stacked call is `_talentModal(this._talentInfo, this._talentInfoCtl, 2100)`.
    The Disciplines-tab path is unchanged.
  - In `render()`, emit `${this._talentInfo ? this._talentModal(this._talentInfo, this._talentInfoCtl, 2100) : ''}`
    **after** the `_modal` block (DOM order + higher layer = on top).
  - `_talentBubble(item, required)`: returns
    `<button type="button" class="tinfo ${required ? 'req' : 'opt'}" aria-label="${name} — ${required ? 'required Discipline talent' : 'Talent option'}, view details" title="… Click for details." @click=${(e) => this._openTalentInfo(item, e)}>i</button>`,
    mirroring `_talentRow`'s bubble (`ui/ed-disciplines.js:359-364`).
  - Comment the two-controller arrangement as ed-spells does.
- **Dependencies:** I1 (items carry `detail`), I2 (modal content).
- **Acceptance criteria:** opening the stacked detail leaves `_modal` and all
  picker view state untouched; Escape / ✕ / backdrop / Enter close only the
  detail and focus returns to the triggering bubble (ring suppressed for a
  pointer open, kept for a keyboard open, MODALS.md §2.4); Tab is trapped in the
  detail while open.
- **Risks / unknowns:** none open. Teardown on a tab switch is already handled:
  `ui/ed-app.js:2712-2713` renders `<ed-disciplines>` inside the tab `switch`, so
  leaving the tab destroys the instance (no stale `_talentInfo` survives), and
  `ModalController.hostDisconnected` (`ui/kit/modal-controller.js:251-257`)
  removes each open controller from the kit stack on its own. Add no
  `disconnectedCallback` or other extra teardown code.
- **Verification:** manual, see M2-M4.

### I4 — Bubbles in the edit-mode Add-talent-option picker (B-002)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Each option row gets an outlined bubble opening the stacked detail.
- **Where:** `ui/ed-disciplines.js` `_learnModal` (~1483-1505).
- **Approach:** Wrap each option as
  `<div class="lrow">${this._talentBubble(o, false)}<button class="lopt" ?autofocus=${i === 0} …>…</button></div>`
  (bubble left of the name, as on the Disciplines tab). `.lopt` keeps its click,
  autofocus and content. Add a small gap/alignment rule for `.lrow .tinfo` if the
  existing `.lrow` (`gap: 4px`) reads cramped.
- **Dependencies:** I3.
- **Acceptance criteria:** T3's criteria: clicking the bubble opens the detail and
  does not pick; Escape closes only the detail and focus returns to the bubble
  with the picker still open; the bubble is Tab-reachable with an aria-label
  naming the talent; Enter on the bubble opens the detail, not a pick; the first
  `.lopt` is still the initial focus.
- **Risks / unknowns:** none.

### I5 — Bubbles in Add Discipline / Seed Circle 1 (B-003)
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** Filled bubbles on the required Circle 1 grants, outlined bubbles on
  each Talent Option radio row.
- **Where:** `ui/ed-disciplines.js` `_startModal` (~1419-1475) and `.startopt` /
  `.crow` styles (~109-118).
- **Approach:**
  - Grants: iterate `cand.grantItems` (from I1) instead of `cand.grants`:
    `<div class="crow"><span class="ck tname">${this._talentBubble(g, true)}${g.name}</span>…</div>`.
    Keep the per-talent Legend pill.
  - Options: render each as a row wrapper
    `<div class="startoptrow">${this._talentBubble(i, false)}<label class="startopt">…radio…</label></div>`;
    the bubble is outside the `<label>`. The "No option for now" row gets a
    spacer the bubble's width (14px) so the radios align.
  - The radio state (`_startOption`), silver (`_startSilver`, `_startEdited`) and
    the select are not touched by the bubble path.
- **Dependencies:** I1, I3.
- **Acceptance criteria:** T4's criteria: an option bubble click does not change
  the radio; Escape closes only the detail and returns focus to the bubble;
  Enter inside the detail closes it and does not confirm Start Discipline /
  Seed Circle 1; selection and silver are unchanged after the detail closes;
  required grants show filled bubbles, options outlined.
- **Risks / unknowns:** if `_startState` recomputes `cand` on every render, the
  `grantItems` objects are fresh each time; the detail holds its own `item`
  snapshot so this is harmless.

### I6 — Bubbles in the creation-mode option picker
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** Each candidate in the creation "+ add option" picker gets an outlined
  bubble.
- **Where:** `ui/ed-disciplines.js` `_creationOptionModal` (~566-585).
- **Approach:** Same `.lrow` wrapper as I4 around each `.lopt`; the pick handler
  (close + `_creationEdit({kind:'talent', …, rank: 1})`) is unchanged.
- **Dependencies:** I1, I3.
- **Acceptance criteria:** T3's behaviour holds here; picking a candidate still
  spends one talent point as before.
- **Risks / unknowns:** none.

### I7 — Docs
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3
- **What:** Describe the shipped behaviour.
- **Where:** `docs/UI-GUIDELINES.md` §4 (add a dated italic Disciplines note in the
  style of the existing ones, ~line 66-86); `docs/MODALS.md` §5 host table /
  creation paragraph (~160-178).
- **Approach:** UI-GUIDELINES: "talent info bubbles (talent-info-bubbles,
  <date>): the three talent pickers carry the Disciplines-tab bubble (filled on
  required Circle 1 grants, outlined on Talent Options); a click opens the shared
  talent detail modal stacked above and never selects; the detail modal lists
  the talent's effect summaries under Effects." MODALS.md: add the stacked
  Disciplines talent detail (kind `info`, layer 2100, 30rem scroll, its own
  controller in the Disciplines shadow root, opened from the learn,
  creation-option and start-discipline modals; Escape closes only it).
- **Dependencies:** I2-I6 final.
- **Acceptance criteria:** both docs match the code.
- **Risks / unknowns:** none.

## Verification

### Automated (`npm test`)
- I1: the new store test covers picker detail for all four lists (learnable,
  `optionPool.items`, `grantItems`, creation candidates), `detail: null` for a
  missing catalog name, and `detail.effects` (not `notes`).
- Existing tests that must stay green unchanged: `grants: string[]`
  (`store-start-discipline.test.js:68,178`) and the `{name, brief}` picker
  consumers (`store-start-discipline.test.js:84`, `store-advancement.test.js:139-163`).
- `tools/check-ui-kit.mjs` (pretest): type tokens, no inline button styles, no
  hand-rolled dialogs.
- No unit test exercises the DOM/kit behaviour of I2-I6; that is manual (below).

### Manual verification (owner, in the browser)
- **M1 — Detail modal Effects (I2).** Open Anticipate Blow from the Disciplines
  tab: an "Effects" heading lists both summaries (no karma-tinted lines for
  them); a talent with no effect summaries shows no Effects heading; check light
  and dark mode.
- **M2 — Edit-mode Add-talent-option picker (I4).**
- **M3 — Add Discipline and Seed Circle 1 (I5).**
- **M4 — Creation "+ add option" picker (I6).**

For each of M2-M4, check that:
1. the bubbles are filled on required grants (M3 only) and outlined on options;
2. clicking a bubble opens the detail on top of the picker and does not pick (M2,
   M4) or change the radio (M3);
3. Escape closes only the detail and the picker stays open; ✕ and backdrop do the
   same;
4. focus returns to the bubble: no ring after a mouse open, a ring after a
   keyboard open;
5. Tab stays trapped inside the detail while it is open;
6. Tab reaches the bubble, the aria-label names the talent, and Enter on the
   bubble opens the detail and does not pick;
7. M3 only: Enter inside the detail closes it and does not confirm Start
   Discipline / Seed Circle 1, and the selection, silver and discipline select
   are unchanged afterwards;
8. picking afterwards still works as before (M4: one talent point spent);
9. the picker's first option still takes initial focus;
10. it looks right in light and dark mode.

## Sequencing
1. **I1** — model first; everything else reads it, and it is unit-testable alone.
2. **I2** — the Effects list; visible on the Disciplines tab immediately, and the
   rename lands before picker items start rendering `detail`.
3. **I3** — stacked controller and bubble helper (no visible change on its own).
4. **I4**, **I5**, **I6** — one picker each; independent of one another after I3.
5. **I7** — docs last, describing what shipped.

## Open questions
- Placement of the bubble in the `.lrow` pickers (left of the name, as on the
  Disciplines tab, versus after the row as the skill picker's `ibadge`): planned
  left to match the owner's "match the Disciplines tab" answer; non-blocking.

## Review responses
- **F1 (major) — UI behaviour not routed to manual verification:** fixed. Added
  the `## Verification` section, which separates automated coverage (I1 store
  test, `check-ui-kit`, the unchanged `grants`/`{name, brief}` tests) from a
  manual owner checklist: M1 for the Effects list (it replaces the karma-tinted
  `.mnote` lines) and M2-M4 for each picker. Linked from I2 and I3.
- **F2 (minor) — `detail.notes` rename left optional:** fixed. `detail.effects`
  is now the settled name and the "keeping `notes` is acceptable" escape hatch
  is gone. The I1 store test asserts `detail.effects` and that `detail.notes`
  is absent; the I2 criterion adds a grep check.
- **F3 (minor) — teardown risk:** fixed. The open risk in I3 is replaced with
  the confirmed facts (`ui/ed-app.js:2712-2713` destroys the instance on a tab
  switch; `hostDisconnected` at `ui/kit/modal-controller.js:251-257` removes
  each open controller) and an instruction to add no extra teardown code.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
