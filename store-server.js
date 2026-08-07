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
 * on success; throws a typed {@link SaveError} otherwise. `saveKey` is required
 * (the worker fails closed) — a missing key throws `no_key` before any request,
 * so the caller can prompt for it. `id` (the character's map key in the grouped
 * store) makes the save an upsert of `characters[id]`; without it the worker
 * falls back to the legacy single-file path.
 */
export async function saveServer(character, { endpoint = DEFAULT_ENDPOINT, saveKey, id } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');

  const payload = id !== undefined ? { character, id } : { character };
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify(payload),
    });
  } catch {
    // The fetch itself failed — offline, DNS, CORS, or the worker is unreachable.
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) {
    const code = out?.error?.code ?? `http_${res.status}`;
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return out.commit; // { sha, url }
}
