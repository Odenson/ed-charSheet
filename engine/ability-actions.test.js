// engine/ability-actions.test.js — taxonomy-on-action-type (I5).
// Pure resolver: fastest-wins override of a talent/skill action.
// Rules: plans/taxonomy-on-action-type/rules.md R1 (valid values), R2 (fastest wins).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTION_SPEED, resolveAbilityAction } from './ability-actions.js';

const fx = (value, extra = {}) => ({
  type: 'action-modifier',
  target: { domain: 'ability', name: 'Frighten' },
  operation: 'set',
  measure: 'action',
  value,
  duration: 'sustained',
  source: 'spell',
  ...extra,
});
const withOrigin = (e, name) => ({ ...e, origin: { kind: 'spell', name } });
const resolve = (base, effects, name = 'Frighten') => resolveAbilityAction(name, base, effects);

test('ACTION_SPEED is Free, Simple, Standard, fastest first (R1, R2)', () => {
  assert.deepEqual([...ACTION_SPEED], ['Free', 'Simple', 'Standard']);
});

test('ACTION_SPEED matches the §5.1 set in the taxonomy doc (drift guard)', () => {
  const doc = readFileSync(new URL('../docs/EFFECT-TAXONOMY.md', import.meta.url), 'utf8');
  const m = doc.match(/^### 5\.1 [^\n]*\n([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m);
  assert.ok(m, 'doc has no "### 5.1" heading');
  const para = m[1].split('\n').find((l) => l.includes('`Free`'));
  assert.ok(para, '§5.1 lists Free');
  const listed = [...para.matchAll(/`([A-Za-z]+)`/g)].map((x) => x[1]);
  const valid = listed.filter((w) => !['Sustained', 'NA'].includes(w));
  assert.deepEqual(valid.slice(0, 3), [...ACTION_SPEED]);
});

test('Simple effect on a Standard base: Simple, base Standard, one applied source (R2)', () => {
  const r = resolve('Standard', [withOrigin(fx('Simple'), 'Death’s Head')]);
  assert.deepEqual(r, {
    action: 'Simple',
    actionBase: 'Standard',
    actionSources: [{ name: 'Death’s Head', action: 'Simple', applied: true }],
  });
});

test('Free + Simple on a Standard base: Free wins, both sources listed, Simple overridden (R2)', () => {
  const r = resolve('Standard', [
    withOrigin(fx('Simple'), 'Spell A'),
    withOrigin(fx('Free'), 'Spell B'),
  ]);
  assert.equal(r.action, 'Free');
  assert.equal(r.actionBase, 'Standard');
  assert.deepEqual(r.actionSources, [
    { name: 'Spell A', action: 'Simple', applied: false },
    { name: 'Spell B', action: 'Free', applied: true },
  ]);
});

test('order of effects does not change the winner (R2)', () => {
  const a = resolve('Standard', [withOrigin(fx('Free'), 'B'), withOrigin(fx('Simple'), 'A'), withOrigin(fx('Standard'), 'C')]);
  assert.equal(a.action, 'Free');
  assert.deepEqual(a.actionSources.map((s) => [s.name, s.applied]), [['B', true], ['A', false], ['C', false]]);
});

test('ties: every source equal to the winning value is applied, in appearance order', () => {
  const r = resolve('Standard', [
    withOrigin(fx('Simple'), 'A'),
    withOrigin(fx('Simple'), 'B'),
    withOrigin(fx('Standard'), 'C'),
  ]);
  assert.equal(r.action, 'Simple');
  assert.deepEqual(r.actionSources, [
    { name: 'A', action: 'Simple', applied: true },
    { name: 'B', action: 'Simple', applied: true },
    { name: 'C', action: 'Standard', applied: false },
  ]);
});

test('a slower effect still overrides the base: Simple on a Free base gives Simple (R2)', () => {
  const r = resolve('Free', [withOrigin(fx('Simple'), 'S')]);
  assert.equal(r.action, 'Simple');
  assert.equal(r.actionBase, 'Free');
});

test('resolved action equal to the base returns null (no change)', () => {
  assert.equal(resolve('Simple', [fx('Simple')]), null);
  assert.equal(resolve('Standard', [fx('Standard')]), null);
});

test('winner equal to base returns null even when a slower effect also exists', () => {
  assert.equal(resolve('Free', [fx('Free'), fx('Simple')]), null);
});

test('no effects, or none considered, returns null', () => {
  assert.equal(resolve('Standard', []), null);
  assert.equal(resolve('Standard', undefined) ?? null, null);
  assert.equal(resolve('Standard', [{ type: 'note', summary: 'x' }]), null);
});

test('effects targeting another ability are ignored', () => {
  const other = fx('Free', { target: { domain: 'ability', name: 'Awareness' } });
  assert.equal(resolve('Standard', [other]), null);
});

test('wrong type, operation or domain are ignored', () => {
  assert.equal(resolve('Standard', [fx('Free', { type: 'test-modifier' })]), null);
  assert.equal(resolve('Standard', [fx('Free', { operation: 'add' })]), null);
  assert.equal(resolve('Standard', [fx('Free', { target: { domain: 'test', name: 'Frighten' } })]), null);
});

test('gmDiscretion and situational effects are ignored (autoApplies)', () => {
  assert.equal(resolve('Standard', [fx('Free', { gmDiscretion: true })]), null);
  assert.equal(resolve('Standard', [fx('Free', { condition: 'situational' })]), null);
});

test('an ignored effect does not appear in sources of a considered one', () => {
  const r = resolve('Standard', [fx('Free', { gmDiscretion: true }), withOrigin(fx('Simple'), 'Real')]);
  assert.equal(r.action, 'Simple');
  assert.deepEqual(r.actionSources, [{ name: 'Real', action: 'Simple', applied: true }]);
});

test('an explicit condition of always applies', () => {
  const r = resolve('Standard', [fx('Simple', { condition: 'always' })]);
  assert.equal(r.action, 'Simple');
});

test('invalid values are ignored: Sustained, NA, Instant, number, missing (R1)', () => {
  for (const bad of ['Sustained', 'NA', 'Instant', 'free', 2, null, undefined]) {
    assert.equal(resolve('Standard', [fx(bad)]), null, `value ${String(bad)}`);
  }
  const r = resolve('Standard', [fx('Sustained'), withOrigin(fx('Simple'), 'Ok')]);
  assert.deepEqual(r.actionSources.map((s) => s.name), ['Ok']);
});

test('non-listed bases (None, Sustained, NA, missing) are still overridden; actionBase is raw', () => {
  for (const base of ['None', 'Sustained', 'NA', undefined, null]) {
    const r = resolve(base, [fx('Simple')]);
    assert.equal(r.action, 'Simple', `base ${String(base)}`);
    assert.equal(r.actionBase, base);
  }
});

test('source name falls back to e.source, then "effect"', () => {
  const noOrigin = resolve('Standard', [fx('Simple')]);
  assert.equal(noOrigin.actionSources[0].name, 'spell');
  const bare = resolve('Standard', [fx('Simple', { source: undefined })]);
  assert.equal(bare.actionSources[0].name, 'effect');
});

test('identical sources are de-duplicated', () => {
  const e = withOrigin(fx('Simple'), 'Dup');
  const r = resolve('Standard', [e, { ...e }]);
  assert.equal(r.actionSources.length, 1);
});

test('does not mutate its inputs', () => {
  const effects = [withOrigin(fx('Simple'), 'S')];
  const snap = JSON.stringify(effects);
  resolve('Standard', effects);
  assert.equal(JSON.stringify(effects), snap);
});

test('module imports no DOM or store', () => {
  const src = readFileSync(new URL('./ability-actions.js', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"][^'"]*store[^'"]*['"]/.test(src));
  assert.ok(!/\b(document|window)\./.test(src));
});
