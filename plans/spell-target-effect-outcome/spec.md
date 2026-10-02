# Tech Spec: Spell effect outcome on other targets (spell-target-effect-outcome)

> Superseded in part by plans/spell-extra-weave-and-extra-cast/spec.md (2026-10-02): `otherCastOutcome` now takes `opts.rank`, returns `success`, and `duration` is `{label, rounds, base, boost, text}`; the "label only" duration rule (R5) is replaced.

## Overview
Add a pure engine function `otherCastOutcome(spell, cast)` in `engine/spells.js` that turns the recorded result of a cast on another target into a structured outcome plus engine-composed strings. `ui/ed-spells.js` keeps the latest Other cast as session state (`_otherCast`, separate from `_prog`, persisted through the existing module-level `SCRATCH`), and when "Cast on" is Other renders a "Target effects" card in place of Active effects, purely from the engine result. Nothing is stored in character data or `rules/*.json`.

## Guardrail alignment
- `engine/spells.js` addition: Tier 3 (pure, DOM-free, additive; no schema or taxonomy change; no new string parsing of spell labels).
- `ui/ed-spells.js` Target effects card and session state: Tier 1 (Spells tab contents, placeholder-pill rule). Signed off: qa-log 2026-10-02 "TIER-1 SIGN-OFF" (Yes, sign off).
- `docs/UI-GUIDELINES.md` §4 Spells row edit: Tier 1, same sign-off. `data/changelog.json` line: Tier 3.
- No Tier-2 change (no taxonomy vocabulary touched).
- Golden rule holds: data flows down (engine result -> render), no new event goes up (session UI state only, like the existing scratchpad); the UI computes no game values (levels already come from `successCount` in the existing `_onRoll`; all strings and the effect/duration readout come from the engine); only inputs are stored (the record holds raw roll results; the outcome is derived on every render); unrolled values are `null` and render as muted dashed placeholder pills.

## Design
### Data / types
No schema, rules data or character data change. New session-only shapes:

`cast` record (UI state `_otherCast`, input to the engine):
`{ seq: number, name: string, target: number, total: number, levels: number, extraPicks: string[], effectTotal: number|null }`
- `target` = the number actually used for the roll (`_castTarget`); `levels` = `successCount(total, target)` already computed in `_onRoll`; `extraPicks` = assigned extra-thread option labels (one entry per thread, repeats allowed); `effectTotal` = Effect roll total or `null` until it lands.

Outcome (return of `otherCastOutcome`, never stored):
```
{
  spell: string,                 // spell name (spell.name, or cast.name when spell is null)
  hit: boolean,                  // cast.levels >= 1
  target: number,                // cast.target
  total: number,                 // cast.total
  levels: number,                // cast.levels
  extraSuccesses: number,        // Math.max(0, levels - 1); informational, never displayed
  badge: 'Hit' | 'Miss',
  headline: string,              // hit: "N success(es) vs T"; miss: "Miss vs T — no effect"
  effect: null | { kind: 'step', total: number|null, text: string|null }
              | { kind: 'static', value: number, label: string, text: string }
              | { kind: 'none', text: string },
  picks: Array<{ label: string, count: number }>,   // stacked, first-seen order
  duration: null | { label: string },
  text: string                   // single composed line, see below
}
```

### Modules & functions
**`engine/spells.js`** — add export `otherCastOutcome(spell, cast, opts)`; `opts` is accepted but reserved/unused. The function takes **no rank** and does not call `durationRounds` or `castBoosts`. `spell` is a joined catalog spell (`joinSpell(ctx, name)` result) or `null`/undefined. Add the export to the import list in `engine/spells.test.js`.

