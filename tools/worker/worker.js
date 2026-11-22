// worker.js — GitHub serverless save endpoint (Cloudflare Worker).
//
// POST /save  { "character": <inputs-only ed-character/1 JSON>, "id": "<id>", "base"?: "<file sha>" }
//
// Commits the posted character to the `character-data` branch on the app's
// behalf, so the GitHub credential never enters the browser. The deploy workflow
// does not watch that branch, so a save is a data commit — never an app rebuild.
// The app reads the branch live (store.js), so a save shows up on next load.
//
// Since the per-character-files split (plans/PLAN-SAVE-CONCURRENCY.md) the save
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
// (plans/PLAN-CUSTOM-ITEMS.md): GET `data/custom-items.json` (ed-items/3) on the
// same branch, merge the posted items (custom wins on a canon-name collision),
// apply the delete list, PUT it back — same bounded GET-sha → PUT 409-retry
// contract as /save. Every item is validated by engine/validate-item.js (shared
// with the UI and the fold job) and the whole merged file is re-checked before
// the PUT: this endpoint is the first gate between the open endpoint and
// rules/custom-items.json on dev.
//
// POST /save-skills  { "skills": { "<name>": <skill> } }
//
// The write endpoint for owner-created custom skills (plans/gen-skill-other): GET
// `data/custom-skills.json` (ed-skills/1, an array under `skills`), upsert the posted
// skills by name, PUT it back — same bounded GET-sha → PUT 409-retry contract. Every skill
// is validated by engine/validate-skill.js (shared with the UI and the fold job) with the
// attribute list (rules/attributes.json) and core skill names (rules/skills.json) ALWAYS
// supplied, and the whole merged file is re-checked before the PUT.
//
// POST /delete-character  { "id": "<id>", "base": "<file sha>", "deleteImage"?: "<imagesDir>/<file>" }
//
// Deletes `data/characters/<id>.json` and drops the id's row from the discovery
// index. A `base` is REQUIRED; a stale one is `409 stale_base` with nothing
// written. A missing file is idempotent (`deleted:false`, the stale index row is
// still removed). `deleteImage` (optional) removes the character's OWN portrait
// image only: it must equal the file's `meta.portrait` and no other character
// (index rows + every other character file) may reference it; anything
// unverifiable skips the image delete (`imageSkipped`). An image failure never
// fails the call. Recovery is via git history on the data branch.
//
// Secrets/vars come from the environment (wrangler.toml [vars] + `wrangler secret
// put`); nothing sensitive is committed or shipped in the app. Stateless: the
// worker holds nothing between calls.

import { validateItem, validateItemsFile } from '../../engine/validate-item.js';
import { validateSkill, validateSkillsFile } from '../../engine/validate-skill.js';
import attributesData from '../../rules/attributes.json' with { type: 'json' };
import coreSkillsData from '../../rules/skills.json' with { type: 'json' };

// Bundled at deploy time (wrangler/esbuild inlines JSON): the worker always checks a posted
// skill against the real attribute list and core skill names — never optional here.
const ATTRIBUTE_NAMES = attributesData.order;
const CORE_SKILL_NAMES = coreSkillsData.skills.map((s) => s.name);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const GITHUB = 'https://api.github.com';
const MAX_BYTES = 512 * 1024; // a character entry is a few KB; cap generously
const MAX_RETRIES = 3;        // bounded 409 (sha moved) retries
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_IMAGE_BYTES = 1_500_000; // decoded portrait image ceiling (client stores <= 1,000,000)

