# Serverless Save — Implementation Runbook

The build-and-rollout companion to the design doc
[GITHUB-SERVERLESS-SAVE.md](GITHUB-SERVERLESS-SAVE.md). That doc explains **what
the feature is and why**; this one is the **written reference and runsheet** for
building it — including the manual steps the repo owner completes.

> Status: **shipped** (v1.5.0, 2026-08-06). Built, deployed, and verified
> end-to-end on `dev`. The runsheet in §4 records the completed steps.

---

## 0. Decisions locked for this build

| Decision | Choice | Notes |
|---|---|---|
| Host | **Cloudflare Worker** | Free tier, one file, `wrangler` deploy |
| Worker code location | **`tools/worker/`** in this repo | `tools/` is excluded from the Pages build, so it never deploys as part of the site |
| Endpoint auth | **`SAVE_KEY` required (fail closed)** | Deviation from the design doc's *optional* default — recorded in §5/§7 of the design doc when we ship |
| Save model | **One primary Save → GitHub; Export = local download** | Consolidated (owner decision): over the always-on autosave overlay. File System Access save retired. See ARCHITECTURE §7 |
| SAVE_KEY in the app | **Session-only, in memory** | Entered via a **key-prompt on first save** each session; never written to `localStorage` |
| Endpoint URL in the app | Hardcoded default | The deployed worker; a Settings override is deferred (one field doesn't warrant a panel) |

---

## 1. What we're building (recap)

The **write** half of the serverless save. A tiny Cloudflare Worker exposes
`POST /save`; the app sends the same inputs-only `character.json` bytes it would
write to a file; the worker commits them to the `character-data` branch using a
server-side GitHub token. The app already **reads** that branch live
([store.js](../store.js)), so a save appears on next load with no rebuild.

Full flow and request/response contract: design doc §3. Worker handler sketch:
design doc §4.2.

---

## 2. Security model & secrets

### 2.1 SAVE_KEY — required, fail closed

Unlike the design doc's optional key, this build **requires** `SAVE_KEY`:

- The worker rejects (`401`) any request whose `x-save-key` header is missing or
  wrong, **and** refuses to operate if `SAVE_KEY` is not configured at all.
- Because this is a single-user sheet, only the owner ever saves. The key is a
  private secret the owner keeps — so the endpoint is effectively private, which
  closes the "anyone can write junk to the branch" vector.

**Honest limit (and why it's bounded):** the key is typed into the browser at
save time, so it lives in page memory for that session (never persisted). Even if
it leaked, the blast radius is small and recoverable — an attacker could only
write a schema-valid `character.json` to the data branch (undone by one real
save) and could **never** reach the GitHub token or anything else, because the
token is a repo-only, `Contents: read/write` fine-grained PAT that never leaves
the worker's secret store.

### 2.2 Secrets & config inventory

| Name | Kind | Value | Set where |
|---|---|---|---|
| `GITHUB_TOKEN` | **secret** | Fine-grained PAT, **ed-charSheet only**, `Contents: read/write` | `wrangler secret put` |
| `SAVE_KEY` | **secret** | 64-char hex from `openssl rand -hex 32` | `wrangler secret put` |
| `GITHUB_OWNER` | var | `odenson` | `wrangler.toml [vars]` |
| `GITHUB_REPO` | var | `ed-charSheet` | `wrangler.toml [vars]` |
| `GITHUB_STORE` | var | `data/characters.json` — grouped store (`ed-characters/1`); saves upsert `characters[id]` here (the only save target since v1.6.0) | `wrangler.toml [vars]` |
| `GITHUB_ITEMS_PATH` | var | `data/custom-items.json` — the custom-item catalog (`ed-items/2`) written by `/save-items` (PLAN-CUSTOM-ITEMS.md) | `wrangler.toml [vars]` |
| `GITHUB_BRANCH` | var | `character-data` | `wrangler.toml [vars]` |

Only the two **secrets** are sensitive; the five vars are plain config and live
in `wrangler.toml`. **No secret is ever committed or placed in the app.**

---

## 3. Roles — who does what

| | Owner (**YOU**) | **CLAUDE** |
|---|---|---|
| Create the GitHub PAT | ✅ | — |
| Generate the SAVE_KEY | ✅ | — |
| Cloudflare account + `wrangler login` | ✅ | — |
| Scaffold `tools/worker/` code + tests | — | ✅ |
| Set Cloudflare secrets/vars, `wrangler deploy` | ✅ | — |
| Smoke-test the endpoint, record the URL | ✅ | — |
| App integration (`store-server.js`, Settings, wiring) | — | ✅ |
| Flip the docs from "not built" → "shipped" | — | ✅ |
| End-to-end verification | ✅ (drives) | ✅ (checks) |

Credentials and deploys stay entirely with the owner; Claude never handles the
PAT, the SAVE_KEY, or a deploy.

---

## 4. The runsheet

Work top-to-bottom. Each step is tagged **[YOU]** or **[CLAUDE]**. Boxes are for
tracking; commands are copy-paste. Placeholders look like `<THIS>`.

### Phase 1 — Provision (YOU)

- [x] **1.1 Create the fine-grained PAT.** GitHub → your avatar → **Settings** →
  **Developer settings** (bottom of the left nav) → **Personal access tokens** →
  **Fine-grained tokens** → **Generate new token**.
  - Token name: `ed-charSheet serverless save`
  - Expiration: 90 days (you will rotate — see §6)
  - Resource owner: **Odenson**
  - Repository access: **Only select repositories** → **ed-charSheet**
  - Permissions → **Repository permissions** → **Contents** → **Read and write**
    (leave everything else "No access"; Metadata auto-set to read-only is fine)
  - **Generate token**, copy the `github_pat_…` value somewhere temporary. You'll
    paste it into a Cloudflare secret in 2.3 and can then discard the copy.

- [x] **1.2 Generate the SAVE_KEY.**
  ```bash
  openssl rand -hex 32
  ```
  Copy the 64-character output. This is your private save key — you'll paste it
  into a Cloudflare secret (2.3) and into the app when saving (Phase 6).

### Phase 2 — Worker

- [x] **2.1 [CLAUDE] Scaffold `tools/worker/`.** Claude adds `worker.js` (design
  §4.2 handler, `SAVE_KEY` **required** per §2.1), `wrangler.toml` (§5.1 below),
  `package.json` (wrangler dev-dep), and `worker.test.js`. *No secrets, no deploy.*
  ✅ Done — `worker.test.js` covers Phase 4 (step 4.1) too; `node --test` green (15/15).

- [x] **2.0 [YOU] Cloudflare account.** If you don't have one, sign up free at
  cloudflare.com. No credit card needed for Workers free tier.

- [x] **2.2 [YOU] Install wrangler + log in.**
  ```bash
  cd tools/worker
  npm install
  npx wrangler login          # opens a browser to authorize Cloudflare
  ```
  > **Expected:** `package.json` pins `wrangler ^4`. `npm install` reports a few
  > `npm audit` vulnerabilities and two deprecation warnings — **all in wrangler's
  > local dev toolchain** (`miniflare`/`undici`/`esbuild`), which never ships: the
  > deployed worker is the single dependency-free `worker.js`. **Do not run
  > `npm audit fix --force`** — it downgrades wrangler to v3 to satisfy the audit.
  > The residual advisories are the current wrangler's transitive floor.

- [X] **2.3 [YOU] Set the two secrets.** Each prompts for the value — paste it
  (input is hidden); nothing is written to disk.
  ```bash
  npx wrangler secret put GITHUB_TOKEN     # paste the PAT from 1.1
  npx wrangler secret put SAVE_KEY         # paste the hex from 1.2
  ```
  (The four `GITHUB_OWNER/REPO/STORE/BRANCH` vars are already in `wrangler.toml`;
  no action needed.)

- [x] **2.4 [YOU] Deploy.**
  ```bash
  npx wrangler deploy
  ```
  On the **first** deploy Cloudflare may ask you to register a `*.workers.dev`
  subdomain (one-time use `edsavechar`). Deploy prints the endpoint, e.g.
  `https://ed-charsheet-save.edsavechar.workers.dev`.

- [x] **2.5 [YOU] Smoke-test.** The id is required (v1.6.0+); the save targets
  `data/characters.json` in the repo root.
  ```bash
  cd "$(git rev-parse --show-toplevel)"   # back to repo root — where data/ lives
  WORKER="https://ed-charsheet-save.edsavechar.workers.dev"
  KEY="<your-save-key>"

  # (a) No key → expect HTTP 401
  curl -sS -X POST "$WORKER/save" -H 'Content-Type: application/json' \
    -d '{"schema":"ed-character/1"}' -w '\n%{http_code}\n'

  # (b) Correct key + id → upserts characters[id] in data/characters.json
  #     (grouped store); expect HTTP 200 + a commit URL. NOTE: the payload must
  #     be a JSON body (not file bytes), so use -d with a quoted JSON here.
  curl -sS -X POST "$WORKER/save" -H 'Content-Type: application/json' \
    -H "x-save-key: $KEY" \
    -d '{"id":"chakka","character":{"schema":"ed-character/1","meta":{"id":"chakka"}}}' \
    -w '\n%{http_code}\n'
  ```
  Pass = (a) `401` unauthorized, (b) `200` with `commit.url`. If (b) fails, check
  the worker logs: `npx wrangler tail` while re-running the curl.

- [x] **2.6 [YOU] Record the URL.** `https://ed-charsheet-save.edsavechar.workers.dev`
  — recorded in §7; this becomes the app's hardcoded `DEFAULT_ENDPOINT` in Phase 3.

### Phase 3 — App integration (CLAUDE)

**Consolidated model (owner decision):** one primary **Save → GitHub**, over the
always-on autosave overlay, plus a portable **Export** download. The old "third
save target (web store + file + server)" plan and the File System Access save are
retired. See ARCHITECTURE §7 and design §4.5.

- [x] **3.1** `store-server.js` — `saveServer(character, { endpoint, saveKey, id })`
  POST to the endpoint (design §4.5), typed `SaveError` (incl. `no_key` /
  `offline`). The body always carries `id`, so the worker upserts the grouped
  store (id required since v1.6.0). `DEFAULT_ENDPOINT` = the deployed worker.
  Tested (`store-server.test.js`).
- [x] **3.2** **Save → GitHub is the one primary Save** (edit-mode icon, all
  browsers). `SAVE_KEY` via a lean **key-prompt on save** (`ed-save-key.js`), held
  **in memory only** (never `localStorage`); endpoint hardcoded (a Settings panel
  and overridable URL are deferred — not needed for one field).
- [x] **3.3** **Export** — portable `.json` download (`store-export.js`), replacing
  the retired `store-file.js` (deleted). Works in every browser.
- [x] **3.4** **Overlay reconciliation on success** — `reconcileOverlay()` clears
  the saved `meta`/`items`/`wealth` keys so the branch read is the source of truth
  (design §4.5). Unsaved dot driven by `hasPendingEdits()`.
- [x] **3.5** UI rules honored: key-prompt modal Escape-closes / Enter-confirms,
  theme-aware, viewport; data-down/dispatch-up preserved (views dispatch, `ed-app`
  saves).

### Phase 4 — Tests (CLAUDE)

- [x] **4.1** `node --test` on the worker (mocked GitHub `fetch`): missing/wrong
  key → 401; bad JSON / wrong schema / oversize → 400; grouped-store upsert PUTs
  with the GET-returned `sha`; `409` → bounded retry → success.
  ✅ Done in 2.1 — `worker.test.js` ships with the scaffold (green). Also
  covers unconfigured-key → 401, branch-creation, and non-409 → 502 mapping. The
  missing/wrong-key cases exercise the constant-time `safeEqual` path (§5.2b).
  Extended for multi-character: an `id` upserts `characters[id]` and preserves
  the other entries, invalid ids → `400 invalid_id`, and a `404` store is
  created fresh (docs/PLAN-MULTI-CHARACTER.md Phase E). Since v1.6.0 the id is
  **required** — the legacy no-id path and its tests were removed.

### Phase 5 — Docs & status flip (CLAUDE)

- [x] **5.1** Flipped design doc §5/§7 and ARCHITECTURE §7/§10 "not built" →
  "shipped"; recorded **SAVE_KEY required**. Also folded in the consolidated save
  model and the API-first read.
- [x] **5.2** Runbook status line + §7 updated with the live URL and dates.
- [x] **5.3** Changelog entries (player-facing) for Save/Export + the read fix,
  cut into **v1.5.0** (2026-08-06).

### Phase 6 — End-to-end verification (YOU drive, CLAUDE checks)

> **Use the deployed dev site** (`https://odenson.github.io/dev/`), not localhost:
> the worker's CORS allows the `odenson.github.io` origin only, so a real save
> only works from `/` or `/dev/`. (`dev` was pushed 2026-08-06, commit `c2593e1`.)

- [✅] **6.1** On the dev site, enter edit mode (✎) → click **Save** → the key
  prompt appears → paste the SAVE_KEY → Save. Edit a value first so there's
  something to commit. Expect a success toast + commit link.
- [✅] **6.2** Reload → the edited value persists (read live from the branch) with
  the overlay reconciled (no stale mask).
  > **Passed after a fix (commit `7e6b8ab`).** First run showed the pre-save copy:
  > the raw CDN keys its ~5-min cache on the path, so the `?t=` cache-buster didn't
  > reliably force a fresh read and the reload raced a stale edge copy. `store.js`
  > now reads via the git-consistent GitHub contents API (raw CDN → bundle as
  > fallbacks); re-test confirmed the save appears immediately on reload.
- [✅] **6.3** Wrong key → clean error toast, no commit; the next Save re-prompts.
- [✅] **6.4** **Export** (download icon) → a `.json` copy downloads (works here and
  in Firefox/Safari/mobile).

---

## 5. Artifacts reference

### 5.1 `tools/worker/wrangler.toml`

```toml
name = "ed-charsheet-save"
main = "worker.js"
compatibility_date = "2026-08-06"

[observability]
enabled = true

[observability.logs]
head_sampling_rate = 1

[vars]
GITHUB_OWNER    = "odenson"
GITHUB_REPO     = "ed-charSheet"
GITHUB_STORE    = "data/characters.json"
GITHUB_ITEMS_PATH = "data/custom-items.json"
GITHUB_BRANCH   = "character-data"
```

Secrets (`GITHUB_TOKEN`, `SAVE_KEY`) are **not** in this file — they're set with
`wrangler secret put` and stored in Cloudflare.

### 5.2 Deviations from the design sketch (both tighten security)

**(a) Key required, fail closed.** The design §4.2 handler treats the key as
optional:

```js
if (env.SAVE_KEY && request.headers.get("x-save-key") !== env.SAVE_KEY)  // optional
```

This build makes it mandatory — a missing/wrong key **or** an unconfigured
`SAVE_KEY` is rejected `401`.

**(b) Constant-time comparison.** The check does **not** compare the key with
`!==` (a timing side-channel flagged by the Workers best-practices review); it
hashes both sides to a fixed 32 bytes and compares in constant time (`safeEqual`,
using only `crypto.subtle.digest` so it runs on the Workers runtime and under
`node --test` alike). Absence of the header short-circuits — that fact is not
itself secret:

```js
const providedKey = request.headers.get("x-save-key");
if (!env.SAVE_KEY || providedKey === null || !(await safeEqual(providedKey, env.SAVE_KEY)))
  return json(cors, 401, { ok: false, error: { code: "unauthorized", message: "bad or missing save key" } });
```

Everything else in the §4.2 handler (schema/size validation, env-pinned
path/branch, GET-sha then PUT, bounded 409 retry, CORS) stays as written. Two
further additions from the same review, reflected in §5.1's `wrangler.toml`: a
current `compatibility_date`, and `[observability]` enabled with structured
`console.error` logging on upstream failures (so `wrangler tail` in §2.5 shows
why a save failed).

### 5.3 App save target

`saveServer(character, { endpoint, saveKey, id })` per design §4.5 — POSTs
`{ character, id }` (the id is **required** since v1.6.0 — the grouped store is
the only save target) with the `x-save-key` header, returns `{ sha, url }` or
throws a typed `SaveError`. The id keeps the app's per-character edits
(`ed-character-edits:${id}` overlay) and branch writes aligned on the same
character.

---

## 6. Verification, recovery & rotation

- **Confirm a save:** the `commit.url` in the 200 response opens the commit on the
  `character-data` branch; the app shows the new data on next load.
- **Recover from a bad save:** save again with correct data, or revert the branch
  commit on GitHub. The `main`/`dev` app bundles are never touched by a save.
- **Disable the feature:** turn the Settings toggle off (app), or
  `npx wrangler delete` the worker (endpoint). Reads keep working — the character
  (and portrait) live on the `character-data` branch regardless of the worker.
- **Rotate the PAT:** before expiry, generate a new fine-grained PAT (1.1) and
  `npx wrangler secret put GITHUB_TOKEN` again. Rotate the SAVE_KEY the same way.

---

## 7. Live values & progress (fill in as you go)

| Item | Value / date |
|---|---|
| Worker URL | `https://ed-charsheet-save.edsavechar.workers.dev` (POST `/save`) |
| PAT created / expires | 2026-08-06 / ~2026-11-04 (90d — rotate before, §6) |
| SAVE_KEY set | 2026-08-06 |
| Deployed | 2026-08-06 (smoke-test 200 + commit; `character-data` branch created) |
| App integration merged | 2026-08-06 on `dev` (commit `c2593e1`); read fix `7e6b8ab` |
| Docs flipped to "shipped" | 2026-08-06 — released as **v1.5.0** |
| Multi-character store | `GITHUB_STORE` + `id` upsert shipped (docs/PLAN-MULTI-CHARACTER.md, Phases A–E); store deployed to `character-data` |
| v1.6.0 promotion | Released 2026-08-07 — grouped store is the only save target; legacy `GITHUB_PATH`/`data/character.json` and the worker no-`id` path removed. **Redeploy the worker after this release** (`npx wrangler deploy`). |
| Custom items (`/save-items`) | Built (PLAN-CUSTOM-ITEMS.md P1–P6); worker route + `GITHUB_ITEMS_PATH` shipped. **Phase B verified 2026-08-09** — all four smoke curls passed (401 / 400 invalid_items / 200 upsert + branch file / 200 delete). Owner rollout runsheet: §8 below. |

---

## 8. Custom items — build & rollout runsheet

The companion write endpoint (`/save-items`) and the CI fold job
(docs/PLAN-CUSTOM-ITEMS.md). Claude built the code and tests (Phases 1–6 of the
plan); the **owner** deploys the worker and verifies live, exactly like the
original rollout above. Work top-to-bottom; status boxes track it.

### Phase A — Prereqs check (YOU)

- [x] **A1. Branch protection** stays off on `main`/`dev` (the fold's
      ephemeral-token direct push to `dev` depends on it):
  ```bash
  gh api repos/Odenson/ed-charSheet/branches/main/protection --jq .message  # expect: Branch not protected
  gh api repos/Odenson/ed-charSheet/branches/dev/protection   --jq .message  # expect: Branch not protected
  ```
- [x] **A2. Cloudflare session.**
  ```bash
  cd tools/worker && npm install && npx wrangler whoami
  ```
  **No new PAT, no new SAVE_KEY** — both existing secrets are reused as-is; the
  only new config is the `GITHUB_ITEMS_PATH` var already in `wrangler.toml`.

### Phase B — Worker update (YOU)

- [x] **B1. Get the code.** `git switch dev && git pull` — sync only; run after
      your dev work is committed and pushed, skip if local dev is current. (A
      `git pull` never overwrites untracked files or uncommitted edits — it
      aborts rather than clobber. See PLAN-CUSTOM-ITEMS.md §6.6.)
- [x] **B2. Deploy.** `npx wrangler deploy` — `/save-items` ships beside `/save`;
      URL unchanged; no new secrets.
- [ ] **B3. Smoke-test `/save-items`** (from the repo root):
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
- [x] **B3. Smoke-test `/save-items`** — all four curls passed 2026-08-09.
- [x] **B4. Record** in the plan's Progress log: route verified, date (done).

### Phase C — Fold job (YOU)

> **Read this first — Phase C has hard prerequisites Phase B didn't** (plan §6.6
> P6 note): the fold cannot run until the workflow file exists on GitHub, and
> *where* depends on the trigger you want. None of the code is committed yet —
> C0 is the first thing to do.

- [ ] **C0. Deploy the change.** Commit + push everything to `dev` (workflow
      file, `tools/fold-custom-items.mjs`, `engine/validate-item.js`, the
      UI/store modules). Verify:
      `gh api "repos/Odenson/ed-charSheet/contents/.github/workflows/fold-custom-items.yml?ref=dev" --jq '.sha'`
- [ ] **C1. (Pre-main) put the workflow on `character-data`** — a `push` trigger
      only fires if this file exists on the branch being pushed, and the
      worker's `/save-items` writes only `data/custom-items.json`. Commit the
      file to `character-data` once (later worker PUTs inherit it). Then push a
      test save via Phase B3c and confirm **Actions** → **Fold custom items**
      ran → verify: `gh api "…/contents/rules/custom-items.json?ref=dev" --jq '.sha'`.
      (Post-main, skip C1 — the manual button below works instead.)
- [ ] **C2. (Post-main) manual run.** Actions → **Fold custom items** → **Run
      workflow**; verify: `gh api "…/contents/rules/custom-items.json?ref=dev" --jq '.sha'`.
- [ ] **C3.** **Deploy to GitHub Pages** ran from the fold's dev push; `/dev/`
      rebuilt (both instances rebuild; main's tree unchanged).

### Phase D — End-to-end (YOU drive, CLAUDE checks)

> Use the deployed dev site `https://odenson.github.io/dev/` — the worker's CORS
> allows the `odenson.github.io` origin only.

- [ ] **D1.** Edit mode (✎) → Equipment → **Custom items** → create
      (name/kind/effect via the form) → **Save** (reuses the SAVE_KEY session;
      prompts once if absent) → success toast + commit link.
- [ ] **D2.** The item is in `data/custom-items.json` on `character-data`
      (commit link, or the B3c `gh api` command).
- [ ] **D3.** Picker shows it; add it to a character; switch characters → still
      available (re-read on switch).
- [ ] **D4.** Reload → persists; overlay reconciled (no stale mask).
- [ ] **D5.** Fold ran → `rules/custom-items.json` on dev updated → `/dev/`
      rebuilt → reload still shows it (bundled fallback path).
- [ ] **D6.** Error path: go offline → edit → Save fails → overlay holds the
      pending item (still usable), Save dot shows → online → Save → reconciled.
- [ ] **D7.** Collision: create a custom item sharing a canon name → custom's
      effects win, override notice shown.
- [ ] **D8.** Delete a custom item → gone from branch + picker + folded file
      (mirror semantics).
- [ ] **D9.** Escape closes the modal without saving; Enter saves; light and
      dark both render correctly; desktop viewport fits without vertical scroll.

### Phase E — Release (YOU)

- [ ] **E1.** Nothing special: the feature + first `rules/custom-items.json` ride
      the next normal dev→main squash release PR (WORKFLOW.md §2). A fold landing
      mid-release just joins that PR's diff (expected).

---

## References

- [GITHUB-SERVERLESS-SAVE.md](GITHUB-SERVERLESS-SAVE.md) — design (why/how it works)
- [PLAN-CUSTOM-ITEMS.md](PLAN-CUSTOM-ITEMS.md) — the custom-items feature the `/save-items` fold/rollout implements (§8 of the runbook = the plan's owner phases)
- [ARCHITECTURE.md](../ARCHITECTURE.md) — §7.4/§7.5 save targets, §10 status
- [WORKFLOW.md](../WORKFLOW.md) — deploy model; why `character-data` never rebuilds
- [store.js](../store.js) — the live read this write half pairs with
