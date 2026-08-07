# Plan: Load a different character from the `character-data` branch

A step-by-step plan for letting the app load any character stored on the
`character-data` branch — a single grouped store file `data/characters.json`
containing every character, replacing the single hard-coded `data/character.json`.
This file is the **status page** for the change: mark a step `[x]` and set its
**Status** when it lands, and add a line to [Progress log](#progress-log). Keep
it in sync with the code — if a step drifts from what was actually done, say so
in the log rather than editing the past.

- **Owner:** repo owner (sign-off needed for any Tier-1 drift — none planned).
- **Created:** 2026-08-07. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `2399efe` — **84/84 tests pass**, multi-character feature
  not started.
- **Landed:** all phases A–E complete on `dev` (2026-08-07); **90/90 tests pass**.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Grouped store `data/characters.json` + `meta.id` | ✅ Tier 3 | New file with its own `schema: "ed-characters/1"` tag; each entry keeps the `ed-character/1` shape with an additive `meta.id`. Existing schema tags/field names unchanged (CLAUDE.md: "adding data within the shape is fine"). |
| New header icon + `ed-character-picker` modal | ✅ Tier 3 | New views/content — but must hold Tier 1: Escape closes / Enter confirms, theme-aware, two font weights (400/500). |
| Worker grouped-file merge + legacy path | 🛡️ Ceremony (not Tier 2) | The env-pinned worker path is a documented security property. Worker changes ship together with `GITHUB-SERVERLESS-SAVE.md`, the runbook, and `wrangler.toml` in the same change. |
| Engine / effect taxonomy | ✅ Untouched | No engine or `rules/*.json` changes; 84/84 stays green. |

**Tier-1 invariants this plan must not break:** store only inputs (derived
values never persisted — the grouped store holds only inputs per character;
overlays store only edited inputs, per-id); data flows down / events up (the
picker only dispatches, `ed-app` acts); modal rules above; relative `./…` fetch
paths, never root-absolute (WORKFLOW.md).

---

## Confirmed decisions (owner answers, 2026-08-07)

1. **Grouped single store file** — `data/characters.json` holds **all**
   characters: `{ schema: "ed-characters/1", characters: { "<id>": { ed-character/1 entry } } }`.
   One fetch discovers *and* loads; no per-character files, no separate manifest.
2. **`meta.id` field** — each entry carries `meta.id` (e.g. `"chakka"`), equal
   to its map key, so a single-character export/import round-trips back into the
   grouped file. Additive within the `ed-character/1` shape; **no** schema bump.
3. **Portraits stay in place** — no image moves. `meta.portrait` (an arbitrary
   path, e.g. `data/chakka.jpg`) already points each character at its image, and
   `portraitUrlFor` derives the loadable URL. A **new character needs a new
   image with a different name** — the character's `meta.portrait` manages which
   image goes with which character.
4. **Confirm-discard-first** — loading a character while `_dirty` goes through
   the existing `ed-confirm` modal before switching.
5. **Legacy save path stays** — a save without an `id` (the old live app)
   continues to write `data/character.json`; only id-carrying saves touch the
   grouped store.
6. **First-run chooser** — no valid `'ed-character'` selection → the picker
   modal opens on startup and the user chooses; a single-entry store auto-loads
   instead; a stale id is treated like no selection. The modal appears only
   until a pick is saved (per browser).

**Costs accepted with the grouped design:** every save rewrites the whole
`data/characters.json` (noisy diffs, single 409-conflict surface) and per-
character git history is lost. Both are acceptable at a single-owner,
few-character roster size.

**Transition note (accepted):** while the old app is still live on `/` (main),
it saves to `data/character.json`, while the new app saves to
`data/characters.json` — the two diverge until the dev→main promotion, when the
compat copy is removed and the grouped store is authoritative.

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--branch-migration-character-data) | Build grouped `data/characters.json` on the branch | ✅ Done |
| [B](#phase-b--storejs-grouped-read--per-id-overlays) | `store.js` one-fetch read + per-id overlay keys | ✅ Done |
| [C](#phase-c--worker--client-save) | Worker grouped-file merge; `store-server.js` envelope | ✅ Done |
| [D](#phase-d--ui) | Load-character icon + picker modal + dirty guard | ✅ Done |
| [E](#phase-e--tests-docs-verification) | Tests, docs ceremony, verification, commit | ✅ Done |

**Overall:** ✅ Done — 90/90 tests, docs updated, pushed to `dev`.

---

## Phase A — Branch migration (`character-data` branch)

Outcome: the branch holds the grouped store; the new app can be served against it.

- [x] A1. On `character-data`, build `data/characters.json` (schema
      `ed-characters/1`) from the current character (base blob `ab2e50ca…`):
      `characters: { "chakka": { … } }` with `meta.id: "chakka"` added;
      `meta.portrait` stays `"data/chakka.jpg"` (no image moves).
- [x] A2. Add a **loader test character** to the same store:
      `characters: { "chakka-test": { … } }` — a copy of Chakka with
      `meta.id: "chakka-test"`, `meta.name: "Chakka-TEST"`, and an **empty
      `meta.portrait`** (`""`) so the picker/overview placeholder fallback is
      exercised. **Kept after promotion** — it doubles as the dataset for a
      planned delete-character feature.
- [x] A3. Keep `data/character.json` (and its portrait path) as the
      transitional compat copy for the live `/` app. Do **not** remove until
      dev→main promotion.
- [x] A4. Refresh the local gitignored working copy (`data/characters.json`) so
      local dev matches.

**Status:** ✅ Done — store blob `e3de06e5…` on `character-data` (with
`data/character.json` + `data/chakka.jpg`), verified against local `git
hash-object`; local working copy refreshed.

## Phase B — `store.js` (grouped read + per-id overlays)

Outcome: `store.js` loads the whole store in one fetch and selects a character;
overlays are per-id.

- [x] B1. Replace the id-agnostic `loadCharacterData()` with `loadCharacters()`
      — fetches `data/characters.json` via the contents-API → raw-CDN chain,
      **no bundle fallback** (relative `./…` locally).
- [x] B2. Add `loadCharacter(id)` → `(await loadCharacters()).characters[id]`,
      with a clear error for an unknown id. Startup flow: load the store, then —
      if `localStorage 'ed-character'` holds a valid id → load that character
      directly; otherwise **open the picker and wait** (auto-skip and load
      directly if the store has exactly one entry; a stale/removed id is treated
      like no selection → picker). The picker lists from the same store object
      (no second fetch).
- [x] B3. Overlay key → `ed-character-edits:${id}`; thread `id` through
      `saveMetaEdits` / `saveItemEdits` / `saveWealthEdits` / `reconcileOverlay` /
      `hasPendingEdits` (per-id drafts survive switching characters).
- [x] B4. Export `portraitUrlFor` (already defined) for picker thumbnails.

**Status:** ✅ Done — `loadCharacters()`/`loadCharacter(id)` exported;
`editsKey(id)` used across all overlay fns; `portraitUrlFor` exported.

## Phase C — Worker + client save

Outcome: saves upsert the id's entry in the grouped store; the legacy path
still works for the live old app.

- [x] C1. `worker.js` accepts `{ character, id }`; validates `id` against
      `^[a-z0-9][a-z0-9-]{0,63}$` (rejects invalid keys → 400).
- [x] C2. With `id`: GET `data/characters.json` (env `GITHUB_STORE`, default
      `data/characters.json`), replace `characters[id]` with the posted
      `ed-character/1` entry (input bytes, not derived), PUT the whole file —
      inside the existing bounded GET-sha→PUT 409-retry loop.
- [x] C3. Backwards-compat: absent `id` → legacy `data/character.json` (env
      `GITHUB_PATH`), exactly today's behavior — no grouped-store write.
- [x] C4. `store-server.js` `saveServer(character, { saveKey, id })` sends
      `{ character, id }`.
- [x] C5. `wrangler.toml`: keep `GITHUB_PATH` (legacy) and add `GITHUB_STORE`
      (grouped file) — alloyed with runbook/doc updates in Phase E.

**Status:** ✅ Done — 404 store is created fresh; invalid ids (incl. `'../evil'`,
`'A/b'`, `'a b'`, `'..'`, `'a.b'`, `'É'`, `42`, `''`) → 400 `invalid_id`.

## Phase D — UI

Outcome: a user can switch characters from the header; modal and dirty-guard
rules hold.

- [x] D1. `ed-app.js`: `_characterId` state + `localStorage 'ed-character'`;
      load-character folder-glyph icon in the header row (always visible).
- [x] D2. New `ui/ed-character-picker.js`: lists characters from the loaded
      store — portrait thumbnail + label (`meta.name ?? id`); Escape closes,
      Enter confirms (autofocus first entry); dispatches `load-character` up
      (views dispatch, `ed-app` acts). Same modal opens on **first-run startup**
      (no saved selection) and from the header icon.
- [x] D3. Dirty-load guard: if `_dirty`, open the existing `ed-confirm` first
      ("Load a different character? Unsaved local edits stay in this browser")
      then load.
- [x] D4. `ed-overview.js`: add `'id'` to the `HIDE` set (`ui/ed-overview.js:234`)
      so `meta.id` never surfaces as an editable field.
- [x] D5. First-run chooser + no-selection state: `_dirty = hasPendingEdits(id)`
      initializes **after** selection (per-id); closing the picker via
      Escape/backdrop lands on a "No character selected" state (status text +
      button to reopen the picker) so the app is never stuck on
      "Loading character…". Picking persists the id to `localStorage` and loads.

**Status:** ✅ Done — picker modal, load icon, confirm-switch guard, no-selection
stub; `ed-edit-meta.js` `FIELDS` list keeps `id` non-editable.

## Phase E — Tests, docs, verification

Outcome: everything is green, documented, and pushed to `dev`.

- [x] E1. Worker tests: id→grouped upsert (GET whole store, replace entry, PUT)
      + invalid-id 400 + absent-id legacy path + grouped-store 409 retry.
      `store-server.test.js`: envelope carries `id`.
- [x] E2. Engine untouched — 84/84 baseline stays green.
- [x] E3. Docs ceremony (worker contract): `docs/GITHUB-SERVERLESS-SAVE.md`
      (§3.1 / §4.5 / §4.6 / §6), `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`
      (new `GITHUB_STORE` var + smoke-test curl paths), `ARCHITECTURE.md` §7/§8,
      `WORKFLOW.md`, `docs/UI-GUIDELINES.md` (icon + picker), `README.md`,
      `data/changelog.json` unreleased entry.
- [x] E4. `.gitignore`: add `data/characters.json` (keep the existing
      `data/character.json` / `data/chakka.jpg` lines while the compat copy
      exists).
- [x] E5. Verify: `npm test` all green, `node --check` on touched JS, local
      static-server smoke (all assets 200, picker loads), raw-CDN reads return
      the grouped store. Commit + push to `dev`.

**Status:** ✅ Done — **90/90 tests** (84 baseline + 6 new), `node --check` clean
on all touched JS, static-server smoke all 200, docs ceremony shipped with this
change.

---

## Verification / acceptance checks

Run these before calling the feature done:

- [ ] Overview still fits the desktop viewport with no vertical scroll (Tier 1).
- [ ] Derived values still render as placeholder pills, never fabricated numbers.
- [ ] Works in light **and** dark mode; picker/confirm modals close on Escape and
      confirm on Enter.
- [ ] One fetch loads the store; picker thumbnails resolve via `portraitUrlFor`
      (raw CDN on Pages, `./…` locally); broken portrait still falls back to the
      placeholder. Each character's `meta.portrait` points at its own
      distinctly-named image (a new character gets a new image name).
- [ ] Switching characters with unsaved edits warns via `ed-confirm`; per-id
      overlays do not leak between characters.
- [ ] First run with no saved selection opens the picker (skipped for a
      single-entry store); picking persists the id and skips the modal on the
      next launch; Escape/backdrop lands on the "No character selected" state
      with a reopen button.
- [ ] Save with id → grouped-store upsert (only that entry changes); save
      without id (legacy) → `data/character.json`, grouped store untouched.
- [ ] Asset/fetch paths are relative (`./…`), never root-absolute.

---

## Progress log

| Date | Step | Note |
|------|------|------|
| 2026-08-07 | — | Plan created (grouped-store design); feature not started. Revised: portraits stay in place; first-run chooser added (decision 6, D5); loader test character "Chakka-TEST" added (A2). |
| 2026-08-07 | A | `data/characters.json` built and uploaded to `character-data` (blob `e3de06e5…`, verified vs local `git hash-object`); contains `chakka` + `chakka-test`; legacy `data/character.json` + `chakka.jpg` retained. |
| 2026-08-07 | B | `store.js` one-fetch grouped read + `loadCharacter(id)` + per-id overlay keys + exported `portraitUrlFor`. |
| 2026-08-07 | C | Worker upsert (`id` → replace `characters[id]`, PUT whole store in the 409 loop; absent `id` → legacy `GITHUB_PATH`); `store-server.js` envelope; `GITHUB_STORE` var in `wrangler.toml`. |
| 2026-08-07 | D | Header load icon, `ed-character-picker.js` modal, first-run chooser, no-selection state, confirm-switch dirty guard, `meta.id` hidden on Overview. |
| 2026-08-07 | E | 6 new tests (90/90 green), `node --check` + static-server smoke clean, docs ceremony (save doc/runbook/ARCHITECTURE/WORKFLOW/UI-GUIDELINES/README/changelog) shipped, `.gitignore` updated, pushed to `dev`. |
| 2026-08-07 | F | First-run picker empty-list bug fixed on `dev` (commit `72ee189`); user-verified save→grouped-store on the dev site after the worker was redeployed. |
| 2026-08-07 | — | **Released v1.6.0** (dev → main). Full cleanup at promotion: worker no-`id` path + `GITHUB_PATH` stripped (`id` required → `400 invalid_id`), `data/character.json` deleted from the branch, `.gitignore` + docs updated; tests 88/88. Owner redeploys the worker. |

---

## Source-of-truth map

| Concern | Authority |
|--------|-----------|
| Architecture, layers, data model | `ARCHITECTURE.md` |
| UI/UX rules | `docs/UI-GUIDELINES.md` |
| Serverless save design + worker contract | `docs/GITHUB-SERVERLESS-SAVE.md` (+ `…RUNBOOK.md`) |
| Dev → prod deploy, relative-path rule | `WORKFLOW.md` |
| Tier / change classification | `CLAUDE.md` (this plan's classification table above) |
