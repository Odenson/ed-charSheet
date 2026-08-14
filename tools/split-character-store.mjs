#!/usr/bin/env node
// tools/split-character-store.mjs — one-shot migration of the legacy grouped
// store to per-character files (plans/PLAN-SAVE-CONCURRENCY Phase D1).
//
// Reads the local gitignored working copy `data/characters.json` (the grouped
// `ed-characters/1` store, as written by the pre-split worker) and writes:
//   data/characters/<id>.json   — the raw `ed-character/1` entry, no wrapper
//   data/characters/index.json  — the discovery index `{ name, portrait }`
//
// The output is gitignored (D1b) — the real migration lives on the
// `character-data` branch (owner push, D2); this script produces the exact file
// set to commit there (or a local working copy to dev against). Cross-checks
// each id against its `meta.id` (a mismatch is a warning, never a rename — the
// file name is authoritative and path-safe by the worker's ID_RE) and prints a
// summary: id → name, count, warnings.
//
// Run:  node tools/split-character-store.mjs
// Tests: node --test tools/split-character-store.test.js

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/; // mirrors worker.js isValidId

/**
 * Split a grouped store into per-character files + a discovery index. Pure and
 * DOM-free — the unit-tested core; main() does the file I/O.
 *
 * @param {object} store the legacy `{ schema: "ed-characters/1", characters: { id: entry } }`
 * @param {object} [opts] `{ indexSchema }` — default `ed-characters-index/1`
 * @returns {{ files: Array<{id, character}>, index: object, warnings: string[] }}
 */
export function splitCharacterStore(store, { indexSchema = 'ed-characters-index/1' } = {}) {
  const files = [];
  const indexCharacters = {};
  const warnings = [];
  const entries = store?.characters ?? {};
  const ids = Object.keys(entries).sort();
  for (const id of ids) {
    const character = entries[id];
    if (!character || typeof character !== 'object' || Array.isArray(character)) {
      warnings.push(`"${id}": entry is not an object — skipped`);
      continue;
    }
    if (!ID_RE.test(id)) {
      warnings.push(`"${id}": not a safe filename (ID_RE) — skipped`);
      continue;
    }
    const metaId = character.meta?.id;
    if (metaId !== undefined && metaId !== id) {
      warnings.push(`"${id}": meta.id is "${metaId}" — keeping the file name (authoritative)`);
    }
    files.push({ id, character });
    indexCharacters[id] = { name: character.meta?.name ?? '', portrait: character.meta?.portrait ?? null };
  }
  return { files, index: { schema: indexSchema, characters: indexCharacters }, warnings };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const storePath = join(root, 'data', 'characters.json');
  const charsDir = join(root, 'data', 'characters');
  const indexPath = join(charsDir, 'index.json');

  let store;
  try {
    store = JSON.parse(await readFile(storePath, 'utf8'));
  } catch (e) {
    console.error(`Couldn't read ${storePath}: ${e.message}`);
    console.error('Expected the legacy grouped store (v1.6.0 layout). Nothing written.');
    process.exit(1);
  }

  const { files, index, warnings } = splitCharacterStore(store);

  await mkdir(charsDir, { recursive: true });
  for (const { id, character } of files) {
    await writeFile(join(charsDir, `${id}.json`), `${JSON.stringify(character, null, 2)}\n`);
  }
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  console.log(`Split ${files.length} character(s) from ${storePath}:`);
  for (const { id, character } of files) {
    console.log(`  ${id} → ${character.meta?.name ?? '(no name)'}`);
  }
  if (warnings.length) {
    console.warn('\nWarnings:');
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  console.log(`\nWrote ${files.length} file(s) + index.json to ${charsDir} (gitignored).`);
}

// Run as a script only (tests import the pure function).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