export default {
  async fetch(request, env) {
    // Allow-list the app origin; overridable by env for the /dev/ or a fork.
    const origin = env.ALLOWED_ORIGIN ?? 'https://odenson.github.io';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS', // /save, /save-items, /save-skills, /save-image, /delete-character
      'Access-Control-Allow-Headers': 'Content-Type, x-save-key',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || (url.pathname !== '/save' && url.pathname !== '/save-items' && url.pathname !== '/save-skills' && url.pathname !== '/save-image' && url.pathname !== '/delete-character'))
      return json(cors, 404, { ok: false, error: { code: 'not_found', message: 'POST /save, /save-items, /save-skills, /save-image or /delete-character only' } });

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
      if (url.pathname === '/save-image') return await saveImage(env, body, repo, branch, gh, cors);
      if (url.pathname === '/delete-character') return await deleteCharacter(env, body, repo, branch, gh, cors);

      if (url.pathname === '/save-items') {
        // Custom items are the shared catalog (ed-items/3). The delta shape and
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

      if (url.pathname === '/save-skills') {
        const checked = checkSkillsDelta(body);
        if (!checked.ok)
          return json(cors, 400, { ok: false, error: { code: 'invalid_skills', message: checked.errors[0] } });
        await ensureBranch(repo, branch, gh); // first save only
        const skillsPath = env.GITHUB_SKILLS_PATH ?? 'data/custom-skills.json';
        return await upsertSkills(repo, branch, gh, skillsPath, body, cors);
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
      const imagesDir = env.GITHUB_IMAGES_DIR ?? 'data';
      return await upsertCharacterFile(repo, branch, gh, charsDir, id, character, base, cors, imagesDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ message: 'save failed (upstream)', error: message, status: err instanceof GitHubError ? err.status : undefined }));
      if (err instanceof GitHubError) return upstreamResponse(cors, err.status);
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
async function upsertCharacterFile(repo, branch, gh, charsDir, id, character, base, cors, imagesDir = 'data') {
  const filePath = `${charsDir}/${id}.json`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { sha, exists } = await readCharacterFile(repo, filePath, branch, gh);
    if (base && exists && base !== sha) return staleBase(cors, sha);
    const res = await putCharacterFile(repo, branch, gh, filePath, character, exists ? sha : undefined, cors);
    if (res) {
      // Every ACTUALLY written (2xx PUT) character syncs the discovery index
      // (create the entry, or refresh its `portrait`) — never a non-409 upstream
      // failure (`putCharacterFile` returns its 502 Response here), which would
      // leave an index entry for a file that was never written.
      if (res.status < 300) await syncIndexEntry(repo, branch, gh, charsDir, id, character, imagesDir);
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
  if (!res.ok) throw new GitHubError(res.status);
  const obj = await res.json();
  return { sha: obj.sha, exists: true, content: obj.content };
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
    return upstreamResponse(cors, res.status);
  }
  return null;
}

// Discovery-index maintenance, run after every 2xx character PUT: ensure
// `id → { name, portrait }` is discoverable in `data/characters/index.json`
// (creating the index file / entry if absent) and refresh ONLY the entry's
// `portrait` when it differs. `name` is create-only (never rewritten) and other
// ids are never touched. The client-supplied portrait is validated first (null or
// `<imagesDir>/<file>.(jpg|jpeg|png|webp)`); anything else skips the index write
// entirely (the character save still succeeds). Best-effort by design — a failed
// index write is logged and tolerated (the file is truth; the index is never
// trusted for save bases).
async function syncIndexEntry(repo, branch, gh, charsDir, id, character, imagesDir = 'data') {
  const portrait = character.meta?.portrait ?? null;
  if (!isValidIndexPortrait(portrait, imagesDir)) return;
  await updateIndex(repo, branch, gh, charsDir, (file) => {
    const entry = file.characters[id];
    if (entry) {
      if ((entry.portrait ?? null) === portrait) return false; // nothing to write
      entry.portrait = portrait; // only the portrait; name and shape left alone
    } else {
      file.characters[id] = { name: character.meta?.name ?? '', portrait };
    }
    return true;
  }, 'Index character (serverless)');
}

// Shared index read -> mutate -> PUT with a bounded 409 retry. `mutate(file)`
// edits the parsed index in place (`file.characters` is guaranteed to exist) and
// returns true when a write is needed. An absent index is presented as a fresh
// empty one (created only if `mutate` changes it). Returns 'written',
// 'unchanged' or 'failed' (logged; the index is a best-effort discovery aid).
// A PUT 409 (sha moved, e.g. a raced create) is re-read and re-applied: without
// it a raced create silently drops an entry that never self-heals.
async function updateIndex(repo, branch, gh, charsDir, mutate, message) {
  const indexPath = `${charsDir}/index.json`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
      return 'failed';
    }
    file.characters = file.characters ?? {};
    if (!mutate(file)) return 'unchanged';
    const content = toBase64(JSON.stringify(file, null, 2) + '\n');
    const res = await fetch(`${GITHUB}/repos/${repo}/contents/${indexPath}`, {
      method: 'PUT',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content, sha, branch }),
    });
    if (res.ok) return 'written';
    if (res.status === 409) continue; // sha moved — re-read and retry
    console.error(JSON.stringify({ message: 'index ensure failed (write)', status: res.status }));
    return 'failed'; // non-409 upstream failure — tolerated (the file is truth)
  }
  console.error(JSON.stringify({ message: 'index ensure gave up (sha kept moving)' }));
  return 'failed';
}

