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

One tiny write endpoint — a single Cloudflare Worker (or Deno Deploy / Vercel
function) — that commits `data/character.json` to the repo **on the app's
behalf**, so the GitHub credential never enters the browser.

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
┌──────────────────────┐  POST /save   ┌──────────────────────────────┐   ┌────────────────┐
│ Save action          │ ─────────────► │ 1. validate character        │   │ branch created │
│ serialize the same   │  { character } │ 2. ensure the data branch    │──►│ read SHA       │
│ inputs-only JSON     │                │ 3. GET contents/character.json│──►│                │
│ (identical to §7.2)  │                │    ?ref=character-data        │◄──│ commit         │
│                      │ ◄───────────── │ 4. PUT contents/character.json│──►│ on the branch  │
│ show commit URL /    │  200 {commit}  │    { base64, sha, branch }    │   └────────────────┘
│ error (409 retried)  │                └──────────────────────────────┘
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

### 4.1 Host — Cloudflare Worker (default)

A Cloudflare Worker is the stated default (ARCHITECTURE §7.5): one file, free
tier, no database, nothing to operate, deployable in seconds with `wrangler`.
Deno Deploy and a Vercel function are drop-in equivalents — same request shape,
same handler, same env-var secrets. The choice does not leak into the app; the
app only needs the endpoint URL.

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

A new save-target module, additive to `store.js` / `store-file.js`:

```js
// store-server.js — serverless save target (design sketch, not shipped)
// Opt-in only: a Settings toggle enables "Save to GitHub (server)".
const DEFAULT_ENDPOINT = "https://<name>.<subdomain>.workers.dev/save";

export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey } = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(saveKey ? { "x-save-key": saveKey } : {}) },
    body: JSON.stringify({ character }),
  });
  const out = await res.json().catch(() => ({ ok: false }));
  if (!res.ok) throw new SaveError(out?.error?.code ?? `http_${res.status}`, out?.error?.message);
  return out.commit; // { sha, url }
}
```

Wiring rules, matching the existing Save behaviour:
- **Same bytes.** It serializes with the identical routine the file save uses
  (merged, inputs-only). The web store is still written on Save as well — the
  overlay stays the resilient working copy *until the commit confirms* (see
  "Reconcile the overlay" below).
- **Opt-in and feature-detected.** Hidden/disabled until the player enables it
  in Settings; disabled cleanly when offline or when the endpoint is unreachable.
- **Feedback.** Surfaces the commit URL after success; a visible error on
  failure (the 409 case is already resolved server-side, so the client has no
  retry logic).
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
`store.js`: on the Pages site it fetches `data/character.json` live from the
`character-data` branch (raw.githubusercontent.com) with a per-load cache-buster
(`?t=${Date.now()}`) so raw's ~5-minute edge TTL can't serve a stale copy — a
fresh save is read immediately — falling back to the deployed copy; locally it
keeps reading the working copy. `/` and `/dev/` read the same branch, so both
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
| Host | Cloudflare Worker | Deno Deploy, Vercel function |
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
