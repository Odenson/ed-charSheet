// worker.js — GitHub serverless save endpoint (Cloudflare Worker).
//
// POST /save  { "character": <inputs-only ed-character/1 JSON>, "id": "<id>", "base"?: "<file sha>" }
//
// Commits the posted character to the `character-data` branch on the app's
// behalf, so the GitHub credential never enters the browser. The deploy workflow
// does not watch that branch, so a save is a data commit — never an app rebuild.
// The app reads the branch live (store.js), so a save shows up on next load.
//
// Since the per-character-files split (docs/PLAN-SAVE-CONCURRENCY.md) the save
// target is ONE file per character: `data/characters/<id>.json`, holding the raw
// `schema: "ed-character/1"` entry (no grouped wrapper). The `id` is validated
// against a strict class (`[a-z0-9][a-z0-9-]{0,63}`) that is also a safe
// filename class — no separators, no traversal — and is interpolated into the
// env-pinned path (`GITHUB_CHARS_DIR`, never taken from the request).
//
// Optimistic concurrency: the client sends `base` = the file sha it last saw
// (captured from the contents-API ETag on read; confirmed == blob sha). The
// worker rejects a stale base with `409 { code: "stale_base", sha }` (no retry —
// a stale base cannot be retried away); the app then offers keep-mine /
// take-theirs. Success returns `commit: { sha, url }` where `sha` is the new
// file blob sha (`content.sha`) — the client's next base. A caller that sends no
// base (older deployment, local dev / CDN-fallback session) keeps the legacy
// bounded GET-sha → PUT 409-retry overwrite contract.
//
// This build REQUIRES SAVE_KEY and fails closed (runbook §2.1 / §5.2): a missing
// or wrong `x-save-key`, OR an unconfigured SAVE_KEY, is rejected 401. Everything
// else follows the design doc §4.2 handler: schema/size validation, env-pinned
// path/branch (never taken from the request), GET-sha → PUT, bounded 409 retry.
//
// POST /save-items  { "items": { "<name>": <item> }, "delete"?: ["<name>", …] }
//
// The companion write endpoint for the player-created custom-item catalog
// (docs/PLAN-CUSTOM-ITEMS.md): GET `data/custom-items.json` (ed-items/2) on the
// same branch, merge the posted items (custom wins on a canon-name collision),
// apply the delete list, PUT it back — same bounded GET-sha → PUT 409-retry
// contract as /save. Every item is validated by engine/validate-item.js (shared
// with the UI and the fold job) and the whole merged file is re-checked before
// the PUT: this endpoint is the first gate between the open endpoint and
// rules/custom-items.json on dev.
//
// Secrets/vars come from the environment (wrangler.toml [vars] + `wrangler secret
// put`); nothing sensitive is committed or shipped in the app. Stateless: the
// worker holds nothing between calls.