Contract (exact strings; "T" = `cast.target`, "N" = `cast.levels`):
1. `spell` field = `spell?.name ?? cast.name`. `hit = cast.levels >= 1`. `extraSuccesses = Math.max(0, levels - 1)`.
2. Miss (`!hit`): `effect = null`, `picks = []`, `duration = null`, `badge = 'Miss'`, `headline = text = \`Miss vs ${T} — no effect\`` (em dash U+2014). `cast.effectTotal` is ignored. No thread/Karma/armor wording anywhere. T is always the number actually rolled against, even if it was the default target.
3. Hit with `spell == null`: `badge = 'Hit'`, `headline = \`${N} success${N === 1 ? '' : 'es'} vs ${T}\``; `text = \`${cast.name} — ${headline}\``; `effect = null`, `picks = []`, `duration = null`.
4. Hit with a spell: `headline` as above. The effect kind comes from `effectReadout({}, spell)`:
   - step: `effect = { kind:'step', total: cast.effectTotal ?? null, text: total == null ? null : \`Effect ${total}\` }`.
   - static: `effect = { kind:'static', value, label, text: \`+${value} ${label}\` }` (same wording as the existing panel grid).
   - none: `effect = { kind:'none', text: 'No Effect roll' }`.
   - `picks` = `cast.extraPicks` collapsed to `{label,count}` preserving first-seen order.
   - `duration = spell.duration ? { label: spell.duration } : null` (label exactly as in the catalog, e.g. "Rank minutes"; no rounds figure, no success-level extension).
   - `text` = parts joined with `" · "`, in this order, omitting absent parts:
     1. `\`${spell.name} — ${headline}\``
     2. effect part: step pending -> `"Effect —"`; step rolled/static/none -> `effect.text`
     3. picks (only if non-empty): `"Extra threads: "` + picks joined `", "`, each `label` plus `" ×" + count` when count > 1
     4. duration (only if non-null): `\`Duration ${label}\``
   - Example: `Arrow of Night — 3 successes vs 9 · Effect 14 · Extra threads: Foo ×2, Bar · Duration Rank minutes`.
5. Pure/total: never throws on missing `extraPicks` (treated as `[]`), never mutates inputs, no DOM.

**`ui/ed-spells.js`** (touches; imports `otherCastOutcome`, `joinSpell` from `../engine/spells.js`):
- `static properties`/constructor: `_otherCast: { state: true }` init `null`; `this._castOnOther = false`, `this._castSeq = 0`, `this._seqCounter = 0`.
- `_rollCast`: after `_castFoldsSelf`, set `this._castOnOther = this._subject === 'other'` and `this._castSeq = ++this._seqCounter`. (Captured at cast time: the toggle may change before the Effect roll.)
- `_onRoll` 'cast' branch (after `levels` is computed): if `this._castOnOther`, `this._otherCast = { seq: this._castSeq, name: this._castName, target: this._castTarget, total, levels, extraPicks: [...this._prog.extraPicks], effectTotal: null }`, hit or miss, replacing any previous record. A Karma re-roll (same rollId) re-enters this branch and replaces it again, keeping the same `seq`. Static/none effects need nothing further (the engine reads spell data).
- `_onRoll` 'effect' branch: if `this._castOnOther && this._otherCast?.seq === this._castSeq`, `this._otherCast = { ...this._otherCast, effectTotal: res.total }` (also on a Karma re-roll refresh). Do this before/independently of the `_prog` reset. A miss may still receive an Effect roll (button is enabled on `castDone`); the record keeps the value, the engine ignores it.
- Self-casts never touch `_otherCast`; changing spell, cast type or the subject toggle does not clear it.
- `_saveScratch`: add `otherCast: this._otherCast ? { ...this._otherCast, extraPicks: [...this._otherCast.extraPicks] } : null`. `_restoreScratch`: restore a clone and set `this._seqCounter = Math.max(this._seqCounter, s.otherCast?.seq ?? 0)`; keep `_castSeq`/`_castOnOther` as is (fresh element after tab switch: no in-flight cast can span a destroy since `_pendingStep` is also not persisted). `_resetWorkspace` (character switch only): `_otherCast = null`.
- `_castPanel`: replace the trailing `${this._activeEffects()}` with `${this._subject === 'other' ? this._targetEffects() : this._activeEffects()}`. `_activeEffects()` is unchanged.
- New `_targetEffects()`: renders `<h4 class="circlelbl aehead">Target effects</h4>` and `<div class="aecard">`. The spell is resolved from the record, not the selected spell: `const rec = this._otherCast; const out = rec ? otherCastOutcome(joinSpell(this.ctx, rec.name), rec) : null`. (The UI must not call `joinSpell` with a null ctx; guard `this.ctx`, passing `null` spell when ctx is absent.)
- Styles: scoped, existing tokens only (`--fs-*`, `--muted`, `--border`, `--spell`, `--karma`, `--danger`), weights 400/500 only; add one placeholder-pill class (e.g. `.tepend`: `font-size: var(--fs-eyebrow); color: var(--muted); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 8px;`, matching `ed-combat.js` `.pend`) and a row class for the layout lines.

