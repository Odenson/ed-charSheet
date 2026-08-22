# GitHub Serverless Save — the one sanctioned backend exception

A feature-design document for the write endpoint introduced in ARCHITECTURE.md
§7.5. It covers three things, in order: **how the feature works**, **how it is
built and implemented**, and **what (if anything) it changes in the existing
app**.

> Status: **shipped** (v1.5.0, 2026-08-06). The primary Save. It is the single
> documented exception to the project's **"no backend, no external runtime
> dependency"** rule (ARCHITECTURE §2, goal 1). This build **requires** the
> `SAVE_KEY` (fail-closed) — see the runbook §2.1.

---

## 1. What it is

Two tiny write endpoints — a single Cloudflare Worker (the decided host, §4.1;
Deno Deploy and a Vercel function are portability alternatives) — that commit
the character store (one file per character, `data/characters/<id>.json`, via
`/save`) **and** the shared custom-item catalog `data/custom-items.json` (via
`/save-items`) to the repo **on the app's behalf**, so the GitHub credential
never enters the browser. The `/save-items` route (plans/PLAN-CUSTOM-ITEMS.md)
mirrors `/save` exactly: same CORS, same fail-closed `x-save-key`, same GET-sha
→ PUT bounded-409-retry write to the `character-data` branch, with every item
validated by the shared `engine/validate-item.js` gate before the commit.

This is now the app's **one primary Save** (v1.5.0): the app `POST`s the merged,
inputs-only character; the worker does the GitHub API round-trip to a dedicated
**data branch** (`character-data`); the app reads the committed file live at
runtime, so a save **never rebuilds or redeploys the app**. It sits over an
always-on autosave overlay, with a portable Export for local backups (the earlier
File System Access file save is retired — see ARCHITECTURE §7 and §4.5).

### 1.1 Relationship to the other GitHub save idea (§7.4)

| | §7.4 Save directly to GitHub | §7.5 Serverless save (this doc) |
|---|---|---|
| Where the GitHub credential lives | Browser, in-memory for the session (OAuth device flow; fine-grained PAT fallback) | Server-side, in the platform's secret store |
| Credential exposure | A credential is present in the page during the session | The page never sees the GitHub token |
| Backend | None (all client-side) | One third-party endpoint — the sanctioned exception |
| Constraint | — | Ships **instead of** §7.4 for players who use it, **never in addition to it** |

Both targets are purely alternate Save destinations for the same
inputs-only `character.json`. They never stack.

---

## 2. Why it exists

Three Save targets, and the gap this one fills:

| Save target | Works offline | No manual commit | No credential in the browser |
|---|---|---|---|
| Web store + file save (§7.1–7.2) | ✅ | ❌ (manual `git commit && git push`) | ✅ |
| GitHub-direct (§7.4) | ❌ | ✅ | ❌ |
| **Serverless save (this doc)** | ❌ (server-save only) | ✅ | ✅ |

Server-save trades a network dependency and one third-party hop for "the token
never touches the page." The web-store + local-file path stays the default and
the only offline path; this is strictly an additional option.

---

## 3. How it works

### 3.1 The flow

```
   Browser (the app)                    Worker (this feature)                  GitHub
┌──────────────────────┐   POST /save   ┌───────────────────────────────┐   ┌────────────────┐
│ Save action          │ ─────────────► │ 1. validate character + id    │   │ branch created │
│ serialize the same   │  { character, │ 2. ensure the data branch     │──►│ read SHA       │
│ inputs-only JSON     │    id, base } │ 3. GET contents/<id>.json     │──►│                │
│ (identical to §7.2)  │                │    ?ref=character-data        │◄──│ commit         │
│                      │ ◄───────────── │ 4. compare base vs file sha   │──►│ on the branch  │
│ show commit URL /    │  200 {commit}  │ 5. PUT contents/<id>.json     │   └────────────────┘
│ error (409 retried)  │                └───────────────────────────────┘
└──────────────────────┘
   No deploy, no rebuild: the deploy workflow (WORKFLOW.md) watches main and dev
   only. On its next load the Pages app fetches the character file LIVE from the
   committed branch (store.js) and selects the saved character by id:
   https://raw.githubusercontent.com/{owner}/{repo}/character-data/data/characters/<id>.json
```

1. **App serializes.** The Save action produces the exact bytes the file save
   produces: the merged, inputs-only character, `JSON.stringify(…, 2) + '\n'`
   (§7.2). Nothing about the data model changes.
2. **App POSTs.** The worker's single endpoint `/save`, body
   `{ "character": { … }, "id": "…", "base": "…" }` — the `id` names the
   character's file, and `base` is the **optimistic-concurrency token**: the
   file's blob sha this client last saw (from the read's ETag or the previous
   save's response). Omitting `base` takes the legacy overwrite path (local dev /
   CDN-fallback sessions have no ETag).
