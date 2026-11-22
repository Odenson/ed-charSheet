// store-portrait.js — the portrait upload's local plumbing (plans/add-char-portrait).
//
//  - the STAGED image: one downscaled upload per character, kept in its own
//    localStorage key `ed-character-image:<id>` as `{ path, mime, dataUrl }`. It is
//    an INPUT held in the local overlay until the next Save uploads it — never in
//    the character JSON, never in `SAVED_CATEGORIES`, never derived;
//  - the branch image LISTING behind the modal's pick-list (contents API on Pages,
//    the dev server's `GET /list-images` locally; `[]` on any failure);
//  - `runPortraitSave`, the save-ordering seam `_doSave` calls (image, then JSON).
//
// Not an engine module: browser storage / network plumbing, no game logic.

const KEY_PREFIX = 'ed-character-image:';
const IMAGE_RE = /\.(jpg|jpeg|png|webp)$/i;
const imageKey = (id) => `${KEY_PREFIX}${id}`;

// --- staged image ---------------------------------------------------------------------------

/** Stage `{ path, mime, dataUrl }` for `id` (replaces any earlier one). A storage
 *  failure (quota) is reported, never thrown, and leaves nothing half-staged. */
export function stagePortraitImage(id, { path, mime, dataUrl }) {
  try {
    localStorage.setItem(imageKey(id), JSON.stringify({ path, mime, dataUrl }));
    return { ok: true };
  } catch {
    return { ok: false, error: 'quota' };
  }
}

/** The staged image for `id`, or null (absent, corrupt or incomplete = none). */
export function loadStagedPortrait(id) {
  let raw;
  try {
    raw = localStorage.getItem(imageKey(id));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    if (typeof v.path !== 'string' || typeof v.mime !== 'string' || typeof v.dataUrl !== 'string') return null;
    return { path: v.path, mime: v.mime, dataUrl: v.dataUrl };
  } catch {
    return null;
  }
}

export function clearStagedPortrait(id) {
  try {
    localStorage.removeItem(imageKey(id));
  } catch {
    /* storage unavailable — nothing staged anyway */
  }
}

export function hasStagedPortrait(id) {
  return loadStagedPortrait(id) !== null;
}

// Session-only (in-memory, never persisted) copy of a just-saved image keyed by its
// path: after a save the staged key is cleared and the view flips to the raw
// branch URL, which can lag behind the commit on the CDN. Serving the data URL
// until the page reloads avoids a flash of the placeholder.
const justSaved = new Map();
export function rememberSavedPortrait(path, dataUrl) {
  if (path && dataUrl) justSaved.set(path, dataUrl);
}
export function savedPortraitDataUrl(path) {
  return justSaved.get(path) ?? null;
}

// --- branch image listing -------------------------------------------------------------------

const byNameDesc = (a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0);

/** Contents-API array -> `[{ path, name, url }]`: image FILES only, newest first
 *  by name (descending; filenames embed a timestamp). Garbage -> []. */
export function parseImageListing(json) {
  if (!Array.isArray(json)) return [];
  return json
    .filter((e) => e && typeof e === 'object' && e.type === 'file' && typeof e.name === 'string' && typeof e.path === 'string' && IMAGE_RE.test(e.name))
    .map((e) => ({ path: e.path, name: e.name, url: typeof e.download_url === 'string' ? e.download_url : '' }))
    .sort(byNameDesc);
}

/** Dev-server `{ images: [name, ...] }` -> the same row shape (`data/<name>`). */
export function parseLocalListing(json) {
  if (!json || !Array.isArray(json.images)) return [];
  return json.images
    .filter((n) => typeof n === 'string' && IMAGE_RE.test(n))
    .map((n) => ({ path: `data/${n}`, name: n, url: `./data/${n}` }))
    .sort(byNameDesc);
}

const LISTING_TTL_MS = 30_000;
const listingCache = new Map(); // key -> { at, rows }

/** Drop the cached listing (call after a save adds an image). */
export function invalidateImageListing() {
  listingCache.clear();
}

/** The images on the data branch: Pages -> GitHub contents API for `data/`; local
 *  -> the dev server's `./list-images`. `[]` on ANY failure. Cached briefly. */
export async function listBranchImages({ fetchFn = fetch, pages, owner, repo, branch } = {}) {
  const key = `${pages ? 'p' : 'l'}|${owner}|${repo}|${branch}`;
  const hit = listingCache.get(key);
  if (hit && Date.now() - hit.at < LISTING_TTL_MS) return hit.rows;
  try {
    const url = pages ? `https://api.github.com/repos/${owner}/${repo}/contents/data?ref=${branch}` : './list-images';
    const res = await fetchFn(url, pages ? { headers: { Accept: 'application/vnd.github+json' } } : undefined);
    if (!res.ok) return [];
    const json = await res.json();
    const rows = pages ? parseImageListing(json) : parseLocalListing(json);
    listingCache.set(key, { at: Date.now(), rows });
    return rows;
  } catch {
    return [];
  }
}

// --- save ordering --------------------------------------------------------------------------

/**
 * The portrait-aware save sequence `_doSave` runs (draft first-save and normal
 * branches alike). `portrait` is `character.meta.portrait`; `uploadImage(staged)`
 * and `postCharacter()` are injected async fns, `clearStaged(id)` is sync.
 *
 *  - staged + keepalive      -> `{ skipped: true }`, NO calls (a flush-on-hide
 *                               request can't carry an image; the overlay stays dirty)
 *  - staged, path mismatch   -> `clearStaged(id)` (stale, never uploaded), then post
 *  - staged, path matches    -> upload (a throw propagates, no post, staged kept),
 *                               then post, then `clearStaged` only after it resolves
 *  - nothing staged          -> post
 * `meta.portrait` therefore never points at an uncommitted file on the branch.
 */
export async function runPortraitSave({ id, portrait, staged, keepalive, uploadImage, postCharacter, clearStaged }) {
  if (staged && keepalive) return { skipped: true };
  if (!staged) return { skipped: false, result: await postCharacter() };
  if (staged.path !== portrait) {
    clearStaged(id);
    return { skipped: false, result: await postCharacter() };
  }
  await uploadImage(staged);
  const result = await postCharacter();
  clearStaged(id);
  return { skipped: false, result };
}

/**
 * A draft was renamed (oldId -> newId): move its staged image to the new id,
 * re-prefixing the path/filename (`data/<oldId>-<ts>.<ext>` -> `data/<newId>-...`;
 * the worker requires the filename prefix to equal the save id). Clears the old
 * key. Returns the new staged `{ path, mime, dataUrl }` (or null when nothing was
 * staged / storage failed), so the caller can point `meta.portrait` at it.
 */
export function moveStagedPortrait(oldId, newId) {
  const staged = loadStagedPortrait(oldId);
  if (!staged) return null;
  const prefix = `data/${oldId}-`;
  const path = staged.path.startsWith(prefix) ? `data/${newId}-${staged.path.slice(prefix.length)}` : staged.path;
  const moved = { ...staged, path };
  const res = stagePortraitImage(newId, moved);
  if (!res.ok) return null;
  clearStagedPortrait(oldId);
  return moved;
}
