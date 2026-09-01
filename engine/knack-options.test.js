// engine/knack-options.test.js — run with `npm test` (node --test, no deps).
// Covers learnableKnacks (PLAN-ADD-KNACKS §7.2/§7.6): the pure derivation of the
// knacks a character may learn, gated on a governing parent at rank >= requiredRank,
// the per-parent cap, and not-already-owned; with Legend cost + silver-fee preview
// from rules/legend.json costs. Parents are Discipline-taught talents by default; when
// `parentSkills` is passed (the `knackParents` homebrew lever, ed-homebrew/3 §5.6),
// the character's owned skills also govern knacks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnableKnacks, scopeKnackOptions } from './knack-options.js';

// A tiny catalog mirroring the real shape. Anticipate Spell (parent Anticipate Blow,
// req 5); Down Strike (parent Melee Weapon, req 2); a multi-parent knack; a
// skill-named parent (Streetwise, a skill) to exercise the skill path.
const catalog = {
  'Anticipate Spell': { parents: ['Anticipate Blow'], requiredRank: 5, restrictions: 'None', summary: 'Anticipate mystic attacks.' },
  'Down Strike': { parents: ['Melee Weapon'], requiredRank: 2, restrictions: 'None', presentation: { shortEffect: '+dmg from above' } },
  'Dual Knack': { parents: ['Melee Weapon', 'Unarmed Combat'], requiredRank: 3, restrictions: 'Warrior' },
  'Skill Knack': { parents: ['Streetwise'], requiredRank: 1, restrictions: 'None' },
};

const costs = {
  talentRank: { '2': { Novice: 300 }, '3': { Novice: 500 }, '5': { Novice: 800 } },
  knackTraining: { '1': 50, '2': 100, '3': 150, '5': 250 },
};

test('a knack surfaces when its parent talent is owned at rank >= requiredRank', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 6 } } }, costs);
  const opt = out.find((o) => o.name === 'Anticipate Spell');
  assert.ok(opt, 'offered when parent rank 6 >= required 5');
  assert.equal(opt.viaDefault, 'Anticipate Blow');
  assert.deepEqual(opt.qualifies, [{ name: 'Anticipate Blow', rank: 6, kind: 'talent' }]);
  assert.equal(opt.cost, 800, 'Legend = Novice talent at required rank 5');
  assert.equal(opt.trainingFee, 250, 'silver fee = knackTraining[5]');
});

test('a candidate carries the full catalog description (summary) for the picker preview', () => {
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 6 }, 'Melee Weapon': { rank: 4 } } },
    costs,
  );
  const opt = out.find((o) => o.name === 'Anticipate Spell');
  assert.equal(opt.summary, 'Anticipate mystic attacks.', 'summary = catalog summary (the bonuses text)');
  assert.equal(opt.brief, 'Anticipate mystic attacks.', 'falls back to summary when no shortEffect');
  const down = out.find((o) => o.name === 'Down Strike');
  assert.equal(down.summary, null, 'catalog entry with no summary → null, never fabricated');
  assert.equal(down.brief, '+dmg from above', 'brief prefers presentation.shortEffect');
});

test('a knack is absent when its parent is under the required rank', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 4 } } }, costs);
  assert.ok(!out.some((o) => o.name === 'Anticipate Spell'));
});

test('a knack is absent when the parent talent is unowned', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: {} }, costs);
  assert.ok(!out.some((o) => o.name === 'Anticipate Spell'));
});

test('a skill-named parent does NOT qualify without the knackParents lever', () => {
  // Streetwise passed with no parentSkills: parentTalents is the ONLY source when the
  // lever is off, so Skill Knack never surfaces. This is the talent-only default.
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 5 } } }, costs);
  assert.ok(!out.some((o) => o.name === 'Skill Knack'), 'a skill-named parent not in parentTalents never qualifies without parentSkills');
});