3. **Worker validates.** JSON parses, `schema` is `"ed-character/1"` or
   `"ed-character/2"` (current tag `/2` — talent `tier` stripped as derived;
   `/1` files keep saving until each is rewritten), byte size
   within the cap, `id` matches `^[a-z0-9][a-z0-9-]{0,63}$` (also a safe
   filename), `base` is a string or omitted, path and branch come from its own
   config, not the request.
4. **Worker commits.** To the `character-data` branch (created on the first
   save, skipped after): `GET …/contents/{GITHUB_CHARS_DIR}/{id}.json?ref=
   character-data` → the file's current blob `sha`; **compare `base` against that
   sha**:
   - base missing or equal → `PUT` the new content (the `PUT`'s own `sha`
     precondition is the *same* sha just read, so a racing save 409s and is
     handled below);
   - base **stale** → `409 { code: "stale_base", sha: <current sha> }` — no
     write, no retry: the client must resolve the conflict (keep mine / take
     theirs, §4.5).
   - file missing (`404`) → **create** it (a brand-new character), and add an
     entry to the discovery index `data/characters/index.json` (`{ "<id>": {
     name, portrait } }`) — the index is written **only on create**, never on a
     save, and never read for a save.
5. **No rebuild.** The deploy workflow (WORKFLOW.md) fires on `main` and `dev`
   only; `character-data` is not a trigger, so a save never rebuilds the app. The
   character file is source info the app reads at runtime — it needs no build.
6. **Feedback.** Worker returns the commit URL and the **new blob sha** (the
   client's next `base`). On a read→write `409` for a base-carrying save (the
   sha moved between the GET and the PUT), the worker returns `stale_base` with
   the fresh sha — it does **not** silently retry, because a retry would clobber
   the other writer. No-base (legacy) saves keep the bounded 3× retry.
7. **Live read.** On its next load the Pages app fetches the committed character
   file live from the branch (`store.js`) and selects the character whose `id`
   matches the app's selection. Both `/` and `/dev/` read the same branch, so the
   two environments show the same character.

**The discovery index (`data/characters/index.json`).** The picker lists
character *names* (+ portrait thumbnails, UI-GUIDELINES §6a); a directory listing
would give only filenames and force an N+1 fetch on every picker open. The index
(`{ schema: "ed-characters-index/1", characters: { "<id>": { name, portrait? }
} }`) answers that in one fetch. It is **never trusted for save bases** — bases
come only from file reads and save responses — so a stale index (a rename or a
changed portrait leaves the entry lagging, the file's `meta.name`/`meta.portrait`
being authoritative) can mis-label a picker row but can never corrupt a save or
cause a false conflict.

**The companion write — `/save-items`.** The same flow, for the player-created
custom-item catalog (`data/custom-items.json`, `ed-items/2`) instead of the
character store: the app POSTs a delta `{ items: { "<name>": <item> }, delete?:
[…] }`; the worker validates every item and the *merged* file through the shared
`engine/validate-item.js` gate (fail-closed → `400 invalid_items`), merges the
items onto the branch catalog (custom wins on a canon-name collision), applies
the deletes, and commits the whole file — the same bounded 409 retry. The
catalog is shared by all characters and both environments, and a CI fold job
(tools/fold-custom-items.mjs) mirrors it into `rules/custom-items.json` on `dev`
for durability/versioning (PLAN-CUSTOM-ITEMS.md §3).

### 3.2 Request / response contract

| | Value |
|---|---|
| Endpoint | `POST https://<worker>/save` — character file (`data/characters/<id>.json`) |
| Headers | `Content-Type: application/json`; `x-save-key` (required — fail-closed, §5) |
| Body | `{ "character": <inputs-only ed-character/1 JSON>, "id": <required file name>, "base"?: <blob sha, string> }` |
| 200 | `{ "ok": true, "commit": { "sha": "…", "url": "https://github.com/…/commit/…" } }` — `commit.sha` is the **new blob sha**, the client's next `base` |
| 400 | `{ "ok": false, "error": { "code": "invalid_json" \| "invalid_character" \| "invalid_id" \| "invalid_base", "message": "…" } }` — `invalid_base`: `base` present but not a string |
| 401 | `{ "ok": false, "error": { "code": "unauthorized", "message": "bad save key" } }` |
| 404 | `{ "ok": false, "error": { "code": "not_found", "message": "POST /save or POST /save-items only" } }` |
| 409 | `{ "ok": false, "error": { "code": "stale_base", "message": "…", "sha": "<current blob sha>" } }` — the character changed on the branch since the client's `base`; **no write, no retry**. No-base (legacy) saves retry internally (bounded, 3 attempts); only surfaced if retries exhaust |
| 502/504 | Upstream GitHub failure; `{ "ok": false, "error": { "code": "upstream", "message": "…" } }` |

