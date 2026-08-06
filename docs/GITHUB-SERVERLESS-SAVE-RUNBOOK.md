# Serverless Save — Implementation Runbook

The build-and-rollout companion to the design doc
[GITHUB-SERVERLESS-SAVE.md](GITHUB-SERVERLESS-SAVE.md). That doc explains **what
the feature is and why**; this one is the **written reference and runsheet** for
building it — including the manual steps the repo owner completes.

> Status: **planned, not started.** Nothing here has been built. The runsheet in
> §4 is the source of truth for progress; check items off as they complete.

---

## 0. Decisions locked for this build

| Decision | Choice | Notes |
|---|---|---|
| Host | **Cloudflare Worker** | Free tier, one file, `wrangler` deploy |
| Worker code location | **`tools/worker/`** in this repo | `tools/` is excluded from the Pages build, so it never deploys as part of the site |
| Endpoint auth | **`SAVE_KEY` required (fail closed)** | Deviation from the design doc's *optional* default — recorded in §5/§7 of the design doc when we ship |
| SAVE_KEY in the app | **Session-only, in memory** | Entered in Settings each session; never written to `localStorage` |
| Endpoint URL in the app | Hardcoded default, overridable in Settings | The default is filled in once the worker is deployed |

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
| `GITHUB_PATH` | var | `data/character.json` | `wrangler.toml [vars]` |
| `GITHUB_BRANCH` | var | `character-data` | `wrangler.toml [vars]` |

Only the two **secrets** are sensitive; the four vars are plain config and live
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

- [ ] **1.1 Create the fine-grained PAT.** GitHub → your avatar → **Settings** →
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

- [ ] **1.2 Generate the SAVE_KEY.**
  ```bash
  openssl rand -hex 32
  ```
  Copy the 64-character output. This is your private save key — you'll paste it
  into a Cloudflare secret (2.3) and into the app when saving (Phase 6).

### Phase 2 — Worker

- [ ] **2.1 [CLAUDE] Scaffold `tools/worker/`.** Claude adds `worker.js` (design
  §4.2 handler, `SAVE_KEY` **required** per §2.1), `wrangler.toml` (§5.1 below),
  `package.json` (wrangler dev-dep), and `worker.test.js`. *No secrets, no deploy.*

- [ ] **2.0 [YOU] Cloudflare account.** If you don't have one, sign up free at
  cloudflare.com. No credit card needed for Workers free tier.

- [ ] **2.2 [YOU] Install wrangler + log in.**
  ```bash
  cd tools/worker
  npm install
  npx wrangler login          # opens a browser to authorize Cloudflare
  ```

- [ ] **2.3 [YOU] Set the two secrets.** Each prompts for the value — paste it
  (input is hidden); nothing is written to disk.
  ```bash
  npx wrangler secret put GITHUB_TOKEN     # paste the PAT from 1.1
  npx wrangler secret put SAVE_KEY         # paste the hex from 1.2
  ```
  (The four `GITHUB_OWNER/REPO/PATH/BRANCH` vars are already in `wrangler.toml`;
  no action needed.)

- [ ] **2.4 [YOU] Deploy.**
  ```bash
  npx wrangler deploy
  ```
  On the **first** deploy Cloudflare may ask you to register a `*.workers.dev`
  subdomain (one-time). Deploy prints the endpoint, e.g.
  `https://ed-charsheet-save.<your-subdomain>.workers.dev`.

- [ ] **2.5 [YOU] Smoke-test.** From the repo root, with your values:
  ```bash
  WORKER="https://ed-charsheet-save.<your-subdomain>.workers.dev"
  KEY="<your-save-key>"

  # (a) No key → expect HTTP 401
  curl -sS -X POST "$WORKER/save" -H 'Content-Type: application/json' \
    -d '{"schema":"ed-character/1"}' -w '\n%{http_code}\n'

  # (b) Correct key, real file → expect HTTP 200 + a commit URL (writes a real
  #     commit to character-data; harmless — it's the current character)
  curl -sS -X POST "$WORKER/save" -H 'Content-Type: application/json' \
    -H "x-save-key: $KEY" --data-binary @data/character.json -w '\n%{http_code}\n'
  ```
  Pass = (a) `401` unauthorized, (b) `200` with `commit.url`. If (b) fails, check
  the worker logs: `npx wrangler tail` while re-running the curl.

- [ ] **2.6 [YOU] Record the URL.** Paste the `$WORKER` URL back to Claude for
  Phase 3, and note it in §7 below.

### Phase 3 — App integration (CLAUDE)

- [ ] **3.1** `store-server.js` — `saveServer(character, { saveKey })` POST to the
  endpoint (design §4.5), with typed errors.
