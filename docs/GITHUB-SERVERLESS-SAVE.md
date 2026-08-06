# GitHub Serverless Save — the one sanctioned backend exception

A feature-design document for the write endpoint introduced in ARCHITECTURE.md
§7.5. It covers three things, in order: **how the feature works**, **how it is
built and implemented**, and **what (if anything) it changes in the existing
app**.

> Status: **documented, not built.** This is an opt-in design, not part of the
> current codebase. It is the single documented exception to the project's
> **"no backend, no external runtime dependency"** rule (ARCHITECTURE §2, goal 1).

---

## 1. What it is

One tiny write endpoint — a single Cloudflare Worker (the decided host, §4.1;
Deno Deploy and a Vercel function are portability alternatives) — that commits
`data/character.json` to the repo **on the app's behalf**, so the GitHub
credential never enters the browser.

The app keeps a Save action. Today it writes two places (web store + a
player-picked file). With this feature it gains a third target: **Save to GitHub
(server)**. The app `POST`s the same bytes it would write to the file; the
worker does the GitHub API round-trip to a dedicated **data branch**
(`character-data`); the app reads the committed file live at runtime, so a save
**never rebuilds or redeploys the app**.

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
│ Save action          │ ─────────────► │ 1. validate character         │   │ branch created │
│ serialize the same   │  { character } │ 2. ensure the data branch     │──►│ read SHA       │
│ inputs-only JSON     │                │ 3. GET contents/character.json│──►│                │
│ (identical to §7.2)  │                │    ?ref=character-data        │◄──│ commit         │
│                      │ ◄───────────── │ 4. PUT contents/character.json│──►│ on the branch  │
│ show commit URL /    │  200 {commit}  │    { base64, sha, branch }    │   └────────────────┘
│ error (409 retried)  │                └───────────────────────────────┘
└──────────────────────┘
   No deploy, no rebuild: the deploy workflow (WORKFLOW.md) watches main and dev
   only. On its next load the Pages app fetches the character LIVE from the
   committed branch (store.js), falling back to the deployed copy:
   https://raw.githubusercontent.com/{owner}/{repo}/character-data/data/character.json
```

1. **App serializes.** The Save action produces the exact bytes the file save
   produces: the merged, inputs-only character, `JSON.stringify(…, 2) + '\n'`
   (§7.2). Nothing about the data model changes.
2. **App POSTs.** The worker's single endpoint `/save`, body
   `{ "character": { … } }`, `Content-Type: application/json`.
3. **Worker validates.** JSON parses, `schema === "ed-character/1"`, byte size
   within the cap, path and branch come from its own config, not the request.
4. **Worker commits.** To the `character-data` branch (created on the first
   save, skipped after):
   - `GET /repos/{owner}/{repo}/contents/{path}?ref=character-data` → the file's
     blob `sha` (the contents API needs it to update in place).
   - `PUT …/contents/{path}` with `{ message, content: base64(bytes), sha,
     branch: "character-data" }` — one commit on the data branch.
5. **No rebuild.** The deploy workflow (WORKFLOW.md) fires on `main` and `dev`
   only; `character-data` is not a trigger, so a save never rebuilds the app. The
   character file is source info the app reads at runtime — it needs no build.
6. **Feedback.** Worker returns the commit URL. On a `409` (the `sha` moved —
   someone else saved), the worker re-reads the SHA and retries (bounded), the
   same retry loop §7.4 sketches for the client.
7. **Live read.** On its next load the Pages app fetches the committed file live
   from the branch (`store.js`), falling back to the deployed copy. Both `/` and
   `/dev/` read the same branch, so the two environments show the same character.

### 3.2 Request / response contract

| | Value |
|---|---|
| Endpoint | `POST https://<worker>/save` |
| Headers | `Content-Type: application/json`; optional `x-save-key` (see §5) |
| Body | `{ "character": <inputs-only ed-character/1 JSON> }` |
| 200 | `{ "ok": true, "commit": { "sha": "…", "url": "https://github.com/…/commit/…" } }` |
| 400 | `{ "ok": false, "error": { "code": "invalid_json" \| "invalid_character" \| "too_large", "message": "…" } }` |
| 401 | `{ "ok": false, "error": { "code": "unauthorized", "message": "bad save key" } }` |
| 404 | `{ "ok": false, "error": { "code": "not_found", "message": "POST /save only" } }` |
| 409 | Retried internally (bounded, 3 attempts); only surfaced if retries exhaust |
| 502/504 | Upstream GitHub failure; `{ "ok": false, "error": { "code": "upstream", "message": "…" } }` |

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
// POST /save  { "character": <inputs-only ed-character/1 JSON> }
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

