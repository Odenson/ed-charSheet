// store-server.js — the GitHub save target: POST the merged, inputs-only
// character to the Cloudflare Worker (tools/worker), which commits it to the
// `character-data` branch on the app's behalf. The GitHub credential never
// touches the browser; only the SAVE_KEY (held in memory for the session)
// travels with the request. See docs/GITHUB-SERVERLESS-SAVE.md and the runbook.
//
// Not an engine module: pure I/O plumbing (no game logic, no DOM), kept out of
// store.js so the derive/overlay code stays free of network APIs — the same
// separation store-export.js keeps for the download path.

// The deployed worker (runbook §7). Overridable per call, but hardcoded here so
// the app needs no configuration to save.
export const DEFAULT_ENDPOINT = 'https://ed-charsheet-save.edsavechar.workers.dev/save';

// The portrait-image route on the same worker (POST /save-image).
export const DEFAULT_IMAGE_ENDPOINT = DEFAULT_ENDPOINT.replace(/\/save$/, '/save-image');

// The delete route on the same worker (POST /delete-character).
export const DEFAULT_DELETE_ENDPOINT = DEFAULT_ENDPOINT.replace(/\/save$/, '/delete-character');

/** A save failure with a stable `code` the UI maps to feedback. */
export class SaveError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'SaveError';
    this.code = code;
  }
}

/**
 * The optimistic-concurrency conflict (worker `409 { code: "stale_base", sha }`):
 * the character changed on the branch since this client loaded it. Carries the
 * **current file sha** (`{ sha }`) so the caller can offer keep-mine (re-save
 * with that sha as the acknowledged overwrite base) / take-theirs (reload).
 * Distinct from the exhausted no-base retry code `conflict` (a generic SaveError
 * → toast); `stale_base` always routes to the conflict modal.
 */
export class SaveConflictError extends SaveError {
  constructor(message, sha) {
    super('stale_base', message);
    this.name = 'SaveConflictError';
    this.sha = sha;
  }
}

// Human-readable fallback for a worker error code when it sends no message.
function messageForCode(code) {
  switch (code) {
    case 'unauthorized':
      return 'Your save key was rejected. Re-enter it and try again.';
    case 'invalid_character':
      return 'The character failed validation and was not saved.';
    case 'invalid_id':
      return 'The character id failed validation and was not saved.';
    case 'exists':
      return 'A different image already exists at that path. Pick the portrait again.';
    case 'too_large':
      return 'The portrait image is too large to upload.';
    case 'invalid_image':
    case 'invalid_name':
      return 'The portrait image was rejected. Pick it again.';
    case 'invalid_base':
      return 'The character version could not be verified. Reload and try again.';
    case 'conflict':
      return 'The saved file kept changing under us — try saving again.';
    case 'upstream':
      return 'GitHub rejected the save. Check the token, then try again.';
    default:
      return 'The save did not complete.';
  }
}

/**
 * Save the character to GitHub via the worker. Returns the commit `{ sha, url }`
 * on success — `sha` is the new file blob sha, the caller's **next base** — and
 * throws a typed error otherwise:
 * - `SaveConflictError` (code `stale_base`, `.sha` = current file sha) — the
 *   character changed on the branch since this client loaded it; route to the
 *   keep-mine/take-theirs modal.
 * - `SaveError` for everything else — `no_key` before any request (prompt for
 *   the key), `unauthorized` (re-prompt), `conflict` (no-base retry exhausted →
 *   toast), `offline`, or a worker code.
 *
 * `saveKey` is required (the worker fails closed). `id` (the character's file
 * name) is required. `base` is the file sha this client last saw (from the read
 * ETag or the previous save) — the optimistic-concurrency token; omit/null it to
 * take the legacy overwrite path (local dev / CDN-fallback session).
 */
export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey, id, base = null, keepalive = false } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ character, id, base }),
      // A flush-on-hide autosave fires as the page is unloading; keepalive lets
      // the request outlive the document so the last edits still reach the worker.
      keepalive,
    });
  } catch {
    // The fetch itself failed — offline, DNS, CORS, or the worker is unreachable.
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) {
    const code = out?.error?.code ?? `http_${res.status}`;
    if (code === 'stale_base') throw new SaveConflictError(out?.error?.message || 'This character changed on another device or player.', out?.error?.sha ?? null);
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return out.commit; // { sha, url } — sha is the new file blob sha (next base)
}

/**
 * Upload a staged portrait image (`{ path, mime, dataUrl }` from the
 * `ed-character-image:<id>` overlay) via the worker's `POST /save-image`. The
 * worker pins the path (`data/<filename>`); only the filename travels. Resolves
 * ONLY on `ok:true` (an identical-content retry is ok server-side); `exists`
 * (different content at that path) and every other failure throw a `SaveError`
 * with the worker's code — `no_key` before any request, `offline` on a network
 * failure. Mirrors `saveServer`'s error handling.
 */
export async function saveImage(staged, { endpoint = DEFAULT_IMAGE_ENDPOINT, saveKey, id } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');
  const filename = String(staged.path).split('/').pop();
  const content = String(staged.dataUrl).replace(/^data:[^,]*,/, '');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ id, filename, content }),
    });
  } catch {
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok !== true) {
    const code = out?.error?.code ?? `http_${res.status}`;
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return { path: out.path, sha: out.sha, url: out.url };
}

/**
 * Delete a character via the worker's `POST /delete-character`. `base` is the file
 * sha this client last saw (null only off Pages / local dev); `deleteImage` is the
 * character's own committed portrait path (the worker pins it to the file's
 * `meta.portrait` and refuses shared images). Resolves
 * `{ deleted, indexUpdated, imageDeleted, imageSkipped }`; throws `SaveError`
 * (`no_key`, `unauthorized`, `offline`, worker codes) or `SaveConflictError`
 * (`stale_base`, nothing was deleted).
 */
export async function deleteCharacterServer({ id, base = null, deleteImage } = {}, { endpoint = DEFAULT_DELETE_ENDPOINT, saveKey } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to delete from GitHub.');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ id, base, deleteImage }),
    });
  } catch {
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok !== true) {
    const code = out?.error?.code ?? `http_${res.status}`;
    if (code === 'stale_base') throw new SaveConflictError(out?.error?.message || 'This character changed on the branch.', out?.error?.sha ?? null);
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return { deleted: out.deleted, indexUpdated: out.indexUpdated, imageDeleted: out.imageDeleted, imageSkipped: out.imageSkipped };
}
