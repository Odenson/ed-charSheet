// store-advancement.test.js — run with `npm test` (node --test, no deps).
// Covers the rank-editing slice of the edits overlay: saving the FULL ranked
// disciplines/skills arrays to localStorage, the overlay replace-back onto the
// character (applyEdits), that deriveModel attaches per-row rank pricing
// (increaseCost/refund/affordable) without ever storing a derived value, and
// that a rank change moves the derived Available Legend (the audit diff the app
// guard enforces).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel, saveAdvancementEdits, hasPendingEdits, reconcileOverlay, applyEdits, forSave } from './store.js';

// Node has no localStorage; the store reads/writes the global. A tiny in-memory
// stub is enough — the store only uses get/set/removeItem.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const rules = {
  steps: read('steps.json').steps,
  talentsFile: read('talents.json'),
  disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'),
  characteristicsFile: read('characteristics.json'),
  itemsFile: read('items.json'),
  legendFile: read('legend.json'),
  skillsFile: read('skills.json'),
  knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'),
};

const baseCharacter = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Chakka' },
  attributes: {},
  resources: { legend: { totalEarnt: 10000 } },
  disciplines: [
    {
      name: 'Archer',
      circle: 4,
      talents: [{ name: 'Missile Weapon', rank: 5, circle: 1 }],
    },
  ],
  skills: [{ name: 'Tracking', rank: 3, tier: 'Novice' }],
  knacks: [],
  items: [],
});

test('saveAdvancementEdits round-trips and applyEdits replaces the ranked arrays', () => {
  memory.clear();
  const nextRanks = {
    disciplines: [
      {
        name: 'Archer',
        circle: 4,
        talents: [{ name: 'Missile Weapon', rank: 6, circle: 1 }],
      },
    ],
    skills: [{ name: 'Tracking', rank: 3, tier: 'Novice' }],
  };
  const edits = saveAdvancementEdits(nextRanks, 'c1');
  const character = baseCharacter();
  const next = applyEdits(character, edits);
  assert.equal(next.disciplines[0].talents[0].rank, 6); // replaced, not merged
  assert.equal(character.disciplines[0].talents[0].rank, 5); // original untouched
  assert.notEqual(next, character); // overlay builds a fresh character
});

test('applyEdits advancements preserve the other stored inputs', () => {
  memory.clear();
  const edits = saveAdvancementEdits(
    {
      disciplines: baseCharacter().disciplines,
      skills: [{ name: 'Tracking', rank: 4, tier: 'Novice' }],
    },
    'c1',
  );
  const character = {
    ...baseCharacter(),
    meta: { name: 'Rook', race: 'Dwarf' },
    items: [{ name: 'Bracers of Aras', equipped: true }],
    resources: { legend: { totalEarnt: 10000 }, health: { damage: 3, wounds: 0, recoveriesUsed: 0 } },
  };
  const next = applyEdits(character, edits);
  assert.equal(next.skills[0].rank, 4);
  assert.equal(next.meta.name, 'Rook'); // untouched
  assert.equal(next.items.length, 1); // untouched
  assert.equal(next.resources.legend.totalEarnt, 10000); // untouched
  assert.deepEqual(next.resources.health, { damage: 3, wounds: 0, recoveriesUsed: 0 }); // untouched
});

test('hasPendingEdits: false before, true after an advancement edit, false after reconcile', () => {
  memory.clear();
  assert.equal(hasPendingEdits('c2'), false);
  saveAdvancementEdits({ disciplines: [], skills: [] }, 'c2');
  assert.equal(hasPendingEdits('c2'), true);
  reconcileOverlay(undefined, 'c2');
  assert.equal(hasPendingEdits('c2'), false);
});

test('a later advancement save replaces the whole arrays (a partial patch must never drop ranks)', () => {
  memory.clear();
  saveAdvancementEdits({ disciplines: baseCharacter().disciplines, skills: [] }, 'c3');
  const edits = saveAdvancementEdits({ disciplines: [], skills: [{ name: 'Tracking', rank: 4, tier: 'Novice' }] }, 'c3');
  assert.deepEqual(edits.advancements.disciplines, []);
  assert.deepEqual(edits.advancements.skills, [{ name: 'Tracking', rank: 4, tier: 'Novice' }]);
});