test('an owned skill qualifies its knack under the knackParents lever', () => {
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: {}, parentSkills: { Streetwise: { rank: 3 } } },
    costs,
  );
  const sk = out.find((o) => o.name === 'Skill Knack');
  assert.ok(sk, 'offered when the skill is owned at rank >= requiredRank');
  assert.equal(sk.viaDefault, 'Streetwise');
  assert.deepEqual(sk.qualifies, [{ name: 'Streetwise', rank: 3, kind: 'skill' }]);
});

test('a skill parent surfaces only when its rank meets requiredRank', () => {
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: {}, parentSkills: { Streetwise: { rank: 1 } } },
    costs,
  );
  assert.ok(out.some((o) => o.name === 'Skill Knack'), 'rank 1 meets Streetwise requiredRank 1');
  const under = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 6 } }, parentSkills: { Streetwise: { rank: 0 } } },
    costs,
  );
  assert.ok(!under.some((o) => o.name === 'Skill Knack'), 'rank 0 (untrained) cannot govern');
});

test('a name owned as BOTH talent and skill governs as talent only (no duplicate)', () => {
  // Melee Weapon is a talent here and a skill in parentSkills; the talent path wins so
  // Down Strike is listed once under the talent, and the skill parent is not added.
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 4 } }, parentSkills: { 'Melee Weapon': { rank: 5 } } },
    costs,
  );
  const down = out.find((o) => o.name === 'Down Strike');
  assert.ok(down, 'still offered via the talent');
  assert.deepEqual(down.qualifies.map((q) => q.name), ['Melee Weapon'], 'owned-as-both governs as talent, single entry');
});

test('the skill path respects the per-parent cap independently', () => {
  // Streetwise rank 2 → cap of 2 knacks under it. Owning one already-owned Streetwise
  // knack leaves room for Skill Knack; writing the cap hides it.
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [{ name: 'Streetwise Knack', via: 'Streetwise' }], parentTalents: {}, parentSkills: { Streetwise: { rank: 2 } } },
    costs,
  );
  assert.ok(out.some((o) => o.name === 'Skill Knack'), 'under the cap (1 < 2)');
  const capped = learnableKnacks(
    catalog,
    { ownedKnacks: [{ name: 'Streetwise Knack', via: 'Streetwise' }], parentTalents: {}, parentSkills: { Streetwise: { rank: 1 } } },
    costs,
  );
  assert.ok(!capped.some((o) => o.name === 'Skill Knack'), 'at the cap (1 >= 1)');
});

test('a non-first skill parent qualifies with kind skill for via-pinning', () => {
  // Dual Knack lists Melee Weapon + Unarmed Combat; the character owns ONLY the
  // Unarmed Combat SKILL (no talents). The skill path must pin `kind: 'skill'` so the
  // app stores `via` and reload re-attaches to Unarmed Combat rather than the
  // catalog's first parent (Melee Weapon).
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: {}, parentSkills: { 'Unarmed Combat': { rank: 3 } } },
    costs,
  );
  const dual = out.find((o) => o.name === 'Dual Knack');
  assert.ok(dual, 'offered via the owned skill');
  assert.deepEqual(dual.qualifies.map((q) => ({ name: q.name, kind: q.kind })), [{ name: 'Unarmed Combat', kind: 'skill' }]);
  assert.equal(dual.viaDefault, 'Unarmed Combat');
});

test('an already-owned knack is excluded', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [{ name: 'Down Strike' }], parentTalents: { 'Melee Weapon': { rank: 5 } } }, costs);
  assert.ok(!out.some((o) => o.name === 'Down Strike'));
});

test('a multi-parent knack lists every qualifying talent, viaDefault = first', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 4 }, 'Unarmed Combat': { rank: 3 } } }, costs);
  const dual = out.find((o) => o.name === 'Dual Knack');
  assert.ok(dual);
  assert.deepEqual(dual.qualifies.map((q) => q.name).sort(), ['Melee Weapon', 'Unarmed Combat']);
  assert.equal(dual.viaDefault, dual.qualifies[0].name);
});

