# Plan: Per-character files + optimistic concurrency (no lost saves)

Replace the single grouped store `data/characters.json` with one file per
character (`data/characters/<id>.json`) plus a small discovery index, and add
**per-file optimistic concurrency**: a save carries the revision it was based on,
a stale revision is rejected with a conflict instead of silently overwriting,
and the app asks **keep mine / take theirs**. This file is the **living status
page**: tick a step `[x]` and set its **Status** when it lands, and add a line to
[Progress log](#progress-log). Keep it in sync with the code.

- **Owner:** repo owner (store-layout change + decisions below confirmed
  2026-08-11).
- **Created:** 2026-08-11. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `a0c7d9a`, with the Combat tab, blood-charm spend, and
  background-save planning in the working tree (uncommitted). Suite at
  **412 tests** (`npm test`, which runs `tools/check-imports.mjs` first).

---

## Problem statement

The save path is the Cloudflare Worker's `POST /save`
(`tools/worker/worker.js`), which today does a whole-file read-modify-write of
the grouped store `data/characters.json`: GET the file, set
`store.characters[id] = character`, PUT it back, with a bounded GET-sha → PUT
409 retry.

Concurrency analysis of that design:

1. **Different characters, simultaneous saves → already safe.** A's PUT moves
   the file sha; B's PUT 409s, re-reads, and merges **only its own id** on top.
   Both persist. The grouped-store decision even recorded this as an accepted
   cost ("every save rewrites the whole `data/characters.json` (noisy diffs,
   single 409-conflict surface)" — `docs/PLAN-MULTI-CHARACTER.md`).
2. **Same character, two writers (two devices, player + GM, a stale tab) →
   silent last-writer-wins.** B's retry re-reads the file — now holding A's
   version of that id — and replaces `characters[id]` wholesale with its own
   full character. A's save for that character is gone, and **neither user is
   told**. A stale client (loaded before A saved, never re-fetched) does the
   same damage even without strict simultaneity.
3. The imminent **background save** feature (blood-charm spend / combat health
   auto-commit) makes concurrent saves *more* likely, so the hole matters now.

The owner's instinct — split the store into one file per character — fixes the
cross-character case structurally (different characters write different files;
no shared contention surface; per-character git history; smaller writes). It
does **not** fix the same-character case, which is the actual lost-save hazard:
two writers on one file still race, and the last writer still silently wins.

## Rationale — why this design

**File-per-character + per-file revision conflict (Option C, owner-approved):**

- **One file per character isolates writers structurally.** A save reads and
  writes only its own file. Two players saving different characters at the same
  instant can never interfere — there is no shared file to race, no whole-store
  rewrite, no cross-character 409 surface. A save of one character can never
  fail because another character is being saved.
- **The file's sha is the natural per-character revision.** With a grouped
  store the file sha moves on *any* character's save, so it is useless as a
  per-character base. Split the store and the sha of `<id>.json` is exactly
  "the latest committed version of *this* character" — no embedded revision
  counter, no shared-file noise.
- **Optimistic concurrency makes the same-character race visible instead of
  silent.** The client sends the base sha it last saw; the worker rejects a
  stale base with `409 stale_base` (carrying the current sha); the app offers
  **keep mine** (acknowledged overwrite) / **take theirs** (reload from branch)
  / **cancel**. The data loss the current design hides becomes a conscious,
  informed choice. For a game sheet, per-field CRDT-style merging is overkill;
  last-writer-wins is acceptable **when it is explicit and confirmed**.
- **A small discovery index (`data/characters/index.json`) keeps the picker one
  fetch.** The picker lists character *names*; a directory listing gives only
  filenames and would force an N+1 fetch on every picker open. The index carries
  `{ id, name }` only and is **never trusted for save bases** — bases come only
  from file reads and save responses — so a stale index can mis-name a picker
  row but can never corrupt a save or cause a false conflict.
- **Backward compatible.** A client that sends no `base` (older deployment) is
  served by the existing bounded-409 overwrite path; the split itself is a pure
  read/write-layout change on the `character-data` branch, coordinated in one
  change (see [Migration](#phase-d--migration--coordination)).

**Alternatives considered and rejected:**

- **A — split only (no conflict check):** keeps the silent same-character
  clobber; would not satisfy the goal.
- **B — rev-conflict on the grouped store:** fixes the data loss with the least
  change, but keeps the whole-store rewrite, cross-character interference, and
  needs an embedded per-entry `rev`. Chosen over nothing, but C is structurally
  cleaner and was owner-preferred.
- **D — worker category-merge heuristic:** cheap, but stale-bases are
  undetectable and same-category edits still silently lost; a partial fix that
  still hides the loss.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Store layout: grouped `data/characters.json` → `data/characters/<id>.json` + `index.json` | 🛡️ Owner-signed layout change | Tier-1 names `data/character.json` and `rules/*.json` schema tags; the grouped `ed-characters/1` store was a later plan decision. Owner requested the split (2026-08-11). Each character file keeps the **`ed-character/1` shape untouched**; the index gets a new `ed-characters-index/1` tag. |
| Worker `/save` per-file write + base/rev contract | 🛡️ Ceremony (not Tier 2) | The env-pinned worker path is a documented security property. Worker changes ship together with `GITHUB-SERVERLESS-SAVE.md`, the runbook, and `wrangler.toml` in the same change. |
| New `ed-conflict` modal | ✅ Tier 3 | New view — must hold Tier 1: Escape closes / Enter confirms, theme-aware, two font weights (400/500), light-DOM portal pattern (like `ed-save-key`). |
| Engine / effect taxonomy | ✅ Untouched | No `engine/*` or `rules/*.json` changes; 412/412 stays green. |
| Background save (planned) | ✅ Composes | The auto-save uses the same save path + conflict modal; no new invariants. |

**Tier-1 invariants this plan must not break:** store only inputs (a character
file holds only `ed-character/1` inputs; derived values never persisted); data
flows down / events up (views dispatch, `ed-app` acts); modal rules above;
relative `./…` fetch paths, never root-absolute (WORKFLOW.md); the `ed-character/1`
schema shape is not renamed — only its storage location changes.

---

## Confirmed decisions (owner answers, 2026-08-11)

1. **One file per character** — `data/characters/<id>.json`, each the raw
   `schema: "ed-character/1"` entry (no grouped wrapper). `ID_RE`
   (`[a-z0-9][a-z0-9-]{0,63}`) is already a safe filename class — the existing
   worker id validation carries over unchanged.
2. **Discovery index** — `data/characters/index.json`
   (`{ schema: "ed-characters-index/1", characters: { "<id>": { name } } }`),
   updated by the worker **only on create or `meta.name` change** (rare, cheap).
   Never trusted for save bases.
3. **Per-file optimistic concurrency** — save envelope becomes
   `{ character, id, base }`; worker rejects `base ≠ current file sha` with
   `409 { code: "stale_base", sha }` (no retry — a stale base cannot be retried
   away); a 409 between read and PUT also maps to `stale_base`; no-base callers
   keep the current bounded-409 overwrite path.
4. **Conflict UX: keep-mine / take-theirs modal** — new `ui/ed-conflict.js`
   (light-DOM portal, Escape closes / Enter confirms). Keep mine = re-save with
   `base = conflict.sha` (acknowledged overwrite); Take theirs = reload from
   branch + `reconcileOverlay` (reuses `_discardLocal` semantics), refresh base;
   Cancel = close, overlay keeps the edits, next save re-conflicts.
5. **Base sha source** — the contents API `ETag` header on read (keeps
   `Accept: raw`, no base64 decode); `commit.sha` on save success. Local dev has
   no concurrency and no sha — saves there simply send no base.
6. **Backward-compat read fallback** — if `index.json` 404s, fall back to the
   legacy grouped `data/characters.json` read, so a not-yet-migrated branch
   still works with the new app. The grouped file is deleted from the branch in
   the same change once migrated.

**Costs accepted with the split:** the picker needs one index fetch + one file
fetch for the selected character (two fetches vs. one today — still well within
the unauthenticated contents-API rate limit); a renamed character updates the
index as well as its file; the data branch holds one commit that replaces the
grouped file with the directory.

**Transition note (accepted):** the migration commit and the app deploy land
**together** on the `character-data` branch (old app can't read the new layout;
the read fallback covers new-app-on-old-branch). The owner pushes the migration
(the worker token lives outside this repo).

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--worker-per-file-write--base-rev-contract) | Worker: per-file write + `base`/`stale_base` + index (+ tests) | ⏳ Not started |
| [B](#phase-b--client-read-path--save-envelope) | `store.js` `listCharacters`/`loadCharacter` + base capture; `store-server.js` envelope + conflict error; dev-server routes (+ tests) | ⏳ Not started |
| [C](#phase-c--ed-app--conflict-modal) | `ed-app` drops the grouped store, tracks `_baseSha`, sends `base`; `ui/ed-conflict.js` modal | ⏳ Not started |
| [D](#phase-d--migration--coordination) | Split script, data-branch commit, docs (`GITHUB-SERVERLESS-SAVE.md`, runbook, multi-character), changelog | ⏳ Not started |

---

## Phase A — Worker: per-file write + base/rev contract

**Outcome:** `/save` writes `data/characters/<id>.json` and rejects stale bases;
custom items untouched; worker tests green.

- [ ] A1. **Path change.** `env.GITHUB_STORE` (default `data/characters.json`)
      → `env.GITHUB_CHARS_DIR` (default `data/characters`); the save target is
      `${GITHUB_CHARS_DIR}/${id}.json`. `id` stays validated by `ID_RE` (never a
      filesystem path; the class is filename-safe). Update `wrangler.toml` /
      runbook env docs in the same change.
- [ ] A2. **`upsertCharacterFile(id, character, base)`** replacing
      `upsertCharacter`:
      - GET the file → 404 ⇒ **create** (PUT without sha; `base` ignored).
      - `base` provided and `≠` current sha ⇒ **409 `{ code: "stale_base", sha }`**
        immediately — no retry.
      - `base` matches (or absent — legacy caller) ⇒ PUT with the current sha;
        a 409 in the read→write window also returns `stale_base` (the base is by
        definition no longer current). No-base callers keep the current bounded
        3× retry.
      - Success ⇒ return `commit: { sha, url }` (sha = new file sha — the
        client's next base).
- [ ] A3. **Index maintenance.** After a successful save, read
      `data/characters/index.json`; create the file if absent; write an entry /
      update `name` **only when the id is new or `meta.name` changed**. A failed
      index PUT is logged and tolerated — never fails the save, never used for
      bases.
- [ ] A4. **Tests** (`tools/worker/worker.test.js`): per-file write path;
      create-on-404; matching base → PUT; stale base → 409 `stale_base` + sha;
      raced 409 → `stale_base`; no-base legacy overwrite; index create/rename
      and "unchanged name ⇒ no index write"; id/path safety; `/save-items`
      untouched. Update the store-path fixtures.
- [ ] A5. **Verification:** worker tests green (part of `npm test`).

## Phase B — Client read path + save envelope

**Outcome:** the app discovers and loads characters per-file, captures base
shas, and the client save layer understands `stale_base`.

- [ ] B1. **`store.js`**: replace `loadCharacters()` with
      - `listCharacters()` → fetch `data/characters/index.json` (contents API
        first, cache-busted raw CDN fallback; local `./data/characters/index.json`)
        → `[{ id, name }]`; fallback to the legacy grouped read if the index 404s
        (Decision 6).
      - `loadCharacter(id)` → fetch `data/characters/<id>.json` (same API→CDN
        chain), capture the base sha from the contents-API `ETag` header, apply
        the overlay, load rules as today. Returns `{ character, rules, base }` —
        the `store` object and `store.characters[id]` lookup go away.
      - Local reads carry no sha (`base = null`).
- [ ] B2. **`store-server.js`**: `saveServer(character, { ..., base })` → POST
      `{ character, id, base }`. Map `stale_base` to a typed `SaveConflictError`
      carrying `{ sha }` (extends `SaveError`). Tests: envelope includes base;
      `stale_base` parses to `SaveConflictError` with the current sha.
- [ ] B3. **`tools/dev-server.mjs`** (+ test): serve `/data/characters/<id>.json`
      and `/data/characters/index.json`; retire the grouped-store route.
- [ ] B4. **Tests**: `store-server.test.js`, `dev-server.test.js` green; existing
      412 stay green.

## Phase C — ed-app + conflict modal

**Outcome:** the app tracks per-character base shas, saves with them, and
surfaces conflicts via the modal — including background auto-saves.

- [ ] C1. **`ui/ed-conflict.js`** (new; pattern: `ed-confirm` / `ed-save-key`):
      light-DOM portal, theme-aware, two weights, Escape closes / Enter confirms.
      Copy: "This character changed on another device or player." Actions:
      **Keep mine** (primary, Enter) / **Take theirs** / **Cancel**. Dispatches
      `ed-conflict` up with the choice.
- [ ] C2. **`ui/ed-app.js`**:
      - Drop `_characterStore`; startup uses `listCharacters()` + `_initialId`
        + `loadCharacter(id)`; the picker lists from `listCharacters()`.
      - Track `_baseSha` per character (set on load, updated from `commit.sha` on
        every save, reset on character switch; `null` locally).
      - `_doSave({ silent })` (manual + background) sends `base: _baseSha`; on
        `SaveConflictError` sets `_conflict = { sha }` → renders the modal.
        Keep mine → re-save with `base = conflict.sha`; Take theirs →
        `_discardLocal()`-style reload + `reconcileOverlay` + refresh `_baseSha`;
        Cancel → close, leave overlay dirty.
- [ ] C3. **Tests / smoke:** no ed-app unit harness exists (DOM/Lit) — manual
      two-browser smoke (see Phase D D4). Import check stays clean (37 modules).

## Phase D — Migration & coordination

**Outcome:** the `character-data` branch holds the new layout; docs and
changelog are current; the whole suite is green.

- [ ] D1. **`tools/split-character-store.mjs`**: reads the legacy
      `data/characters.json` (local gitignored working copy), writes
      `data/characters/<id>.json` per entry + `data/characters/index.json`,
      cross-checks ids vs `meta.id`, prints a summary (id → name, count).
- [ ] D2. **Data-branch migration commit** (owner push): delete
      `data/characters.json`, add `data/characters/` + `index.json` — landed with
      the app deploy (Decision transition note).
- [ ] D3. **Docs:** `docs/GITHUB-SERVERLESS-SAVE.md` — rewrite the save model
      (per-file writes, base/rev contract, `stale_base` + modal, index-not-
      trusted rule, read path); `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` — worker
      env/path change; `docs/PLAN-MULTI-CHARACTER.md` — record the layout change
      and `ed-characters-index/1`, update the accepted-costs paragraph;
      `data/changelog.json` — unreleased entries.
- [ ] D4. **Verification:** `npm test` (all suites, import check) green; manual
      two-browser smoke — B saves a stale character → conflict modal; keep-mine
      overwrites (A's newer data replaced knowingly); take-theirs reloads A's
      version and clears the overlay; background auto-save also conflicts
      correctly; old branch (index 404) still loads via the legacy fallback.

---

## Issues & learnings

*(Append here as the change lands — traps, corrections, and non-obvious calls.)*

---

## Progress log

*(Append newest-last. Each entry: date, what landed, suite status, branch state.)*

---

## Guardrail re-check (before landing)

- [ ] No Tier-1 invariant changed: `ed-character/1` shape untouched (only its
      storage location); engine/`rules/*.json` untouched; inputs-only invariant
      holds; data down / events up holds (views dispatch, `ed-app` acts).
- [ ] Conflict modal honors Escape-closes / Enter-confirms; theme-aware.
- [ ] Works in light and dark mode; no hardcoded colors.
- [ ] Asset/fetch paths relative (`./…`), never root-absolute.
- [ ] Migration + app deploy land together on the `character-data` branch.
- [ ] Any worker change shipped with `GITHUB-SERVERLESS-SAVE.md`, the runbook,
      and `wrangler.toml` in the same change.