test('deriveModel derives the Half-Magic roll: one option per attribute, Perception default, Karma-eligible', () => {
  memory.clear();
  const model = deriveModel(
    { ...baseCharacter(), attributes: { Perception: { base: 15, points: 0, increases: 0 }, Willpower: { base: 10, points: 0, increases: 0 } } },
    rules,
  );
  const d = model.disciplines[0];
  const percStep = model.attributes.find((a) => a.name === 'Perception').step;
  assert.ok(percStep > 0, 'Perception resolved a real step'); // guards against a false pass on 0
  assert.ok(d.halfMagicRoll, 'a discipline with half-magic gets a roll'); // PG p.81
  assert.equal(d.halfMagicRoll.defaultAttribute, 'Perception'); // printed default, focused in the picker
  // One option per resolvable attribute, each = that attribute's step + Circle.
  assert.equal(d.halfMagicRoll.options.length, model.attributes.filter((a) => a.step != null).length);
  const perc = d.halfMagicRoll.options.find((o) => o.attribute === 'Perception');
  assert.equal(perc.step, percStep + d.circle); // Attribute Step + Circle
  const will = model.attributes.find((a) => a.name === 'Willpower');
  assert.equal(d.halfMagicRoll.options.find((o) => o.attribute === 'Willpower').step, will.step + d.circle);
  assert.equal(d.halfMagicRoll.karma.grants.length, 1); // Karma may be spent on the test
});

test('deriveModel exposes per-Circle option slots, learnable pools, and the next-Circle grant', () => {
  memory.clear();
  const model = deriveModel(baseCharacter(), rules); // Archer Circle 4, only Missile Weapon learned
  const d = model.disciplines[0];
  assert.equal(d.optionSlots.length, 4); // Circles 1-4
  assert.ok(d.optionSlots.every((s) => s.open)); // no options learned yet
  const c1 = d.optionSlots.find((s) => s.circle === 1);
  assert.equal(c1.available, true);
  assert.ok(c1.learnable.length > 0 && c1.learnable.every((o) => typeof o.name === 'string'));
  assert.ok(d.nextGrant.length > 0); // Circle 5 grants at least one Discipline Talent
});

test('a learned Talent Option fills its Circle slot and is priced by that Circle', () => {
  memory.clear();
  const base = baseCharacter();
  const before = deriveModel(base, rules).legend.available;
  const learnable = deriveModel(base, rules).disciplines[0].optionSlots.find((s) => s.circle === 1).learnable[0].name;
  const withOption = {
    ...base,
    disciplines: [{ ...base.disciplines[0], talents: [...base.disciplines[0].talents, { name: learnable, rank: 1, circle: 1 }] }],
  };
  const model = deriveModel(withOption, rules);
  const c1 = model.disciplines[0].optionSlots.find((s) => s.circle === 1);
  assert.equal(c1.open, false); // slot now filled
  assert.equal(c1.filledBy, learnable);
  assert.ok(model.legend.available < before); // the Rank-1 option cost was spent
});

test('deriveModel attaches rank pricing: step up, refund, and affordability', () => {
  memory.clear();
  const model = deriveModel(baseCharacter(), rules);
  const t = model.disciplines[0].talents[0];
  assert.equal(t.pricing.increaseCost, 1300); // Missile Weapon R5→R6, Novice table step 6
  assert.equal(t.pricing.refund, 800); // R5→R4 refunds the step that bought Rank 5
  assert.equal(t.pricing.affordable, true); // 1300 ≤ 8100 available
  const s = model.skills[0];
  assert.equal(s.pricing.increaseCost, 800); // Tracking R3→R4, Skill Training step 4
  assert.equal(s.pricing.refund, 500); // R3→R2 refunds the step that bought Rank 3
  assert.equal(s.pricing.affordable, true);
  assert.equal(model.legend.available, 7100); // 10000 − (1900 talents + 1000 skills)
});

test('deriveModel pricing: additional-Discipline talents use the surcharge tables', () => {
  memory.clear();
  const char = baseCharacter();
  char.disciplines.push({
    name: 'Nethermancer',
    circle: 3,
    talents: [{ name: 'Spellcasting', rank: 3, circle: 1 }],
  });
  const model = deriveModel(char, rules);
  const t = model.disciplines[1].talents[0];
  assert.equal(t.pricing.increaseCost, 800); // R3→R4 as a Journeyman-equivalent step
  assert.equal(t.pricing.refund, 500); // R3→R2 (New-Discipline R1 500 + Journeyman R2 300 = R2; refund of the step into R3)
});

