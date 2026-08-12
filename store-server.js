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
export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey, id, base = null } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ character, id, base }),
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
