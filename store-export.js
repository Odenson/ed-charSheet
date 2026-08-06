// store-export.js — export the character as a downloaded file. Portable: a plain
// Blob download, so it works in every browser (Firefox / Safari / mobile), not
// just Chromium. Replaces the retired File System Access save (store-file.js):
// with GitHub the canonical store (store-server.js), a local file is just an
// exportable backup, and a download is the right fit for that.
//
// Not an engine module: pure I/O plumbing (no game logic), kept out of store.js.

/**
 * Serialize the merged, inputs-only character exactly as the worker commits it:
 * pretty-printed JSON with a trailing newline. Keeping this byte-identical means
 * an exported file and a GitHub-saved file are the same bytes.
 */
export function serializeCharacter(character) {
  return JSON.stringify(character, null, 2) + '\n';
}

// A filesystem-friendly filename from the character's name, e.g. "Chakka.json".
function filenameFor(character) {
  const name = String(character?.meta?.name || '').trim();
  const slug = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return slug ? `${slug}.json` : 'character.json';
}

/**
 * Trigger a browser download of the character as a `.json` file. Returns the
 * filename used. Pure download — no permissions, no picker, no handle to keep.
 */
export function exportCharacter(character, filename = filenameFor(character)) {
  const blob = new Blob([serializeCharacter(character)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