import { validateItem, validateItemsFile } from '../../engine/validate-item.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const GITHUB = 'https://api.github.com';
const MAX_BYTES = 512 * 1024; // a character entry is a few KB; cap generously
const MAX_RETRIES = 3;        // bounded 409 (sha moved) retries
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export default {
  async fetch(request, env) {
    // Allow-list the app origin; overridable by env for the /dev/ or a fork.
    const origin = env.ALLOWED_ORIGIN ?? 'https://odenson.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-save-key',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || (url.pathname !== '/save' && url.pathname !== '/save-items'))
      return json(cors, 404, { ok: false, error: { code: 'not_found', message: 'POST /save or POST /save-items only' } });

    // SAVE_KEY is required (fail closed): reject if unconfigured, missing, or
    // wrong. The key is compared in constant time (hash-then-compare, see
    // safeEqual) so a timing side-channel can't leak it. Absence of the header
    // is not itself secret, so that one case short-circuits.
    const providedKey = request.headers.get('x-save-key');
    if (!env.SAVE_KEY || providedKey === null || !(await safeEqual(providedKey, env.SAVE_KEY)))
      return json(cors, 401, { ok: false, error: { code: 'unauthorized', message: 'bad or missing save key' } });

    let body;
    try {
      body = await request.json();
    } catch {
      return json(cors, 400, { ok: false, error: { code: 'invalid_json', message: 'body is not JSON' } });
    }

    const branch = env.GITHUB_BRANCH ?? 'character-data'; // NOT main/dev — never triggers a deploy
    const repo = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const gh = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub's API rejects requests with no User-Agent (403 "Request forbidden
      // by administrative rules"). Workers don't set one by default, so send it.
      'User-Agent': 'ed-charsheet-save',
    };

    try {
      if (url.pathname === '/save-items') {
        // Custom items are the shared catalog (ed-items/2). The delta shape and
        // every posted item are validated first (fail fast, before any GitHub
        // call), and the merged file is re-checked before the PUT — see
        // upsertItems.
        const checked = checkItemsDelta(body);
        if (!checked.ok)
          return json(cors, 400, { ok: false, error: { code: 'invalid_items', message: checked.errors[0] } });
        await ensureBranch(repo, branch, gh); // first save only
        const itemsPath = env.GITHUB_ITEMS_PATH ?? 'data/custom-items.json';
        return await upsertItems(repo, branch, gh, itemsPath, body, cors);
      }

      const character = body?.character;
      if (!isValidCharacter(character))
        return json(cors, 400, { ok: false, error: { code: 'invalid_character', message: 'not an ed-character/1 file' } });
      const id = body?.id;
      if (!isValidId(id))
        return json(cors, 400, { ok: false, error: { code: 'invalid_id', message: 'character id must match [a-z0-9][a-z0-9-]{0,63}' } });
      const rawBase = body?.base;
      if (rawBase !== undefined && rawBase !== null && typeof rawBase !== 'string')
        return json(cors, 400, { ok: false, error: { code: 'invalid_base', message: 'base must be a file sha string or omitted' } });
      const base = typeof rawBase === 'string' ? rawBase : null;

      await ensureBranch(repo, branch, gh); // first save only
      const charsDir = env.GITHUB_CHARS_DIR ?? 'data/characters';
      return await upsertCharacterFile(repo, branch, gh, charsDir, id, character, base, cors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ message: 'save failed (upstream)', error: message }));
      return json(cors, 502, { ok: false, error: { code: 'upstream', message } });
    }
  },
};

// Upsert `character` as `data/characters/<id>.json` (one file per character, raw
// ed-character/1 — no grouped wrapper, no merge). With a `base`: GET the file →
// 404 ⇒ create (PUT without sha; base ignored — a missing file cannot be raced);
// base ≠ current file sha ⇒ 409 `stale_base` immediately (no retry — a stale
// base cannot be retried away); base == sha ⇒ PUT with the current sha, and a
// 409 in the read→write window also returns `stale_base` (with the current sha,
// freshly read). Without a `base` (legacy caller) keep the current bounded
// GET-sha → PUT 409-retry contract.
async function upsertCharacterFile(repo, branch, gh, charsDir, id, character, base, cors) {
  const filePath = `${charsDir}/${id}.json`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { sha, exists } = await readCharacterFile(repo, filePath, branch, gh);
    if (base && exists && base !== sha) return staleBase(cors, sha);
    const res = await putCharacterFile(repo, branch, gh, filePath, character, exists ? sha : undefined, cors);
    if (res) {
      // Only a brand-new file (404 on read) touches the discovery index.
      if (!exists) await ensureIndexEntry(repo, branch, gh, charsDir, id, character);
      return res;
    }
    // PUT 409 — the file sha moved in the read→write window. A base-caller
    // cannot retry this away: surface the current sha so the app can offer
    // keep-mine / take-theirs.
    if (base) {
      const current = await readCharacterFile(repo, filePath, branch, gh);
      return staleBase(cors, current.sha ?? sha);
    }
  }
  return json(cors, 409, { ok: false, error: { code: 'conflict', message: 'sha kept moving' } });
}

function staleBase(cors, sha) {
  return json(cors, 409, { ok: false, error: { code: 'stale_base', message: 'character changed on the branch', sha } });
}

// Read one character file: `{ sha, exists }`. `sha` is the blob sha (the
// contents-API ETag, confirmed == blob sha 2026-08-12) — the client's base and
// the PUT's `sha`. The content is never needed: a per-file save writes the
// posted character as-is, so there is no store to merge. A 404 (file not created
// yet) yields `{ sha: undefined, exists: false }`.
async function readCharacterFile(repo, filePath, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers: gh });
  if (res.status === 404) return { sha: undefined, exists: false };
  if (!res.ok) throw new Error(`read ${res.status}`);
  const obj = await res.json();
  return { sha: obj.sha, exists: true };
}