| | Value |
|---|---|
| Endpoint | `POST https://<worker>/save-items` — custom-item catalog (`data/custom-items.json`, `ed-items/2`) |
| Headers | Same as `/save` (`x-save-key` required, fail-closed) |
| Body | `{ "items": { "<name>": <item> }, "delete"?: ["<name>", …] }` |
| 200 | `{ "ok": true, "commit": { "sha": "…", "url": "…" } }` |
| 400 | `{ "ok": false, "error": { "code": "invalid_items", "message": "…" } }` — every item and the merged file pass the shared `engine/validate-item.js` gate before any PUT |
| 401 / 404 / 409 / 502 | Same as `/save` |

CORS: the worker must answer cross-origin calls from the Pages origin, including
an `OPTIONS` preflight for the JSON `POST` (and the `x-save-key` header when
used).

---

## 4. How it is built and implemented

### 4.1 Host — Cloudflare Worker (decided)

**Chosen: Cloudflare Workers.** This is a decision recorded for the record, not a
default by habit; the comparison that settled it lives here so it can be
revisited. (Figures as of mid-2026 — re-verify on the vendor pricing pages
before relying on them.)

| | Cloudflare Workers | Deno Deploy | Vercel Functions |
|---|---|---|---|
| Free tier | 100k requests/**day** (~3M/mo), 10 ms CPU/req, 128 MB mem, 50 subrequests/req | 1M requests/**month**, 100 GB egress, 50 ms CPU/req, ~15 h CPU/mo, 1 GiB KV | Hobby: ~100 GB/mo transfer, modest function invocations, **non-commercial** use only |
| Paid floor | $5/mo (10M req + 30M CPU-ms incl.) | $20/mo (Pro) | $20/mo (Pro) |
| Billing model | Requests + CPU-ms; I/O wait is free | Monthly request/egress allowances | "Fluid Compute" Active CPU + invocation; the most overage-surprise-prone of the three |
| Secrets | `wrangler secret put` (encrypted) | Project env vars / secrets (dashboard) | Project env vars (settings) |
| Deploy | `wrangler` CLI (or Git via Workers Builds) | Git push → auto-deploy, or `deployctl` CLI | `vercel` CLI or Git integration |
| Our sketch (§4.2) | Drop-in (`export default { fetch }`, `btoa`, env) | Near drop-in (web-standard APIs) | Needs an `api/` route wrapper + `process.env` |
| Fit | Edge network; strongest abuse protection; most stable vendor | Edge, but free-tier terms have shifted historically; smaller vendor | Framework-coupled (Next.js); zero synergy with a GitHub Pages app |

What settles it for *this* endpoint — a stateless, occasional-use proxy (1
inbound POST → 1–3 GitHub calls per save, most latency in the GitHub
round-trip):

- **Request volume is a non-factor.** Every free tier is orders of magnitude
  larger than the feature needs; the comparison is about everything *else*.
- **CPU caps don't bind.** The work is I/O-bound — waiting on GitHub's API is
  free against Cloudflare's 10 ms CPU budget. 128 MB and 50 subrequests are
  likewise ample.
- **Cold starts don't matter.** A save is user-initiated; an occasional
  ~100–500 ms cold start is imperceptible on all three.
- **CORS is identical** — manual headers in the handler, same code on all three.

Cloudflare wins on: the sketch drops in unchanged; the most generous *and* most
stable free tier (100k requests/day, no credit card, no commercial-use clause);
and the strongest built-in abuse protection for an endpoint that is intentionally
open (§5). Deno Deploy is the close second (zero-CLI, push-to-deploy) if the
constraint set ever changes; Vercel adds setup and billing complexity and shares
no stack with the GitHub Pages app. The handler is written to the web-standard
fetch surface, so both portability paths stay real. The choice does not leak
into the app — the app only needs the endpoint URL.

### 4.2 Worker source

A single ES-module handler. Design sketch:

```js
// worker.js — GitHub serverless save endpoint (design sketch, not shipped)
// POST /save  { "character": <inputs-only ed-character/1 JSON>, "id": <file name>, "base"?: <blob sha> }
// POST /save-items  { "items": { "<name>": <item> }, "delete"?: ["<name>", …] }  (shipped worker)
// Shipped worker differs: SAVE_KEY fail-closed auth (§5), the two routes above,
// and the write targets ONE file per character — GET contents/<id>.json (sha),
// compare the request `base` (stale → 409 stale_base + sha, no retry), PUT the
// raw ed-character/1 content; a 404 creates the file and adds a
// data/characters/index.json entry (name + portrait) on create only. The legacy
// grouped-store upsert shown below was removed with the per-character split.
const JSON_HEADERS = { "Content-Type": "application/json" };
const GITHUB = "https://api.github.com";
const MAX_BYTES = 512 * 1024;                 // character.json is a few KB; cap generously
const MAX_RETRIES = 3;                        // bounded 409 (sha moved) retries

export default {
  async fetch(request, env) {
    const origin = "https://odenson.github.io";   // or request.headers.get("Origin") allow-listed
    const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
                   "Access-Control-Allow-Headers": "Content-Type, x-save-key" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/save" || request.method !== "POST")
      return json(cors, 404, { ok: false, error: { code: "not_found", message: "POST /save only" } });

    // Optional shared key (see §5). Default: no key — the endpoint is open by design.
    if (env.SAVE_KEY && request.headers.get("x-save-key") !== env.SAVE_KEY)
      return json(cors, 401, { ok: false, error: { code: "unauthorized", message: "bad save key" } });

    let character;
    try {
      const body = await request.json();
      character = body.character ?? body;      // accept { character } or the file itself
    } catch {
      return json(cors, 400, { ok: false, error: { code: "invalid_json", message: "body is not JSON" } });
    }
    if (!isValidCharacter(character))
      return json(cors, 400, { ok: false, error: { code: "invalid_character", message: "not an ed-character/1 file" } });

    const path = env.GITHUB_PATH ?? "data/character.json";
    const branch = env.GITHUB_BRANCH ?? "character-data";  // NOT main/dev — never triggers a deploy
    const repo = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const gh = { "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const content = btoa(JSON.stringify(character, null, 2) + "\n");   // byte-identical to §7.2

    await ensureBranch(repo, branch, gh);                              // first save only
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const sha = await currentSha(repo, path, branch, gh);            // step 3.4 (4)
      const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}`, {
        method: "PUT", headers: { ...gh, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Save character (serverless)", content, sha, branch }) });
      if (res.ok) {
        const c = await res.json();
        return json(cors, 200, { ok: true, commit: { sha: c.content.sha, url: c.html_url } });
      }
      if (res.status !== 409)                                         // step 3.4 (5) — other failure
        return json(cors, 502, { ok: false, error: { code: "upstream", message: `github ${res.status}` } });
    }                                                                 // 409: sha moved — loop re-reads and retries
    return json(cors, 409, { ok: false, error: { code: "conflict", message: "sha kept moving" } });
  },
};

// First save on a fresh repo: create the data branch from the default branch so
// the contents API has a ref to write into. No-op on every later save.
async function ensureBranch(repo, branch, gh) {
  const head = await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${branch}`, { headers: gh });
  if (head.ok) return;
  const meta = await (await fetch(`${GITHUB}/repos/${repo}`, { headers: gh })).json();
  const base = await (await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${meta.default_branch}`, { headers: gh })).json();
  const created = await fetch(`${GITHUB}/repos/${repo}/git/refs`, {
    method: "POST", headers: { ...gh, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
  if (!created.ok) throw new Error(`create branch ${created.status}`);
}

async function currentSha(repo, path, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}?ref=${branch}`, { headers: gh });
  if (!res.ok) throw new Error(`read ${res.status}`);
  return (await res.json()).sha;
}

function isValidCharacter(c) {
  return !!c && typeof c === "object" && c.schema === "ed-character/1" &&
         JSON.stringify(c).length <= MAX_BYTES;
}

function json(cors, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors } });
}
```

Key properties:
- **Stateless.** No database, no storage; the worker holds nothing between
  calls.
- **Path/branch are pinned by env**, never taken from the request — a caller
  cannot redirect the write elsewhere.
- **No rebuild.** The target branch is `character-data`, which the deploy
  workflow does not watch — a save is a data commit, never an app rebuild.
- **Byte-identical output.** `btoa(JSON.stringify(character, null, 2) + "\n")`
  reproduces exactly what the file save writes, so the diff churn noted in §7.2
  does not recur per-save.
- **Retry is server-side.** The client sees one `200` or one final error; the
  `409` loop lives in the worker.
- **Two routes, one gate.** The shipped worker routes both `/save` and
  `/save-items` through the same CORS + fail-closed auth + bounded-409 machinery.
  `/save-items` additionally validates the delta with the shared
  `engine/validate-item.js` (PLAN-CUSTOM-ITEMS.md §3), and re-validates the whole
  merged catalog before its PUT — this endpoint is the first gate between the
  open `/save-items` surface and the deployed rules.

### 4.3 Secrets

Everything sensitive is an environment secret in the platform's secret store,
created by the repo owner, never committed and never in the app:

| Secret | Value |
|---|---|
| `GITHUB_TOKEN` | **Fine-grained PAT**, scoped to this repo only, `Contents: read/write`. Created once by the repo owner in GitHub → Settings → Developer settings → Fine-grained tokens. |
| `GITHUB_OWNER` / `GITHUB_REPO` | The repo that hosts the app (e.g. `odenson` / `ed-charSheet`). |
| `GITHUB_CHARS_DIR` | The per-character files dir, default `data/characters` — one raw `ed-character/1` file per character at `<id>.json`, plus a create-only `index.json` (`ed-characters-index/1` — `{ name, portrait? }` per id). Saves write the character file; the index row is ensured on create only (PLAN-SAVE-CONCURRENCY). The grouped `GITHUB_STORE`/`data/characters.json` target was removed with the per-character split. |
| `GITHUB_ITEMS_PATH` | The custom-item catalog, default `data/custom-items.json` — `{ "schema": "ed-items/2", "items": { "<name>": <item> } }`; `/save-items` merges + deletes here. |
| `GITHUB_BRANCH` | Default `character-data` — a data-only branch the deploy workflow does not watch, so saves never rebuild the app. |
| `SAVE_KEY` | **Required** shared endpoint key — fail-closed (see §5). |

### 4.4 Deploying the worker

```bash
npm i -D wrangler                 # or wrangler via npx
wrangler secret put GITHUB_TOKEN  # interactive; also OWNER/REPO/PATH/BRANCH and SAVE_KEY
wrangler deploy                   # uses wrangler.toml with name + main
```

The worker URL (`https://<name>.<subdomain>.workers.dev`) is the value the app
is pointed at. The worker's repo/deployment lives **outside** the Pages app —
it is not part of `rules/`, `ui/`, or the deploy workflow, and the Pages CI is
unchanged. The `character-data` branch is created by the worker on its first
save (from the repo's default branch), so there is no manual branch setup.

### 4.5 App-side integration

**Shipped, and consolidated: GitHub is the one primary Save.** The earlier "three
targets (web store + file + server)" framing is retired. The model is now:

- **Save → GitHub** (`store-server.js`) — the single primary Save.
- **Autosave overlay** (`store.js`) — always-on, beneath the save; never a
  user-facing target (ARCHITECTURE §7.1).
- **Export → download** (`store-export.js`) — a portable local backup, replacing
  the retired File System Access save (`store-file.js` is gone).

The save-target module, `store-server.js`:

```js
// store-server.js — the GitHub save target (shipped).
const DEFAULT_ENDPOINT = "https://ed-charsheet-save.edsavechar.workers.dev/save";

export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey, id, base = null } = {}) {
  if (!saveKey) throw new SaveError("no_key", "Enter your save key to save to GitHub.");
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-save-key": saveKey },
      body: JSON.stringify({ character, id, base }),
    });
  } catch { throw new SaveError("offline", "Could not reach the save service."); }
  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) {
    const code = out?.error?.code ?? `http_${res.status}`;
    if (code === "stale_base")
      throw new SaveConflictError(out?.error?.message, out?.error?.sha ?? null); // → conflict modal
    throw new SaveError(code, out?.error?.message);
  }
  return out.commit; // { sha, url } — sha is the next base
}
```

Wiring rules:
- **Same bytes.** It serializes the merged, inputs-only character with the same
  routine `store-export.js` uses, so a saved and an exported file are identical.
  The overlay is still written on every edit — the resilient working copy *until
  the commit confirms* (see "Reconcile the overlay" below).
- **Base = the read's ETag.** `loadCharacter(id)` captures the file's blob sha
  from the contents-API `ETag` header (confirmed == the blob sha the worker
  compares, §3.1) — quotes stripped, malformed/missing ⇒ `base = null` (never an
  error). The app holds it as `_baseSha`, updated from every save response's
  `commit.sha`. CDN-fallback / local reads have no usable ETag ⇒ `base = null`
  (legacy overwrite path, accepted caveat).
- **Key-prompt on save.** `SAVE_KEY` is required (the worker fails closed). If
  none is set for the session, Save opens a lean key-prompt (`ed-save-key.js`),
  stores the key **in memory only**, and retries — the overlay holds the edits
  meanwhile, so nothing is lost. A rejected key is dropped so the next Save
  re-prompts. **The prompt renders as a light-DOM portal on `<body>` — outside
  `<ed-app>`'s shadow tree — on purpose:** the field is a `type=password` +
  `autocomplete="current-password"` credential (with a hidden `username`), so
  password managers can save/fill it, and Apple's iCloud Keychain does not pierce
  shadow DOM. Keep it document-level; do not move it back inside the shadow tree.
- **Unsaved indicator.** The Save button shows a dot whenever the overlay has
  edits not yet committed (`hasPendingEdits`); it clears on a successful save and
  survives reload, so an edit made-but-not-saved still reads as unsaved.
- **Feedback.** Surfaces the commit URL after success; a visible typed error on
  failure. The `stale_base` case is **not** an error toast — it opens the
  conflict modal (below).
- **Conflicts → keep mine / take theirs.** A `SaveConflictError` (`stale_base`)
  opens `ed-conflict.js`, a light-DOM portal modal: **Keep mine** re-saves with
  the conflict's current sha as the acknowledged base (the overwrite is explicit,
  not silent); **Take theirs** reconciles the local overlay and reloads the branch
  version; **Cancel** closes and leaves the local draft dirty. The same path
  serves a future background auto-save — a conflict is never dropped silently.
- **Reconcile the overlay on success.** After a confirmed commit the branch holds
  those exact inputs, so the localStorage edits overlay for the saved categories
  (`meta` / `items` / `wealth`) is now redundant **and** will mask the branch on
  the next load — including edits made from another device. On success, clear the
  reconciled keys from the overlay so the (cache-busted) branch read becomes the
  source of truth. **Trade-off:** if a later branch read is unreachable, that
  device shows the load error rather than stale data — acceptable versus
  permanently masking saves. This is the
  exact failure a direct, out-of-band branch edit exposed in testing: a stale
  `meta.name` left in the overlay hid the branch's updated name, with no error
  (the live fetch succeeded; `applyEdits` merged the stale name on top).

**Reading the saved character.** The flip side of not rebuilding lives in
`store.js`: on the Pages site it reads live from the `character-data` branch —
the **discovery index** `data/characters/index.json` (one fetch → `[{ id, name,
portrait }]`, for the picker) and then the **per-character file**
`data/characters/<id>.json` for the selected character — **preferring the GitHub
contents API** (`api.github.com/…/contents/data/characters/<id>.json?ref=
character-data` with `Accept: application/vnd.github.raw`). The API reads the git
database directly, so a just-saved commit is visible **immediately** — the raw
CDN is not reliable for read-after-write because it keys its ~5-minute cache on
the path, and the `?t=` query does not dependably bust it, so a save-then-reload
can race a stale edge copy (the bug Phase 6 surfaced). Fallbacks keep it
never-worse: if the API is unreachable or rate-limited (60/hr per IP,
unauthenticated — ample for one player, and the response is cached with
`no-store`), it falls back to the raw CDN (cache-busted, eventually consistent).
There is deliberately **no deployed bundle fallback** — the bundle ships no
character data, so a total failure surfaces the load error rather than masking it
with stale bytes. Locally it keeps reading the gitignored working copies
(`./data/characters/`, WORKFLOW.md). `/` and `/dev/` read the same branch, so
both environments show the same characters.

A missing index or missing character file surfaces a clear error — "character
store not found" / "unknown character" — **never a fallback to the retired
grouped `data/characters.json`**: the split is a coordinated migration on the
`character-data` branch (plans/PLAN-SAVE-CONCURRENCY.md Phase D), and the skew
window is a visible error on either side, not a silent legacy read. The
portrait image (`meta.portrait`, e.g. `data/chakka.jpg`) is read from the
branch's raw CDN — a static repo asset doesn't need the git-consistent contents
API tier, and the UI falls back to a placeholder icon if it can't load
(docs/UI-GUIDELINES.md §6).

### 4.6 Testing

The project's ethos is `node --test`, zero deps (ARCHITECTURE §10) — apply it:

- **Worker handler, unit.** Mock the GitHub `fetch` (a stub returning a
  scripted SHA, a scripted `409` then `200`, and a `403`), then assert: wrong
  method/path → `404`; non-JSON → `400`; wrong schema / oversized → `400`;
  `invalid_base` (non-string `base`) → `400`; a save PUTs `data/characters/<id>.
  json` with the raw entry and **never touches the index** on an existing file;
  a matching `base` → PUT carries that sha; a stale `base` → `409 stale_base`
  + the current sha, **no PUT, no retry**; a raced read→write `409` for a
  base-caller → `stale_base` with a fresh sha; a missing file (`404`) → create +
  an `index.json` entry `{ name, portrait }` (create-only — an already-indexed
  character is never re-indexed, and a failed index write is logged, not fatal);
  a missing/invalid id (incl. `'../evil'`, `'A/b'`, `'a b'`, `'..'`, `'a.b'`,
  `'É'`, `42`, `''`) → `400 invalid_id`; no-base (legacy) saves retry `409` with
  the new sha (bounded) and surface `conflict` when exhausted; cross-character
  concurrent saves both succeed without a false conflict; a rename save touches
  only the character file; upstream `403` → `502`. (The grouped-store upsert and
  the no-`id` path are gone — the id is required since v1.6.0, the per-file
  layout since the split.)
- **Worker, manual integration.** One real `POST` against the repo, verify the
  commit appears on `character-data` and the app shows it on a Pages-like origin
  without any deploy, then reset the branch if desired.
- **App.** Assert `saveServer` sends exactly the bytes the §7.2 serializer
  produces (and always carries the `id` + `base`), that `stale_base` parses to a
  `SaveConflictError` carrying the current sha (routing to the modal) while other
  codes stay plain `SaveError`s (toast), and that `store.js` reads the live
  branch on a Pages-like origin, throws a clear "store not found / unknown
  character" error when the index or file is missing (no legacy fallback), and
  captures the ETag base. The pure `nextSaveAction` mapping (keep-mine /
  take-theirs / cancel) is unit-tested (save-action.js).
- **`/save-items`.** The worker tests cover the second route the same way:
  auth → 401, invalid item/delta → `400 invalid_items` with no PUT, a valid
  upsert merges + deletes and PUTs the whole `ed-items/2` file, a missing
  catalog (404) is created fresh, over-cap merged files → 400, 409-retry, and
  env-pinned `GITHUB_ITEMS_PATH`. The fold job (`tools/fold-custom-items.mjs`)
  has its own suite (create / update / skip-identical / validation-abort /
  409-retry / missing-file no-op).

---

## 5. Security model

The design leans on the same reasoning as §7.4's token discipline, moved
server-side, plus honest limits:

- **Least-privilege token.** A repo-only, `Contents: read/write` fine-grained
  PAT. It cannot touch other repos or other scopes. It lives only in the
  platform's secret store.
- **No data at rest.** The worker is stateless; there is nothing to steal
  between calls beyond the token itself.
- **Validation and pins.** Schema check + size cap; path and branch come from
  env, never from the request.
- **The honest limit: a static page cannot hide a secret.** The endpoint's
  public surface is the write-abuse vector. Two mitigations:
   1. **Blast radius.** The worst a junk caller can do is a malformed or junk
      character file commit on the `character-data` branch — isolated to one
      `data/characters/<id>.json` (and its index row), so the app's live read
      shows a bad character, trivially recovered by a real save. This bounded
      blast radius is why an open endpoint was even *considered* safe. The
      `/save-items` twin is bounded the same way — junk items land only on
      `data/custom-items.json`
      and are undone by one real save — and is additionally filtered by the shared
      validator (worker) and the fold job's diff-guard (PLAN-CUSTOM-ITEMS.md §9).
  2. **`SAVE_KEY` — required as shipped (fail-closed).** This design floated the
     key as optional, but the shipped build **requires** it: the worker rejects a
     missing/wrong key, or an unconfigured one (runbook §2.1). Single-user sheet,
     so the owner keeps one private key. Players enter it in the app per session,
     held in memory only; the GitHub token still never reaches the browser.
- **Public read is by design.** The data branch is public like the rest of the
  repo; unauthenticated reading is exactly what the app's live fetch needs.
- **Rate limiting.** Free-tier Workers have basic request limits; a per-IP
  counter or a Cloudflare WAF rule is the documented hardening path for later.

---

## 6. Effect on the existing application

### 6.1 What does NOT change

- **The default save model.** Web store overlay + file save stay the default and
  the only offline path. Editing offline still works; the server target is simply
  absent until enabled.
- **The engine.** It is persistence-agnostic and never sees this feature.
- **The data model.** The committed bytes are the same inputs-only
  `character.json` entry — the "store only inputs" invariant (ARCHITECTURE §4.1)
  is untouched because the file content is identical to the file save. Each
  character file is the raw `ed-character/1` entry; the per-character layout
  adds no wrapper and stores nothing recomputable.
- **The deploy workflow.** Unchanged, and no longer part of the save path —
  saves go to `character-data`, which is not a trigger branch, so nothing ever
  rebuilds on a save.
- **Local dev / working copy.** Off the Pages site the app still reads
  `./data/characters/<id>.json` + `./data/characters/index.json` (and the
  portrait from `./${meta.portrait}`) — the gitignored working copies (produced
  by `tools/split-character-store.mjs` or local dev saves), so a local checkout
  keeps working as today.
- **No new runtime dependency for anyone not using it.** The save module loads
  only when the option is enabled. The live read (§3, step 7) applies only on
  the Pages site, where it reads the branch instead of a bundle copy — the
  bundle ships no character data.

### 6.2 What is added

| Addition | Notes |
|---|---|
| `store-server.js` | A save-target module (feature-detected, opt-in) — POSTs `{ character, id, base }`, maps `stale_base` to `SaveConflictError` |
| `store.js` live read | On the Pages site the discovery index + the per-character file are fetched from the `character-data` branch; local runs read the gitignored working copies |
| `save-action.js` | Pure conflict-choice → next-step mapping (keep mine / take theirs / cancel) |
| `ui/ed-conflict.js` | The keep-mine / take-theirs conflict modal (light-DOM portal) |
| `store-custom-items.js` | The `/save-items` twin — custom-item delta POST + the `ed-custom-items` overlay (PLAN-CUSTOM-ITEMS.md §4.2) |
| `data/custom-items.json` | Shared player-created catalog on `character-data` (`ed-items/2`), folded into `rules/custom-items.json` on `dev` by CI (PLAN-CUSTOM-ITEMS.md §3) |
| Settings toggle | "Save to GitHub (server)" — enables the target and holds the required `SAVE_KEY` for the session |
| Save action entry | A third target alongside web store + file, in edit mode |
| Worker + secrets | Deployed outside the repo; owner-only setup |

### 6.3 Rules the addition must honour

Landing this is still a **Tier 3** change (new module + view option) under
CLAUDE.md, but it is bound by the same protected surfaces as any feature:

- **UI/UX contract** (docs/UI-GUIDELINES.md): the toggle and any modal honour
  Escape-closes / Enter-confirms, theme-awareness, and the viewport rules; the
  Save button remains in edit mode.
- **Architecture golden rule** (data down / events up through `dispatch`):
  triggering a server save is an event dispatched from the UI; the worker is
  backend plumbing, never UI. The worker does not read or mutate the store.
- **"instead of, never in addition to"**: if a player enables server-save, the
  §7.4 in-browser token flow is not offered; the two never stack.
- **Same-vendor runtime read.** The live character fetch goes to
  `raw.githubusercontent.com` (GitHub's own raw file host — same vendor as
  Pages), the minimal exception needed to show saves without rebuilding. It
  affects only the character load on the Pages site and is documented in §3.
- **No new taxonomy.** No changes to `rules/*.json`, `character.json` fields, or
  docs/EFFECT-TAXONOMY.md. The layout change is additive: each character is a raw
  `ed-character/1` file at `data/characters/<id>.json` (the file name is the
  character's id, a path-safe class), plus a discovery index
  `data/characters/index.json` (`ed-characters-index/1` — `{ name, portrait? }`
  per id, written on create only and never trusted for save bases). The legacy
  single-file `data/character.json`, the worker's no-`id` path, and the grouped
  `data/characters.json` store were removed with their layouts. The
  custom-item feature adds `ed-items/2` (`data/custom-items.json` +
  `rules/custom-items.json`) — a new file *within* the taxonomy's grammar, not a
  vocabulary change (Tier 3, PLAN-CUSTOM-ITEMS.md §7).

---

## 7. Status & resolved decisions

**Status: shipped** (v1.6.0, 2026-08-07; matches ARCHITECTURE §10). Worker live at
`https://ed-charsheet-save.edsavechar.workers.dev`; app integration in `store-server.js`.
The per-character split + concurrency check (PLAN-SAVE-CONCURRENCY) shipped to
`dev` (`457e39d`) and verified on the dev site 2026-08-12 — branch migrated,
worker redeployed, two-browser smoke passed.

| Decision | Resolved as |
|---|---|
| Host | **Cloudflare Worker** (decided, §4.1) |
| Endpoint auth | **`SAVE_KEY` required, fail-closed** (runbook §2.1) — not the optional default |
| Worker repo | Same repo under `tools/worker/` |
| Endpoint URL in app | Hardcoded default (Settings override deferred) |
| Save model | One primary Save → GitHub, over the autosave overlay; Export = local download (§4.5) |
| Read-after-write | App reads the branch via the git-consistent GitHub contents API (§4.5) |
| Concurrency | **Per-character files + optimistic concurrency** (plans/PLAN-SAVE-CONCURRENCY.md, Option C): `/save` writes `data/characters/<id>.json` with a `base` (ETag==blob-sha) check; stale → `409 stale_base` + sha → keep-mine/take-theirs modal; index (`ed-characters-index/1`) is create-only and never a save base. The grouped `ed-characters/1` store is retired. |

---

## References

- **ARCHITECTURE.md** — §2 goal 1 (the exception), §7.1–7.2 (web store + file
  save, the serialization this reuses), §7.3 (save-target table), §7.4 (the
  in-browser alternative this ships *instead of*), §7.5 (the one-paragraph
  summary this doc expands).
- **WORKFLOW.md** — the `dev`/`main` deploy model and the relative-path rule the
  committed file must keep satisfying.
- **docs/UI-GUIDELINES.md** — the UI contract any new Settings/save UI must
  honour.
- **CLAUDE.md** — the protected-surface tiers this change must classify under.
