// store-homebrew.test.js — run with `npm test` (node --test, no deps).
// Covers the homebrew-rules wiring in deriveModel: enabled rules override the
// health ratings' base via their formula (docs/HOMEBREW-RULES.md), the adept
// synthesis is skipped for overridden ratings (no double counting), rule effects
// fold with a `kind: 'homebrew'` origin, and disabled rules are ignored.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));

const baseRules = {
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

// Tou 17 → step 7, table uncon 34 / death 41. A Warrior (durability 7) with
// Durability rank 4: adept synthesis = 7×4 = 28 to both ratings, +Circle 1 to
// Death → standard uncon 62 / death 70. The homebrew rule replaces those bases.
const character = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Test' },
  attributes: { Toughness: { base: 17 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [{ name: 'Warrior', circle: 1, talents: [{ name: 'Durability', rank: 4 }, { name: 'Melee Weapon', rank: 1 }] }],
  skills: [],
  knacks: [],
  items: [],
});

const homebrewRule = {
  schema: 'ed-homebrew/1',
  rules: [
    {
      id: 'hb-uncon-death',
      name: 'Durability-Scaled Health Ratings',
      summary: 'Replaces the fixed Unconsciousness/Death table bases with Durability-scaled ones.',
      enabled: true,
      formula: {
        // (Rank × Step) + table uncon = 4×7 + 34 = 62.
        unconsciousness: {
          terms: [
            { times: ['talent|Durability|Rank', 'attribute|Toughness|Step'], sign: 'add', note: 'Durability Rank × Toughness Step' },
            { ref: 'characteristics|uncon', sign: 'add', note: 'table Unconsciousness base' },
          ],
        },
        // (Rank × Step) + Step + table death = 4×7 + 7 + 41 = 76.
        death: {
          terms: [
            { times: ['talent|Durability|Rank', 'attribute|Toughness|Step'], sign: 'add', note: 'Durability Rank × Toughness Step' },
            { ref: 'attribute|Toughness|Step', sign: 'add', note: 'the extra Toughness Step (+1 on the Rank)' },
            { ref: 'characteristics|death', sign: 'add', note: 'table Death base' },
          ],
        },
      },
      effects: [
        {
          type: 'characteristic-modifier',
          target: { domain: 'characteristic', name: 'DeathRating' },
          operation: 'add',
          value: 2,
          measure: 'rating',
          condition: 'always',
          source: 'homebrew',
          summary: '+2 Death (rule effect)',
        },
      ],
    },
  ],
};

const rulesWith = (homebrewFile) => ({ ...baseRules, homebrewFile });

// --- ed-homebrew/2 `set` lever (docs/HOMEBREW-RULES.md §5.5) -------------------

// A Human (karmaModifier 5) Warrior at Circle 4 → standard max = 5×4 = 20, die
// step 4 (D6), no ritual cost.
const humanChar = (circle = 4) => ({
  schema: 'ed-character/1',
  meta: { name: 'Karn', race: 'Human' },
  attributes: { Toughness: { base: 17 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 }, karma: { available: 3 } },
  disciplines: [{ name: 'Warrior', circle, talents: [{ name: 'Durability', rank: 1 }] }],
  skills: [], knacks: [], items: [],
});
const karmaEconomy = (enabled = true) => ({
  schema: 'ed-homebrew/2',
  rules: [{
    id: 'hb-karma-economy', name: 'Race Karma economy', summary: 'race-driven karma', enabled,
    set: {
      'karma.step': { Human: 5, Dwarf: 4 },
      'karma.maxCap': { Human: 40, Dwarf: 25 },
      'karma.ritualCost': { Human: 6, Dwarf: 10 },
    },
  }],
});

test('set: race-keyed karma.step / maxCap / ritualCost apply for the character race', () => {
  const model = deriveModel(humanChar(10), rulesWith(karmaEconomy())); // circle 10 → base 50
  assert.equal(model.characteristics.karma.step, 5); // Human override (was 4)
  assert.equal(model.characteristics.karma.max, 40); // min(5×10, 40) = 40 capped
  assert.equal(model.characteristics.karma.ritualCost, 6); // Human cost, drives the paid ritual
});

test('set: below the cap, max is the standard mod×circle (cap only clamps)', () => {
  const model = deriveModel(humanChar(4), rulesWith(karmaEconomy())); // base 20 < cap 40
  assert.equal(model.characteristics.karma.max, 20);
});

test('set: disabled rule leaves the standard karma (no cap, KARMA_STEP, no cost)', () => {
  const model = deriveModel(humanChar(10), rulesWith(karmaEconomy(false)));
  assert.equal(model.characteristics.karma.step, 4); // KARMA_STEP
  assert.equal(model.characteristics.karma.max, 50); // 5×10, uncapped
  assert.equal(model.characteristics.karma.ritualCost, null);
});

test('set: a race absent from a race-keyed map leaves that target un-overridden', () => {
  const dwarfOnly = { schema: 'ed-homebrew/2', rules: [{ id: 'hb-k', name: 'x', summary: 'x', enabled: true, set: { 'karma.step': { Dwarf: 4 } } }] };
  const model = deriveModel(humanChar(4), rulesWith(dwarfOnly)); // Human not in the map
  assert.equal(model.characteristics.karma.step, 4); // falls back to KARMA_STEP, not overridden
});

test('set: an unknown target is ignored (registry-gated)', () => {
  const bogus = { schema: 'ed-homebrew/2', rules: [{ id: 'hb-x', name: 'x', summary: 'x', enabled: true, set: { 'karma.bogus': 99, 'not.a.target': 1 } }] };
  const model = deriveModel(humanChar(4), rulesWith(bogus));
  assert.equal(model.characteristics.karma.max, 20); // untouched
  assert.equal(model.characteristics.karma.step, 4);
});

test('set: legend.spends derives karma-on-legend rows from the ledger (historic + events)', () => {
  const char = {
    ...humanChar(4),
    resources: {
      health: { damage: 0, wounds: 0, recoveriesUsed: 0 },
      karma: { converted: 20, rituals: [
        { id: 'a', date: '2026-08-13T00:00:00Z', points: 3, cost: 6 },
        { id: 'b', date: '2026-08-13T01:00:00Z', points: 2, cost: 6 },
      ] },
      legend: { earned: [{ id: 'e1', amount: 500, description: 'Adventure', date: '2026-08-01' }] },
    },
  };
  const model = deriveModel(char, rulesWith(karmaEconomy())); // Human ritualCost 6
  const spends = model.legend.spends;
  assert.equal(spends.length, 3); // historic(15) + a + b
  assert.equal(spends[0].virtual, true);
  assert.equal(spends[0].points, 15); // 20 − 3 − 2
  assert.equal(spends[0].legend, 90); // 15 × 6, current cost
  assert.equal(spends[1].legend, 18); // 3 × 6
  assert.equal(spends[2].legend, 12); // 2 × 6
  // Display rows never leak into the earned list or the earned total.
  assert.equal(model.legend.totalEarnt, 500);
  assert.equal(model.legend.spent.total, 120); // converted 20 × 6 sink
});

test('set: legend.spends is empty when the Karma economy rule is off (no cost)', () => {
  const char = {
    ...humanChar(4),
    resources: {
      health: { damage: 0, wounds: 0, recoveriesUsed: 0 },
      karma: { converted: 20 },
      legend: { earned: [{ id: 'e1', amount: 500, description: 'Adventure', date: '2026-08-01' }] },
    },
  };
  const model = deriveModel(char, rulesWith(karmaEconomy(false)));
  assert.deepEqual(model.legend.spends, []);
  assert.equal(model.legend.totalEarnt, 500); // unaffected by the display rows
});

// --- ed-homebrew/2 `set` lever: legend.additionalTierShift (PLAN-HOMEBREW-LEGEND-TIER) ---

// Archer + Nethermancer (2nd Discipline) with a Novice talent at Rank 3, lowest
// Circle 3 — the standard model prices it 500+300+500 = 1300; the tier-shift
// rule prices it at the bumped Journeyman column 200+300+500 = 1000.
const tierShiftChar = (totalEarnt = 10000) => ({
  schema: 'ed-character/1',
  meta: { name: 'Mica', race: 'Human' },
  attributes: {},
  resources: { legend: { totalEarnt } },
  disciplines: [
    { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }] },
    { name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank: 3, tier: 'Novice', circle: 1 }] },
  ],
  skills: [],
  knacks: [],
  items: [],
});