- [ ] **3.2** Settings: a **"Save to GitHub"** toggle + a SAVE_KEY field held **in
  memory only** (never `localStorage`); the endpoint URL defaults to the deployed
  worker and is overridable.
- [ ] **3.3** Wire as a third Save target in edit mode (web store + file + server).
- [ ] **3.4** **Overlay reconciliation on success** — clear the saved
  `meta`/`items`/`wealth` keys from the `localStorage` edits overlay so the branch
  read is the source of truth (design §4.5 "Reconcile the overlay").
- [ ] **3.5** Honor UI rules: Escape-closes / Enter-confirms, theme-aware, viewport.

### Phase 4 — Tests (CLAUDE)

- [ ] **4.1** `node --test` on the worker (mocked GitHub `fetch`): missing/wrong
  key → 401; bad JSON / wrong schema / oversize → 400; happy path PUTs with the
  GET-returned `sha`; `409` → bounded retry → success.

### Phase 5 — Docs & status flip (CLAUDE)

- [ ] **5.1** Flip design doc §5/§7 and ARCHITECTURE §7.5/§10 from "not built" →
  "shipped"; record **SAVE_KEY required**.
- [ ] **5.2** Update this runbook's status line and §7 with the live URL and dates.
- [ ] **5.3** Changelog entry (player-facing) for the new Save target.

### Phase 6 — End-to-end verification (YOU drive, CLAUDE checks)

- [ ] **6.1** On the dev Pages site, enable "Save to GitHub", enter the SAVE_KEY,
  edit a value, Save → expect a success + commit URL.
- [ ] **6.2** Reload → the edited value persists (read live from the branch) with
  the overlay reconciled (no stale mask).
- [ ] **6.3** Wrong key → clean error, no commit.

---

## 5. Artifacts reference

### 5.1 `tools/worker/wrangler.toml`

```toml
name = "ed-charsheet-save"
main = "worker.js"
compatibility_date = "2025-01-01"

[vars]
GITHUB_OWNER  = "odenson"
GITHUB_REPO   = "ed-charSheet"
GITHUB_PATH   = "data/character.json"
GITHUB_BRANCH = "character-data"
```

Secrets (`GITHUB_TOKEN`, `SAVE_KEY`) are **not** in this file — they're set with
`wrangler secret put` and stored in Cloudflare.

### 5.2 The SAVE_KEY-required change vs the design sketch

The design §4.2 handler treats the key as optional:

```js
if (env.SAVE_KEY && request.headers.get("x-save-key") !== env.SAVE_KEY)  // optional
```

This build makes it mandatory (fail closed):

```js
if (!env.SAVE_KEY || request.headers.get("x-save-key") !== env.SAVE_KEY)  // required
  return json(cors, 401, { ok: false, error: { code: "unauthorized", message: "bad or missing save key" } });
```

Everything else in the §4.2 handler (schema/size validation, env-pinned
path/branch, GET-sha then PUT, bounded 409 retry, CORS) stays as written.

### 5.3 App save target

`saveServer(character, { endpoint, saveKey })` per design §4.5 — POSTs
`{ character }` with the `x-save-key` header, returns `{ sha, url }` or throws a
typed `SaveError`.

---

## 6. Verification, recovery & rotation

- **Confirm a save:** the `commit.url` in the 200 response opens the commit on the
  `character-data` branch; the app shows the new data on next load.
- **Recover from a bad save:** save again with correct data, or revert the branch
  commit on GitHub. The `main`/`dev` app bundles are never touched by a save.
- **Disable the feature:** turn the Settings toggle off (app), or
  `npx wrangler delete` the worker (endpoint). Reads keep working via the bundle
  fallback.
- **Rotate the PAT:** before expiry, generate a new fine-grained PAT (1.1) and
  `npx wrangler secret put GITHUB_TOKEN` again. Rotate the SAVE_KEY the same way.

---

## 7. Live values & progress (fill in as you go)

| Item | Value / date |
|---|---|
| Worker URL | _(from 2.4)_ |
| PAT created / expires | _/_ |
| SAVE_KEY set | _date_ |
| Deployed | _date_ |
| App integration merged | _date_ |
| Docs flipped to "shipped" | _date_ |

---

## References

- [GITHUB-SERVERLESS-SAVE.md](GITHUB-SERVERLESS-SAVE.md) — design (why/how it works)
- [ARCHITECTURE.md](../ARCHITECTURE.md) — §7.4/§7.5 save targets, §10 status
- [WORKFLOW.md](../WORKFLOW.md) — deploy model; why `character-data` never rebuilds
- [store.js](../store.js) — the live read this write half pairs with
