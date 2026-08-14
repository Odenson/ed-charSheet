# Plan: Notes Tab v2 — Notes, Roll Log, Legend Earned, History

The Notes tab (currently a stub in `ui/ed-app.js`) becomes a real surface with
**four** functions behind a segmented sub-tab control: hand-written **Notes**
(info keeping), the **Roll Log** (every roll, capped at a configurable N),
the **Legend Earned** log (amount + description, addable from here *and* from
the Overview Legend panel), and **History** (a user-built event timeline).

This file is the **living status page**: tick a step `[x]` and set its
**Status** when it lands, append to [Issues & learnings](#issues--learnings)
and the [Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner (locked decisions below confirmed 2026-08-10).
- **Created:** 2026-08-10. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `13b6fb3` (after the v1.9.0 release) — clean working
  tree, **354/354 tests pass**.
- **Source of truth:** the Notes tab is documented in UI-GUIDELINES §4 as
  "Running character history / log over time" — this feature fills that slot.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| New `ui/ed-notes.js` component + tab wiring | ✅ Tier 3 | New view for an existing tab (UI-GUIDELINES §4 five-tab contract); modal/segmented patterns already in the codebase. |
| New character data `notes` / `history` arrays | ✅ Tier 3 | Additive data **within** the `ed-character/1` shape — no field renames, no schema bump. |
| New `resources.legend.earned` array | ✅ Tier 3 | Additive within the existing `resources.legend` object. |
| `totalEarnt` becomes **derived** (sum of `earned`, incl. a virtual seed row) | ✅ Tier 3 with **owner sign-off** | Additive, and *removes* a stored value rather than adding one — `totalEarnt` stops being written to the overlay; the legacy branch value surfaces as a **derived virtual row** (see "Confirmed decisions" #1), so nothing recomputable is stored. Consistent with `available` already being derived (REVIEW-FINDINGS G1). Owner confirmed 2026-08-10. |
| New overlay categories `notes` / `history` / `legend` | ✅ Tier 3 | Existing overlay pattern (items/wealth/health/advancements); store inputs only, full-array replacement. |
| Per-character localStorage roll log | ✅ Tier 3 | Runtime, high-churn; not a save category; new store key `ed-rolllog:<id>`. |
| Roll-log capture in `ed-roll-modal` | ✅ Tier 3 | The modal already holds the pure-engine result; a new dispatched event (`ed-roll-logged`) rides up to ed-app. Engine stays pure & DOM-free. |
| Effect taxonomy | ✅ Untouched | No vocabulary change; no bump. |

**Tier-1 invariants this plan must not break:** store only inputs; data down /
events up; the engine stays pure and DOM-free; derived values render as muted
dashed placeholder pills, never a fabricated number; modals Escape-close /
Enter-confirm; theme-aware (light + dark); two font weights only; relative
`./…` fetch paths; Overview still fits the desktop viewport with no vertical
scroll (the Legend-panel add affordance is the existing hover-reveal `.info`
`✚` button reused verbatim — it reserves its own slot, so it never shifts
layout — Phase F).

---

## Confirmed decisions (owner answers, 2026-08-10)

1. **The earned log is the source of truth for Total Legend Earned — via a
   derived virtual seed row, nothing recomputable is stored.** `totalEarnt` is
   **never written to the overlay**. `deriveModel` computes the total as the
   **pure sum of the `earned` entries plus one virtual "Starting total" row**
   synthesized (in the model only, not persisted) from any legacy
   `resources.legend.totalEarnt` in the branch file. So an existing character's
   legacy total shows up as a non-persisted, read-only first row and its number
   flows into the sum unchanged; a character with no legacy value and no entries
   derives `null` (placeholder pill, no fabricated number). There is **no stored
   "seed" row and no separate fallback branch** — the virtual row *is* the
   fallback, keeping a single derivation path. `available`, the Legendary Status
   band, the rank-editing guard (`_canAffordRank`), and the Legend-spent audit
   all read this derived total unchanged.
2. **Roll Log lives in per-character `localStorage`** (`ed-rolllog:<id>`), not
   in character data. It is an **ephemeral, device-local game-time view** — a
   convenience log for the session/table, not part of the character. It survives
   reloads on this device but is deliberately **never exported and never written
   to a GitHub save**; it does not follow the character to another device, and
   that is intended. The cap ("keep last N") is a per-character setting in the
   same store; the key is cleaned up when its character is deleted.
3. **Notes tab = segmented sub-tabs** — a `.seg` pill control (same pattern as
   ed-disciplines' discipline toggle) switching between four views. Icons use
   the tab bar's **monoline geometric family** (`◈ ✦ ⚔ ❋`), never color-emoji:
   **▤ Notes / ⬡ Roll Log / ✧ Legend / ◷ History** (`✧` outline, distinct from
   Spells' filled `✦`). Mobile folds to a stacked column per UI-GUIDELINES §2.
4. **Notes and History are distinct surfaces.** *Notes* is free-form
   info-keeping (NPCs, locations, quest threads, table reminders) — untimed
   cards the player curates. *History* is a dated, reverse-chronological event
   timeline (`{ date, text }`) — "what happened, when." They intentionally do
   not merge.
5. **Roll Log: one entry per roll interaction, upserted in place.** Each open of
   the roll modal gets a `rollId`; the entry is **replaced** (not appended)
   whenever the dice land again — initial roll, "Roll again", and Karma toggles
   all overwrite the same entry. So the log always matches the modal's final
   total, and there is exactly one row per press of a roll button — never a
   duplicate because Karma re-rolled.
6. **The virtual "Starting total" row is read-only in v1.** A wrong legacy
   `totalEarnt` is corrected in the branch `character.json` (status quo — no UI
   edits `totalEarnt` today either). No convert-to-entry path in this change.
7. **Character-delete roll-log cleanup is deferred (future work).** There is no
   character-delete feature in the codebase yet, so the `ed-rolllog:<id>`
   cleanup hook has no home. The plan notes it as a follow-up to the future
   delete feature, not part of this change.

---

## Status summary

| Phase | Status |
|-------|--------|
| A — Store: data + overlay categories | ✅ done |
| B — Legend derivation (earned → total) | ✅ done |
| C — Roll-log store | ✅ done |
| D — UI: `ed-notes.js` component | ✅ done |
| E — Roll capture in `ed-roll-modal` | ✅ done |
| F — Overview Legend-panel affordance | ✅ done |
| G — Tests | ✅ done |
| H — Docs & changelog | ✅ done |

---

## Phase A — Store: data + overlay categories (`store.js`)

- New `saveNotesEdits(notes, id)` / `saveHistoryEdits(history, id)` /
  `saveLegendEdits(earned, id)` mirroring `saveHealthEdits` (full-array
  replacement; inputs only).
- New overlay categories `notes`, `history`, `legend` added to
  `SAVED_CATEGORIES` (`store.js:284`) so `hasPendingEdits` and
  `reconcileOverlay` pick them up with the existing GitHub save.
- `applyEdits` merges them: `notes` / `history` replace their top-level array;
  `legend` merges `{ earned: [...] }` into `resources.legend`.
- `deriveModel` returns `notes` and `history` slices (pure pass-through of the
  input arrays) and a `legendEarned` slice (resolved entries + the virtual seed
  row, see Phase B).

## Phase B — Legend derivation (earned → total, single path)

- `deriveModel` builds a **display list** for Legend earned: a synthesized,
  non-persisted **"Starting total"** row (amount = legacy
  `resources.legend.totalEarnt`, present only when that legacy value is a
  number) followed by the real `resources.legend.earned` entries in order.
- `totalEarnt` is the **pure sum of that display list's amounts** — one
  derivation path, no separate fallback branch. Empty list (no legacy value, no
  entries) ⇒ `totalEarnt = null` ⇒ placeholder pill, never a fabricated number.
- The virtual seed row is flagged (e.g. `virtual: true`) so the UI renders it
  **read-only / non-deletable**; only the real `earned` entries are editable and
  ride the overlay. `totalEarnt` is never written back to the overlay.
- `available` / `status` / the rank guard / the Legend-spent audit all read this
  derived total unchanged.

## Phase C — Roll-log store

- `saveRollLog(entry, id, max)` — new small module (`store-rolllog.js`) or a
  section of `store.js`: reads `ed-rolllog:<id>`, **upserts by `rollId`** (a
  fresh entry replaces any existing entry with the same `rollId` — one row per
  roll interaction), trims to `max` (default 20, configurable 10/20/50), writes
  back. Pure, no engine.
- `loadRollLog(id)` returns `{ max, entries }`; entry shape mirrors the
  structured dice result plus the roll-time context the modal showed:
  `{ rollId, at, label, step, dice, groups, modifier, total, difficulty?,
  outcome?, karma?, mods? }`.
  - **`total` is the full displayed number the modal showed** (`_grandTotal()`:
    dice + Karma die + roll-time mods), so the log matches what the player saw;
    `karma` (when present) carries the karma sub-result `{ step, dice, total }`
    and `mods` carries the roll-time mod list `[{ label, value }]` so a row can
    show chips explaining a total that isn't the raw dice sum. Do not
    double-count karma or mods when rendering (they're already in `total`).
- `clearRollLog(id)` for the header "Clear". The per-character key is **never**
  serialized by `store-export.js` and is **not** a `SAVED_CATEGORIES` member —
  it stays out of exports and GitHub saves by construction (Decision #2). The
  cleanup of `ed-rolllog:<id>` on character delete is **deferred** (Decision #7)
  — no delete feature exists yet; hook it into that future work.

## Phase D — UI: `ed-notes.js` component

- Segmented control (`▤ Notes / ⬡ Roll Log / ✧ Legend / ◷ History`) —
  monoline glyphs matching the tab bar, no color-emoji; `aria-pressed` toggles
  as in ed-disciplines' `.seg`. Each view has a defined **empty state**.
- **Notes:** free-form info-keeping (NPCs, locations, quest threads) —
  read-mode cards; edit-mode add + per-card edit/delete (edits open a modal per
  UI-GUIDELINES §7 — Escape closes, Enter confirms). Cards show text + relative
  time. *Distinct from History (Decision #4).*
- **Roll Log:** newest-first list, each roll rendered compactly from the
  structured entry (label, dice → total, `·vs D…·`, ✓/✗ outcome, karma die,
  time); `keep last [20 ▾]` select and `Clear` in the header; oldest trimmed
  past the cap. Ephemeral/device-local — no edit-mode, no overlay.
- **Legend:** table from the derived display list (Phase B) — amount,
  description, date — with the derived running total up top. The virtual
  "Starting total" row renders **read-only / non-deletable**; real `earned`
  rows are deletable and an `+ Add Legend earned` form/modal adds them.
  Dispatches `ed-edit-legend-earned` up (full-array replacement of the real
  entries only — the virtual row is never in the payload).
- **History:** dated, reverse-chronological timeline of `{ date, text }`, `+ Add`
  form/modal, rows editable/deletable. *Distinct from Notes (Decision #4).*

## Phase E — Roll capture in `ed-roll-modal`

- On every completed roll (including auto-resolve recovery/knockdown) the modal
  dispatches `ed-roll-logged` (`bubbles, composed`) carrying **only the dice
  result** it just computed — `_result`, the resolved `_karmaResult`, the
  derived outcome, and a per-modal-open `rollId`. It does **not** re-send
  label/step/difficulty/mods: ed-app already holds those in `this._roll` (set
  from the `ed-roll` event at `ed-app.js:172`), so its listener **merges** the
  result with the known roll config and calls `saveRollLog`.
- The `rollId` makes the save an **upsert** (Decision #5): toggling Karma or
  "Roll again" re-fires the event with the same `rollId`, so ed-app replaces the
  entry instead of stacking a duplicate — one row per roll interaction, always
  showing the modal's final `total`.
- This keeps the modal dumb, avoids duplicating the payload, and reuses the same
  result the modal already surfaces via `ed-roll-apply` (which fires only for
  apply-button rolls — the new event covers *every* roll). The view never
  computes game values; the engine stays pure and DOM-free.

## Phase F — Overview Legend-panel affordance (hover-reveal, no edit mode)

- The affordance is a **carbon copy of the existing Health `✚` button**
  (`ed-overview.js:886`) so the two panels read identically. That button is:
  ```
  <button class="info" title="Take damage or heal"
          aria-label="Take damage or heal" @click=${() => this._openHealth()}>✚</button>
  ```
  The Legend one mirrors it exactly — same `class="info"`, same `✚` glyph:
  ```
  <button class="info lplus" title="Add Legend earned"
          aria-label="Add Legend earned" @click=${() => this._openAddLegend()}>✚</button>
  ```
  It inherits the existing `.info` rule verbatim for **look + reveal**
  (`ed-overview.js:126`): `opacity: 0` accent glyph, revealed by
  `*:hover > .info, *:focus-within > .info, .info:focus-visible`
  (`ed-overview.js:132`) and always shown on touch via
  `@media (hover: none) { .info { opacity: 1; } }` (`ed-overview.js:133`).
- **Exact wrapper + placement (verified against `ed-overview.js:690-695`).** The
  "total earned" block is:
  ```
  <div class="ltotal">                                  ← hover host + direct parent
    <span class="lnum" title="Total Legend Points earned">{number}</span>  ← the total
    <span class="lsub">total earned</span>
  </div>
  ```
  The `✚` button goes **inside `<div class="ltotal">`** (the wrapper — named
  `.ltotal`, defined at `ed-overview.js:76`) as a **direct child**, so the
  `*:hover > .info` direct-child selector fires whenever the mouse is over the
  total block. It must sit **to the right of the `.lnum` number** (not below it,
  not by the "total earned" caption).
- **One small CSS add is required — `.info` alone won't position it.** `.lnum`
  is `display: block` and `.ltotal` is `text-align: center`
  (`ed-overview.js:76-77`), so an inline `✚` would wrap to the next line and
  shove the centered number off-centre. Instead, anchor it: add
  `.ltotal { position: relative; }` and a `.lplus` rule positioning the button
  absolutely to the **right of the centred number**, vertically centred on the
  `.lnum` row (e.g. `position: absolute; top: 0; left: 50%; transform:
  translateX(<half the number's width + gap>);` — or a right-offset tuned to the
  panel). This is the **only** new CSS; appearance and hover-reveal still come
  from `.info`.
- Absolute positioning means the button has **zero flow footprint**: the centred
  number stays centred and there is **no layout shift** on hover (only opacity
  toggles) — the Overview no-scroll contract holds and the top-row height is
  unchanged.
- Note this `✚` is intentionally the **same add-glyph as Health**, and is *not*
  the segmented sub-tab's Legend icon (`✧`, Decision #3) — one is an add-button,
  the other a tab label; both are monoline dingbats, not color-emoji.
- `_openAddLegend()` opens the **same add-entry modal** as the Notes Legend view
  and dispatches the same `ed-edit-legend-earned` up (Escape closes / Enter
  confirms per UI-GUIDELINES §7). No new engine or derived value — it only
  appends a real `earned` entry, which re-derives the total (Phase B).
- **Shared component (implementation supersedes the "modal lives in ed-notes"
  sketch):** the form was extracted into `ui/ed-add-legend.js` (`<ed-add-legend>`)
  — presentational only, appends to the `earned` list it's given and dispatches
  `ed-edit-legend-earned`. Both the Notes Legend view and the Overview open the
  *same* component, so the two surfaces add through one identical form and one
  dispatch contract (ed-app's `_editLegendEarned` persists it).

## Phase G — Tests

- `store-notes.test.js` (or additions): overlay round-trip for `notes` /
  `history` / `legend`; `applyEdits` merge; `SAVED_CATEGORIES` / reconcile.
- Legend: `deriveModel` display-list + pure-sum derivation — legacy value
  surfaces as the virtual "Starting total" row and feeds the sum; real entries
  add on top; no-legacy-no-entries ⇒ `null`; virtual row flagged read-only and
  excluded from the `ed-edit-legend-earned` payload; `totalEarnt` never written
  to the overlay; rank-guard/audit still price from the derived total.
- Roll log: upsert-by-`rollId` (karma toggle / roll-again replace, no
  duplicates), cap/trim, max-change, per-character key isolation;
  `clearRollLog`; `total` includes karma and roll-time mods without
  double-count (mods recorded in the entry); excluded from `store-export.js`
  and `SAVED_CATEGORIES`. Delete-cleanup test deferred with the delete feature
  (Decision #7).
- Suite stays green: **354 + new tests** via `npm test`.

## Phase H — Docs & changelog

- `data/changelog.json` `unreleased` entry (released with the next bump).
- Any UI-GUIDELINES touch is additive (Notes tab contents) — no locked rule
  changes.

---

## Issues & learnings

- *(none yet — first fill on implementation.)*
- **2026-08-10** — Plan review pass #2 (owner-edited plan vs baseline code,
  four follow-up questions answered): (5) roll log upserts per roll interaction
  via a per-modal-open `rollId` (karma toggle / roll-again replace, never
  duplicate); (6) virtual "Starting total" row stays **read-only** v1 —
  correcting a legacy total remains a branch-file edit (no current UI does it
  either); (7) roll-log key cleanup on character delete is **deferred** — no
  delete feature exists, verified in the codebase; (8) roll-log entries record
  the roll-time `mods` list so rows can explain a `total` that isn't the raw
  dice sum.

## Progress log

- **2026-08-10** — Plan created; decisions locked (earned log = source of
  truth, roll log = per-character localStorage, Notes = segmented sub-tabs).
  Mockup approved. No code yet.
- **2026-08-10** — Plan review pass (against baseline code). Refinements locked:
  (1) Legend total via a **derived virtual "Starting total" row** + pure sum —
  single derivation path, nothing recomputable stored (was: stored seed row +
  fallback branch); (2) roll log confirmed **ephemeral / device-local**, never
  exported, key cleaned on character delete; (3) sub-tab icons moved to the tab
  bar's monoline family (`▤ ⬡ ✧ ◷`), no color-emoji; (4) Notes vs History
  confirmed distinct surfaces; (5) `ed-roll-logged` carries **result only** —
  ed-app merges with the `this._roll` config it already holds; roll-log `total`
  includes karma without double-count. Still no code.
- **2026-08-10** — Phase F reworked: the Overview add-Legend affordance is **no
  longer edit-mode-gated**. It becomes an inline **hover-reveal `+`** at the end
  of the "total earned" line, reusing the panel's universal `.info` reveal rule
  (`ed-overview.js:126-133`) — hidden until the mouse is near the total, always
  shown on touch, and it reserves its slot so there's no layout shift (no-scroll
  contract holds).
- **2026-08-10** — Phase F pinned to exact markup: the affordance is a **verbatim
  copy of the Health `✚` button** (`ed-overview.js:886`) — same `class="info"`,
  same `✚` glyph — placed as a **direct child** of the "total earned" line (the
  `*:hover > .info` direct-child selector requires it). Health and Legend
  add-buttons are now identical in form.
- **2026-08-10** — Wrapper verified and named: the hover host / direct parent is
  `<div class="ltotal">` (`ed-overview.js:690`), and the `✚` sits **to the right
  of the `.lnum` number**. Correction to the earlier "no new CSS" note: because
  `.lnum` is a centred `display:block`, the one required CSS add is
  `.ltotal { position: relative }` + a `.lplus` absolute-position rule to hold
  the `✚` at the number's right without decentring it (zero flow footprint, so
  no-layout-shift still holds). Look + reveal still come entirely from `.info`.
- **2026-08-10** — Plan review pass #2: decisions 5–7 locked (roll-log upsert
  per interaction via `rollId`; virtual row read-only v1; delete-cleanup
  deferred), and decision 8 added (roll-log entries record the roll-time `mods`
  list). Plan is implementation-ready. No code yet.
- **2026-08-10** — Phases A–H implemented (all status ticks ✅): store overlay
  categories + `saveNotesEdits`/`saveHistoryEdits`/`saveLegendEdits`; `deriveModel`
  `legendEarned` display list (virtual seed + real entries, pure-sum derived
  `totalEarnt`); `store-rolllog.js` (upsert-by-`rollId`, capped); `ui/ed-notes.js`
  four views + `ui/ed-add-legend.js` **shared** add-Legend modal; ed-app wiring +
  `rollId`/`ed-roll-logged` capture; Overview `✚` affordance. The shared-modal
  decision (one form, both surfaces) superseded the original "form lives in
  ed-notes" plan — see Phase F §. **373/373 tests** (354 baseline + 19 new),
  `node --check` clean, dev server 200s.