// PUT one character file (its own file, never a whole-store rewrite). Returns
// the success/upstream Response, or null on a 409 so the caller decides between
// `stale_base` (base-caller) and a bounded retry (no-base caller).
async function putCharacterFile(repo, branch, gh, filePath, character, sha, cors) {
  const content = toBase64(JSON.stringify(character, null, 2) + '\n');
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Save character (serverless)', content, sha, branch }),
  });
  if (res.ok) return ok(cors, res);
  if (res.status !== 409) {
    console.error(JSON.stringify({ message: 'github PUT failed', status: res.status }));
    return json(cors, 502, { ok: false, error: { code: 'upstream', message: `github ${res.status}` } });
  }
  return null;
}

// Create-only discovery-index maintenance. Touched ONLY when a save created a
// brand-new character file: ensure `id → { name, portrait }` is discoverable in
// `data/characters/index.json` (creating the index file if absent), so the new
// character appears in the picker in one fetch. Best-effort by design — a failed
// index write is logged and tolerated (the file is truth; a created-but-
// unindexed character is invisible to the picker until the index is refreshed).
// Renames and portrait changes never touch the index: an entry may go stale (the
// file's `meta.name`/`meta.portrait` are authoritative) and the index is never
// trusted for save bases.
async function ensureIndexEntry(repo, branch, gh, charsDir, id, character) {
  const indexPath = `${charsDir}/index.json`;
  let sha;
  let file;
  try {
    const read = await fetch(`${GITHUB}/repos/${repo}/contents/${indexPath}?ref=${branch}`, { headers: gh });
    if (read.status === 404) {
      file = { schema: 'ed-characters-index/1', characters: {} };
    } else if (!read.ok) {
      throw new Error(`index read ${read.status}`);
    } else {
      const obj = await read.json();
      sha = obj.sha;
      file = JSON.parse(base64ToString(obj.content));
    }
  } catch (err) {
    console.error(JSON.stringify({ message: 'index ensure failed (read)', error: err instanceof Error ? err.message : String(err) }));
    return;
  }
  file.characters = file.characters ?? {};
  if (file.characters[id]) return; // already indexed — nothing to write
  file.characters[id] = { name: character.meta?.name ?? '', portrait: character.meta?.portrait ?? null };
  const content = toBase64(JSON.stringify(file, null, 2) + '\n');
  try {
    const res = await fetch(`${GITHUB}/repos/${repo}/contents/${indexPath}`, {
      method: 'PUT',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Index character (serverless)', content, sha, branch }),
    });
    if (!res.ok) throw new Error(`index write ${res.status}`);
  } catch (err) {
    console.error(JSON.stringify({ message: 'index ensure failed (write)', error: err instanceof Error ? err.message : String(err) }));
  }
}

// Upsert custom items into the shared catalog at `itemsPath` (ed-items/2): GET
// the file, merge the posted `items` (custom wins on a name collision) and apply
// the `delete` list, PUT it back — same bounded GET-sha → PUT 409-retry contract
// as character saves. A missing file (first save) is created as a fresh catalog.
// The whole merged file is re-checked with validateItemsFile before the PUT; a
// merged file that no longer validates never reaches the branch.
async function upsertItems(repo, branch, gh, itemsPath, delta, cors) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { sha, file } = await readItemsFile(repo, itemsPath, branch, gh);
    for (const [name, item] of Object.entries(delta.items ?? {})) file.items[name] = item;
    for (const name of delta.delete ?? []) delete file.items[name];
    const checked = validateItemsFile(file);
    if (!checked.ok)
      return json(cors, 400, { ok: false, error: { code: 'invalid_items', message: checked.errors[0] } });
    const content = toBase64(JSON.stringify(file, null, 2) + '\n');
    const res = await fetch(`${GITHUB}/repos/${repo}/contents/${itemsPath}`, {
      method: 'PUT',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Save custom items (serverless)', content, sha, branch }),
    });
    if (res.ok) return ok(cors, res);
    if (res.status !== 409) {
      console.error(JSON.stringify({ message: 'github PUT failed', status: res.status }));
      return json(cors, 502, { ok: false, error: { code: 'upstream', message: `github ${res.status}` } });
    }
  }
  return json(cors, 409, { ok: false, error: { code: 'conflict', message: 'sha kept moving' } });
}

