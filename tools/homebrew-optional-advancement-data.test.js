// Data contract for the homebrew optional Circle-advancement rule
// (plans/homebrew-circle-adv). Table values: spec.md Rules / rules.md R1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../rules/${p}`, import.meta.url)));

const R1 = [
  [2, 5, 2, 1], [3, 6, 3, 2], [4, 7, 4, 3], [5, 8, 5, 4], [6, 9, 6, 5], [7, 10, 7, 6], [8, 11, 8, 7],
  [9, 12, 9, 8], [10, 13, 10, 9], [11, 14, 11, 10], [12, 15, 11, 11], [13, 16, 12, 12], [14, 17, 12, 13], [15, 18, 13, 14],
];

test('legend.json costs.optionalAdvancement holds the 14 R1 rows', () => {
  const t = read('legend.json').costs.optionalAdvancement;
  assert.deepEqual(Object.keys(t).sort((a, b) => a - b), R1.map(([c]) => String(c)));
  for (const [c, n, r, f] of R1) assert.deepEqual(t[String(c)], { minTalents: n, minRank: r, fromCircle: f }, `Circle ${c}`);
});

test('legend.json optionalAdvancement: fromCircle === Circle - 1 for every row', () => {
  const t = read('legend.json').costs.optionalAdvancement;
  for (const [c, row] of Object.entries(t)) assert.equal(row.fromCircle, Number(c) - 1);
});

test('legend.json: schema tag and circleTraining unchanged', () => {
  const l = read('legend.json');
  assert.equal(l.schema, 'ed-legend/1');
  assert.deepEqual(l.costs.circleTraining, {
    2: 200, 3: 300, 4: 500, 5: 800, 6: 1000, 7: 1500, 8: 2000, 9: 2500, 10: 3500, 11: 5000, 12: 7500, 13: 10000, 14: 15000, 15: 20000,
  });
});

test('homebrew.json: enabled hb-optional-circle-advancement boolean set rule', () => {
  const h = read('homebrew.json');
  const rule = h.rules.find((r) => r.id === 'hb-optional-circle-advancement');
  assert.ok(rule, 'rule present');
  assert.equal(rule.enabled, true);
  assert.deepEqual(rule.set, { 'advancement.optionalTable': true });
  assert.match(rule.overrides, /p\.453/);
  assert.ok(rule.summary && rule.note);
  assert.match(String(h.source), /advancement\.optionalTable/);
});