test('the per-parent cap drops a knack once owned-knacks-under-parent >= parent rank', () => {
  // Melee Weapon rank 1 → cap of 1 knack. Already owning one Melee-parented knack
  // fills the cap, so Down Strike (also Melee) no longer qualifies.
  const out = learnableKnacks(
    catalog,
    { ownedKnacks: [{ name: 'Some Owned', via: 'Melee Weapon' }], parentTalents: { 'Melee Weapon': { rank: 1 } } },
    costs,
  );
  assert.ok(!out.some((o) => o.name === 'Down Strike'), 'at the cap, no more Melee knacks');
});

test('cost/trainingFee are null (placeholder) when the tables lack the rank', () => {
  const out = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 4 }, 'Unarmed Combat': { rank: 4 } } }, {});
  const dual = out.find((o) => o.name === 'Dual Knack');
  assert.equal(dual.cost, null, 'no talentRank table → null, never fabricated');
  assert.equal(dual.trainingFee, null, 'no knackTraining table → null');
});

// --- scopeKnackOptions (PLAN-ADD-KNACKS: per-discipline picker scoping) ------

test('scopeKnackOptions keeps only knacks whose qualifying parent is in the set', () => {
  const opts = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 6 }, 'Melee Weapon': { rank: 4 }, 'Unarmed Combat': { rank: 3 } } },
    costs,
  );
  const names = scopeKnackOptions(opts, ['Anticipate Blow']).map((o) => o.name);
  assert.deepEqual(names, ['Anticipate Spell'], 'only the Anticipate Blow-governed knack');
});

test('scopeKnackOptions includes a multi-parent knack when any parent is in the set', () => {
  const opts = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Unarmed Combat': { rank: 3 } } },
    costs,
  );
  const names = scopeKnackOptions(opts, ['Unarmed Combat']).map((o) => o.name);
  assert.deepEqual(names, ['Dual Knack'], 'admitted via the second (matching) parent');
});

test('scopeKnackOptions with a disjoint/empty set yields none', () => {
  const opts = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Anticipate Blow': { rank: 6 } } },
    costs,
  );
  assert.deepEqual(scopeKnackOptions(opts, ['Melee Weapon']).map((o) => o.name), [], 'no governing talent in scope');
  assert.deepEqual(scopeKnackOptions(opts, []).map((o) => o.name), [], 'empty scope → none');
});

test('scopeKnackOptions tolerates null/undefined options and a Set input', () => {
  assert.deepEqual(scopeKnackOptions(undefined, ['X']), []);
  assert.deepEqual(scopeKnackOptions(null, ['X']), []);
  const opts = learnableKnacks(catalog, { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 4 } } }, costs);
  assert.ok(scopeKnackOptions(opts, new Set(['Melee Weapon'])).some((o) => o.name === 'Down Strike'));
});

test('scopeKnackOptions scopes a skill-path picker by owned skill name', () => {
  const opts = learnableKnacks(
    catalog,
    { ownedKnacks: [], parentTalents: { 'Melee Weapon': { rank: 4 } }, parentSkills: { Streetwise: { rank: 3 } } },
    costs,
  );
  assert.deepEqual(
    scopeKnackOptions(opts, ['Streetwise']).map((o) => o.name),
    ['Skill Knack'],
    'only the Streetwise-governed knack in the Skills-tab scope',
  );
});

// --- discipline restriction gate (PLAN-KNACK-RESTRICTIONS §2) -----------------
// A knack whose `restrictions.discipline` doesn't intersect the character's own
// disciplines is excluded. Mirrors the migrated structured form in rules/knacks.json.

const gatedCatalog = {
  'Nether Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { discipline: 'Nethermancer' }, summary: 'nm' },
  'Elem Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { discipline: 'Elementalist' }, summary: 'el' },
  'Multi Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { discipline: [{ name: 'Elementalist', circle: 4 }, 'Wizard'] }, summary: 'multi' },
  'Circle Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { discipline: [{ name: 'Nethermancer', circle: 4 }] }, summary: 'circ' },
  'NoDisc Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { note: 'Any Discipline' }, summary: 'note' },
  'Plain Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: {}, summary: 'plain' },
  'Attr Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: { attribute: { name: 'Strength', value: 14 } }, summary: 'attr' },
};
const parentTalents = { Spellcasting: { rank: 4 } };