// Read the custom-items catalog: `{ sha, file }` decoded from the contents API.
// A 404 (catalog not created yet) yields a fresh empty ed-items/2 file with no sha.
async function readItemsFile(repo, itemsPath, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${itemsPath}?ref=${branch}`, { headers: gh });
  if (res.status === 404)
    return {
      sha: undefined,
      file: {
        schema: 'ed-items/2',
        effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
        source: 'custom',
        notes: 'Player-created items, folded into rules/custom-items.json on dev by CI.',
        items: {},
      },
    };
  if (!res.ok) throw new Error(`read ${res.status}`);
  const obj = await res.json();
  return { sha: obj.sha, file: JSON.parse(base64ToString(obj.content)) };
}

// Validate the /save-items delta: `{ items, delete? }`. Returns `{ ok, errors }`;
// on failure the first error becomes the 400 message. Every posted item goes
// through the same engine/validate-item.js gate the UI and fold job use.
function checkItemsDelta(body) {
  const errors = [];
  const items = body?.items;
  const dels = body?.delete;
  if (items === undefined && dels === undefined) {
    errors.push('must provide items and/or delete');
  }
  if (items !== undefined && (typeof items !== 'object' || items === null || Array.isArray(items))) {
    errors.push('items: must be an object of name → item');
  } else {
    for (const [name, item] of Object.entries(items ?? {})) {
      for (const e of validateItem(name, item).errors) errors.push(`items["${name}"]: ${e}`);
    }
  }
  if (dels !== undefined && (!Array.isArray(dels) || dels.some((d) => typeof d !== 'string' || d === '')))
    errors.push('delete: must be an array of non-empty names');
  return { ok: errors.length === 0, errors };
}

function ok(cors, res) {
  return res.json().then((c) => json(cors, 200, { ok: true, commit: { sha: c.content.sha, url: c.html_url } }));
}

// First save on a fresh repo: create the data branch from the default branch so
// the contents API has a ref to write into. No-op on every later save.
async function ensureBranch(repo, branch, gh) {
  const head = await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${branch}`, { headers: gh });
  if (head.ok) return;
  const meta = await (await fetch(`${GITHUB}/repos/${repo}`, { headers: gh })).json();
  const base = await (await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${meta.default_branch}`, { headers: gh })).json();
  const created = await fetch(`${GITHUB}/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
  if (!created.ok) throw new Error(`create branch ${created.status}`);
}

// Base64-encode a string as its UTF-8 bytes. `btoa` alone only accepts Latin1
// (code points 0–255) and throws on characters like em-dashes or the ✦ magic
// star, which the character data contains. Encoding to UTF-8 bytes first is also
// exactly what GitHub's contents API wants (base64 of the file's UTF-8 bytes),
// so the committed file stays byte-identical to the local file save.
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Constant-time secret comparison. Hash both sides to a fixed 32 bytes, then
// compare with an XOR accumulator so neither the loop length nor the per-byte
// work depends on the secret's value — no timing side-channel. Uses only the
// web-standard crypto.subtle.digest, so it runs identically on the Workers
// runtime and under `node --test` (avoids the CF-only crypto.subtle.timingSafeEqual).
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function isValidCharacter(c) {
  return (
    !!c &&
    typeof c === 'object' &&
    c.schema === 'ed-character/1' &&
    JSON.stringify(c).length <= MAX_BYTES
  );
}

// A character id is a short lowercase slug naming one file,
// `data/characters/<id>.json`. The strict character class is also a safe
// filename class: no separators (`/`, backslash), no dots (so no `..` or hidden
// files), no control characters, no uppercase — traversal is impossible to
// express and the id is interpolated into the env-pinned directory only.
function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

// Decode the contents API's base64 payload back to UTF-8 text. GitHub encodes
// the file's raw bytes; decoding via bytes (not atob's Latin1 assumption) keeps
// em-dashes and the ✦ magic star intact when the worker merges a store.
function base64ToString(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function json(cors, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors } });
}