const tierShiftRule = (enabled = true) => ({
  schema: 'ed-homebrew/2',
  rules: [{ id: 'hb-additional-tier-shift', name: 'One tier higher', summary: 'tier shift', enabled, set: { 'legend.additionalTierShift': 1 } }],
});

test('set: legend.additionalTierShift reprices additional-Discipline talents (bumped column)', () => {
  const model = deriveModel(tierShiftChar(), rulesWith(tierShiftRule()));
  assert.equal(model.legend.tierShift, 1);
  const neth = model.legend.spent.sections.find((s) => s.key === 'talents:1');
  assert.equal(neth.total, 1000); // 200+300+500 vs 1300 standard
  assert.equal(neth.lines[0].detail, 'Novice → Journeyman · Rank 3');
  // First Discipline untouched.
  const arch = model.legend.spent.sections.find((s) => s.key === 'talents:0');
  assert.equal(arch.total, 1900);
});

test('set: tier-shift pricing flows into the rank-editing step costs', () => {
  const model = deriveModel(tierShiftChar(), rulesWith(tierShiftRule()));
  const neth = model.disciplines[1];
  const spell = neth.talents[0];
  // Rank 3 → the refund for dropping to 2 is the step that bought Rank 3:
  // Journeyman R3 = 500 (under the rule). increaseCost R3→R4 = Journeyman R4 = 800.
  assert.equal(spell.pricing.refund, 500);
  assert.equal(spell.pricing.increaseCost, 800);
});