// A portrait value the index accepts: null, or a one-level `<imagesDir>/<name>`
// image path. The dir comes from env (never the request).
function isValidIndexPortrait(portrait, imagesDir) {
  if (portrait === null) return true;
  if (typeof portrait !== 'string') return false;
  const prefix = `${imagesDir}/`;
  if (!portrait.startsWith(prefix)) return false;
  const name = portrait.slice(prefix.length);
  return /^[^/]+\.(jpg|jpeg|png|webp)$/i.test(name) && !name.startsWith('.');
}

// POST /delete-character { id, base, deleteImage? } — see the header. Order:
// validate (no GitHub call on a bad request) -> read file -> stale check -> decide
// the image outcome while the file still exists -> DELETE file -> drop index row
// -> DELETE image (only when every check passed). Nothing is written on a stale
// base. The branch is never created here (a delete never needs to).
async function deleteCharacter(env, body, repo, branch, gh, cors) {
  const id = body?.id;
  if (!isValidId(id))
    return json(cors, 400, { ok: false, error: { code: 'invalid_id', message: 'character id must match [a-z0-9][a-z0-9-]{0,63}' } });
  const base = body?.base;
  if (typeof base !== 'string' || base === '')
    return json(cors, 400, { ok: false, error: { code: 'invalid_base', message: 'base must be the file sha string' } });
  const charsDir = env.GITHUB_CHARS_DIR ?? 'data/characters';
  const imagesDir = env.GITHUB_IMAGES_DIR ?? 'data';
  const wantImage = body?.deleteImage !== undefined;
  const image = body?.deleteImage;
  if (wantImage && (typeof image !== 'string' || !isValidIndexPortrait(image, imagesDir)))
    return json(cors, 400, { ok: false, error: { code: 'invalid_image', message: `deleteImage must be ${imagesDir}/<file>.(jpg|jpeg|png|webp)` } });

  const filePath = `${charsDir}/${id}.json`;
  const dropRow = (f) => (id in f.characters ? (delete f.characters[id], true) : false);
  const { sha, exists, content } = await readCharacterFile(repo, filePath, branch, gh);

  if (!exists) {
    // Idempotent: nothing to delete, but a stale index row is still cleaned.
    const idx = await updateIndex(repo, branch, gh, charsDir, dropRow, 'Remove character from index (serverless)');
    return json(cors, 200, { ok: true, deleted: false, indexUpdated: idx !== 'failed', ...(wantImage ? { imageSkipped: 'unknown' } : {}) });
  }
  if (base !== sha) return staleBase(cors, sha);

  // Decide the image outcome while the file (the truth about its portrait) exists.
  let imageSkipped;
  if (wantImage) imageSkipped = await imageVerdict(repo, branch, gh, charsDir, id, image, content);

  const del = await fetch(`${GITHUB}/repos/${repo}/contents/${filePath}`, {
    method: 'DELETE',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Delete character (serverless)', sha, branch }),
  });
  if (!del.ok) {
    if (del.status === 409 || del.status === 422) {
      const current = await readCharacterFile(repo, filePath, branch, gh);
      return staleBase(cors, current.sha ?? sha);
    }
    console.error(JSON.stringify({ message: 'github DELETE failed', status: del.status }));
    return upstreamResponse(cors, del.status);
  }

  const idx = await updateIndex(repo, branch, gh, charsDir, dropRow, 'Remove character from index (serverless)');
  const out = { ok: true, deleted: true, indexUpdated: idx !== 'failed' };
  if (wantImage) {
    if (imageSkipped) {
      out.imageDeleted = false;
      out.imageSkipped = imageSkipped;
    } else {
      const done = await deleteImageFile(repo, branch, gh, image);
      out.imageDeleted = done;
      if (!done) out.imageSkipped = 'error';
    }
  }
  return json(cors, 200, out);
}

