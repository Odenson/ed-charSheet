// engine/combat-opponent-skip.test.js — run with `npm test` (node --test, no deps).
// plans/active-condition-window: opponent (Taunt) records must never fold into any
// roll/defence pool. Defensive skip in collectCombatEffects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCombatEffects } from './combat.js';

const AIM_EFFECT = {
  type: 'test-modifier',
  target: { domain: 'test', name: 'Attack' },
  operation: 'add',
  value: 2,
  measure: 'step',
  condition: 'on-success',
  perSuccess: true,
  source: 'talent',
};
const rules = { options: [], situations: [] };

test('collectCombatEffects ignores an armed record flagged opponent (even if it carries effects)', () => {
  const armed = [{ name: 'Taunt', opponent: true, successes: 3, effects: [AIM_EFFECT] }];
  const r = collectCombatEffects({ armedTalents: armed, rules });
  assert.equal(r.attackEffects.filter((x) => x.target?.name === 'Attack').length, 0);
  assert.equal(r.defenseMods.length, 0);
});

test('an opponent record beside a real Aim arm leaves only the Aim bonus', () => {
  const armed = [
    { name: 'Mystic Aim', successes: 2, effects: [AIM_EFFECT] },
    { name: 'Taunt', opponent: true, successes: 5, effects: [AIM_EFFECT] },
  ];
  const r = collectCombatEffects({ armedTalents: armed, rules });
  const atk = r.attackEffects.filter((x) => x.target?.name === 'Attack');
  assert.equal(atk.length, 1);
  assert.equal(atk[0].label, 'Mystic Aim');
  assert.equal(atk[0].value, 4);
});
