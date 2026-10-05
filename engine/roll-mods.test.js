import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollTimeMods, resolveOptionalMods } from './roll-mods.js';

const combat = JSON.parse(readFileSync(new URL('../rules/combat.json', import.meta.url)));
const rules = { combat };
const steps = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { step: i + 1 }]));

test('Knocked Down is a result -3 on every roll but the Karma die', () => {
  assert.deepEqual(rollTimeMods({ knockedDown: true, rules }).applied, [{ label: 'Knocked Down', value: -3, measure: 'result' }]);
  assert.deepEqual(rollTimeMods({ knockedDown: true, kind: 'karma', rules }), { applied: [], optional: [] });
});

test('Harried (chip or encumbrance) is one -2 step mod, deduped, on any roll', () => {
  const r = rollTimeMods({ harried: true, situations: ['Harried'], rules });
  assert.deepEqual(r.applied, [{ label: 'Harried', value: -2, measure: 'step' }]);
});

test('scoped mods are optional pre-ticked; none on Combat pool rolls; damage offers only Range Long', () => {
  const sits = ['Full Darkness', 'Range — Long', 'Impaired Movement — Light'];
  assert.equal(rollTimeMods({ situations: sits, rules }).optional.length, 3);
  assert.ok(rollTimeMods({ situations: sits, rules }).optional.every((m) => m.on && m.optional));
  assert.deepEqual(rollTimeMods({ situations: sits, pool: true, rules }).optional, []);
  assert.deepEqual(rollTimeMods({ situations: sits, kind: 'damage', rules }).optional.map((m) => m.label), ['Range — Long']);
  assert.deepEqual(rollTimeMods({ rules }), { applied: [], optional: [] });
});

test('resolveOptionalMods: step mods re-resolve the Step (min 1); result mods total flat', () => {
  const r = resolveOptionalMods({ baseStep: 7, stepByNumber: steps, mods: [{ value: -4, measure: 'step' }, { value: -3, measure: 'result' }] });
  assert.equal(r.step, 3);
  assert.equal(r.stepRow.step, 3);
  assert.equal(r.resultTotal, -3);
  assert.equal(resolveOptionalMods({ baseStep: 2, stepByNumber: steps, mods: [{ value: -4, measure: 'step' }] }).step, 1);
  assert.equal(resolveOptionalMods({ baseStep: 5, stepByNumber: steps, mods: [] }).step, 5);
});
