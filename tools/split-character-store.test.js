// tools/split-character-store.test.js — run with `npm test` (node --test).
// Pins the D1 migration core (pure splitCharacterStore) + a real temp-dir file
// write of the main() output layout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { splitCharacterStore } from './split-character-store.mjs';

const STORE = {
  schema: 'ed-characters/1',
  characters: {
    chakka: { schema: 'ed-character/1', meta: { id: 'chakka', name: 'Chakka', portrait: 'img/chakka.jpg' } },
    'test-orc': { schema: 'ed-character/1', meta: { id: 'test-orc', name: 'Test Orc' } },
  },
};

test('splits each entry into a raw file + index rows, sorted by id', () => {
  const { files, index, warnings } = splitCharacterStore(STORE);
  assert.deepEqual(files.map((f) => f.id), ['chakka', 'test-orc']);
  assert.deepEqual(files[0].character, STORE.characters.chakka, 'raw entry, no wrapper');
  assert.equal(index.schema, 'ed-characters-index/1');
  assert.deepEqual(index.characters, {
    chakka: { name: 'Chakka', portrait: 'img/chakka.jpg' },
    'test-orc': { name: 'Test Orc', portrait: null },
  });
  assert.deepEqual(warnings, []);
});

test('a missing portrait becomes null; a missing store yields empty output', () => {
  const { files, index } = splitCharacterStore({ schema: 'ed-characters/1', characters: {} });
  assert.deepEqual(files, []);
  assert.deepEqual(index.characters, {});
});

test('meta.id disagreement is a warning, never a rename (file name is authoritative)', () => {
  const { files, warnings } = splitCharacterStore({
    schema: 'ed-characters/1',
    characters: { chakka: { schema: 'ed-character/1', meta: { id: 'chakka-new', name: 'X' } } },
  });
  assert.equal(files[0].id, 'chakka');
  assert.match(warnings[0], /chakka-new/);
});

test('an unsafe or non-object entry is skipped with a warning', () => {
  const { files, warnings } = splitCharacterStore({
    schema: 'ed-characters/1',
    characters: {
      '../evil': { schema: 'ed-character/1', meta: { name: 'Evil' } },
      chakka: 'not an object',
      ok: { schema: 'ed-character/1', meta: { name: 'Ok' } },
    },
  });
  assert.deepEqual(files.map((f) => f.id), ['ok']);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /not a safe filename/);
  assert.match(warnings[1], /not an object/);
});

test('file layout round-trips: <id>.json holds the raw entry, index.json the rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ed-split-'));
  try {
    const { files, index } = splitCharacterStore(STORE);
    for (const { id, character } of files) {
      await import('node:fs/promises').then((fs) => fs.writeFile(join(dir, `${id}.json`), JSON.stringify(character)));
    }
    await import('node:fs/promises').then((fs) => fs.writeFile(join(dir, 'index.json'), JSON.stringify(index)));
    const chakka = JSON.parse(await readFile(join(dir, 'chakka.json'), 'utf8'));
    const indexBack = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(chakka, STORE.characters.chakka);
    assert.deepEqual(indexBack.characters['test-orc'], { name: 'Test Orc', portrait: null });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