test('a bare-string discipline restriction gates for the matching discipline', () => {
  const nm = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 3 }] }, costs);
  assert.ok(nm.some((o) => o.name === 'Nether Knack'), 'Nethermancer char sees its knack');
  assert.ok(!nm.some((o) => o.name === 'Elem Knack'), 'but not another discipline’s');

  const el = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Elementalist', circle: 3 }] }, costs);
  assert.ok(el.some((o) => o.name === 'Elem Knack'));
  assert.ok(!el.some((o) => o.name === 'Nether Knack'));
});

test('a mixed OR-list admits the character via the second (bare-string) entry', () => {
  const out = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Wizard', circle: 1 }] }, costs);
  assert.ok(out.some((o) => o.name === 'Multi Knack'), 'a Wizard (no circle) still matches the bare "Wizard" entry');
});

test('a circle-qualified OR-list entry requires the character at that circle or higher', () => {
  const low = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 3 }] }, costs);
  assert.ok(!low.some((o) => o.name === 'Circle Knack'), 'Nethermancer circle 3 < required 4 → excluded');
  const high = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 5 }] }, costs);
  assert.ok(high.some((o) => o.name === 'Circle Knack'), 'circle 5 >= 4 → included');
});

test('a Set<name> characterDisciplines gate works (circle-free names)', () => {
  const out = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: new Set(['Nethermancer']) }, costs);
  assert.ok(out.some((o) => o.name === 'Nether Knack'));
  assert.ok(!out.some((o) => o.name === 'Elem Knack'));
});

test('non-discipline restrictions do NOT gate the knack (attribute/note/empty)', () => {
  const out = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 3 }] }, costs);
  assert.ok(out.some((o) => o.name === 'NoDisc Knack'), 'note-only restriction never gates');
  assert.ok(out.some((o) => o.name === 'Plain Knack'), 'empty restrictions object = no gate');
  assert.ok(out.some((o) => o.name === 'Attr Knack'), 'attribute restriction is structured but not enforced in v1');
});

test('omitting characterDisciplines (or passing none) disables the discipline gate', () => {
  const unset = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents }, costs);
  assert.ok(unset.some((o) => o.name === 'Nether Knack'), 'no gate when characterDisciplines omitted');
  assert.ok(unset.some((o) => o.name === 'Elem Knack'));
  const empty = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [] }, costs);
  assert.ok(empty.some((o) => o.name === 'Nether Knack'), 'empty discipline list = no gate, not an all-exclude');
});

test('the output restriction field is the structured object (pass-through)', () => {
  const out = learnableKnacks(gatedCatalog, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 5 }] }, costs);
  const circ = out.find((o) => o.name === 'Circle Knack');
  assert.ok(circ, 'a circle-qualifying knack is offered');
  assert.deepEqual(circ.restriction, { discipline: [{ name: 'Nethermancer', circle: 4 }] });
  const plain = out.find((o) => o.name === 'Plain Knack');
  assert.deepEqual(plain.restriction, {});
});

test('a legacy plain-string restriction is tolerated (no gate, no throw) — back-compat', () => {
  const legacy = { ...gatedCatalog, 'Legacy Knack': { parents: ['Spellcasting'], requiredRank: 2, restrictions: 'Warrior', summary: 'legacy' } };
  const out = learnableKnacks(legacy, { ownedKnacks: [], parentTalents, characterDisciplines: [{ name: 'Nethermancer', circle: 3 }] }, costs);
  assert.ok(out.some((o) => o.name === 'Legacy Knack'), 'a string restriction is not gated and never throws');
  assert.equal(out.find((o) => o.name === 'Legacy Knack').restriction, 'Warrior');
});
