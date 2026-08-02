// store-file.js — optional "write the character to a real file" persistence,
// layered on top of the always-on localStorage overlay (see store.js).
//
// ARCHITECTURE §7/§10: this is the File System Access half of the persistence
// story. The web store (localStorage overlay) is the resilient working copy;
// this module writes the *same* merged, inputs-only character to a file the user
// picks — their durable, committable backup. Save dual-writes both, so within a
// session memory ↔ web store ↔ file stay in sync. Chromium-only; callers must
// feature-detect with isFileSaveSupported() and hide the affordance otherwise.
//
// Not an engine module: it's pure I/O plumbing (no game logic, no DOM), kept out
// of store.js so the derive/overlay code stays free of browser-storage APIs.

// --- tiny IndexedDB key/value (localStorage can't hold a file handle) --------
const DB_NAME = 'ed-file';
const STORE = 'handles';
const HANDLE_KEY = 'character';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key, val) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// --- public API --------------------------------------------------------------

/** True only where the browser can write a user-picked file (Chromium). */
export function isFileSaveSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

// In-memory cache of the connected handle for this session.
let _handle = null;

/**
 * Reconnect the file remembered from a previous session (no prompt, no write —
 * the browser re-asks for write permission only when we actually save).
 * Returns { name } if a handle was restored, else null.
 */
export async function restoreFileHandle() {
  if (!isFileSaveSupported()) return null;
  try {
    _handle = (await idbGet(HANDLE_KEY)) || null;
  } catch {
    _handle = null; // a broken handle store must never block the app
  }
  return _handle ? { name: _handle.name } : null;
}

/** Name of the currently connected file, or null. */
export function connectedFileName() {
  return _handle ? _handle.name : null;
}

async function ensureWritePermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/**
 * Open the save picker and remember the chosen file for future saves.
 * Throws DOMException 'AbortError' if the user cancels — callers treat that as
 * a no-op, not an error.
 */
export async function connectFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'character.json',
    types: [{ description: 'Earthdawn character', accept: { 'application/json': ['.json'] } }],
  });
  _handle = handle;
  await idbSet(HANDLE_KEY, handle);
  return { name: handle.name };
}

/**
 * Write the merged, inputs-only character object to the connected file. Picks a
 * file first if none is connected yet. Returns { name } of the file written.
 * Callers pass the same object the overlay/model derive from, so the file and
 * the web store hold identical inputs after a save.
 */
export async function saveToFile(character) {
  if (!_handle) await connectFile(); // may throw AbortError (user cancelled)
  if (!(await ensureWritePermission(_handle))) {
    throw new Error('Permission to write the file was denied.');
  }
  const writable = await _handle.createWritable();
  await writable.write(JSON.stringify(character, null, 2) + '\n');
  await writable.close();
  return { name: _handle.name };
}