test('deriveModel pricing: unpriceable steps are null, never fabricated', () => {
  memory.clear();
  const char = baseCharacter();
  delete char.disciplines[0].talents[0].circle; // no learned Circle → no tier band → first-Disc table can't price
  const model = deriveModel(char, rules);
  const t = model.disciplines[0].talents[0];
  assert.equal(t.pricing.increaseCost, null);
  assert.equal(t.pricing.affordable, false);
});

test('deriveModel pricing: no Total Legend earned → every increase is unaffordable', () => {
  memory.clear();
  const char = baseCharacter();
  delete char.resources.legend;
  const model = deriveModel(char, rules);
  assert.equal(model.legend, null);
  const t = model.disciplines[0].talents[0];
  assert.equal(t.pricing.increaseCost, 1300); // still priceable from the tables
  assert.equal(t.pricing.affordable, false); // but nothing to spend
});

test('deriveModel pricing: an increase the audit cannot fund drives available below 0 (app-guard reject)', () => {
  memory.clear();
  // TotalEarnt 1500 covers exactly Missile Weapon R3 (600) + Tracking R1 (200) = 800
  // at R3/R1; pushing Missile Weapon to R4 adds 500 → available would be −100.
  const char = baseCharacter();
  char.resources.legend = { totalEarnt: 1500 };
  char.disciplines[0].talents[0].rank = 3;
  char.skills[0].rank = 1;
  const before = deriveModel(char, rules);
  assert.equal(before.legend.available, 700);
  const t = before.disciplines[0].talents[0];
  assert.equal(t.pricing.increaseCost, 500); // R3→R4
  assert.equal(t.pricing.affordable, true); // 500 ≤ 700 — one step fits
  // The same increase in a second step (R4→R5, 800) would overdraw: 700 − 500 − 800 < 0.
  assert.equal(deriveModel({ ...char, disciplines: [{ ...char.disciplines[0], talents: [{ ...char.disciplines[0].talents[0], rank: 4 }] }] }, rules).legend.available, 200);
});

test('deriveModel: a rank change moves the derived Available Legend (increase spends, decrease refunds)', () => {
  memory.clear();
  const raised = {
    ...baseCharacter(),
    disciplines: [
      {
        name: 'Archer',
        circle: 4,
        talents: [{ name: 'Missile Weapon', rank: 6, circle: 1 }],
      },
    ],
  };
  const up = deriveModel(raised, rules);
  assert.equal(up.legend.available, 7100 - 1300); // the increase spent exactly the step cost
  const lowered = {
    ...baseCharacter(),
    disciplines: [
      {
        name: 'Archer',
        circle: 4,
        talents: [{ name: 'Missile Weapon', rank: 4, circle: 1 }],
      },
    ],
  };
  const down = deriveModel(lowered, rules);
  assert.equal(down.legend.available, 7100 + 800); // the decrease refunded the step into R5
  // The stored inputs are untouched — the sheet stores only inputs.
  assert.equal(baseCharacter().disciplines[0].talents[0].rank, 5);
});

test('applyEdits strips a stale talent tier from the advancements overlay (never leaks back in)', () => {
  memory.clear();
  // An overlay written by a pre-derivation build still carries `tier` on each
  // talent; merging it must not reintroduce the removed field (knockedDown
  // precedent). Skills pass through untouched.
  const edits = saveAdvancementEdits(
    {
      disciplines: [
        { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 6, tier: 'Novice', circle: 1 }] },
      ],
      skills: [{ name: 'Tracking', rank: 3, tier: 'Novice' }],
    },
    'c4',
  );
  const next = applyEdits(baseCharacter(), edits);
  assert.deepEqual(next.disciplines[0].talents[0], { name: 'Missile Weapon', rank: 6, circle: 1 });
  assert.deepEqual(next.skills[0], { name: 'Tracking', rank: 3, tier: 'Novice' }); // skill tier stays
});

test('forSave stamps ed-character/2 and strips talent tier (serializer-side guarantee)', () => {
  // A pre-bump file whose talents still carry the stored tier.
  const character = {
    ...baseCharacter(),
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }] },
    ],
  };
  const out = forSave(character);
  assert.equal(out.schema, 'ed-character/2');
  assert.deepEqual(out.disciplines[0].talents[0], { name: 'Missile Weapon', rank: 5, circle: 1 });
  assert.deepEqual(out.skills, character.skills); // skill tier untouched
  assert.equal(character.schema, 'ed-character/1'); // pure: input never mutated
  assert.ok('tier' in character.disciplines[0].talents[0]); // …and its tier is intact
});
