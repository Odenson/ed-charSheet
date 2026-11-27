# Tech Spec: Talent info bubbles (talent-info-bubbles)

## Overview
Every talent listed by the three Disciplines-tab pickers (edit-mode Add-talent-option,
Add Discipline / Seed Circle 1, creation "+ add option") gets the Disciplines-tab `.tinfo`
bubble. A click opens the existing talent detail modal (`_talentModal`) stacked above the
picker through a second kit `ModalController` (kind `info`, layer 2100), leaving picker state
untouched. The store enriches every picker talent with the same `detail` shape a
Disciplines-tab row has, via one `pickerTalent` helper in `deriveModel`. The derived
`detail.notes` is renamed `detail.effects`, and the modal shows it as a labelled "Effects" list
instead of the unlabelled karma-tinted `.mnote` lines.

## Guardrail alignment
- **All changes are Tier 3** (plan.md "Guardrail classification", build-log Run 1). No Tier-1
  sign-off is needed and there is no Tier-2 taxonomy change.
- `store.js`: these are derived view-model fields only. Nothing is written to the character, and
  `data/characters/*.json` and `rules/*.json` shapes are untouched. `detail.notes` → `detail.effects`
  renames a *derived* field. It is not a schema shape.
- Data down / events up: the view reads `item.detail`, `brief`, `action` and `attribute` from the
  model and never looks up `rules/talents.json`. There is no new `dispatch`. Pick handlers and
  `ed-learn-talent` / `_creationEdit` / `_confirmStart` are unchanged.
- The engine is untouched. `engine/talent-options.js` `initiationQuote` still returns
  `grants: string[]`.
- No derived numeric values are shown, so no placeholder pills are needed. The modal shows only
  catalog text plus the tier chip, which comes from the existing `tierForCircle`.
- Modals go through `ui/kit/` (`modalFrame`, `ModalController`) and follow the MODALS.md §2/§3
  focus and Escape/Enter contract. `DISC_KIND` and `_modalCtl` are not changed.

## Design
### Data / types
No stored inputs, and no `rules/*.json` changes.

Derived view-model additions and changes (`deriveModel` in `store.js`):

```ts
// shape of every picker talent item
type PickerTalent = {
  name: string;
  required: boolean;            // true only for Start-modal grants
  brief: string | null;         // cat.presentation.shortEffect (same value as today)
  action: string | null;        // cat.action || null
  attribute: string | null;     // cat.attribute || null
  detail: TalentDetail | null;  // null when the name is not in the catalog
};
type TalentDetail = {           // talentDetail(); only `notes` -> `effects` changes
  summary: string | null; versus: string | null; strain: number | null;
  tier: string | null; skillUse: object | null;
  effects: string[];            // (cat.effects || []).map(e => e.summary).filter(Boolean)
  documented: boolean;
};
```

Lists that become `PickerTalent[]`:
- `model.disciplines[].slots[].learnable`: circle = `s.circle`, required false.
- `model.addableDisciplines[].optionPool.items`: circle 1, required false.
- **New** `model.addableDisciplines[].grantItems`: `c.grants.map(n => pickerTalent(n, 1, true))`.
  `grants` stays `string[]`, because `ui/ed-app.js:1984` and `store-start-discipline.test.js:68,178`
  depend on it.
- `model.creation.talents.option.candidates`: circle 1, required false.

Every existing `{name, brief}` consumer still works because the items are a superset.

### Modules & functions
**`store.js`**
- `talentDetail(cat, circle, legendFile)` (line ~933): rename key `notes` to `effects`, keep the
  same value, and update the comment.
- In `deriveModel`, right after `const talentCatalog = …` (line ~963), add a closure:
  ```js
  const pickerTalent = (name, circle, required = false) => {
    const cat = talentCatalog[name];
    return {
      name, required,
      brief: cat?.presentation?.shortEffect ?? null,
      action: cat?.action || null,
      attribute: cat?.attribute || null,
      detail: cat ? talentDetail(cat, circle, legendFile) : null,
    };
  };
  ```
- Slots (line ~1295): `learnable: pool.items.map((name) => pickerTalent(name, s.circle))`.
- `addableDisciplinesModel` (line ~1756): `optionPool.items: c.optionPool.items.map((n) => pickerTalent(n, 1))`
  and add `grantItems: c.grants.map((n) => pickerTalent(n, 1, true))`.
- Creation (line ~2140): `candidates: status.talents.option.candidates.map((n) => pickerTalent(n, 1))`.
  Leave the creation `rows` mapping as it is.
- The homebrew `tierShift` is not passed. The displayed tier is `tierForCircle(circle, costs)`
  only, as on creation rows.

**`ui/ed-disciplines.js`**
- `static properties`: add `_talentInfo: { state: true }`. Initialise it to `null` in the
  constructor.
- Constructor (after `_modalCtl`, line ~331): add the controller, with a comment on the
  two-controller arrangement in the style of `ui/ed-spells.js:246`.
  `this._talentInfoCtl = new ModalController(this, { kind: 'info', onClose: () => { this._talentInfo = null; } });`