### UI / behavior
Card content (all text/labels from the engine result; the UI only lays them out):
- No record: one muted `.aeempty` line, exactly "No cast on another target yet."
- Miss: ONE line: `out.spell` (name), then a `.succn.miss` pill whose text is `out.headline` ("Miss vs T — no effect"). No other rows.
- Hit, line 1: `out.spell`, a `.succn` pill with `out.badge` ("Hit"), then muted `out.headline` ("N success(es) vs T").
- Hit, line 2 (omitted if nothing to show): effect pill and pick pills. Effect pill: `out.effect.text` in a `.pickchip`-styled pill; for step with `total == null` a dashed `.tepend` pill with the literal "Effect —". Kind `none` shows the "No Effect roll" pill. Each pick: `.pickchip` with `label` plus ` ×count` when count > 1 (same as existing picksum).
- Hit, line 3: `out.duration` -> muted "Duration <label>"; omitted when null.
- Unresolvable spell (`joinSpell` returns null): render `out.text` as plain muted text, no pills (for a miss this is still "Miss vs T — no effect").
- Placeholder -> number: when the Effect roll lands, `_otherCast.effectTotal` updates (reactive state) and the dashed pill becomes "Effect <total>".
- Toggle This character: Active effects exactly as today (the session `active` set is untouched while hidden). Tab switch and back: restored from `SCRATCH`. Next Other cast replaces the card. Character switch clears it.
- No new dispatched event. Theme: only variables with light/dark values; the existing `.succn.miss` already uses `light-dark()`. No modals involved (Escape/Enter unchanged). Keep the card compact (max 3 short lines) so the right column does not add desktop vertical scroll; pills may wrap on narrow widths; mobile stays single column.

### Rules
| Rule | Value / formula | rules.md id | Source |
|---|---|---|---|
| Target number | The roll's Difficulty is the number actually used (spell Casting Difficulty, often target's Mystic Defense; minimum 2 is handled upstream by the existing UI). The outcome always displays this number, including on a miss. | R1 | RULES-FAQ Q011; spell-concepts p.248, p.257; game-concepts p.33 |
| Success levels | `levels` = 1 at the Difficulty Number, +1 per full 5 over (`successCount`); `N` displayed = `levels`; extra successes = `levels - 1` (not displayed) | R2 | RULES-FAQ Q012; game-concepts p.34; spell-concepts p.257, p.270 |
| Miss | `levels` 0 -> "Miss vs <target> — no effect"; no effect applied; no thread/Karma wording (house ruling) | R3 | RULES-FAQ Q013; owner decision 2026-10-02 (qa-log) |
| Effect | After a successful cast, a step-effect spell shows the Effect roll total; static shows its readout; no armor type or armor math is shown | R4 | RULES-FAQ Q014; owner decision (qa-log) |
| Duration | Only the spell's duration label is shown, verbatim (e.g. "Rank minutes"); no rounds conversion, no success-level extension | R5 | RULES-FAQ Q015 (label only) |

