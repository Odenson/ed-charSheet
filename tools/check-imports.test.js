// tools/check-imports.test.js — run with `npm test` (node --test, no deps).
// Exercises the static import validator on in-memory fixtures (the analyzer is
// pure, so no temp files) plus a guard that the real repo stays clean.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeModules } from './check-imports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kinds = (errs) => errs.map((e) => e.kind).sort();

// A minimal provider module (store*/engine names are the ones the missing-import
// heuristic treats as "must be imported to use").
const store = {
  rel: 'store.js',
  src: `export function saveNotesEdits(notes, id) { return [notes, id]; }
        export function deriveModel(x) { return x; }`,
};

test('flags a known store export used without importing it (the regression)', () => {
  const consumer = {
    rel: 'ui/ed-app.js',
    src: `import { deriveModel } from '../store.js';
          class EdApp { _editNotes(notes) { saveNotesEdits(notes, this.id); return deriveModel(notes); } }`,
  };
  const { errors } = analyzeModules([store, consumer]);
  assert.deepEqual(kinds(errors), ['missing-import']);
  assert.match(errors[0].msg, /saveNotesEdits/);
  assert.equal(errors[0].file, 'ui/ed-app.js');
});

test('clean once the missing import is added', () => {
  const consumer = {
    rel: 'ui/ed-app.js',
    src: `import { deriveModel, saveNotesEdits } from '../store.js';
          class EdApp { _editNotes(notes) { saveNotesEdits(notes, this.id); return deriveModel(notes); } }`,
  };
  const { errors } = analyzeModules([store, consumer]);
  assert.deepEqual(errors, []);
});

test('flags importing a name the target does not export', () => {
  const consumer = {
    rel: 'ui/ed-app.js',
    src: `import { saveNotesEdits, saveGhostEdits } from '../store.js';
          saveNotesEdits(); saveGhostEdits();`,
  };
  const { errors } = analyzeModules([store, consumer]);
  assert.ok(errors.some((e) => e.kind === 'bad-import' && /saveGhostEdits/.test(e.msg)));
});

test('flags importing from a path that does not exist', () => {
  const consumer = { rel: 'ui/ed-app.js', src: `import { x } from '../store-nope.js'; x();` };
  const { errors } = analyzeModules([store, consumer]);
  assert.deepEqual(kinds(errors), ['missing-file']);
});

test('a param that shadows a provider export is not a false positive', () => {
  // mirrors engine/health.js `woundsFromHit(take, woundThreshold)` where
  // `woundThreshold` is also an engine export elsewhere.
  const provider = { rel: 'engine/characteristics.js', src: `export function woundThreshold() {}` };
  const other = {
    rel: 'engine/health.js',
    src: `export function woundsFromHit(take, woundThreshold) { return woundThreshold != null && take >= woundThreshold ? 1 : 0; }`,
  };
  const { errors } = analyzeModules([provider, other]);
  assert.deepEqual(errors, []);
});

test('a name mentioned only in a comment or string is not a use', () => {
  const consumer = {
    rel: 'ui/ed-app.js',
    src: `import { deriveModel } from '../store.js';
          // saveNotesEdits is described here
          const doc = 'call saveNotesEdits(x) to persist';
          deriveModel(doc);`,
  };
  const { errors } = analyzeModules([store, consumer]);
  assert.deepEqual(errors, []);
});

test('namespace and aliased imports are recognized as bindings', () => {
  const consumer = {
    rel: 'ui/ed-app.js',
    src: `import * as store from '../store.js';
          import { saveNotesEdits as save } from '../store.js';
          store.deriveModel(); save();`,
  };
  const { errors } = analyzeModules([store, consumer]);
  assert.deepEqual(errors, []);
});

test('the real repository passes the import check', () => {
  const rels = [];
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir)) {
      const abs = resolve(absDir, entry);
      const rel = relative(ROOT, abs).split(sep).join('/');
      if (statSync(abs).isDirectory()) { if (rel === 'engine' || rel === 'ui') walk(abs); continue; }
      if (!rel.endsWith('.js') || rel.endsWith('.test.js')) continue;
      if (rel.includes('/') && !rel.startsWith('engine/') && !rel.startsWith('ui/')) continue;
      rels.push(rel);
    }
  };
  walk(ROOT);
  const modules = rels.map((rel) => ({ rel, src: readFileSync(resolve(ROOT, rel), 'utf8') }));
  const { errors } = analyzeModules(modules);
  assert.deepEqual(errors, [], `import problems:\n${errors.map((e) => `${e.file}:${e.line} ${e.msg}`).join('\n')}`);
});