// Why the requested image must NOT be deleted, or undefined when it may be:
// 'none' (target has no portrait), 'mismatch' (not the target's own portrait),
// 'unverified' (could not prove no other character uses it), 'shared'.
async function imageVerdict(repo, branch, gh, charsDir, id, image, targetContent) {
  let portrait;
  try {
    portrait = JSON.parse(base64ToString(targetContent))?.meta?.portrait ?? null;
  } catch {
    return 'unverified';
  }
  if (portrait === null) return 'none';
  if (portrait !== image) return 'mismatch';
  try {
    // Index rows (best-effort) ...
    const idxRes = await fetch(`${GITHUB}/repos/${repo}/contents/${charsDir}/index.json?ref=${branch}`, { headers: gh });
    if (idxRes.ok) {
      const rows = JSON.parse(base64ToString((await idxRes.json()).content))?.characters ?? {};
      for (const [rid, row] of Object.entries(rows)) if (rid !== id && row?.portrait === image) return 'shared';
    } else if (idxRes.status !== 404) {
      return 'unverified';
    }
    // ... and every other character file (the file is truth).
    const list = await fetch(`${GITHUB}/repos/${repo}/contents/${charsDir}?ref=${branch}`, { headers: gh });
    if (!list.ok) return 'unverified';
    const entries = await list.json();
    if (!Array.isArray(entries)) return 'unverified';
    for (const e of entries) {
      if (e?.type !== 'file' || typeof e.name !== 'string' || !e.name.endsWith('.json')) continue;
      if (e.name === 'index.json' || e.name === `${id}.json`) continue;
      const r = await fetch(`${GITHUB}/repos/${repo}/contents/${charsDir}/${e.name}?ref=${branch}`, { headers: gh });
      if (!r.ok) return 'unverified';
      const other = JSON.parse(base64ToString((await r.json()).content));
      if (other?.meta?.portrait === image) return 'shared';
    }
  } catch {
    return 'unverified';
  }
  return undefined;
}

// DELETE one image file. Already gone (404) counts as deleted; any other failure
// is logged and reported false (never fails the character delete).
async function deleteImageFile(repo, branch, gh, path) {
  try {
    const read = await fetch(`${GITHUB}/repos/${repo}/contents/${path}?ref=${branch}`, { headers: gh });
    if (read.status === 404) return true;
    if (!read.ok) return false;
    const { sha } = await read.json();
    const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}`, {
      method: 'DELETE',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Delete portrait image (serverless)', sha, branch }),
    });
    if (res.ok || res.status === 404) return true;
    console.error(JSON.stringify({ message: 'github image DELETE failed', status: res.status }));
    return false;
  } catch (err) {
    console.error(JSON.stringify({ message: 'image delete failed', error: err instanceof Error ? err.message : String(err) }));
    return false;
  }
}

// POST /save-image { id, filename, content: <base64> } — commit one downscaled
// portrait to `<GITHUB_IMAGES_DIR|data>/<filename>`. The path is worker-pinned
// (never from the request); create-only: an existing file with identical content
// is an idempotent ok (no PUT), different content is 409 `exists` (no PUT).
async function saveImage(env, body, repo, branch, gh, cors) {
  const id = body?.id;
  if (!isValidId(id))
    return json(cors, 400, { ok: false, error: { code: 'invalid_id', message: 'character id must match [a-z0-9][a-z0-9-]{0,63}' } });
  const filename = body?.filename;
  if (typeof filename !== 'string' || !new RegExp(`^${id}-\\d{10,17}\\.(jpg|png|webp)$`).test(filename))
    return json(cors, 400, { ok: false, error: { code: 'invalid_name', message: 'filename must be <id>-<timestamp>.(jpg|png|webp)' } });
  if (typeof body?.content !== 'string' || body.content === '')
    return json(cors, 400, { ok: false, error: { code: 'invalid_image', message: 'content must be a base64 string' } });
  let bytes;
  try {
    const binary = atob(body.content);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return json(cors, 400, { ok: false, error: { code: 'invalid_image', message: 'content is not valid base64' } });
  }
  if (bytes.length > MAX_IMAGE_BYTES)
    return json(cors, 400, { ok: false, error: { code: 'too_large', message: `image exceeds ${MAX_IMAGE_BYTES} bytes` } });
  if (!magicMatches(bytes, filename.slice(filename.lastIndexOf('.') + 1)))
    return json(cors, 400, { ok: false, error: { code: 'invalid_image', message: 'bytes do not match the file extension' } });

  const path = `${env.GITHUB_IMAGES_DIR ?? 'data'}/${filename}`;
  const read = await fetch(`${GITHUB}/repos/${repo}/contents/${path}?ref=${branch}`, { headers: gh });
  if (read.ok) {
    const existing = await read.json();
    const sha = await gitBlobSha(bytes);
    if (existing.sha === sha)
      return json(cors, 200, { ok: true, path, sha, url: `https://github.com/${repo}/blob/${branch}/${path}` });
    return json(cors, 409, { ok: false, error: { code: 'exists', message: 'a different image already exists at this path' } });
  }
  if (read.status !== 404) throw new GitHubError(read.status);

  await ensureBranch(repo, branch, gh);
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Save portrait image (serverless)', content: body.content, branch }),
  });
  if (!res.ok) {
    console.error(JSON.stringify({ message: 'github PUT failed', status: res.status }));
    return upstreamResponse(cors, res.status);
  }
  const c = await res.json();
  if (!c?.content?.sha) throw new Error('GitHub returned no content.sha for the saved image');
  return json(cors, 200, { ok: true, path, sha: c.content.sha, url: c.commit?.html_url ?? c.html_url ?? null });
}

