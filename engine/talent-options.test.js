import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disciplineTalentSet, optionSlots, learnableTalents, nextCircleGrant, UNIVERSAL_TALENTS } from './talent-options.js';

const ref = {
  name: 'Archer',
  talentOptions: {
    novice: ['Awareness', 'Climbing', 'First Impression'],
    journeyman: ['Conversation', 'Danger Sense'],
  },
  circles: [
    { circle: 1, talents: ['Avoid Blow', 'Missile Weapon', 'Mystic Aim', 'Thread Weaving (Archer)', 'True Shot'], freeTalents: ['Call Missile'] },
    { circle: 2, talents: ['Mystic Pursuit'] },
    { circle: 3, talents: ['Anticipate Blow'] },
    { circle: 4, talents: ['Long Shot'] },
    { circle: 5, talents: ['Second Shot'] },
  ],
};
const costs = { tiers: [
  { label: 'Novice', minCircle: 1, maxCircle: 4 }, { label: 'Journeyman', minCircle: 5, maxCircle: 8 },
  { label: 'Warden', minCircle: 9, maxCircle: 12 }, { label: 'Master', minCircle: 13, maxCircle: 15 },
] };

// Circle 4 Archer: a mix of DTs and options; Awareness fills slot 1, Stealthy
// Stride fills slot 3; slots 2 and 4 left open.
const talents = [
  { name: 'Missile Weapon', circle: 1 }, { name: 'Avoid Blow', circle: 1 },
  { name: 'Awareness', circle: 1 },
  { name: 'Mystic Pursuit', circle: 2 },
  { name: 'Anticipate Blow', circle: 3 }, { name: 'Stealthy Stride', circle: 3 },
  { name: 'Long Shot', circle: 4 },
];
const known = new Set(talents.map((t) => t.name));

test('disciplineTalentSet is universals + every circle DT, excluding free talents', () => {
  const s = disciplineTalentSet(ref);
  assert.ok([...UNIVERSAL_TALENTS].every((n) => s.has(n)));
  assert.ok(s.has('Missile Weapon') && s.has('Long Shot') && s.has('Second Shot'));
  assert.ok(!s.has('Call Missile')); // free talent never gates a slot
});

test('optionSlots: one slot per Circle, filled by the option learned there', () => {
  const slots = optionSlots(ref, talents, 4);
  assert.deepEqual(slots, [
    { circle: 1, filledBy: 'Awareness', open: false },
    { circle: 2, filledBy: null, open: true },
    { circle: 3, filledBy: 'Stealthy Stride', open: false },
    { circle: 4, filledBy: null, open: true },
  ]);
});

test('learnableTalents at a Novice slot pulls the novice pool, minus known', () => {
  const r = learnableTalents(ref, 2, { costs, knownNames: known });
  assert.equal(r.available, true);
  assert.deepEqual(r.items, ['Climbing', 'First Impression']); // Awareness excluded (already learned)
});

test('learnableTalents at a Journeyman slot pulls novice + journeyman (lower pools allowed)', () => {
  const r = learnableTalents(ref, 5, { costs, knownNames: known });
  assert.equal(r.available, true);
  assert.deepEqual(r.items, ['Climbing', 'First Impression', 'Conversation', 'Danger Sense']);
});

test('learnableTalents is unavailable for a Warden+ slot with no pool data', () => {
  const r = learnableTalents(ref, 9, { costs, knownNames: known });
  assert.deepEqual(r, { available: false, items: [] });
});

test('nextCircleGrant is the next Circle DTs not already known', () => {
  assert.deepEqual(nextCircleGrant(ref, 4, known), ['Second Shot']); // Circle 5 grants Second Shot
  assert.deepEqual(nextCircleGrant(ref, 4, new Set([...known, 'Second Shot'])), []); // already known → nothing to grant
});
