// Data contract for the custom-skills homebrew toggle and the bundled empty skills file
// (plans/gen-skill-other I2, I6). R4: owner house rule 2026-11-22 (book silent on
// custom General skills), so the rule must say it overrides that silence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../rules/${p}`, import.meta.url)));

test('homebrew.json: enabled hb-custom-skills boolean set rule', () => {
  const h = read('homebrew.json');
  const rule = h.rules.find((r) => r.id === 'hb-custom-skills');
  assert.ok(rule, 'rule present');
  assert.equal(rule.enabled, true);
  assert.deepEqual(rule.set, { 'skills.allowCustom': true });
  assert.ok(rule.summary && rule.note, 'summary and note present');
  assert.ok(rule.overrides, 'overrides text present');
  assert.match(String(h.source), /skills\.allowCustom/, 'top-level source prose lists the new target');
});

test('homebrew.json: rule ids stay unique and the file keeps its schema', () => {
  const h = read('homebrew.json');
  const ids = h.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(h.schema, /^ed-homebrew\/\d+$/);
  assert.equal(h.rules.find((r) => r.id === 'hb-custom-skills').effects, undefined, 'a set rule carries no effects');
});

test('rules/custom-skills.json ships bundled and empty with the ed-skills/1 schema', () => {
  const f = read('custom-skills.json');
  assert.equal(f.schema, 'ed-skills/1');
  assert.equal(f.source, 'custom');
  assert.deepEqual(f.skills, []);
  assert.equal(f.effects, undefined);
});