test('set: rule off keeps the standard New-Discipline pricing and tierShift 0', () => {
  const off = deriveModel(tierShiftChar(), rulesWith(tierShiftRule(false)));
  assert.equal(off.legend.tierShift, 0);
  const neth = off.legend.spent.sections.find((s) => s.key === 'talents:1');
  assert.equal(neth.total, 1300); // 500 + 300 + 500
  const spell = off.disciplines[1].talents[0];
  assert.equal(spell.pricing.refund, 500); // the Rank-1 New-Discipline step stayed
});

test('set: an enabled rule with an absent/zero shift keeps the standard model', () => {
  const zero = { schema: 'ed-homebrew/2', rules: [{ id: 'hb-tier0', name: 'x', summary: 'x', enabled: true, set: { 'legend.additionalTierShift': 0 } }] };
  const model = deriveModel(tierShiftChar(), rulesWith(zero));
  assert.equal(model.legend.tierShift, 0);
  assert.equal(model.legend.spent.sections.find((s) => s.key === 'talents:1').total, 1300);
});

test('set: an unknown legend target is still ignored (registry-gated)', () => {
  const bogus = { schema: 'ed-homebrew/2', rules: [{ id: 'hb-x', name: 'x', summary: 'x', enabled: true, set: { 'legend.bogus': 1 } }] };
  const model = deriveModel(tierShiftChar(), rulesWith(bogus));
  assert.equal(model.legend.tierShift, 0);
  assert.equal(model.legend.spent.sections.find((s) => s.key === 'talents:1').total, 1300);
});

test('disabled homebrew rules leave the standard ratings and no homebrew effects', () => {
  const model = deriveModel(character(), rulesWith({ schema: 'ed-homebrew/1', rules: [{ ...homebrewRule.rules[0], enabled: false }] }));
  assert.equal(model.characteristics.unconsciousness.value, 62); // 34 + 7×4
  assert.equal(model.characteristics.death.value, 70); // 41 + 7×4 + circle 1
  assert.ok(!model.activeEffects.some((e) => e.origin?.kind === 'homebrew'));
});

test('an enabled rule overrides both ratings; the adept synthesis is skipped', () => {
  const model = deriveModel(character(), rulesWith(homebrewRule));
  // Formula bases replace the table bases (uncon 62, death 76); the Death rule
  // effect folds (+2 → 78). Adept synthesis is NOT folded again — if it were,
  // Death would be 76 + 29 + 2 = 107, not 78.
  assert.deepEqual(model.characteristics.unconsciousness, { base: 62, value: 62, modifiers: [] });
  assert.equal(model.characteristics.death.base, 76);
  assert.equal(model.characteristics.death.value, 78);
  assert.equal(model.characteristics.death.modifiers.length, 1);
});

test('rule effects fold into the active-effects panel with a homebrew origin', () => {
  const model = deriveModel(character(), rulesWith(homebrewRule));
  const homebrew = model.activeEffects.filter((e) => e.origin?.kind === 'homebrew');
  assert.equal(homebrew.length, 1);
  assert.deepEqual(homebrew[0].origin, { kind: 'homebrew', name: 'Durability-Scaled Health Ratings' });
  assert.equal(homebrew[0].value, 2);
});

test('an enabled rule with no formula only contributes its effects', () => {
  const model = deriveModel(
    character(),
    rulesWith({
      schema: 'ed-homebrew/1',
      rules: [
        {
          id: 'hb-flat-death',
          name: 'Sturdy',
          enabled: true,
          effects: [
            {
              type: 'characteristic-modifier',
              target: { domain: 'characteristic', name: 'DeathRating' },
              operation: 'add',
              value: 5,
              measure: 'rating',
              condition: 'always',
            },
          ],
        },
      ],
    }),
  );
  // No override → the table base stands (41), the adept synthesis folds as
  // modifiers (28 + Circle 1), and the rule's effect folds on top → 75.
  assert.equal(model.characteristics.death.base, 41);
  assert.equal(model.characteristics.death.value, 75);
  assert.equal(model.characteristics.unconsciousness.value, 62);
});

test('a rule referencing an untrained talent treats its rank as 0', () => {
  const noDurability = character();
  noDurability.disciplines = [{ name: 'Warrior', circle: 1, talents: [{ name: 'Melee Weapon', rank: 1 }] }];
  const model = deriveModel(noDurability, rulesWith(homebrewRule));
  // Rank 0 → uncon = 0×7 + 34 = 34; death = 0×7 + 7 + 41 = 48, + rule effect 2.
  assert.equal(model.characteristics.unconsciousness.value, 34);
  assert.equal(model.characteristics.death.value, 50);
});

test('deriveModel exposes only the enabled homebrew rules for the footer pill', () => {
  const model = deriveModel(character(), rulesWith(homebrewRule));
  assert.equal(model.homebrewRules.length, 1);
  assert.deepEqual(model.homebrewRules[0], homebrewRule.rules[0]); // pure data, untouched
  // Disabled rules stay out of the list — nothing shows when none are enabled.
  const off = deriveModel(character(), rulesWith({ schema: 'ed-homebrew/1', rules: [{ ...homebrewRule.rules[0], enabled: false }] }));
  assert.deepEqual(off.homebrewRules, []);
  // Absent file → no list at all (the app renders no pill).
  assert.deepEqual(deriveModel(character(), baseRules).homebrewRules, []);
});