### 4.3 Secrets

Everything sensitive is an environment secret in the platform's secret store,
created by the repo owner, never committed and never in the app:

| Secret | Value |
|---|---|
| `GITHUB_TOKEN` | **Fine-grained PAT**, scoped to this repo only, `Contents: read/write`. Created once by the repo owner in GitHub → Settings → Developer settings → Fine-grained tokens. |
| `GITHUB_OWNER` / `GITHUB_REPO` | The repo that hosts the app (e.g. `odenson` / `ed-charSheet`). |
| `GITHUB_PATH` | Default `data/character.json`. |
| `GITHUB_BRANCH` | Default `character-data` — a data-only branch the deploy workflow does not watch, so saves never rebuild the app. |
| `SAVE_KEY` | Optional shared endpoint key (see §5). |

### 4.4 Deploying the worker

```bash
npm i -D wrangler                 # or wrangler via npx
wrangler secret put GITHUB_TOKEN  # interactive; also OWNER/REPO/PATH/BRANCH, optionally SAVE_KEY
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

export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey } = {}) {
  if (!saveKey) throw new SaveError("no_key", "Enter your save key to save to GitHub.");
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-save-key": saveKey },
      body: JSON.stringify({ character }),
    });
  } catch { throw new SaveError("offline", "Could not reach the save service."); }
  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) throw new SaveError(out?.error?.code ?? `http_${res.status}`, out?.error?.message);
  return out.commit; // { sha, url }
}
```

Wiring rules:
- **Same bytes.** It serializes the merged, inputs-only character with the same
  routine `store-export.js` uses, so a saved and an exported file are identical.
  The overlay is still written on every edit — the resilient working copy *until
  the commit confirms* (see "Reconcile the overlay" below).
- **Key-prompt on save.** `SAVE_KEY` is required (the worker fails closed). If
  none is set for the session, Save opens a lean key-prompt (`ed-save-key.js`),
  stores the key **in memory only**, and retries — the overlay holds the edits
  meanwhile, so nothing is lost. A rejected key is dropped so the next Save
  re-prompts.
- **Unsaved indicator.** The Save button shows a dot whenever the overlay has
  edits not yet committed (`hasPendingEdits`); it clears on a successful save and
  survives reload, so an edit made-but-not-saved still reads as unsaved.
- **Feedback.** Surfaces the commit URL after success; a visible typed error on
  failure (the 409 case is resolved server-side, so the client has no retry).
- **Reconcile the overlay on success.** After a confirmed commit the branch holds
  those exact inputs, so the localStorage edits overlay for the saved categories
  (`meta` / `items` / `wealth`) is now redundant **and** will mask the branch on
  the next load — including edits made from another device. On success, clear the
  reconciled keys from the overlay so the (cache-busted) branch read becomes the
  source of truth. **Trade-off:** if a later branch read is unreachable and falls
  back to the deployed bundle, that device shows bundle-age data until the branch
  is reachable again — acceptable versus permanently masking saves. This is the
  exact failure a direct, out-of-band branch edit exposed in testing: a stale
  `meta.name` left in the overlay hid the branch's updated name, with no error
  (the live fetch succeeded; `applyEdits` merged the stale name on top).

