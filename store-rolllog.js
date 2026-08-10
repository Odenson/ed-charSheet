// store-rolllog.js — per-character roll log (PLAN-NOTES-TAB, decisions #2/#5/#7).
// Ephemeral, device-local game-time view: it survives reloads on this browser
// but is deliberately never part of character data, never exported, and never
// written to a GitHub save — it does not follow the character to another device,
// and that is intended. High churn means it never rides the edits overlay.
// Each roll interaction owns a `rollId`; an entry is UPSERTED by that id, so
// Karma toggles / "Roll again" replace the row instead of stacking duplicates.

export const DEFAULT_MAX = 20;
export const MAX_OPTIONS = [10, 20, 50];

const rollLogKey = (id) => `ed-rolllog:${id}`;

// Read the store for `id`, normalising shape: `{ max, entries }`, newest first.
// Corrupt/absent data degrades to defaults — a broken log must never break the
// sheet or the roll flow.
function readRollLog(id) {
  try {
    const raw = JSON.parse(localStorage.getItem(rollLogKey(id)) || '{}') || {};
    const max = MAX_OPTIONS.includes(raw.max) ? raw.max : DEFAULT_MAX;
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    return { max, entries };
  } catch {
    return { max: DEFAULT_MAX, entries: [] };
  }
}

function writeRollLog(id, value) {
  try {
    localStorage.setItem(rollLogKey(id), JSON.stringify(value));
  } catch {
    /* storage full/unavailable — fail open, never break a roll */
  }
  return value;
}

export function loadRollLog(id) {
  return readRollLog(id);
}

/**
 * Record a completed roll interaction. The entry is unshifted and any older
 * entry with the same `rollId` is dropped first (the upsert of Decision #5), so
 * a Karma re-roll or "Roll again" overwrites the one row for that interaction
 * rather than appending a duplicate. The list is then trimmed to the stored
 * `max` (kept when valid, else the default). Pure; never touches the engine.
 */
export function saveRollLog(entry, id) {
  if (!entry || entry.rollId == null) return readRollLog(id);
  const cur = readRollLog(id);
  const entries = [entry, ...cur.entries.filter((e) => e.rollId !== entry.rollId)].slice(0, cur.max);
  return writeRollLog(id, { max: cur.max, entries });
}

/** Change the "keep last N" cap (one of MAX_OPTIONS) for `id`; trims to fit. */
export function setRollLogMax(max, id) {
  const cur = readRollLog(id);
  const nextMax = MAX_OPTIONS.includes(max) ? max : DEFAULT_MAX;
  return writeRollLog(id, { max: nextMax, entries: cur.entries.slice(0, nextMax) });
}

/** Empty the log for `id` (the Roll Log view's "Clear"). */
export function clearRollLog(id) {
  try {
    localStorage.removeItem(rollLogKey(id));
  } catch {
    /* fail open */
  }
  return { max: DEFAULT_MAX, entries: [] };
}
