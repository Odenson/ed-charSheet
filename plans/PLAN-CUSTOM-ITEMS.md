# Custom Items — write-back to `rules/`

A feature-design + work-tracking plan for letting a player create items **not in
the catalog** from the Equipment tab. Created items persist to the
`character-data` branch (a shared store every character sees instantly) and a CI
fold job writes them into `rules/custom-items.json` on `dev` for durability and
versioning — riding the normal dev→main release PR into `main`.

> Status: **built & verified (logic level) — P1–P8 complete; owner Phases A–E
> (deploy, smoke, fold run) pending.** Build-time variations and discoveries are
> recorded in §6.6. Work through the Activities checklist top-to-bottom, ticking
> boxes as you go.

Authority: this plan changes **no Tier-1 or Tier-2 surface** (see
[Guardrail classification](#guardrail-classification)) — it is a Tier 3 change
landing as new data file + new UI + new store module + worker endpoint + CI job.

---

## 1. Objective

- A player can author an item the catalog doesn't have (name, kind, reference
  stats, effects) from a modal in the Equipment tab.
- The item persists through the existing serverless-save machinery to
  `data/custom-items.json` on the `character-data` branch — one shared store for
  **all** characters, on **both** `/` and `/dev/` (they read the same branch).
- In the background, a GitHub Actions job folds the branch file into
  `rules/custom-items.json` on `dev` (durability/versioning only — the app never
  depends on it for availability).
- The engine stays **untouched**: custom items resolve through the existing
  item-catalog path.

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Persistence | `data/custom-items.json` on the `character-data` branch, `ed-items/3` shape, written by the worker (`POST /save-items`) |
| App read | Live from the branch (contents API → raw CDN → bundled `./rules/custom-items.json` → local gitignored `./data/custom-items.json` working copy); re-read on every character switch (`_loadCharacter` re-fetches rules) |
| Fold target | **`dev` only** — durability-only; `main`'s bundled copy arrives with the next dev→main release PR (which also ships the feature code to main) |
| Fold credential | Ephemeral `GITHUB_TOKEN` (`contents: write`) — **no new secrets** (`main`/`dev` unprotected, verified via `gh api`) |
| Save action | **Explicit** — one "Save" in a manager modal posts the full create/edit/delete delta in a single `/save-items` call |
| Overlay | `ed-custom-items` (global key, not per-character); written instantly on edit, **cleared on confirmed commit** (branch = truth) |
| Name collision | **Custom wins** over canon (house rule replaces the book item); the UI flags it as an override |
| Deletes | Mirror the branch file (deletes propagate to picker, characters, and the folded rules file) |
| V1 scope | The 8 standard kinds; **thread items excluded** (their `base`/`threadRanks` shape is a separate effort) |
| Shared validator | `engine/validate-item.js` (pure, DOM-free) used by UI, worker, and fold job |

## 3. Flow

```
Manager modal ─Save─► POST /save-items ─► Worker (validate, merge, 409-retry) ─► data/custom-items.json on character-data
   │ overlay ed-custom-items       │                                                  │
   ├─200─► clear overlay ─► re-read branch ─► picker/catalog rebuilt (all characters, this session)
   └─err─► overlay keeps delta (item still usable), Save dot, retry                   ▼
                                                                      Fold job: checkout dev → validate → diff-guard
                                                                      → PUT rules/custom-items.json → dev
                                                                                      │
                                                                                      ▼
                                                                      deploy-pages.yml rebuilds (one run, both instances)
```

Read path (always the live tier, not the fold): on Pages the app reads
`data/custom-items.json` from `character-data` — contents API preferred
(git-consistent, no-store), raw CDN fallback (cache-busted), bundled
`rules/custom-items.json` as offline/fallback, gitignored working copy locally.
Both environments read the same branch, so an item saved on `/dev/` is visible on
`/` immediately — no deploy needed for availability.

---

## 4. Activities checklist

Each step is tagged **[CLAUDE]** (build) or **[YOU]** (owner). Boxes are for
tracking; tick them as the work lands.

### Phase 1 — Preflight
- [x] **1.1 [CLAUDE]** Baseline: `node --test` at the repo root and in
      `tools/worker/`; `node --check` the files you touch. Record counts below
      (Progress log).
- [x] **1.2 [CLAUDE]** Confirm the guardrail classification (this doc §7) still
      holds as you build.

### Phase 2 — Shared validator
- [x] **2.1 [CLAUDE]** `engine/validate-item.js` — pure ESM, zero deps.
      Validates one item against the `ed-items/3` shape + taxonomy:
  - name: 1–64 chars, allows Title Case / spaces / commas / apostrophes,
    forbids `/`, control chars, leading/trailing whitespace;
  - `kind` ∈ the 8 standard kinds (weapon, armor, shield, ammunition, gear,
    magic-item, blood-charm, healing-aid);
  - `ref` (optional) shape: cost (number) / weight (string) / availability /
    description / kind-specific fields;
  - `effects[]` against the taxonomy grammar — valid `type`, `operation` ∈
    add/subtract/set, numeric `value` where required, `target` present where
    required, valid `measure`/`condition`, `summary` present;
  - per-item size cap (~4 KB), per-file item-count cap.
  Returns `{ ok, errors[] }`.
- [x] **2.2 [CLAUDE]** `engine/validate-item.test.js` — unit coverage: valid
      item, each failure class, caps, name edge cases.

### Phase 3 — Worker `/save-items`
- [x] **3.1 [CLAUDE]** `tools/worker/worker.js` — route `/save-items` beside
      `/save`: same CORS + `x-save-key` fail-closed auth; body
      `{ items: { <name>: <item> }, delete?: string[] }`; validate via the shared
      validator (fail-closed → `400 invalid_items`); write
      `data/custom-items.json` on `character-data` — GET (404 → fresh
      `ed-items/3` file), merge `items`, apply `delete`, PUT whole file (base64,
      sha, bounded 409-retry); path pinned from `env.GITHUB_ITEMS_PATH ??
      'data/custom-items.json'`. Imports `../../engine/validate-item.js`
      (wrangler bundles relative ESM).
- [x] **3.2 [CLAUDE]** `tools/worker/wrangler.toml` — add
      `GITHUB_ITEMS_PATH = "data/custom-items.json"` to `[vars]`.
- [x] **3.3 [CLAUDE]** `tools/worker/worker.test.js` — mocked-fetch cases:
      no/wrong key → 401; invalid item → 400; valid upsert (create + merge +
      delete); 404 file created fresh; 409-retry; non-409 → 502; path-pinning.

### Phase 4 — Store + save module (app side, powers the UI)
- [x] **4.1 [CLAUDE]** `store.js` — `loadCustomItems()` mirroring
      `loadCharacters()` (contents API → raw CDN fallback); merge customs into
      the `itemCatalog` used by `deriveModel` (canon first, customs last → custom
      wins); expose `model.customCatalog` (display), `model.customCommittedCatalog`
      (the modal's delta baseline — branch truth before the overlay, see §6.6) and
      `model.customCanonKeys` (override-warning names) for the manager modal;
      `loadCharacter()`
      gains the bundled fallback `loadJSONOptional('./rules/custom-items.json',
      { items: {} })` and the gitignored `./data/custom-items.json` working copy
      (off-Pages); apply the `ed-custom-items` overlay delta on top.
- [x] **4.2 [CLAUDE]** `store-custom-items.js` —
      `saveCustomItems(items, { endpoint, saveKey, deleteNames })` POST + typed
      errors (mirror `store-server.js`); overlay helpers
      (`saveCustomEdits` / `loadCustomEdits` / `reconcileCustomEdits`, key
      `ed-custom-items`).
- [x] **4.3 [CLAUDE]** `.gitignore` — add `data/custom-items.json` (working-copy
      parity with `data/characters.json`).
- [x] **4.4 [CLAUDE]** Store/integration tests — custom armor item flows through
      the store merge and its `armor-modifier` lands on the character.

### Phase 5 — UI (see §5 for the full UI-change detail)
- [x] **5.1 [CLAUDE]** `ui/ed-custom-item.js` — the custom-item manager modal
      (new component; design in §6).
- [x] **5.2 [CLAUDE]** `ui/ed-equipment.js` — "＋ Custom items" affordance
      (edit mode) next to the add-picker; mounts the manager modal; the modal
      dispatches `ed-edit-custom-items` up (golden rule — no state mutation in
      the view).
- [x] **5.3 [CLAUDE]** `ui/ed-app.js` — handle the dispatch: write the overlay,
      call `saveCustomItems` with the in-memory session key (re-prompt via
      `ed-save-key.js` if absent), on success reconcile the overlay + re-read the
      catalog; success toast + commit link; typed errors.

### Phase 6 — Fold job
- [x] **6.1 [CLAUDE]** `tools/fold-custom-items.mjs` — contents API direct (no
      git checkout): fetch `data/custom-items.json` from `character-data`
      (404 → no-op success); validate (shared validator); diff-guard vs
      `rules/custom-items.json` on dev (byte-identical → exit, no deploy); PUT to
      `dev` (sha-preconditioned, bounded 409-retry); on failure open a GitHub
      issue (ephemeral token, `issues: write`).
- [x] **6.2 [CLAUDE]** `tools/fold-custom-items.test.js` — mocked contents API:
      create / update / skip-identical / validation-abort / 409-retry /
      missing-branch-file no-op (11 tests, all green).
- [x] **6.3 [CLAUDE]** `.github/workflows/fold-custom-items.yml` —
      `on: push: branches: [character-data] paths: [data/custom-items.json]` +
      `workflow_dispatch`; `permissions: contents: write, issues: write`;
      `concurrency: { group: fold-custom-items, cancel-in-progress: false }`;
      thin wrapper around the script (no checkout — the script talks to the API).

### Phase 7 — Docs (ship with the change — worker ceremony)
- [x] **7.1 [CLAUDE]** `docs/GITHUB-SERVERLESS-SAVE.md` — "one tiny write
      endpoint" → two (`/save`, `/save-items`); §3 contract + §4.2 sketch + §4.3
      table (`GITHUB_ITEMS_PATH`) extended; §5 blast-radius + §6.2/§6.3/§6.5
      touched.
- [x] **7.2 [CLAUDE]** `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` — §8 owner
      runsheet (Phases A–E) added with status boxes; secrets/var inventory gained
      `GITHUB_ITEMS_PATH` (incl. the `wrangler.toml` snippet); cross-refs
      resolving (R1 lesson).
- [x] **7.3 [CLAUDE]** `WORKFLOW.md` — `character-data` section gains
      `data/custom-items.json` + the fold job; fold-to-dev-only consequence
      documented (the one exception to "saves never rebuild").
- [x] **7.4 [CLAUDE]** `data/changelog.json` — `unreleased` entry: "Create
      custom items in the Equipment tab — shared by all characters and folded
      into the rule files."
- [x] **7.5 [CLAUDE]** This doc → Status flipped to **built & verified (logic
      level)**.

### Phase 8 — Verify (CLAUDE)
- [x] **8.1** `node --test` root + `tools/worker/` all green (238/238, incl. the
      11 fold tests); `node --check` clean on every touched file.
- [x] **8.2** Headless smoke — **logic-level probe** (`tools/probe-custom-items.mjs`,
      `node tools/probe-custom-items.mjs`): the gate (validate-item), the
      picker's catalog merge (store.js:465, custom-wins-on-collision), a custom
      armor item's effects resolving onto Physical/Mystic Armor
      (engine/characteristics.js), the manager modal's working-set delta
      (applyCustomEdits purity + overlay round-trip), and the file caps. The
      plan's "existing probe pattern" did **not** exist in the repo (no
      browser-automation dependency — this is a deliberately dependency-free
      repo), so per owner decision the browser-level checks (picker rendering,
      modal Escape/Enter, light/dark, 1280×800 viewport, overview fit) are
      **deferred to owner Phase D** (runbook §8, D1–D9 covers each by hand).
- [x] **8.3** Guardrail self-check against the CLAUDE.md PR checklist — passed:
      no Tier-1 surface touched by P6–P8 (tools/workflow/docs only; the UI and
      engine were P1–P5 and were already reviewed), no taxonomy change, no
      schema-shape change, fold writes an inputs file at CI time only.

---

## 5. UI changes to support this plan

### 5.1 Surface (Equipment tab, edit mode)

- **"＋ Custom items"** — a small affordance rendered next to the existing
  add-picker search in the Equipment tab, **edit mode only** (read mode offers
  the catalog as today). Opens the manager modal.
- The **manager modal** (`ui/ed-custom-item.js`) — a new component owning the
  form in §6. It renders inside the tab's shadow root, styled to match the
  existing item-detail and discipline-talent modals.
- **No changes to existing read/display paths.** The catalog picker
  (`_catalogs()`), the two-column board, the equipped-item tiles
  (`deriveTileEffect` / `tileEffect`), and the item-detail modal (`_detailModal`)
  all render from `kind`/`ref`/`effects` generically — a custom item drops in
  with zero changes to those. Thread items stay out of the custom creator, so
  `threadItemCatalog` handling is untouched.

### 5.2 The manager modal behaviour (contract)

| Rule | Behaviour |
|---|---|
| Visibility | Edit mode only; opened from the "＋ Custom items" affordance |
| List | Existing custom items — the **committed** branch catalog (`model.customCommittedCatalog`) with any pending `ed-custom-items` overlay delta applied on top (ed-app passes both down), each with kind label, short effect, and a remove (✕) button |
| Add / edit | Opens the item form (§6) — new row, or edits a listed item |
| Remove | Staged until Save (not committed per-row); the row shows "to delete" |
| **Save** (primary action) | One POST: `{ items: {…}, delete: […] }` via `store-custom-items.js` |
| Keyboard | **Escape** closes (backdrop/✕ equivalent); **Enter** confirms Save |
| Theme | Light + dark via CSS variables / `light-dark()`; no hardcoded colour |
| Errors | Inline field errors from the shared validator (block Save); server errors surface in the app's existing toast pattern |
| Close with staged changes | Confirm first (drafts live in the `ed-custom-items` overlay and survive a close) |
| Collision | If the name matches a canon catalog key, the form shows an **"overrides canon item"** notice; custom wins on save |

### 5.3 Dispatch flow (golden rule — events up, data down)

```
ed-custom-item modal ──(click Save)──► CustomEvent 'ed-edit-custom-items'
        { items, delete } bubbles/composed (through ed-equipment's shadow)
ed-app ──► saveCustomEdits(delta)        → overlay write (instant, resilient)
        ──► saveCustomItems(delta, …)    → POST /save-items (session save key)
              ├─ success: reconcileCustomEdits() → re-read catalog → toast + commit link
              └─ error: overlay keeps the delta → typed error toast → Save dot stays
```

- The view never mutates state or computes game values; it formats effect data
  for display and dispatches the delta up.
- The save key reuses the session's in-memory `SAVE_KEY` from the existing
  key-prompt (`ed-save-key.js`); if absent, Save re-prompts (same flow as the
  character Save).

### 5.4 Overlay & persistence behaviour

- Every edit writes the **global** `ed-custom-items` overlay immediately —
  nothing is lost if the worker/network is down, and a pending item still
  resolves this session (the store applies the overlay on top of the branch
  read on load).
- On a confirmed commit the overlay key is **cleared** so the branch read is the
  source of truth (reconcile — same trade-off as the character save overlay).
- The Save button's unsaved dot reflects a pending `ed-custom-items` delta the
  same way `hasPendingEdits` does for character edits.

---

## 6. The custom-item form — how it deals with item types

The form is **kind-driven**. Selecting a kind reconfigures three things: which
`ref` reference fields are shown, which effect quick-templates are offered, and
the defaults for generated effects.

### 6.1 Layout (within the modal)

```
┌ Custom item ───────────────────────────────────────────────┐
│ Name [____________________]   Kind [ weapon ▾ ]            │
│                                                            │
│ ▸ Reference (kind-dependent group — §6.2)                  │
│   Cost [___] sp   Weight [______]   Availability [______]  │
│   …kind-specific fields…                                   │
│   Description [______________________________________]     │
│   Short effect [________________] (n/32 — tile label)      │
│                                                            │
│ ▸ Effects (§6.3)                                           │
│   [＋ Armour +N] [＋ Mystic Armour +N] [＋ Initiative −N] [＋ Note]   ← quick templates (kind-scoped)
│   ┌──────────────────────────────────────────────┐         │
│   │ Type ▾ Target ▾ Op ▾ Value [__] Measure ▾ Con ▾  ✕     │
│   │ Summary [auto-generated text]                          │
│   └──────────────────────────────────────────────┘         │
│   [＋ Add effect row]                                      │
│                                                            │
│              [ Cancel ]                 [ Save ]           │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Kind selector → reference fields

| Kind (KLABEL) | Reference fields shown | Default effect quick-templates |
|---|---|---|
| **weapon** | Category (melee/missile/throwing), STR min, Size, Damage Step; short/long Range when missile/throwing | Damage `attack-modifier add`, target `{attack, Damage}`, measure **step** |
| **armor** | Living checkbox, weight, availability | Physical Armour `+N`; Mystic Armour `+N` (`armor-modifier add`, measure **rating**); Initiative `−N` (`characteristic-modifier subtract`, measure **step**) |
| **shield** | Living checkbox, weight, availability | Physical Armour `+N` (measure **rating**) |
| **ammunition** | Weight, availability, quantity | Note |
| **gear** | Weight, availability | Note |
| **magic-item** | Weight, availability, Range | Note; any modifier template available |
| **blood-charm** | Crafting difficulty, weight, availability | Note (activation) + `characteristic-modifier subtract` on Unconsciousness/Death Rating (measure **rating**, condition **situational**) |
| **healing-aid** | Weight, availability | Note; `test-modifier add` (measure **result**) |

Common to all: Cost (sp, number), Weight (text), Availability (free text — it is
display-only reference, not a controlled vocabulary), Description (textarea),
Short effect (a text input with a live `n/32` counter and hard `maxlength` — it
authors the equipped tile's one-line `presentation.shortEffect` label, kept
short so the tile's right-hand space never overflows; empty is fine, then the
tile derives its label from the first numeric effect),
and an auto summary derived from the templates.

Build note (§6.6): quick-templates shipped for **weapon / armor / shield /
blood-charm / healing-aid** only. **ammunition, gear and magic-item have none** —
the "＋ Add effect row" covers them — and the blood-charm template is
Unconsciousness-only (Death Rating via the generic row).

### 6.3 Effects editor

One repeatable row per effect. Fields:

| Field | Options / notes |
|---|---|
| **Type** | Curated set: `armor-modifier`, `defense-modifier`, `attack-modifier`, `test-modifier`, `characteristic-modifier`, `attribute-modifier`, `note` |
| **Target** | Two-part select (domain + name), constrained by type — §6.4 |
| **Operation** | `add` / `subtract` / `set` (full taxonomy allows more; items rarely need them) |
| **Value** | Number input (hidden for `note` — only the summary input renders) |
| **Measure** | Defaulted by type — §6.4 — editable: `rating` / `step` / `result` / `value` |
| **Condition** | `always` (default) / `situational` (the validator's optional `scope` string is not surfaced as a form field — see §6.6) |
| **Summary** | Auto-generated from the fields and kept in sync as the row's fields change (mirrors the tile/modal chip formatting); typing an override freezes it, and changing the **Type** resets the row to the new type's auto summary. Rows are never silently dropped for having an empty summary — an effect the user added always saves (see §6.6) |

A "＋ Add effect row" appends a pre-filled `armor-modifier` default row. Rows are
**not reorderable** (build note §6.6); remove via ✕.

### 6.4 Type → target/measure constraints (so generated effects are taxonomy-valid)

| Type | Target domain | Target names | Default measure |
|---|---|---|---|
| `armor-modifier` | armor | Physical, Mystic (no Social Armor) | `rating` |
| `defense-modifier` | defense | Physical, Mystic, Social | `rating` |
| `attack-modifier` | attack | Damage (weapon damage) | `step` |
| `test-modifier` | test | Action, Attack, Damage, Effect, Initiative, Recovery — or a named ability (free text) | `result` |
| `characteristic-modifier` | characteristic | WoundThreshold, DeathRating, UnconsciousnessRating, RecoveryTests, Initiative, Movement, CarryingCapacity | `rating` (Initiative template forces `step`) |
| `attribute-modifier` | attribute | Dexterity, Strength, Toughness, Perception, Willpower, Charisma | `value` |
| `note` | — | — | — |

Quick templates prefill type/target/operation/measure/condition; the user edits
value and summary. `source: "item"` is always set by the builder. The whole
delta is validated by `engine/validate-item.js` before Save is enabled.

### 6.5 Validation UX

- Save is disabled until the name and every effect row pass the shared
  validator; failing rows get inline field messages.
- The name field additionally warns (does not block) when it collides with a
  canon catalog key — "Custom overrides the catalog item of the same name."
- A name colliding with an **existing custom** item edits that item in place
  (upsert semantics).

---

## 6.6 Build notes — variations & discoveries (P1–P5)

Recorded while P1–P5 were built. Each row keys back to the plan line it refines;
where the build diverges from the text above, this section is the source of
truth.

**Store (§4.1) — three catalog fields, not one.** `deriveModel` exposes
`customCatalog` (canon+custom merged, overlay applied — the picker/display set),
`customCommittedCatalog` (the pre-overlay **branch truth**) and `customCanonKeys`
(canon names for the override warning). The modal must diff its working set
against a *stable* baseline: if it used the overlay-applied `customCatalog`,
every draft dispatch re-derives the model with the pending item already merged
in, so the modal's recomputed delta collapses to empty (Save disabled, pending
count lost). `customCommittedCatalog` is the load-bearing field.

**UI (§5.2) — modal props are `committed` + `overlay` (+ `canonKeys`), not one
`catalog`.** ed-app passes `m.customCommittedCatalog` and the raw
`loadCustomEdits()` overlay; `committed` arrives as the **items map**
`{ name: item }` (not an ed-items file shape). The modal seeds its working set
once per open in `willUpdate` — after the bound props are applied, before the
first render — via `applyCustomItemsMap(committed, overlay)` (D8 fix: seeding in
`connectedCallback` ran before the props landed, and `applyCustomEdits(...)?.items`
read the file shape off the map, so the working set seeded empty and every
committed item was diffed as deleted). Prop updates while open never reseed, so
the working set survives the model re-deriving beneath it.

**§5.1/§5.2 — the `ed-open-custom-items` event was dropped.** ed-equipment opens
the modal via `_customItemsOpen` state directly; `ed-edit-custom-items` reaches
ed-app by bubbling (Lit composed events) through ed-equipment's shadow — no
re-dispatch, no two-event handshake.

**§5.3 draft path — no branch fetch per keystroke.** A draft re-applies the
overlay in place (`applyCustomEdits(this._rules.customItemsCommittedFile,
loadCustomEdits())`) and re-derives the model. The branch is re-read
(`_refreshCustomItems`) only after a confirmed commit; fetching on every draft
would flash offline toasts.

**§5.3/§5.4 — a net-empty delta clears the overlay.** Add-then-remove before
Save produces `{items:{},delete:[]}`; the draft handler routes that to
`reconcileCustomEdits()`, and `hasCustomPendingEdits()` treats a content-less
overlay as not-pending. Without this the Save dot would light falsely after
add-then-remove. (New test.)

**§5.4 — the character Save button also flushes a pending custom delta.**
`_save()` POSTs the overlay via `/save-items` after the character save (the
custom commit link wins the toast) and recomputes `_dirty` from
`hasPendingEdits || hasCustomPendingEdits`. The plan said the dot reflects
pending customs; the build decided the Save button must act on them too.

**§5.3 key-prompt — replay, not re-open.** The modal closes itself after
dispatching `save`, so the interrupted delta is buffered in
`_pendingCustomSave` `{ items, delete }`, replayed on key confirm, and cleared
on any prompt close (explicit `@close`). Without the buffer the user would have
to re-open the modal and re-save.

**§5.4 discard — pending customs survive.** `_discardLocal` (discard character
edits) keeps a pending custom delta: the `ed-custom-items` overlay is
global/separate from the per-character overlay, and `_dirty` recomputes as
`hasCustomPendingEdits()`. "Cleared on confirmed commit" is commit-specific, not
discard-specific.

**§6.2 quick templates — 5 of 8 kinds.** Shipped for weapon, armor, shield,
blood-charm, healing-aid. ammunition / gear / magic-item have **no** templates —
the plan's "Note" defaults and "any modifier template available" are served by
the generic "＋ Add effect row". The blood-charm template is
Unconsciousness-only; "Death Rating" needs the generic row. (Deferred, not a
regression.)

**§6.3 reorderable rows — not built.** Rows stay in insertion order; remove via
✕. No reorder affordance was implemented. (Deferred.)

**§6.3 `note` rows — fields hidden, not disabled.** For a `note` effect the
value/operation/measure/target inputs aren't rendered — only the summary input.

**§6.3 `scope` — not surfaced in the form.** The Condition select offers
always/situational only; the validator's optional `scope` string
(`engine/validate-item.js`) is not rendered as an input. Situational nuance
rides in the summary text. Validator-side support already present, so a future
form field can expose it with no validator change.

**§6.3 "＋ Add effect row" — pre-filled default.** Appends a pre-filled
`armor-modifier` row (not an empty row) so the first effect is instantly
editable.

**§6.4 attack-modifier — free text too.** The plan listed attack targets as
"Damage" only and free text only for test-modifier; the build lets **both**
attack- and test-modifier take free-text names, mirroring the validator
(`attack-modifier`/`test-modifier` are `names: null` → open). "Damage" is the
quick-template default; the target select offers "Other…".

### P6–P8 build notes

**P6.1 fold — contents API, no git checkout.** The plan's "checkout `dev`" step
became pure contents-API I/O (`GET` source → validate → diff-guard → sha-
preconditioned `PUT` with a bounded 3-retry on 409): no git, no clone, nothing
but the ephemeral `GITHUB_TOKEN` (`contents: write` + `issues: write`). A 404 on
`data/custom-items.json` (catalog never created) is a **no-op success** — the
first custom-item save is what creates it. Failures open a GitHub issue via the
same token instead of `gh issue create` (no git/gh CLI in the runner).

**P6.3 workflow — no checkout step.** The job runs `node tools/fold-custom-items.mjs`
directly against the API; env pins `GITHUB_OWNER`/`GITHUB_REPO` and the token.
`cancel-in-progress: false` keeps a slow fold from being cancelled by the next
custom-item save.

**P7.2 runsheet — §8 is the plan's owner Phases A–E, transplanted.** The runbook
gains a §8 with the plan's owner checklist (A prereqs → B worker deploy/smoke →
C fold run → D end-to-end → E release) as runnable commands with status boxes,
so the owner never needs the plan open to roll this out.

**P8.2 — no "existing probe pattern" existed.** The plan assumed one; the repo is
deliberately dependency-free (no playwright/jsdom — every test is `node --test`
pure logic). Per owner decision the browser-level checks are deferred to owner
Phase D (runbook §8 D1–D9 covers each by hand); `tools/probe-custom-items.mjs`
became the **logic-level** smoke — and the repo's first probe pattern for future
plans. Runs standalone (`node tools/probe-custom-items.mjs`), asserts against
the real shipped modules, exits non-zero on failure.

**P8.1 counts.** Root suite 238/238 (227 prior + 11 fold); `node --check` clean
on every touched file; probe green.

**P6.3 fold trigger — two gotchas found at rollout, both fixed/documented.**
(1) The workflow initially had **no `actions/checkout`**: `node
tools/fold-custom-items.mjs` would fail on a bare runner (script + shared
validator not present). Fixed with an explicit `actions/checkout@v4` of `ref:
dev` — the fold must run the same code version dev serves, and the pushed
branch (character-data) has no `tools/`/`engine/`. (2) **A `push` trigger only
fires when the workflow file exists on the branch being pushed** (GitHub reads
`on:` from the pushed commit). The worker's `/save-items` writes only
`data/custom-items.json`, so the auto-fold on save **requires committing this
workflow file to the `character-data` branch too** (once — later worker PUTs
inherit it in their trees). Until that commit, the fold runs only manually.
Separately, the **manual "Run workflow" button appears only when the file is on
the default branch (`main`)** — so post-Phase-E, the UI button works; pre-main,
verify via the auto-trigger or `GITHUB_TOKEN=… node tools/fold-custom-items.mjs`
run locally. Runbook §8 Phase C and this §8 were amended to carry the C0 commit
prerequisite.

**P8.4 D3 — the add-picker hid fresh custom items behind its 50-result cap.**
Found in owner Phase D (dev): after creating and saving a custom item, it did
not appear in the "＋ Add item" picker. Root cause: `_matches()` sliced to 50
results, and the merged `itemCatalog` appends customs after the real **179**
canon entries (`{ ...canonItems, ...customItems }`), so a custom item sat at
position ~180 — invisible while browsing (a typed search still found it).
Fix: the picker's selection moved into a pure, DOM-free module
(`ui/picker.js`, `pickItemKeys`), which sorts custom items **first** before the
`.slice(0, PICKER_CAP)` — a fresh item always surfaces, and the rule is now
unit-tested against the real catalog (`picker.test.js`). The store merge
stays canon-first/custom-wins by design. Second, a git-consistent read that
lags the `/save-items` PUT could briefly blank the item (only a page refresh
recovered it): `_refreshCustomItems` now reconciles the overlay only once the
re-read **reflects** the just-saved delta (item present, deletes applied) —
otherwise the overlay keeps the item visible and reconciles on the next
confirmed read. Guardrail: Tier 3 (bug fixes restoring documented behavior;
new pure presentation module; no Tier-1 rule touched).

**P8.4 fold action — Node.js 20 deprecation warning.** The fold job showed
"running on old Node.js 20 [deprecated]" (GitHub deprecates node20-based
actions): `actions/checkout@v4` ran on the node20 runtime. Bumped to
`actions/checkout@v5` (Node 24). The `run: node …` step uses the runner's
preinstalled default (Node 24 on `ubuntu-latest`) and needs no change.

**P8.4 fold auto-commit — `dev` goes stale under local clones.** The fold
commits `rules/custom-items.json` straight to `dev`, so `origin/dev` advances
after a custom-item save and a later local `git push` from a stale clone is
rejected (hit live). Expected, not a conflict — the fold only touches that one
file, so `git pull --rebase origin dev` replays local commits cleanly. Written
into WORKFLOW.md (fold section + Everyday development) and §8 C0 in this plan
and the runbook; the character-data workflow copy was also bumped to
`checkout@v5` via the C1 temp-branch procedure so auto-folds lose the node20
warning too.

### Post-release (v1.8.0) updates

**Effects were silently dropped on save — root cause found and fixed.** A saved
custom item always landed with `effects: []` (confirmed in every commit of
`data/custom-items.json` on `character-data`). Two stacked bugs in the modal:
(1) changing an effect's **Type** reset the row via `blankEffect(newType)`,
whose `summary` is `''` — so the old summary was wiped; (2) the clean step
(`_cleanForm`) filtered out every row with an empty summary. Net: add an effect,
change its type, save → the effect vanished. Fix: `_setEffect` now regenerates
the summary from the row's fields after a type reset (and keeps it in sync on
any field change unless the user typed an override), and the clean step
auto-fills a missing summary instead of filtering the row out — a row the user
added always saves, and an invalid row (e.g. a `note` with no summary) surfaces
a validator error rather than disappearing. The effect-building/cleaning logic
moved into a pure, DOM-free module (`ui/custom-item-builder.js`,
`summaryFor`/`blankEffect`/`finishEffect`/`cleanEffects`/`cleanItemForm`,
mirroring the `ui/picker.js` precedent) so the form's save semantics are pinned
by `custom-item-builder.test.js`. The override set is tracked by **index** now
(was object identity, which never survived the immutable-effect re-render); it
also shifts when a row above is removed. Side fix: `attack-modifier`'s type
label was `"Damage"` while its default target name is `"Damage"`, so auto
summaries read "Adds +2 Damage Damage"; the label is now `''` (matches the
equipment tile, which already used an empty suffix for `attack-modifier`).

**`presentation.shortEffect` is now authorable, capped at 32 chars.** The
Reference group gained a "Short effect" input with a live `n/32` counter and a
hard `maxlength` — the equipped tile's one-line label. Empty is fine (the tile
then derives its label from the first numeric effect). The shared validator
(`engine/validate-item.js`) gained `MAX_SHORT_EFFECT = 32` and now rejects
over-long `shortEffect` at the same gate the UI/worker/fold all use, so the cap
holds even against a direct `/save-items` POST. `cleanItemForm` persists
`presentation.shortEffect` trimmed and only when non-empty. Guardrail: Tier 3 —
new form field within the existing `ed-items/3` shape (`presentation` with an
optional string was already validated), a bug fix restoring documented
behavior, no taxonomy/UI-GUIDELINES change.

**Editing a custom item showed the stale copy — effects missing on re-edit —
until a page refresh — fixed.** Reported: on an **edit** of a custom item, the
changes added in the previous save (in particular freshly added **effects**)
were not pulled back into the modal until a refresh. First pass traced it to
`_editItem` reading `committed[name]` before the working set (`committed ??
working`) — after a save whose branch re-read lags the `/save-items` PUT, the
edit stays pending in the overlay and the working set (seeded via
`applyCustomItemsMap(committed, overlay)`) holds the **fresh** copy, so the form
opened with the stale branch copy. That half-fix (`working ?? committed`) was
right but incomplete. The **real** root cause was upstream of the modal in
`_refreshCustomItems` (ui/ed-app.js): the reflection check that decides when to
reconcile the overlay away was **content-agnostic** — it only verified each
saved item *existed* in the re-read (`committedItems[n] != null`), never that
its **content** matched. A git-consistent read that lags the PUT returns the
*previous* commit's file: same item name, **old content** (no effects). The
presence check passed, the overlay was reconciled away, and the stale read
became the committed baseline — so the modal re-seeded the old item and the
just-saved effects were gone from the form until a full refresh finally read the
new content. Fix: extracted a pure, content-aware check `isItemsReflected(saved,
deleted, committed)` (store-custom-items.js) — a saved item must come back
**deep-equal** (the same `JSON.stringify` comparison the modal's `_delta()`
uses), and a delete must be gone. When the read is stale the overlay is kept and
the fresh copy wins on the next seed. Both fixes pinned by regression tests:
`applyCustomItemsMap` overlay-wins upsert + `isItemsReflected` lagged-read
cases → `store-custom-items.test.js` 17/17; root 257/257.

---

## 7. Guardrail classification

All **Tier 3**:

- `rules/custom-items.json` fits the existing `ed-items/3` schema (data within
  the shape — Tier 3).
- **No `ed-character/1` shape change** — custom items live in the shared branch
  store, not per-character (the earlier per-character Tier-1 question is moot).
- **No taxonomy vocabulary change** — the form only writes effects the taxonomy
  already defines → no Tier 2 ceremony.
- New UI honors UI-GUIDELINES: manager modal Escape-closes / Enter-confirms,
  theme-aware, edit-mode-only, fits the viewport; derived values still render as
  placeholder pills, never fabricated numbers.
- Golden rule: the view dispatches `ed-edit-custom-items` up; the app persists
  and re-derives; `engine/` stays pure and **unchanged**.
- Worker + workflow changes ship together with their docs (established worker
  ceremony).

## 8. Owner runsheet (after the build lands on `dev`)

Work top-to-bottom. **[YOU]** / **[CLAUDE]**. Commands copy-paste. Placeholders
look like `<THIS>`.

### Phase A — Prereqs check (YOU)
- [x] **A1. Branch protection** stays off on `main`/`dev` (the fold's
      ephemeral-token direct push depends on it):
  ```bash
  gh api repos/Odenson/ed-charSheet/branches/main/protection --jq .message  # expect: Branch not protected
  gh api repos/Odenson/ed-charSheet/branches/dev/protection   --jq .message  # expect: Branch not protected
  ```
- [x] **A2. Cloudflare session.**
  ```bash
  cd tools/worker && npm install && npx wrangler whoami
  ```
  **No new PAT, no new SAVE_KEY** — both existing secrets are reused as-is.

### Phase B — Worker update (YOU)
- [x] **B1. Get the code.** `git fetch && git switch dev && git pull`.
- [x] **B2. Deploy.** `npx wrangler deploy` — `/save-items` ships beside `/save`;
      URL unchanged; no new secrets.
- [x] **B3. Smoke-test `/save-items`** (from the repo root):
  ```bash
  WORKER="https://ed-charsheet-save.edsavechar.workers.dev"
  KEY="<your-save-key>"

  # (a) No key → expect 401
  curl -sS -X POST "$WORKER/save-items" -H 'Content-Type: application/json' \
    -d '{"items":{}}' -w '\n%{http_code}\n'

  # (b) Invalid item (bad kind) → expect 400 invalid_items
  curl -sS -X POST "$WORKER/save-items" -H 'Content-Type: application/json' \
    -H "x-save-key: $KEY" \
    -d '{"items":{"Junk":{"kind":"nope","effects":[]}}}' -w '\n%{http_code}\n'

  # (c) Valid upsert → expect 200 + commit.url; verify the branch file
  curl -sS -X POST "$WORKER/save-items" -H 'Content-Type: application/json' \
    -H "x-save-key: $KEY" \
    -d '{"items":{"Smoke Cloak":{"kind":"gear","ref":{"cost":5,"description":"test"},"effects":[]}}}' -w '\n%{http_code}\n'
  gh api "repos/Odenson/ed-charSheet/contents/data/custom-items.json?ref=character-data" \
    --jq '.content' | base64 -d | head -c 400; echo

  # (d) Delete propagates → expect 200; branch file no longer has "Smoke Cloak"
  curl -sS -X POST "$WORKER/save-items" -H 'Content-Type: application/json' \
    -H "x-save-key: $KEY" \
    -d '{"items":{},"delete":["Smoke Cloak"]}' -w '\n%{http_code}\n'
  ```
  Failures → `npx wrangler tail` while re-running the failing curl.
- [x] **B3. Smoke-test `/save-items`** — all four curls passed (2026-08-09):
      401 no-key, 400 `invalid_items`, 200 upsert + branch file verified,
      200 delete propagates.
- [x] **B4. Record** in the Progress log: route verified, date.

### Phase C — Fold job (YOU)
> **Read this first — Phase C has hard prerequisites that Phase B didn't.** The
> fold workflow cannot run until it exists on GitHub, and *where* it must live
> depends on how you want it triggered (see §6.6 P6 build note):
>   - **To deploy the whole change at all**, commit + push everything to `dev`
>     first (the workflow file, `tools/fold-custom-items.mjs`, the engine
>     validator, the UI/store modules — none of it is committed yet as of this
>     note).
>   - **Auto-fold on every custom-item save** (the plan's design) needs this
>     workflow file **also committed on the `character-data` branch** — a
>     `push` trigger only fires if the file exists on the branch being pushed,
>     and worker saves only ever write `data/custom-items.json`. Commit it there
>     once (`git push origin dev:.github/workflows/fold-custom-items.yml:...` via
>     `gh api` or a temp worktree); later worker PUTs inherit it in their trees.
>   - **The manual "Run workflow" button** only appears once this file is on the
>     **default branch (`main`)** — i.e. after the Phase E release PR. Pre-main,
>     verification is via the auto-trigger or a local run of
>     `node tools/fold-custom-items.mjs` with a token.

- [x] **C0. Deploy the change.** Pull first — a fold auto-commit may have landed
      on `origin/dev`: `git pull --rebase origin dev`. Then commit + push `dev`
      (the whole custom-items change). Verify the workflow file is in the pushed
      commit:
      `gh api "repos/Odenson/ed-charSheet/contents/.github/workflows/fold-custom-items.yml?ref=dev" --jq '.sha'`.
- [x] **C1. (Pre-main) fold exists on `character-data`** so a custom-item save
      auto-folds. Once done, push a test save through `/save-items` (Phase B3c)
      and watch **Actions** → **Fold custom items** fire → then verify:
      `gh api "repos/Odenson/ed-charSheet/contents/rules/custom-items.json?ref=dev" --jq '.sha'`
      (post-main, skip C1 — the manual button is available instead.)
- [x] **C2. (Post-main) manual run.** Actions → **Fold custom items** → **Run
      workflow** → verify `rules/custom-items.json` on dev updated
      (`gh api "…/contents/rules/custom-items.json?ref=dev" --jq '.sha'`).
- [x] **C3.** **Deploy to GitHub Pages** ran from the fold's dev push; `/dev/`
      rebuilt (both instances rebuild; main's tree unchanged).

### Phase D — End-to-end (YOU drive, CLAUDE checks)
> Use the deployed dev site `https://odenson.github.io/dev/` — the worker's CORS
> allows the `odenson.github.io` origin only.

- [x] **D1.** Edit mode (✎) → Equipment → **Custom items** → create
      (name/kind/effect via the form) → **Save** (reuses the SAVE_KEY session;
      prompts once if absent) → success toast + commit link.
- [x] **D2.** The item is in `data/custom-items.json` on `character-data`
      (commit link, or the B3c `gh api` command).
- [x] **D3.** Picker shows it; add it to a character; switch characters → still
      available (re-read on switch).
- [x] **D4.** Reload → persists; overlay reconciled (no stale mask).
- [x] **D5.** Fold ran → `rules/custom-items.json` on dev updated → `/dev/`
      rebuilt → reload still shows it (bundled fallback path).
- [x] **D6.** Error path: go offline → edit → Save fails → overlay holds the
      pending item (still usable), Save dot shows → online → Save → reconciled.
- [x] **D7.** Collision: create a custom item sharing a canon name → custom's
      effects win, override notice shown.
- [x] **D8.** Delete a custom item → gone from branch + picker + folded file
      (mirror semantics).
- [x] **D9.** Escape closes the modal without saving; Enter saves; light and
      dark both render correctly; desktop viewport fits without vertical scroll.

### Phase E — Release (YOU)
- [x] **E1.** Nothing special to do: the feature + first `rules/custom-items.json`
      ride the next normal dev→main squash release PR (WORKFLOW.md §2). A fold
      landing mid-release just joins that PR's diff (expected).

---

## 9. Security posture (unchanged philosophy)

- Fail-closed `SAVE_KEY`, stateless worker, no credential in the browser.
- **Three validation layers** (UI → worker → fold job) gate the open endpoint
  from the deployed rules; the fold job is the filter between `character-data`
  and `dev`.
- Worker token stays pinned to the data branch; the fold uses the ephemeral
  `GITHUB_TOKEN` (zero new secrets) — verified both target branches are
  unprotected, so no bypass list is needed.
- Size caps (per-item ~4 KB, total ≤ 512 KB) and name rules keep the branch file
  bounded; a junk `/save-items` caller's blast radius stays on the data branch
  and is undone by one real save.

## 10. Test matrix

| Suite | File | Covers |
|---|---|---|
| Validator units | `engine/validate-item.test.js` | shape/name/kind/effects/size failures; `shortEffect` cap |
| Custom-item form builders | `custom-item-builder.test.js` | summary auto-gen, effects never dropped on save, `shortEffect` persistence |
| Worker | `tools/worker/worker.test.js` | 401 / 400 / upsert / delete / 404-create / 409 / 502 / path-pin |
| Fold job | `tools/fold-custom-items.test.js` | create / update / skip / abort / 409 / missing-file |
| Store + integration | root `node --test` | merge, custom-wins, overlay reconcile, `armor-modifier` lands |
| Headless smoke | probe script | picker, tile, modal keyboard, light/dark, viewport |

## 11. Definition of done

- §4 Phases 1–8 all ticked; owner §8 Phases A–D ticked.
- Tests green everywhere; guardrail checklist (§7/§8.3) passes.
- Working tree clean on `dev`; nothing committed until the owner asks.

---

## Progress log (fill in as you go)

| When | What | Who | Outcome |
|---|---|---|---|
| 2026-08-08 | Plan drafted | CLAUDE | Status: draft — under review |
| 2026-08-08 | P1–P2 done | CLAUDE | Baseline green; shared validator `engine/validate-item.js` + tests (23/23) |
| 2026-08-08 | P3 done | CLAUDE | `/save-items` route + `GITHUB_ITEMS_PATH` var + worker tests (36/36); root 214/214; wrangler dry-run bundles (17 KiB) |
| 2026-08-08 | P4 done | CLAUDE | `store.js` `loadCustomItems()` + canon/custom catalog merge + `customCatalog`; `store-custom-items.js` (save POST + `ed-custom-items` overlay); `.gitignore`; tests 11/11 (root 225/225) |
| 2026-08-08 | P5 done | CLAUDE | Manager modal wired: `ed-equipment` "＋ Custom items" affordance mounts `ed-custom-item` (committed-catalog baseline + overlay delta props); `ed-app` handles `ed-edit-custom-items` draft/save (overlay write, /save-items POST, key re-prompt with replay, reconcile + catalog re-read, toast); `deriveModel` exposes `customCommittedCatalog` + `customCanonKeys`; Save dot reflects pending custom edits and the Save button flushes them; empty delta clears the overlay (root 227/227) |
| 2026-08-09 | P1–P5 reviewed vs build | CLAUDE | Variations/discoveries recorded in §6.6; §4.1 / §6.2 / §6.3 text corrected to match what shipped; status flipped to in-progress (P6–P8 + owner phases pending) |
| 2026-08-09 | P6 done | CLAUDE | `tools/fold-custom-items.mjs` (contents-API fold, diff-guard, bounded 409-retry, issue-on-failure, env-pinned) + `tools/fold-custom-items.test.js` (11/11) + `.github/workflows/fold-custom-items.yml` (push `character-data` `data/custom-items.json` + dispatch; `contents`/`issues: write`; serialized); root 238/238 |
| 2026-08-09 | P7 done | CLAUDE | Docs: SAVE.md two-endpoint (§3/§4.2/§4.3 + `GITHUB_ITEMS_PATH`), RUNBOOK §8 owner runsheet A–E + var inventory, WORKFLOW.md fold-to-dev-only consequence, changelog unreleased entry |
| 2026-08-09 | P8 done | CLAUDE | Verify: root 238/238 + `node --check` clean + `tools/probe-custom-items.mjs` logic probe green (P8.2 had **no** existing pattern → owner chose logic-level + defer UI checks to Phase D); guardrail self-check passed; status flipped to built & verified (logic level) |
| 2026-08-09 | Phase B done | OWNER | Worker deployed; all four `/save-items` smoke curls passed (401 / 400 / 200+commit / 200 delete) |
| 2026-08-09 | Fold rollout gaps found | CLAUDE | Workflow had no checkout step (job would fail on a bare runner) + push trigger requires the workflow file on the `character-data` branch (data-only branch lacks it) + manual Run-workflow needs `main`. Workflow fixed (checkout `dev`); §6.6 note + §8 Phase C amended with the C0 commit prerequisite |
| 2026-08-09 | Test on Dev | HUMAN | Testing workflow to fold passed, but I found that it is running the action on an older version of node, this needs to be upgraded |
| 2026-08-09 | Test on Dev | HUMAN | D3: The UI test in dev has one major issue, the initial create in the modal works and created the custom item in char-data and the workflow correctly pushes the change to dev.  However the item does not appear in the add item search until a refresh was tiggered.  This is a bug and will need to be addressed. |
| 2026-08-09 | D3 + Node-20 fixes done | CLAUDE | D3 root cause: picker capped results at 50 and custom items merge last (position ~180 of 180 canon) → invisible in browse. Fixed via new pure `ui/picker.js` (custom-first sort, `PICKER_CAP`) + deferred overlay reconcile in `_refreshCustomItems` (reconcile only when the re-read reflects the saved delta). Fold action node20 deprecation: `actions/checkout@v4` → `@v5` (Node 24). New `picker.test.js` (5 tests, real 179-item catalog) + probe §2b; §6.6 P8.4 note |
| 2026-08-09 | Fold auto-commit staleness documented | CLAUDE | The fold's `dev` push makes local `dev` fall behind `origin/dev`; a plain `git push` gets rejected (hit live during the D3-fix push). Documented the pull-before-push (`git pull --rebase origin dev`) habit in WORKFLOW.md (fold section + Everyday development) and amended §8 C0 in plan + runbook |
| 2026-08-09 | Collision test D7 | HUMAN | While testing this D7, I found that the warning message needs improving, current reads "Custom overrides the catalog item of the same name." should read "This new Custom Item will overrides the catalog item of the same name if you continue.".  A minor bug was also that it was comparing using exact match and is missing case changes.  So if there is a "Backpack" item and I was creating a "backpack" it would allow me to creating it, this is a bug. | 
| 2026-08-09 | Collision test D8 | HUMAN | This is a failed case in that every time you create a new custom item it will force the delete of the existing custom item.  So the delete function works, but that is not the intended functionality, users can create multiple custom items that will be added to the available items.  A delete option should exist but it needs to be triggered by user. | 
| 2026-08-09 | D7 + D8 fixed | CLAUDE | Both reported bugs reproduced headless against the shipped code. **D8 root cause** (two stacked bugs in the modal seed): (1) the seed ran in `connectedCallback`, but the bound `committed`/`overlay` props are applied after the element connects — so it seeded empty on every open; (2) it read `applyCustomEdits(...)?.items`, treating `committed` (an items map) as an ed-items file shape. Result: `_working` was empty, `_delta()` reported every committed item as deleted, and each create+save POSTed the existing item's delete (confirmed in the branch history — every save replaced the previous item). Fix: seed once per open in `willUpdate` via new pure `applyCustomItemsMap(committed, overlay)` (store-custom-items.js) + regression test. **D7 fixes**: collision check now case-insensitive (`backpack` collides with canon `Backpack`); warning copy uses the owner's wording with the grammar fixed ("This new Custom Item will override the catalog item of the same name if you continue."). New `applyCustomItemsMap` test → root 244/244; `node --check` clean. D8 checklist left unticked for owner re-test on /dev/ | 
| 2026-08-09 | Post-1.8.0 owner requests | CLAUDE | Two updates to custom-item creation. (1) **Effects-save bug fixed**: every saved item landed with `effects: []` — a Type change blanked the summary (`blankEffect(newType).summary === ''`) and the clean step filtered summary-less rows out. Effect-building/cleaning moved to pure `ui/custom-item-builder.js`; `_setEffect` now keeps the auto summary in sync (index-tracked override), clean never drops a row, and a missing summary is auto-filled. (2) **`presentation.shortEffect` authoring added**: Reference group "Short effect" input with live `n/32` counter + hard `maxlength`; validator gained `MAX_SHORT_EFFECT = 32` so the cap holds through the UI/worker/fold gate. Side fix: `attack-modifier` summary no longer doubles ("Damage Damage" → "Damage"). New `custom-item-builder.test.js` (9) + validator cap test → root 254/254; §6.1/§6.2/§6.3/§6.6 + §10 updated; changelog unreleased entries added |
| 2026-08-09 | Edit-visibility bug fixed | CLAUDE | **Edit of a custom item showed the pre-save copy until a page refresh.** Root cause: `_editItem` read `committed[name]` before the working set — after a save whose branch re-read lags the PUT, the overlay keeps the edit pending and `_working` (seeded committed ∪ overlay, overlay wins) holds the fresh copy, but the form loaded the stale `committed` one. Fix: `_editItem` now reads the working set first (working is always ≥ fresh; committed stays the delta baseline). Regression test: new `applyCustomItemsMap` overlay-wins-upsert case → root 255/255 |
| 2026-08-09 | Effects missing on re-edit: real root cause found | CLAUDE | First fix was incomplete. Re-edit after a save still showed the old item — freshly saved **effects** absent until a refresh. Real root cause: `_refreshCustomItems`' reflection check was **content-agnostic** (each saved item just had to *exist* in the re-read). A lagged git-consistent read returns the previous commit's file (same name, old content) → the check passed, the overlay was reconciled away, and the stale read became the baseline → modal re-seeded the old item. Fix: pure content-aware `isItemsReflected` (deep-equal per saved item, delete-gone per name) in store-custom-items.js; ed-app uses it; a stale read keeps the overlay and the fresh copy wins on the next seed. +2 tests → root 257/257; §6.6 note corrected |

---
 
Baseline tests at 1.1: root `176 / 176 pass` · `tools/worker/` `21 / 21 pass`.
Rolling after P4: root `225 / 225 pass` · `tools/worker/` `36 / 36 pass`.
Rolling after P5: root `227 / 227 pass` · `tools/worker/` `36 / 36 pass`.
Rolling after P6–P8: root `238 / 238 pass` (incl. fold 11) · `tools/worker/` `36 / 36 pass` · logic probe green.
After D3 fix: root `243 / 243 pass` (incl. picker 5) · probe green (incl. §2b picker contract).
After D7/D8 fix: root `244 / 244 pass` (incl. `applyCustomItemsMap` 1) · headless modal repro green.
After post-1.8.0 updates: root `254 / 254 pass` (incl. custom-item-builder 9 + shortEffect cap 1).
After edit-visibility fix: root `255 / 255 pass` (incl. applyCustomItemsMap overlay-wins 2).
After effects-re-edit root cause: root `257 / 257 pass` (incl. isItemsReflected 2).

Live values (Phase B): worker URL unchanged; `/save-items` verified
`___` · first fold `___` · `/dev/` end-to-end `___`.
