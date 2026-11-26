// ui/notes-edit-source.test.js — run with `npm test` (node --test, no deps).
// Source-level guards for plans/update-notes-edit (Notes editable outside edit mode). ed-notes is a
// lit component and cannot be loaded under node, so these read the module text and pin only the
// contract points the spec states verbatim: editMode is gone from ed-notes and from its binding in
// ed-app (the <ed-combat> binding stays), the pure helper is imported by relative path, the
// read/edit split selectors are gone, the popup action row uses `.nfoot` (never `.mfoot`), and
// ed-notes stays at 0 on every check-ui-kit counter. NEW-FEATURE tests: fail until the dev builds it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countViolations } from '../tools/check-ui-kit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const NOTES = read('ui/ed-notes.js');
const APP = read('ui/ed-app.js');

// The literal <tag ...>...</tag> template block for a custom element in ed-app.
const tagBlock = (src, tag) => {
  const m = src.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`));
  assert.ok(m, `<${tag}> template not found in ui/ed-app.js`);
  return m[0];
};

describe('ui/ed-notes.js — edit-mode independence (I1)', () => {
  test('no longer references editMode at all', () => {
    assert.doesNotMatch(NOTES, /editMode/);
  });

  test('the read-only card variant (.cards.read) is gone', () => {
    assert.doesNotMatch(NOTES, /\.cards\.read\b/);
    assert.doesNotMatch(NOTES, /class="cards read/);
  });

  test('the old edit-mode action row (.nactions) is gone', () => {
    assert.doesNotMatch(NOTES, /nactions/);
  });

  test('the edit-mode-only empty hint is gone; the single empty message remains', () => {
    assert.doesNotMatch(NOTES, /Turn on edit mode/);
    assert.match(NOTES, /No notes yet — add NPCs, locations, quest threads, or table reminders\./);
  });
});

describe('ui/ed-notes.js — helper wiring (I4)', () => {
  test('imports upsertNote and removeNote from ./notes-state.js', () => {
    const imp = NOTES.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/notes-state\.js['"]/);
    assert.ok(imp, 'expected a named import from ./notes-state.js');
    const names = imp[1].split(',').map((s) => s.trim());
    assert.ok(names.includes('upsertNote'), 'upsertNote not imported');
    assert.ok(names.includes('removeNote'), 'removeNote not imported');
  });

  test('ui/notes-state.js is pure: no lit / DOM-component imports', () => {
    const src = read('ui/notes-state.js');
    assert.doesNotMatch(src, /from\s*['"]lit['"]/);
    assert.doesNotMatch(src, /\bdocument\b|\bwindow\b|customElements/);
  });
});

describe('ui/ed-notes.js — card and popup markup (I2, I3)', () => {
  test('card has a .nread expand target with role="button" and a sibling .nicons row', () => {
    assert.match(NOTES, /class="nread"/);
    assert.match(NOTES, /role="button"/);
    assert.match(NOTES, /class="nicons"/);
  });

  test('icon buttons keep their aria-labels', () => {
    assert.match(NOTES, /aria-label="Edit note"/);
    assert.match(NOTES, /aria-label="Delete note"/);
  });

  test('popup action row uses .nfoot, never the kit .mfoot', () => {
    assert.match(NOTES, /class="nfoot"/);
    assert.doesNotMatch(NOTES, /mfoot/);
  });

  test('ed-notes stays at 0 on every check-ui-kit counter (no baseline entry)', () => {
    const counts = countViolations('ui/ed-notes.js', NOTES);
    for (const [rule, n] of Object.entries(counts)) {
      assert.equal(n, 0, `check-ui-kit rule "${rule}" counted ${n} in ui/ed-notes.js`);
    }
  });
});

describe('ui/ed-app.js — <ed-notes> binding (I1)', () => {
  test('<ed-notes> is no longer bound with .editMode', () => {
    const block = tagBlock(APP, 'ed-notes');
    assert.doesNotMatch(block, /\.editMode\s*=/);
    assert.match(block, /\.model=\$\{/, '<ed-notes> should still receive .model');
    assert.match(block, /\.characterId=\$\{/, '<ed-notes> should still receive .characterId');
  });

  test('<ed-combat> keeps its .editMode binding (untouched)', () => {
    assert.match(tagBlock(APP, 'ed-combat'), /\.editMode=\$\{this\._editMode\}/);
  });
});

describe('data/changelog.json — entry (I4)', () => {
  test('has the "improved" Notes entry (in unreleased or a release)', () => {
    const log = JSON.parse(read('data/changelog.json'));
    const all = [
      ...(log.unreleased?.changes ?? []),
      ...(log.releases ?? []).flatMap((r) => r.changes ?? []),
    ];
    const hit = all.find((c) => c.type === 'improved'
      && /Notes can now be added, edited and deleted without edit mode/.test(c.text ?? ''));
    assert.ok(hit, 'expected the update-notes-edit "improved" changelog entry');
  });
});
