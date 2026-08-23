import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disciplineTalentsUpTo, circleRequirement, supportedCircle, circleStatus } from './advancement.js';

// A trimmed Archer-shaped discipline: DTs per Circle (options/freeTalents omitted
// on purpose — the gate reads only circles[].talents).
const ref = {
  name: 'Archer',
  circles: [
    { circle: 1, talents: ['Avoid Blow', 'Missile Weapon', 'Mystic Aim', 'Thread Weaving (Archer)', 'True Shot'], freeTalents: ['Call Missile'] },
    { circle: 2, talents: ['Mystic Pursuit'] },
    { circle: 3, talents: ['Anticipate Blow'] },
    { circle: 4, talents: ['Long Shot'] },
  ],
};

// TEST-Char's Archer ranks (Long Shot unlearned).
const ranks = {
  'Avoid Blow': 4, 'Missile Weapon': 5, 'Mystic Aim': 5, 'Thread Weaving (Archer)': 4, 'True Shot': 4,
  'Mystic Pursuit': 3, 'Anticipate Blow': 4,
};

test('disciplineTalentsUpTo gathers DTs through a circle, excluding freeTalents', () => {
  assert.deepEqual(disciplineTalentsUpTo(ref, 2), ['Avoid Blow', 'Missile Weapon', 'Mystic Aim', 'Thread Weaving (Archer)', 'True Shot', 'Mystic Pursuit']);
  assert.equal(disciplineTalentsUpTo(ref, 0).length, 0); // Circle 1 has no lower gate
});

test('circleRequirement: Circle 4 needs all Circle 1-3 DTs at rank 4', () => {
  const r = circleRequirement(ref, 4, ranks);
  assert.equal(r.total, 7); // 5 + 1 + 1
  assert.equal(r.satisfied, false); // Mystic Pursuit is rank 3
  assert.deepEqual(r.missing.map((m) => m.name), ['Mystic Pursuit']);
});

test('supportedCircle: TEST-Char is only supported at Circle 3', () => {
  assert.equal(supportedCircle(ref, ranks), 3); // Mystic Pursuit (rank 3) blocks Circle 4
});

test('circleStatus flags a stored Circle the talents do not support (inconsistent)', () => {
  const s = circleStatus(ref, 4, ranks); // stored Circle 4
  assert.equal(s.attained, 4);
  assert.equal(s.supported, 3);
  assert.equal(s.consistent, false); // 4 > 3 — the number is not justified
  assert.equal(s.eligible, false);
});

test('circleStatus: raising the laggards makes Circle 4 consistent and Circle 5 eligible', () => {
  const strong = { ...ranks, 'Avoid Blow': 5, 'Thread Weaving (Archer)': 5, 'True Shot': 5, 'Mystic Pursuit': 5, 'Anticipate Blow': 5, 'Long Shot': 5 };
  const s = circleStatus(ref, 4, strong);
  assert.equal(s.supported, 5); // all Circle 1-4 DTs at rank 5
  assert.equal(s.consistent, true);
  assert.equal(s.eligible, true); // can advance to Circle 5
  assert.equal(s.next, 5);
  assert.equal(s.nextRequirement.satisfied, true);
});