**Reading the saved character.** The flip side of not rebuilding lives in
`store.js`: on the Pages site it reads `data/character.json` live from the
`character-data` branch, **preferring the GitHub contents API**
(`api.github.com/…/contents/data/character.json?ref=character-data` with
`Accept: application/vnd.github.raw`). The API reads the git database directly,
so a just-saved commit is visible **immediately** — the raw CDN is not reliable
for read-after-write because it keys its ~5-minute cache on the path, and the
`?t=` query does not dependably bust it, so a save-then-reload can race a stale
edge copy (the bug Phase 6 surfaced). Fallbacks keep it never-worse: if the API
is unreachable or rate-limited (60/hr per IP, unauthenticated — ample for one
player, and the response is cached with `no-store`), it falls back to the raw
CDN (cache-busted, eventually consistent), then to the deployed bundle. Locally
it keeps reading the working copy. `/` and `/dev/` read the same branch, so both
environments show the same character.

### 4.6 Testing

The project's ethos is `node --test`, zero deps (ARCHITECTURE §10) — apply it:

- **Worker handler, unit.** Mock the GitHub `fetch` (a stub returning a
  scripted SHA, a scripted `409` then `200`, and a `403`), then assert: wrong
  method/path → `404`; non-JSON → `400`; wrong schema / oversized → `400`;
  correct request → `PUT` receives the GET-returned `sha`, the pinned
  branch/path, and base64 equal to the §7.2 serialization; `409` → second attempt
  carries the new `sha`; final failure → `502`/`409`.
- **Worker, manual integration.** One real `POST` against the repo, verify the
  commit appears on `character-data` and the app shows it on a Pages-like origin
  without any deploy, then reset the branch if desired.
- **App.** Assert `saveServer` sends exactly the bytes the §7.2 serializer
  produces, and that error codes map to the modal feedback paths. Also assert
  `store.js` reads the live branch on a Pages-like origin and falls back to the
  deployed copy when the branch has no file yet.

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
     `character.json` commit on the `character-data` branch — the app's live read
     shows a bad character, trivially recovered by a real save. This is why the
     default is **no endpoint key**.
  2. **Optional `SAVE_KEY`.** The repo owner distributes a shared key
     out-of-band; players enter it in the app per session and it is held in
     memory only (the same discipline §7.4 applies to its tokens). The GitHub
     token still never reaches the browser.
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
  `character.json` — the "store only inputs" invariant (ARCHITECTURE §4.1) is
  untouched because the file content is identical to the file save.
- **The deploy workflow.** Unchanged, and no longer part of the save path —
  saves go to `character-data`, which is not a trigger branch, so nothing ever
  rebuilds on a save.
- **Local dev / working copy.** Off the Pages site the app still reads
  `./data/character.json`, so a local checkout keeps working exactly as today.
- **No new runtime dependency for anyone not using it.** The save module loads
  only when the option is enabled. The live read (§3, step 7) applies only on
  the Pages site, where it replaces a bundle fetch with the same vendor's raw
  file host.

### 6.2 What is added

| Addition | Notes |
|---|---|
| `store-server.js` | A save-target module (feature-detected, opt-in) |
| `store.js` live read | On the Pages site the character is fetched from the `character-data` branch (raw), falling back to the deployed copy; local runs unchanged |
| Settings toggle | "Save to GitHub (server)" — enables the target and holds the optional `SAVE_KEY` for the session |
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
- **No new taxonomy/schema.** No changes to `rules/*.json`, `character.json`,
  or docs/EFFECT-TAXONOMY.md.

---

## 7. Status & open decisions

**Status: documented, not built** (matches ARCHITECTURE §10). Nothing in this
doc is live code; landing it is an owner decision.

| Open decision | Default | Alternatives |
|---|---|---|
| Host | **Cloudflare Worker (decided, §4.1)** | Revisit only if the free tier or constraints change |
| Endpoint auth | None (open, §5 blast-radius argument) | `SAVE_KEY` shared secret |
| Worker repo | Same repo under `tools/` | Sibling private repo |
| Endpoint URL in app | Hardcoded default | Overridable in Settings |
| Docs when built | Update this doc + ARCHITECTURE §7.5/§10 from "not built" to "shipped" | — |

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
