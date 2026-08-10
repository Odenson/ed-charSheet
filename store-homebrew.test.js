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
