// Tier-2 guard: rules/*.json must agree with docs/EFFECT-TAXONOMY.md.
//  1. every file's `effectTaxonomy` ref names the doc's current version
//  2. every `schema` tag is well-formed
//  3. every effect's controlled fields use vocabulary the doc defines
// Vocabulary is read from the doc's own tables, so a taxonomy bump that is not
// migrated everywhere fails here (docs/GUARDRAILS.md Tier 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = fs.readFileSync(path.join(root, 'docs/EFFECT-TAXONOMY.md'), 'utf8');
const rulesDir = path.join(root, 'rules');
const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.json')).sort();
const load = (f) => JSON.parse(fs.readFileSync(path.join(rulesDir, f), 'utf8'));

const docVersion = doc.match(/^# Effect Taxonomy — (v\d+)/m)?.[1];

// Text of "## <n>. …" up to the next "## " heading.
function section(n) {
  const m = doc.match(new RegExp(`^## ${n}\\. [\\s\\S]*?(?=^## \\d+\\. |(?![\\s\\S]))`, 'm'));
  assert.ok(m, `taxonomy doc has no section ${n}`);
  return m[0];
}
// Backticked first cells of table rows: "| `add` | …".
function tableVocab(n) {
  return new Set([...section(n).matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]));
}
// Backticked tokens in the prose list of §9.
function proseVocab(n) {
  return new Set([...section(n).matchAll(/`([a-z-]+)`/g)].map((m) => m[1]));
}

const VOCAB = {
  type: tableVocab(2),
  operation: tableVocab(4),
  measure: tableVocab(5),
  stacking: tableVocab(7),
  duration: tableVocab(8),
  source: proseVocab(9),
};

// Every object held in an `effects` array, at any depth.
function* walk(node, trail = '') {
  if (Array.isArray(node)) { for (const [i, v] of node.entries()) yield* walk(v, `${trail}[${i}]`); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'effects' && Array.isArray(v)) {
        for (const [i, e] of v.entries()) if (e && typeof e === 'object') yield [e, `${trail}.effects[${i}]`];
      }
      yield* walk(v, `${trail}.${k}`);
    }
  }
}

test('taxonomy doc exposes a version and non-empty vocabularies', () => {
  assert.match(docVersion ?? '', /^v\d+$/);
  for (const [k, set] of Object.entries(VOCAB)) assert.ok(set.size > 0, `no vocabulary parsed for ${k}`);
});

test('every rules file has a well-formed schema tag', () => {
  for (const f of files) {
    const d = load(f);
    assert.match(String(d.schema), /^ed-[a-z-]+\/\d+$/, `rules/${f}: bad or missing schema tag`);
  }
});

test('effectTaxonomy refs name the current taxonomy version', () => {
  for (const f of files) {
    const d = load(f);
    const uses = [...walk(d)].length > 0;
    if (d.effectTaxonomy == null) {
      assert.ok(!uses, `rules/${f}: has effects but no effectTaxonomy reference`);
      continue;
    }
    assert.equal(d.effectTaxonomy, `docs/EFFECT-TAXONOMY.md (${docVersion})`,
      `rules/${f}: effectTaxonomy is "${d.effectTaxonomy}", doc is ${docVersion} — half-migrated Tier-2 change`);
  }
});

test('every effect uses the documented vocabulary', () => {
  const bad = [];
  let scanned = 0;
  for (const f of files) {
    for (const [e, where] of walk(load(f))) {
      scanned++;
      if (!VOCAB.type.has(e.type)) bad.push(`rules/${f}${where}: type "${e.type}"`);
      for (const field of ['operation', 'measure', 'stacking', 'duration', 'source']) {
        if (e[field] != null && !VOCAB[field].has(e[field]))
          bad.push(`rules/${f}${where}: ${field} "${e[field]}"`);
      }
    }
  }
  assert.ok(scanned > 0, 'no effects scanned — the walker is broken');
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} vocabulary violations (first 20 shown)`);
});