- New `_openTalentInfo(item, e)`: `e.stopPropagation(); e.preventDefault(); this._talentInfo = item; this._talentInfoCtl.opened(e.currentTarget);`
  It does not touch `_modal`, `_startSel`, `_startOption`, `_startSilver` or `_startEdited`.
- New `_talentBubble(item, required)` returns the bubble button. Its markup mirrors `_talentRow`
  (lines ~359-364):
  `<button type="button" class="tinfo ${required ? 'req' : 'opt'}" aria-label="${name} — ${status}, view details" title="${name} — ${status}. Click for details." @click=${(e) => this._openTalentInfo(item, e)}>i</button>`.
  `status` is `'required Discipline talent'` when required, otherwise `'Talent option'`.
- `_talentModal(t, ctl = this._modalCtl, layer = 2000)` passes `ctl` and `layer` to `modalFrame`.
  The body changes as follows:
  - Replace `${(dt.notes ?? []).map(... .mnote ...)}` with
    `${dt.effects?.length ? html`<h4 class="meffh">Effects</h4><ul class="meffects">${dt.effects.map((n) => html`<li>${n}</li>`)}</ul>` : ''}`,
    placed after the summary / "Full details coming." line and before the grant-sources `.mnote`.
  - `.mnote` stays for the grant-sources note.
- `render()`: after the `${this._modal ? … : ''}` chain (line ~1903) and before
  `${this._customSkillForm()}`, add
  `${this._talentInfo ? this._talentModal(this._talentInfo, this._talentInfoCtl, 2100) : ''}`.
- `_learnModal` (line ~1488): wrap each option as
  `<div class="lrow">${this._talentBubble(o, false)}<button class="lopt" ?autofocus=${i === 0} …>…</button></div>`.
  The `.lopt` content, click handler and autofocus stay as they are.
- `_creationOptionModal` (line ~574): use the same `.lrow` wrapper. The pick handler is
  unchanged.
- `_startModal` (line ~1440):
  - Grants: iterate `cand.grantItems` instead of `cand.grants`:
    `<div class="crow"><span class="ck tname">${this._talentBubble(g, true)}${g.name}</span><span class="cchk">${pill(perTalent)} Legend</span></div>`.
  - Options: render each as
    `<div class="startoptrow">${this._talentBubble(i, false)}<label class="startopt">…radio unchanged…</label></div>`.
    The "No option for now" row is
    `<div class="startoptrow"><span class="tspacer" aria-hidden="true"></span><label class="startopt">…</label></div>`.
    The bubble is never inside the `<label>`.
- Static styles (tokens only, light-dark-aware vars, weights 400/500):
  - `.meffh { margin: 10px 0 4px; }`, which reuses the global `h4` eyebrow style
    (`--fs-eyebrow`, weight 500, `--muted`, line 171).
  - `.meffects { margin: 0; padding-left: 18px; font-size: var(--fs-small); line-height: 1.5; color: var(--fg); }`
  - `.meffects li + li { margin-top: 3px; }`
  - `.lrow > .tinfo { margin-left: 6px; }` (spacing only, if needed)
  - `.startoptrow { display: flex; gap: 8px; align-items: flex-start; }`
  - `.startoptrow > .tinfo, .tspacer { margin-top: 2px; }`
  - `.tspacer { width: 14px; flex: none; }`

**Docs** (I7)
- `docs/UI-GUIDELINES.md` §4: add a dated italic note "*Talent info bubbles (talent-info-bubbles,
  <date>): …*" as worded in plan.md I7.
- `docs/MODALS.md` §5: add the stacked Disciplines talent detail. It is kind `info`, layer 2100,
  30rem scroll, and has its own controller in the Disciplines shadow root. It opens from the
  learn, creation-option and start-discipline modals, and Escape closes only it.

**Tests**
- New `store-talent-picker-detail.test.js`. Use the `rules` loader and the `kolonLike()` fixture
  pattern from `store-start-discipline.test.js`.

**Changelog**
- `data/changelog.json` `unreleased.changes`: add the entry below.

### UI / behavior
- **Placement:** the bubble sits left of the talent name in every picker, matching the
  Disciplines tab (settled in build-log Run 1). It is filled (`.tinfo.req`) on Start-modal grants
  and outlined (`.tinfo.opt`) on every Talent Option.
- **Click / Enter on a bubble:** opens the stacked detail. It never picks (`.lopt` is a sibling,
  not a parent) and never toggles a radio (the bubble is outside the `<label>`). Enter on the
  bubble is a non-primary button, so it passes (MODALS.md R13) and activates the bubble natively.
- **Stacked detail:** the detail renders after the `_modal` block in the DOM and sits at layer
  2100, so it is on top. The kit stack routes Escape and Enter to it only. Escape, ✕, backdrop and
  Enter close it (kind `info`), and `onClose` clears `_talentInfo`. Focus returns to the bubble:
  no ring after a pointer open, a ring after a keyboard open (MODALS.md §2.4). Tab is trapped in
  the detail. Enter inside the detail never reaches the Start modal's confirm.