### Edge cases & invariants
- Miss with `effectTotal` supplied: `effect` null, text unchanged ("Miss vs T — no effect").
- Exactly one success (total == target): `levels` 1, `extraSuccesses` 0, headline "1 success vs T". total = target + 10 -> `levels` 3, `extraSuccesses` 2, headline "3 successes vs T".
- Step effect pending: `effect.total === null`, `effect.text === null`, text part "Effect —"; after the roll a number and "Effect <n>".
- `extraPicks` with repeats stack in first-seen order (`['A','A','B']` -> `A ×2`, `B`); empty/absent -> `picks []`, no picks part.
- Spell with no duration: `duration` null, no duration part.
- Null spell: text-only outcome from `cast.name`, no pills data.
- Two consecutive Other casts of the same spell: the Effect roll only updates the record whose `seq` equals `_castSeq`.
- Self-cast or no-cast: `_otherCast` is not written. Effect roll after toggling to This character still updates the Other record it belongs to (captured `_castOnOther`).
- The record is never written to character data, `ed-edit-*` events, localStorage or GitHub saves.

## Testability notes
- `engine/spells.test.js` (node:test, `npm test`; `pretest` runs `tools/check-imports`): use real spells from `rules/spells.json` via the existing `spellsFile` and `joinSpell` helpers, or small hand-built spell objects (`{ name, duration, effects: [...] }`) since the function only needs `name`, `duration`, `effects`. Cases, asserting exact `text`, `headline`, `badge`, and `effect`/`picks`/`duration` fields: miss (levels 0) exact "Miss vs 9 — no effect"; miss with `effectTotal` ignored; exactly 1 success; target+10 -> levels 3, extraSuccesses 2, "3 successes vs T"; step pending (text "Effect —", `effect.total` null) and rolled; static spell (`+<value> <label>`); no-effect spell ("No Effect roll"); spell with duration and stacked picks (full composed line including "Duration Rank minutes", no rounds figure); spell with no duration; null spell -> text-only from `cast.name`; inputs not mutated; absent `extraPicks` tolerated.
- UI behavior (not unit-testable; owner verifies manually, per project preference no preview run by the agent): (1) miss one line "Miss vs N — no effect"; (2) hit with 1 and several successes; (3) step placeholder pill then number after the Effect roll; (4) static and no-effect spells; (5) select a different spell: card still shows the previous Other cast; (6) toggle to This character and back, tab switch and back: persists, Active effects unchanged; (7) second Other cast replaces it; Effect roll after a miss adds no Effect pill; (8) character switch: no carry-over; (9) light and dark; (10) desktop height no vertical scroll, mobile single column.

## Changelog entry
`data/changelog.json` `unreleased.changes` (type `added`): "Spells tab: when Cast on is set to Other, a new Target effects card replaces Active effects and shows the outcome of your latest cast on another target — hit or miss against the target number, success levels, the Effect roll or static effect, extra-thread picks and duration." Also set `unreleased.summary` to: "The Spells tab now reports the outcome of your latest cast on another target."

## Docs
`docs/UI-GUIDELINES.md` §4 Spells row becomes: "Grimoire + spell matrices by circle, the Weave/Cast/Effect cast flow, self-cast active effects, and target effects (cast on Other) — spellcasters only". `ARCHITECTURE.md` unchanged (its Spells mentions are file/engine inventory only; its l.284 area lists grandfathered regex deviations, not exports).

## Out of scope
- A list, countdown or log of casts on others (latest only).
- Spell description prose or armor-type/armor-math notes in the outcome.
- Any claim about woven threads or Karma on a miss; existing thread behavior unchanged.
- Rounds conversion, success-level duration extension, or any Spellcasting-rank input.
- Changes to self-casts or the Active effects card contents; any stored character data or `rules/*.json` change.
