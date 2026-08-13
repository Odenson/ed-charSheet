# Plan: Per-character files + optimistic concurrency (no lost saves)

Replace the single grouped store `data/characters.json` with **one file per
character** (`data/characters/<id>.json`) plus a small discovery index, and add
**per-file optimistic concurrency**: a save carries the file revision it was based
on, a stale revision is rejected with a conflict instead of silently overwriting,
and the app asks **keep mine / take theirs**. This is **Option C** — chosen for a
multi-player tool because it isolates writers structurally (no shared save
contention, smaller blast radius, clean per-character history) **and**, now that
the file-sha base is settled, makes the conflict check *simpler* than a grouped
store (the file sha is a natural per-file revision — no hand-rolled content hash).

This file is the **living status page**: tick a step `[x]` and set its **Status**
when it lands, and add a line to [Progress log](#progress-log). Keep it in sync
with the code.

- **Owner:** repo owner (Option C confirmed 2026-08-12 after the B/C
  deliberation — see [History](#history--why-option-c)).
- **Created:** 2026-08-11. **Confirmed as Option C:** 2026-08-12.
  **Branch of record:** `dev`.
- **Baseline:** `dev` @ `fc99951` (Combat tab + fixes committed). Suite at
  **415 tests** (`npm test`, which runs `tools/check-imports.mjs` first).

---

## Problem statement

The save path is the Cloudflare Worker's `POST /save` (`tools/worker/worker.js`),
which today does a whole-file read-modify-write of the grouped store
`data/characters.json`: GET the file (`readStore` → blob `sha` + parsed store),
set `store.characters[id] = character`, PUT it back, with a bounded GET-sha → PUT
409 retry (`upsertCharacter`).

Concurrency analysis of that design:

1. **Different characters, simultaneous saves → works, but contends.** A's PUT
   moves the file sha; B's PUT 409s, re-reads the whole store, merges **only its
   own id**, re-PUTs. Both persist — but every save rewrites a file holding
   *every* character (noisy diffs, big PUTs), and a **burst of concurrent writers
   can exhaust the bounded `MAX_RETRIES=3` and fail a save**. Recorded as an
   accepted cost in `docs/PLAN-MULTI-CHARACTER.md`.
2. **Same character, two writers (two devices, player + GM, a stale tab) →
   silent last-writer-wins.** B's retry re-reads the file — now holding A's
   version of that id — and replaces `characters[id]` wholesale with its own full
   character. A's save is gone and **neither user is told**. A stale client does
   the same even without strict simultaneity. **This is the real data-loss
   hazard.**
3. The imminent **background save** feature (blood-charm spend / combat health
   auto-commit) makes concurrent saves *more* likely — both the contention (1)
   and the silent clobber (2) matter now.

Two distinct problems, two fixes: the **layout split** removes the cross-character
contention/blast-radius (1); the **per-file base check** makes the same-character
clobber visible (2). This plan does both.

---

## Rationale — why this design

**File-per-character + per-file revision conflict (Option C, owner-approved):**

- **One file per character isolates writers structurally.** A save reads and
  writes only its own file. Two players saving different characters at the same
  instant can never interfere — no shared file to race, no whole-store rewrite,
  no cross-character 409 surface, no retry-exhaustion under concurrent load. A
  save of one character can never fail because another character is being saved.
- **The file's sha *is* the per-file revision — settled, no content hash needed.**
  With a grouped store the file sha moves on *any* character's save, so it is
  useless as a per-character base (this is exactly why the grouped-store fallback
  would need a hand-rolled per-entry hash). Split the store and the sha of
  `<id>.json` is precisely "the latest committed version of *this* character."
  **Confirmed 2026-08-12:** the contents-API `Accept: raw` **ETag equals the git
  blob sha** (curl against `character-data`: raw ETag and JSON `.sha` both
  `789239a1…`). So the client captures the base from the read's ETag (no base64
  decode), the worker compares it to the file sha it already reads for the PUT,
  and the save response returns the new blob sha as the next base. **No `revOf`,
  no canonical-JSON serialization, no client/worker parity test** — the fragile
  piece a grouped-store rev check would need is gone.
- **Optimistic concurrency makes the same-character race visible instead of
  silent.** The client sends the base sha it last saw; the worker rejects a stale
  base with `409 { code: "stale_base", sha }` (carrying the current sha); the app
  offers **keep mine** (acknowledged overwrite) / **take theirs** (reload from
  branch) / **cancel**. For a game sheet, per-field CRDT merging is overkill;
  last-writer-wins is acceptable **when it is explicit and confirmed**.
- **A small discovery index (`data/characters/index.json`) keeps the picker one
  fetch.** The picker lists character *names*; a directory listing gives only
  filenames and would force an N+1 fetch on every picker open. The index carries
  `{ id, name }` only and is **never trusted for save bases** — bases come only
  from file reads and save responses — so a stale index can mis-name a picker row
  but can never corrupt a save or cause a false conflict.
- **Backward compatible.** A client that sends **no `base`** (older deployment,
  local dev) is served by the existing bounded-409 overwrite path. There is **no
  legacy grouped-store read** — a not-yet-migrated branch surfaces a clear error
  instead of silently degrading. The split is a pure read/write-layout change on
  the `character-data` branch, coordinated in one change (see
  [Migration](#phase-d--migration--coordination)); the owner lands migration and
  deploy together, so the skew window is a conscious, visible error on either
  side.

**One honest caveat (base survives less than a content hash would):** the base is
the read's **ETag**, which the **raw-CDN fallback does not provide**. If a client
is ever pushed onto the CDN fallback (contents-API rate-limited at 60 req/hour/IP,
or erroring), that session has **no base** and degrades to the current overwrite
path for that save. For the expected use — a player loading **their one**
character = a single contents-API read, far under the limit — this is rare, and
it degrades to *today's* behaviour, never worse. Accepted.

**Alternatives considered and rejected:**

- **A — split only (no conflict check):** keeps the silent same-character
  clobber; does not meet the goal.
- **B — rev-conflict on the grouped store:** the minimal fix for the data loss,
  but keeps the whole-store rewrite, cross-character contention / retry-exhaustion
  under concurrent load, and needs a hand-rolled per-entry content hash
  (`revOf`) that must be **byte-identical on client and worker** (a parity-test
  care-point). Fixes (2) but not (1), and adds the fragile hash. Rejected in
  favour of C once the ETag base was settled — see [History](#history--why-option-c).
  **If B is ever revisited, the hash must be ≥64-bit by default** (BigInt, or the
  standard two-32-bit-halves trick — *not* a bare 32-bit FNV-1a/djb2): the hash
  *is* the entire guard, so a ~2⁻³² collision makes a genuinely stale base match
  as current and silently clobbers — the exact failure this plan exists to
  prevent. Near-zero cost; make it the floor, not an option. (C sidesteps this
  entirely — its base is the 160-bit git blob sha, no hand-rolled hash.)
- **D — worker category-merge heuristic:** cheap, but stale bases are
  undetectable and same-character edits still silently lost; a partial fix that
  still hides the loss.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Store layout: grouped `data/characters.json` → `data/characters/<id>.json` + `index.json` | 🛡️ Owner-signed layout change | Tier-1 names `data/character.json` and `rules/*.json` schema tags; the grouped `ed-characters/1` store was a later plan decision. Owner requested the split (2026-08-12). Each character file keeps the **`ed-character/1` shape untouched**; the index gets a new `ed-characters-index/1` tag. |
| Worker `/save` per-file write + base contract | 🛡️ Ceremony (not Tier 2) | The env-pinned worker path is a documented security property. Worker changes ship together with `GITHUB-SERVERLESS-SAVE.md`, the runbook, and `wrangler.toml` in the same change. |
| New `ed-conflict` modal | ✅ Tier 3 | New view — must hold Tier 1: Escape closes / Enter confirms, theme-aware, two font weights (400/500), light-DOM portal pattern (like `ed-save-key`). |
| Pure conflict-decision helper | ✅ Tier 3 | Dependency-free, DOM-free; makes the ed-app transition logic unit-testable. |
| Engine / effect taxonomy | ✅ Untouched | No `engine/*` or `rules/*.json` changes; 415/415 stays green. |
| Background save (planned) | ✅ Composes | The auto-save uses the same save path + conflict modal; no new invariants. |

**Tier-1 invariants this plan must not break:** store only inputs (a character
file holds only `ed-character/1` inputs; derived values never persisted); data
flows down / events up (views dispatch, `ed-app` acts); modal rules above;
relative `./…` fetch paths, never root-absolute (WORKFLOW.md); the `ed-character/1`
schema shape is not renamed — only its storage location changes.

---

## Confirmed decisions (owner, 2026-08-12)

1. **One file per character** — `data/characters/<id>.json`, each the raw
   `schema: "ed-character/1"` entry (no grouped wrapper). `ID_RE`
   (`[a-z0-9][a-z0-9-]{0,63}`) is already a safe filename class — the existing
   worker id validation carries over unchanged (`id` is never a path).
2. **Discovery index** — `data/characters/index.json`
   (`{ schema: "ed-characters-index/1", characters: { "<id>": { name, portrait? } } }`),
   updated by the worker **only on create** (rare, cheap). The index carries the
   character's `portrait` (optional) alongside `name` so the picker rows keep
   their UI-GUIDELINES §6a portrait thumbnails in one fetch (owner decision
   2026-08-12 — same session as the B/C review). **Never trusted for save bases.**
3. **Per-file optimistic concurrency** — save envelope becomes
   `{ character, id, base }`; the worker rejects `base ≠ current file sha` with
   `409 { code: "stale_base", sha }` (no retry — a stale base cannot be retried
   away); a 409 in the read→write window also maps to `stale_base`; no-base
   callers keep the current bounded-409 overwrite path. Success ⇒
   `{ commit: { sha, url } }` where **`sha` is the new file blob sha**
   (`content.sha` from the GitHub PUT response — the worker already returns this
   as `commit.sha`; note it is the *blob* sha, not the commit sha) — the client's
   **next base**.
4. **Conflict UX: keep-mine / take-theirs modal** — new `ui/ed-conflict.js`
   (light-DOM portal, Escape closes / Enter confirms). Keep mine = re-save with
   `base = conflict.sha` (acknowledged overwrite); Take theirs = reload from
   branch + `reconcileOverlay` (reuses `_discardLocal` semantics) + refresh base;
   Cancel = close, overlay keeps the edits, next save re-conflicts. The
   choice→action mapping lives in a **pure helper** (`nextSaveAction`) so it is
   unit-testable without a DOM harness.
5. **Base sha source** — the contents-API **`ETag` header** on read (`Accept:
   raw`, no base64 decode; **confirmed ETag == git blob sha**, 2026-08-12);
   **`content.sha`** on save success (the worker's `commit.sha`). Local dev / the
   raw-CDN fallback have no ETag ⇒ **no base** ⇒ overwrite path (accepted caveat
   above).
6. **No legacy read fallback** — the legacy grouped `data/characters.json` is
   gone after migration and the new app never reads it. A missing
   `index.json` (not-yet-migrated branch) or a missing character file surfaces a
   clear error ("character store not found / not migrated" / "unknown
   character") — never a silent legacy read. Migration and app deploy land
   together (transition note).

**Costs accepted with the split:** the picker needs one index fetch + one file
fetch for the selected character (two fetches vs. one today — still well within
the unauthenticated contents-API rate limit for a single-character load); a
renamed character's index entry goes stale until the index is refreshed (the
file's `meta.name` is authoritative; the index is never trusted for bases, so a
stale name only mis-labels a picker row — likewise a changed `meta.portrait` lags
until the next create; the file is authoritative); the data branch holds one
commit that replaces the grouped file with the directory; the ETag base does not
survive a raw-CDN fallback (degrades to overwrite for that session — rare).

**Transition note (accepted):** the migration commit and the app deploy land
**together** on the `character-data` branch. There is **no read fallback in
either direction**: a new app against a not-yet-migrated branch shows a clear
"store not found" error; an old app against the migrated branch shows "no
characters found". Both are visible, accepted degradations of a coordinated
release. The owner pushes the migration (the worker token lives outside this
repo).

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--worker-per-file-write--base-contract) | Worker: per-file write + `base`/`stale_base` + index (+ tests) | ✅ Done |
| [B](#phase-b--client-read-path--save-envelope) | `store.js` `listCharacters`/`loadCharacter` + ETag base capture; `store-server.js` envelope + conflict error; dev-server routes (+ tests) | ✅ Done |
| [C](#phase-c--ed-app--conflict-modal) | `ed-app` drops the grouped store, tracks `_baseSha`, sends `base`; pure `nextSaveAction`; `ui/ed-conflict.js` modal | ✅ Done |
| [D](#phase-d--migration--coordination) | Split script, data-branch commit, `.gitignore`, docs, changelog | ✅ Done (D2 owner push + D4 two-browser smoke verified 2026-08-12) |

---

## Phase A — Worker: per-file write + base contract

**Outcome:** `/save` writes `data/characters/<id>.json` and rejects stale bases;
custom items untouched; worker tests green.

- [x] A1. **Path change.** `env.GITHUB_STORE` (default `data/characters.json`)
      → `env.GITHUB_CHARS_DIR` (default `data/characters`); the save target is
      `${GITHUB_CHARS_DIR}/${id}.json`. `id` stays validated by `ID_RE` (never a
      filesystem path; the class is filename-safe). Update `wrangler.toml` /
      runbook env docs in the same change.
- [x] A2. **`upsertCharacterFile(id, character, base)`** replacing
      `upsertCharacter`:
      - GET the file → 404 ⇒ **create** (PUT without sha; `base` ignored).
      - `base` provided and `≠` current sha ⇒ **409 `{ code: "stale_base", sha }`**
        immediately — no retry.
      - `base` matches (or absent — legacy caller) ⇒ PUT with the current sha;
        a 409 in the read→write window also returns `stale_base` (the base is by
        definition no longer current). No-base callers keep the current bounded
        3× retry.
      - Success ⇒ return `commit: { sha, url }` where **`sha = content.sha`** (the
        new file blob sha — the client's next base), reusing the existing
        `c.content.sha` return shape.
- [x] A3. **Index maintenance — create-only, no per-save ceremony.** A save
      writes **only** `data/characters/<id>.json` — no index read, no name diff,
      no extra commit on the save path. The index is touched **only when the
      save creates a brand-new file** (file 404 → create → also ensure an entry
      in `data/characters/index.json`, creating the index file if absent, so the
      new character is discoverable). The entry carries `{ name, portrait? }`
      (from `meta`) — enough for the picker rows in one fetch. A failed index
      write on create is logged and tolerated — the file is truth; a
      created-but-unindexed character is invisible to the picker until the index
      is refreshed (accepted). Renames and portrait changes never touch the
      index (the entry goes stale; `meta.name`/`meta.portrait` in the file are
      authoritative).
- [x] A4. **Tests** (`tools/worker/worker.test.js`): per-file write path;
      create-on-404 (file **and** index entry, only on create); matching base →
      PUT; stale base → 409 `stale_base` + sha; raced 409 → `stale_base`; no-base
      legacy overwrite; cross-character concurrent save still succeeds and does
      **not** false-conflict; **ordinary saves never read or write the index**
      (a rename save touches only the character file); id/path safety;
      `/save-items` untouched. Update the store-path fixtures.
- [x] A5. **Verification:** worker tests green (part of `npm test`).

## Phase B — Client read path + save envelope

**Outcome:** the app discovers and loads characters per-file, captures base shas
from the read ETag, and the client save layer understands `stale_base`.

- [x] B1. **`store.js`**: replace `loadCharacters()` with
      - `listCharacters()` → fetch `data/characters/index.json` (contents API
        first, cache-busted raw-CDN fallback; local `./data/characters/index.json`)
        → `[{ id, name, portrait }]` (portrait optional, from the index entry —
        keeps the picker's §6a thumbnails in one fetch). **No legacy grouped
        fallback** (Decision 6): an index 404 surfaces a clear "character store
        not found / not migrated" error.
      - `loadCharacter(id)` → fetch `data/characters/<id>.json` (same API→CDN
        chain), **capture the base sha from the contents-API `ETag` header**
        (confirmed == blob sha) — **strip the ETag's surrounding quotes**; a
        missing or malformed ETag ⇒ `base = null` (never an error). Apply the
        overlay, load rules as today. Returns `{ character, rules, base }` — the
        `store` object and `store.characters[id]` lookup go away. A 404 for the
        file is an "unknown character" error.
      - CDN-fallback / local reads carry **no usable ETag** ⇒ `base = null`
        (overwrite path on save; accepted caveat).
- [x] B2. **`store-server.js`**: `saveServer(character, { ..., base })` → POST
      `{ character, id, base }`. Map `stale_base` to a typed `SaveConflictError`
      carrying `{ sha }` (extends `SaveError`). **Distinct codes:** `stale_base`
      → the conflict modal; the exhausted no-base retry `conflict` (legacy
      callers only) → the generic error toast. On success, surface the response
      `commit.sha` to the caller as the next base. Tests: envelope includes base;
      `stale_base` parses to `SaveConflictError` with the current sha; success
      returns the new sha.
- [x] B3. **`tools/dev-server.mjs`** (+ test): serve `/data/characters/<id>.json`
      and `/data/characters/index.json`; retire the grouped-store route.
- [x] B4. **Tests**: `store-server.test.js`, `dev-server.test.js` green; existing
      415 stay green.

## Phase C — ed-app + conflict modal

**Outcome:** the app tracks per-character base shas, saves with them, and surfaces
conflicts via the modal — including background auto-saves.

- [x] C1. **`ui/ed-conflict.js`** (new; pattern: `ed-confirm` / `ed-save-key`):
      light-DOM portal, theme-aware, two weights, Escape closes / Enter confirms.
      Copy: "This character changed on another device or player." Actions:
      **Keep mine** (primary, Enter) / **Take theirs** / **Cancel**. Dispatches
      `ed-conflict` up with the choice.
- [x] C2. **Pure `nextSaveAction({ choice, conflictSha })`** helper (new,
      dependency-free): maps a conflict-modal choice to the next step —
      `keep-mine` → `{ action: 'resave', base: conflictSha }`; `take-theirs` →
      `{ action: 'reload' }`; `cancel` → `{ action: 'none' }`. Unit-tested,
      keeping `ed-app` thin (no DOM harness exists).
- [x] C3. **`ui/ed-app.js`**:
      - ✓ (landed with B1/B2 consumer work) Drop `_characterStore`; startup uses
        `listCharacters()` + `_initialId` + `loadCharacter(id)`; the picker lists
        from `listCharacters()` rows.
      - ✓ (landed with B1/B2) Track `_baseSha` per character (set on load from
        `base`, updated from `commit.sha` on every save, `null` when unknown).
      - `_doSave({ silent })` (manual + background) sends `base: _baseSha`; on
        `SaveConflictError` sets `_conflict = { sha }` → renders the modal; routes
        the choice through `nextSaveAction`. Keep mine → re-save with the returned
        base; Take theirs → `_discardLocal()`-style reload + `reconcileOverlay` +
        refresh `_baseSha`; Cancel → close, leave overlay dirty.
- [x] C4. **Tests / smoke:** `nextSaveAction` unit tests (5); import check stays
      clean; two-browser smoke is Phase D D4 (owner).

## Phase D — Migration & coordination

**Outcome:** the `character-data` branch holds the new layout; docs and changelog
are current; the whole suite is green.

- [x] D1. **`tools/split-character-store.mjs`**: reads the legacy
      `data/characters.json` (local gitignored working copy), writes
      `data/characters/<id>.json` per entry + `data/characters/index.json`,
      cross-checks ids vs `meta.id`, prints a summary (id → name, count).
- [x] D1b. **`.gitignore`**: ignore `data/characters/` (the per-file working
      copies + index) alongside the legacy `data/characters.json` line, so the
      split script's local output and local dev writes never reach `dev`/Pages —
      character data stays on the `character-data` branch only.
- [x] D2. **Data-branch migration commit** (owner push): delete
      `data/characters.json`, add `data/characters/` + `index.json` — landed with
      the app deploy (Decision transition note).
- [x] D3. **Docs:** `docs/GITHUB-SERVERLESS-SAVE.md` — rewrite the save model
      (per-file writes, base contract, `stale_base` + modal, index-not-trusted
      rule, ETag==blob-sha base, read path); `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`
      — worker env/path change; `docs/PLAN-MULTI-CHARACTER.md` — record the layout
      change and `ed-characters-index/1`, resolve the accepted-costs paragraph;
      `data/changelog.json` — unreleased entries.
- [x] D4. **Verification:** `npm test` (all suites, import check) green; manual
      two-browser smoke — B saves a stale character → conflict modal; keep-mine
      overwrites (A's newer data replaced knowingly); take-theirs reloads A's
      version and clears the overlay; background auto-save also conflicts
      correctly; cross-character concurrent save still succeeds without a false
      conflict; a rename save touches only the character file (picker name lags
      — accepted); a not-yet-migrated branch (no `index.json`) shows the clear
      "store not found" error, never a legacy read.

---

## History — why Option C

The plan briefly re-scoped to **Option B** (a per-entry content-hash conflict
check on the grouped store) as the *smallest* fix for the same-character silent
clobber. On review for the **multi-player** use case, two things tipped it back to
the split:

1. **B fixes the clobber but not the contention.** With several players (and
   background autosave) hammering one grouped file, saves still contend on that
   file and a burst can exhaust the bounded retry and *fail*. The split removes
   that class of failure entirely, plus the whole-file rewrites and the shared
   blast radius.
2. **The ETag base is settled, which deletes B's fragile piece.** B needs a
   hand-rolled canonical `revOf` that must be byte-identical on client and worker
   (a parity-test care-point) *because* the grouped file sha is too coarse per
   entry. With one file per character, the **file sha is the per-file revision**,
   and the contents-API `Accept: raw` ETag **equals the blob sha** (confirmed by
   curl, 2026-08-12: `789239a1…`). So C's conflict check is *simpler and more
   robust* than B's — no custom hash, no serialization trap, no parity test.

B's one edge over C — its content-hash base survives the raw-CDN fallback, where
C's ETag base does not — is minor for a single-character load (far under the
rate limit; degrades only to today's overwrite). Owner chose **C** (2026-08-12).

---

## Issues & learnings

*(Append here as the change lands — traps, corrections, and non-obvious calls.)*

---

## Progress log

*(Append newest-last. Each entry: date, what landed, suite status, branch state.)*

- **2026-08-12** — Plan settled on **Option C** (per-character files + per-file
  base check) for the multi-player use case, after weighing Option B (grouped-store
  content-hash). Deciding facts: the split removes cross-character save contention
  / retry-exhaustion and shrinks blast radius; and the contents-API raw ETag was
  confirmed == git blob sha, so C's base check uses the file sha directly with no
  `revOf` / parity test (simpler than B). Added a pure `nextSaveAction` helper for
  ed-app testability and recorded the ETag-not-on-CDN-fallback caveat. No code yet.
- **2026-08-12** — Plan amendments per owner review: **(1)** `.gitignore` step
  added (ignore `data/characters/` so working copies never reach `dev`/Pages);
  **(2)** the legacy grouped **read fallback is dropped** (Decision 6) — a
  not-yet-migrated branch or missing file surfaces a clear error, never a silent
  legacy read; transition note updated (no fallback in either direction);
  **(3)** ETag hardening — strip the ETag's quotes, malformed/missing ETag ⇒
  `base = null`; **(4)** `conflict` (no-base exhausted retry → toast) vs
  `stale_base` (→ modal) called out in B2; **(5)** index is **create-only** —
  saves write only the character file, no per-save index read/name-diff; renames
  leave the index entry stale (accepted; the file's `meta.name` is authoritative).
  No code yet.
- **2026-08-12** — **Phase A landed** (worker per-file write + base contract).
  `tools/worker/worker.js`: env `GITHUB_STORE` → `GITHUB_CHARS_DIR`, save target
  `data/characters/<id>.json` (raw `ed-character/1`, no wrapper); new
  `upsertCharacterFile` — 404 ⇒ create (base ignored), stale base ⇒ 409
  `stale_base` + current sha (no retry), matching base ⇒ PUT, read→write 409 for
  base-callers ⇒ `stale_base` with a fresh sha, no-base callers keep the bounded
  3× retry; create-only `ensureIndexEntry` (best-effort, logged); `readCharacterFile`
  reads only the sha (no content — no store to merge); `putCharacterFile` returns
  null on 409 so the caller picks retry vs `stale_base`; invalid non-string base
  → 400 `invalid_base`. `wrangler.toml` env updated. Tests rewritten for the
  per-file layout + all A4 cases (44 worker tests, suite **423** green, import
  check 37 modules clean). Working tree still uncommitted on `dev`.
- **2026-08-12** — **Index shape amendment (owner):** the discovery index entry
  is `{ name, portrait? }`, not `{ name }` — the picker's UI-GUIDELINES §6a
  portrait thumbnails require the portrait in the index to stay a one-fetch
  picker. Worker `ensureIndexEntry` writes `meta.portrait` alongside `meta.name`
  on create; `listCharacters` returns `[{ id, name, portrait }]`; a changed
  portrait lags like a rename (accepted; file is authoritative).
- **2026-08-12** — **Phase B landed** (client read path + save envelope).
  `store.js`: `loadCharacters()` → `listCharacters()` (index → rows, no legacy
  grouped fallback; local read when not on Pages) + `loadCharacter(id)` reads
  the per-character file and captures the **ETag base** (`baseFromEtag` strips
  quotes, malformed/missing ⇒ `null`), plus `readCharacterFile`/`loadRules`;
  CDN/local reads carry no ETag ⇒ base `null` (accepted overwrite path).
  `store-server.js`: `saveServer` POSTs `{ character, id, base }`; `stale_base`
  → typed `SaveConflictError` carrying `{ sha }`; exhausted no-base `conflict`
  stays a plain `SaveError` (toast); success returns `commit.sha` as next base.
  `tools/dev-server.mjs`: `/save` writes `data/characters/<id>.json` raw +
  create-only index (name + portrait), mirrors worker validation incl.
  `invalid_base`; grouped route retired. `ui/ed-app.js` + `ui/ed-character-picker.js`
  consume the new API (`_characters` rows, `loadCharacter(id)`, `_baseSha`
  captured on load and advanced on save). Suite **430** green, import check 37
  modules clean; ticks B1–B4. Working tree uncommitted on `dev`.
- **2026-08-12** — **Index portrait in the worker + dev server:** `ensureIndexEntry`
  (worker) and the dev-server `/save` both write `{ name, portrait }` on create;
  a new worker test pins the portrait index entry. Still 45 worker tests; suite
  **430** green.
- **2026-08-12** — **Phase C landed** (conflict modal + save envelope in ed-app).
  New `save-action.js`: pure `nextSaveAction({ choice, conflictSha })`
  (keep-mine → resave with the conflict sha as acknowledged base / take-theirs →
  reload / cancel → none) + 5 unit tests. New `ui/ed-conflict.js` (light-DOM
  portal, theme-aware, two weights, Escape closes, Enter = Keep mine). `ed-app`:
  `_save()` → `_doSave({ silent, base })` (manual loud, background silent; the
  background-save seam); key-prompt replay preserves the silent flag
  (`_pendingSaveSilent`); a `SaveConflictError` sets `_conflict = { sha, silent }`
  → modal, routed via `nextSaveAction` (keep-mine re-saves with the branch sha,
  take-theirs reconciles the overlay + `_reloadSaved()`, cancel leaves the draft
  dirty); `_reloadSaved()` factored out of `_discardLocal()`; `_baseSha` advanced
  from each save's commit sha. Suite **435** green, import check 39 modules clean;
  ticks C1–C4. Two-browser smoke deferred to D4. Working tree uncommitted on
  `dev`.
- **2026-08-12** — **Phase D partial (D1 + D1b).** `tools/split-character-store.mjs`
  (+ 5 tests): pure `splitCharacterStore` core — reads the legacy grouped
  `data/characters.json`, writes `data/characters/<id>.json` (raw `ed-character/1`)
  + `index.json` (`{ name, portrait }`), cross-checks `meta.id` (warning, never a
  rename), skips unsafe ids, prints id → name + count + warnings. Ran against the
  local working copy: **chakka → Chakka, chakka-test → Chakka-TEST, kolon → Kolon**,
  index `ed-characters-index/1` written to gitignored `data/characters/`.
  `.gitignore` now covers `data/characters/`. Suite **440** green, import check
  39 modules clean. Remaining: D2 (owner data-branch push), D3 (docs), D4
  (owner two-browser smoke). Working tree uncommitted on `dev`.
- **2026-08-12** — **D3 docs landed.** `docs/GITHUB-SERVERLESS-SAVE.md` fully
  rewritten for the per-file model: §1 endpoints line, §3.1 flow diagram + steps
  + index-costs paragraph + `/save-items` companion, §3.2 contract table
  (`base?: string`; `invalid_base` 400; `stale_base` 409 + sha, no retry;
  200 `commit.sha` = next base), §4.3 env table (`GITHUB_CHARS_DIR` replaces
  `GITHUB_STORE`), §4.5 code sample + wiring rules (Base = read's ETag;
  conflicts → keep-mine/take-theirs), §4.6 per-file test list, §5 blast-radius
  wording (per-character file), §6.1/6.2/6.3 what-changes, §7 history.
  `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`: env inventory + `wrangler.toml` +
  smoke-test + §3.1/§4.1/§5.3 + §7 status row all per-file (`GITHUB_CHARS_DIR`,
  "PENDING — needs redeploy + smoke test" owner action). `docs/PLAN-MULTI-CHARACTER.md`
  gained a **Superseded 2026-08-12** banner pointing at this plan (historical
  record; picker/overlay decisions still hold). `data/changelog.json` unreleased
  gained 3 entries (conflict prompt, per-character files, concurrency-checked
  saves) — 14 unreleased total. Ticks D3. Remaining: D2 + D4 (owner). Working
  tree uncommitted on `dev`.
- **2026-08-12** — **Cross-doc cleanup for the split.** README (§Data, tree,
  `/save` route), ARCHITECTURE (§7.1, §7.3, §7.5 multi-character, §8 layout,
  §10 persistence + scope decisions), WORKFLOW (`character-data` section, save
  note, local-copies note, deploy excludes), docs/THREAD-ITEMS.md ownership
  row, and `.gitignore`'s custom-items comment updated to the per-character
  layout. `scripts/sync-local-data.sh` rewritten: syncs `data/characters/index.json`
  + every `data/characters/<id>.json` enumerated via `git ls-tree` (no grouped
  fallback — a not-yet-migrated branch yields the empty-index fallback, the
  "store not found" error), plus all `data/*.{jpg,jpeg,png}` portraits (now also
  kolon.jpeg / test-orc.jpeg). Re-ran against the branch (works; restored the
  D1 index after the first pass clobbered it with the empty fallback). Suite
  still **440** green, import check 39 clean. Remaining: D2 + D4 (owner). Working
  tree uncommitted on `dev`.
- **2026-08-12** — **All phases complete (D2 + D4 landed).** Owner pushed the
  `character-data` migration (grouped `data/characters.json` deleted; per-character
  files + `index.json` committed) and redeployed the worker (`GITHUB_CHARS_DIR`);
  `origin/character-data` now holds `data/characters/{chakka,chakka-test,kolon,index}.json`.
  App code pushed to `dev` (**`457e39d`**, feat(save): per-character files +
  optimistic concurrency) and Pages rebuilt. Owner ran the two-browser smoke
  (D4) on the dev site — **all passed**: per-character load + portraits, save →
  reload persists, stale-save conflict modal (keep-mine overwrite / take-theirs
  reload), cross-character concurrent saves with no false conflict, and the
  not-migrated "store not found" behavior. (Rename item dropped: the app has no
  rename UI — `meta.name` is not editable; the "rename touches only the character
  file" property stays covered by the worker test.) Suite **440** green, import
  check 39 modules clean. Working tree on `dev` clean apart from unrelated
  pre-existing edits (`rules/items.json`, portrait renames — not part of this
  plan).

---

## Guardrail re-check (landed)

- [x] No Tier-1 invariant changed: `ed-character/1` shape untouched (only its
      storage location); engine/`rules/*.json` untouched; inputs-only invariant
      holds; data down / events up holds (views dispatch, `ed-app` acts).
- [x] Conflict modal honors Escape-closes / Enter-confirms; theme-aware; two
      font weights.
- [x] Works in light and dark mode; no hardcoded colors.
- [x] Asset/fetch paths relative (`./…`), never root-absolute.
- [x] Migration + app deploy land together on the `character-data` branch; no
      legacy read fallback in either direction (visible errors instead).
- [x] `.gitignore` covers `data/characters/` (working copies never reach
      `dev`/Pages).
- [x] Any worker change shipped with `GITHUB-SERVERLESS-SAVE.md`, the runbook,
      and `wrangler.toml` in the same change.