function magicMatches(b, ext) {
  const at = (off, arr) => arr.every((v, i) => b[off + i] === v);
  if (ext === 'jpg') return at(0, [0xff, 0xd8, 0xff]);
  if (ext === 'png') return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (ext === 'webp') return at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50]);
  return false;
}

// Git blob sha: sha1("blob <len>\0" + bytes) — what the contents API reports.
async function gitBlobSha(bytes) {
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head, 0);
  all.set(bytes, head.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(digest, (x) => x.toString(16).padStart(2, '0')).join('');
}

// Upsert custom items into the shared catalog at `itemsPath` (ed-items/3): GET
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
      return upstreamResponse(cors, res.status);
    }
  }
  return json(cors, 409, { ok: false, error: { code: 'conflict', message: 'sha kept moving' } });
}

// Read the custom-items catalog: `{ sha, file }` decoded from the contents API.
// A 404 (catalog not created yet) yields a fresh empty ed-items/3 file with no sha.
async function readItemsFile(repo, itemsPath, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${itemsPath}?ref=${branch}`, { headers: gh });
  if (res.status === 404)
    return {
      sha: undefined,
      file: {
        schema: 'ed-items/3',
        effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v6)',
        source: 'custom',
        notes: 'Player-created items, folded into rules/custom-items.json on dev by CI.',
        items: {},
      },
    };
  if (!res.ok) throw new GitHubError(res.status);
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

// Upsert custom skills into the shared catalog at `skillsPath` (ed-skills/1, array under
// `skills`): GET, replace-by-name or append, re-validate the WHOLE merged file, PUT with a
// bounded 409 retry. A missing file (first save) is created fresh.
async function upsertSkills(repo, branch, gh, skillsPath, delta, cors) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { sha, file } = await readSkillsFile(repo, skillsPath, branch, gh);
    for (const [name, skill] of Object.entries(delta.skills)) {
      const i = file.skills.findIndex((s) => s?.name === name);
      if (i >= 0) file.skills[i] = skill;
      else file.skills.push(skill);
    }
    const checked = validateSkillsFile(file, { coreNames: CORE_SKILL_NAMES, attributeNames: ATTRIBUTE_NAMES });
    if (!checked.ok)
      return json(cors, 400, { ok: false, error: { code: 'invalid_skills', message: checked.errors[0] } });
    const content = toBase64(JSON.stringify(file, null, 2) + '\n');
    const res = await fetch(`${GITHUB}/repos/${repo}/contents/${skillsPath}`, {
      method: 'PUT',
      headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Save custom skills (serverless)', content, sha, branch }),
    });
    if (res.ok) return ok(cors, res);
    if (res.status !== 409) {
      console.error(JSON.stringify({ message: 'github PUT failed', status: res.status }));
      return upstreamResponse(cors, res.status);
    }
  }
  return json(cors, 409, { ok: false, error: { code: 'conflict', message: 'sha kept moving' } });
}

// Read the custom-skills catalog: `{ sha, file }`. A 404 yields a fresh empty ed-skills/1 file.
async function readSkillsFile(repo, skillsPath, branch, gh) {
  const res = await fetch(`${GITHUB}/repos/${repo}/contents/${skillsPath}?ref=${branch}`, { headers: gh });
  if (res.status === 404)
    return {
      sha: undefined,
      file: { schema: 'ed-skills/1', source: 'custom', notes: 'Owner-created skills, folded from data/custom-skills.json by CI.', skills: [] },
    };
  if (!res.ok) throw new GitHubError(res.status);
  const obj = await res.json();
  const file = JSON.parse(base64ToString(obj.content));
  if (!Array.isArray(file?.skills)) file.skills = [];
  return { sha: obj.sha, file };
}

// Validate the /save-skills delta: `{ skills: { name: skill } }`. Core-name and attribute
// checks always run; collisions with already-saved custom names are caught on the merged
// file (upsertSkills), where a same-name entry is a replace and a case-variant is a duplicate.
function checkSkillsDelta(body) {
  const errors = [];
  const skills = body?.skills;
  if (typeof skills !== 'object' || skills === null || Array.isArray(skills)) {
    errors.push('skills: must be an object of name → skill');
  } else {
    for (const [name, skill] of Object.entries(skills)) {
      for (const e of validateSkill(name, skill, { coreNames: CORE_SKILL_NAMES, attributeNames: ATTRIBUTE_NAMES }).errors)
        errors.push(`skills["${name}"]: ${e}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function ok(cors, res) {
  return res.json().then((c) => {
    // A 2xx without `content.sha` is not a usable commit — fail clearly rather
    // than crash reading `.sha` of undefined.
    if (!c?.content?.sha) throw new Error('GitHub returned no content.sha for the saved file');
    return json(cors, 200, { ok: true, commit: { sha: c.content.sha, url: c.html_url } });
  });
}

// A failed GitHub call, carrying its HTTP status so the catch-all can map it.
class GitHubError extends Error {
  constructor(status) {
    super(`github ${status}`);
    this.status = status;
  }
}

// Map a GitHub failure status to a clear 502 the app can show. 401/403 almost
// always mean the worker's GITHUB_TOKEN is expired, revoked or lacks access
// (403 can also be a rate limit); 404 means the repo or data branch is missing.
function upstreamResponse(cors, status) {
  if (status === 401 || status === 403)
    return json(cors, 502, { ok: false, error: { code: 'github_auth', message: `GitHub rejected the worker's token (${status}): it may be expired, revoked, rate-limited or lack write access. Renew GITHUB_TOKEN.` } });
  if (status === 404)
    return json(cors, 502, { ok: false, error: { code: 'github_not_found', message: 'GitHub could not find the repo or the data branch (404). Check GITHUB_OWNER, GITHUB_REPO and GITHUB_BRANCH.' } });
  return json(cors, 502, { ok: false, error: { code: 'upstream', message: `github ${status}` } });
}

// First save on a fresh repo: create the data branch from the default branch so
// the contents API has a ref to write into. No-op on every later save.
async function ensureBranch(repo, branch, gh) {
  const head = await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${branch}`, { headers: gh });
  if (head.ok) return;
  // Anything but "branch not found" (bad/expired token, rate limit, outage) is
  // not a reason to try creating it — surface the real status.
  if (head.status !== 404) throw new GitHubError(head.status);
  const metaRes = await fetch(`${GITHUB}/repos/${repo}`, { headers: gh });
  if (!metaRes.ok) throw new GitHubError(metaRes.status);
  const meta = await metaRes.json();
  const baseRes = await fetch(`${GITHUB}/repos/${repo}/git/ref/heads/${meta.default_branch}`, { headers: gh });
  if (!baseRes.ok) throw new GitHubError(baseRes.status);
  const base = await baseRes.json();
  const created = await fetch(`${GITHUB}/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
  if (!created.ok) throw new GitHubError(created.status);
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
  // ed-character/2: talent `tier` stripped (derived from the learned Circle,
  // PLAN-TALENT-TIER-DERIVATION). /1 files keep saving until each is rewritten.
  return (
    !!c &&
    typeof c === 'object' &&
    (c.schema === 'ed-character/1' || c.schema === 'ed-character/2') &&
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