- **Chips in a picker detail:** the brief chip. "Required" (grants) or "Optional" (options),
  because `t.free` is absent. `${action} action` and attribute, Strain, tier, "No skill use" and
  "vs …" when the data exists. `actionBase`, `grantSources` and `rank` are absent and already
  guarded.
- **Missing catalog entry:** `detail: null` → "Full details coming." and no Effects heading.
- **Disciplines-tab detail:** the same modal now shows "Effects" instead of the karma-tinted lines.
- **Teardown:** add no extra code. `ui/ed-app.js:2712` destroys the component on a tab switch,
  and `hostDisconnected` (`ui/kit/modal-controller.js:251`) unstacks the controller.
- **Theme:** all new colours are existing theme vars, legible in light and dark mode. The Overview
  viewport is not affected.

### Rules
| Rule | Value / formula | rules.md id / source |
|---|---|---|
| — | None. The feature displays existing `rules/talents.json` text. Eligibility, prices, gating and tier derivation are unchanged. | rules.md (no rule computed or asserted) |

The displayed tier uses the existing `tierForCircle(circle, legendFile.costs)` behaviour. It is
not a new ruling, and the tester asserts it equals the function's output rather than a literal.

### Edge cases & invariants
- `addableDisciplines[].grants` is still `string[]`, with the same names and order. `grantItems`
  has the same length and order, and `grantItems[i].name === grants[i]`.
- Each picker item's `name` and `brief` are identical to today's `{name, brief}`, so the existing
  tests stay green unchanged.
- An unknown name gives `{ name, required, brief: null, action: null, attribute: null, detail: null }`.
- `detail.effects` is `[]` (not undefined) for a catalog talent with no effect summaries, for
  example `Acting`. The `notes` key is absent everywhere. `grep -rn "detail\.notes\|dt\.notes"`
  returns nothing.
- `deriveModel` writes nothing to `character` (no new stored field).
- An empty pool or an empty candidates list renders exactly as today (no bubbles).
- Opening and closing the detail leaves `_modal`, `_startSel`, `_startOption`, `_startSilver`
  and `_startEdited` unchanged. The first `.lopt` keeps `autofocus`.

## Testability notes
- **Unit (node:test, `store-talent-picker-detail.test.js`).** All of these go through
  `deriveModel(character, rules)`:
  - **Learnable:** an edit-mode character with an open option slot (reuse a fixture from
    `store-advancement.test.js` lines ~139-163). Every `slots[].learnable[i]` has the
    `PickerTalent` keys. For catalog talents, `detail.tier === tierForCircle(slot.circle, costs)`.
  - **Start modal:** with the `kolonLike()` Warrior seed candidate
    (`store-start-discipline.test.js`):
    - `grantItems.length === grants.length`, names match, and every item has `required: true`.
    - `optionPool.items` items have `required: false`.
    - Anticipate Blow is in the Warrior novice pool (`rules/disciplines.json:307`). Its item has:
      - `detail.effects` deep-equal to the two catalog summaries ("+2 Physical Defense vs that
        foe's attacks until end of round (per success)." and "+2 per success to your first
        Attack test against the target.");
      - `'notes' in detail === false`;
      - `detail.strain === 1`, `action === 'Simple'`, `attribute === 'Perception'`.
  - **Creation:** a creation-open character (fixture from `store-creation-model.test.js`). The
    `creation.talents.option.candidates` items carry `detail` with the circle-1 tier.
  - **Missing name:** inject a bogus name, for example by stubbing `talentsFile` without one pool
    talent, or by calling with a `rules` copy whose catalog lacks it. The result is `detail: null`
    and the other fields are null.
  - **Disciplines-tab rows:** `model.disciplines[].talents[].detail.effects` is an array and
    `notes` is absent.
- **Pre-test:** `tools/check-ui-kit.mjs` must pass (tokens, no inline button styles).
- **Manual (owner), plan.md Verification M1-M4:**
  - M1: the Effects list in light and dark mode.
  - For each picker: bubble look; click and Enter open on top and never select or toggle;
    Escape, ✕ and backdrop close only the detail; focus returns with the correct ring; Tab is
    trapped; in the Start modal, Enter in the detail does not confirm and selection, silver and
    select are unchanged; picking afterwards still works; the first option keeps initial focus.

## Changelog entry
`{"type": "added", "text": "Talent pickers (Add talent option, Add Discipline / Seed Circle 1, and the creation option picker) now have an info bubble on each talent that opens its full details, and talent details list the talent's effects."}`

## Out of scope
- Picker selection, eligibility, prices, gating and silver fees.
- New talent data or a talent-level `notes` field in `rules/talents.json`.
- Character-specific Step or rank for unlearned talents.
- The homebrew `tierShift` in the displayed tier.
- Bubbles in the skill or knack pickers, inline expand, and any change to `DISC_KIND` or `_modalCtl`.
