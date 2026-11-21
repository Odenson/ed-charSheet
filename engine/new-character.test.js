// engine/new-character.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A3: the pure, DOM-free draft builder `engine/new-character.js`
// (spec A3). Imports of a not-yet-existing module are expected to fail until the dev builds it.
//
// Rules cited (plans/create-new-adept/rules.md): R1 (Durability and Karma Ritual seeded at
// Rank 1, Circle 1, free, outside the 8 points), R2 (free talents are derived, never stored),
// R4 (Max Karma = min(Karma Modifier x Circle, cap); starts full), R7 (Legend 0/0: nothing stored),
// R8 (starting kit + 100 silver), R9 (Grimoire for magicians). Per-race Karma numbers and caps are
// READ from rules/races.json and rules/homebrew.json, never restated.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STARTING_SILVER,
  STARTING_KIT,
  GRIMOIRE,
  slugifyId,
  idTaken,
  validateNewName,
  buildNewCharacter,
} from './new-character.js';

const read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const racesFile = read('races.json');
const disciplinesFile = read('disciplines.json');
const attributesFile = read('attributes.json');
const itemsFile = read('items.json');
const economy = read('homebrew.json').rules.find((r) => r.id === 'hb-karma-economy').set;
const rules = { racesFile, disciplinesFile, attributesFile };

const RACES = racesFile.races;
const DISCIPLINES = disciplinesFile.disciplines.map((d) => d.name);
const capFor = (race) => economy['karma.maxCap'][race] ?? null;
const circle1 = (disc) => disciplinesFile.disciplines.find((d) => d.name === disc).circles.find((c) => c.circle === 1);
const isMagician = (disc) => circle1(disc).talents.includes('Spellcasting');
const matrixCount = (disc) => circle1(disc).freeTalents.filter((n) => n === 'Standard Matrix').length;
const expectedKarma = (race, cap) => {
  const mod = RACES.find((r) => r.name === race).karmaModifier;
  return cap == null ? mod : Math.min(mod, cap);
};
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

describe('constants', () => {
  test('STARTING_SILVER is 100 (R8)', () => {
    assert.equal(STARTING_SILVER, 100);
  });

  test('STARTING_KIT is Adventuring Kit, Dagger (equipped), Traveler\'s Garb (equipped), Trail Rations (1 week) (R8)', () => {
    assert.deepEqual(STARTING_KIT, [
      { name: 'Adventuring Kit', equipped: false },
      { name: 'Dagger', equipped: true },
      { name: "Traveler's Garb", equipped: true },
      { name: 'Trail Rations (1 week)', equipped: false },
    ]);
  });

  test('GRIMOIRE is { name: Grimoire, equipped: false } (R9)', () => {
    assert.deepEqual(GRIMOIRE, { name: 'Grimoire', equipped: false });
  });

  test('every kit name (and the Grimoire) resolves in rules/items.json', () => {
    for (const k of [...STARTING_KIT, GRIMOIRE]) assert.ok(itemsFile.items[k.name], `"${k.name}" is in the catalog`);
  });
});

describe('slugifyId', () => {
  const cases = [
    ['Kolon', 'kolon'],
    ['Kolon v2', 'kolon-v2'],
    ['Kolon!', 'kolon'],
    ["Kol'on the Brave", 'kol-on-the-brave'],
    ['a   --  b', 'a-b'], // runs of non-[a-z0-9] collapse to one hyphen
    ['--Kolon--', 'kolon'], // leading and trailing hyphens are trimmed
    ['Éowyn', 'eowyn'], // NFKD + strip combining marks
    ['Zoë Müller', 'zoe-muller'],
    ['ÅNGSTRÖM', 'angstrom'],
    ['Ｋｏｌｏｎ', 'kolon'], // NFKD folds full-width forms
    ['7 Dwarves', '7-dwarves'], // a leading digit is fine
    ['123', '123'],
  ];
  for (const [input, expected] of cases) {
    test(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      assert.equal(slugifyId(input), expected);
    });
  }

  test('an empty or slug-less name falls back to "character"', () => {
    for (const n of ['', '   ', '!!!', '---', '日本語']) assert.equal(slugifyId(n), 'character', JSON.stringify(n));
  });

  test('capped at 64 characters; a hyphen exposed by the cut is trimmed again', () => {
    assert.equal(slugifyId('a'.repeat(100)), 'a'.repeat(64));
    assert.equal(slugifyId('a'.repeat(63) + ' bbbb'), 'a'.repeat(63)); // slice(0,64) ends in "-"
    assert.equal(slugifyId('a'.repeat(64) + ' b'), 'a'.repeat(64));
  });

  test('the output ALWAYS matches the worker id rule ^[a-z0-9][a-z0-9-]{0,63}$', () => {
    const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
    const nasty = ['', ' ', '-', '--a--', '_underscore_', 'Ünï cödé ✓', 'a'.repeat(200), '9'.repeat(70), 'x y z '.repeat(30), 'Ωmega', '日本', '\u0000a\u0000', "O'Brien-Smith, Jr."];
    for (const n of nasty) assert.match(slugifyId(n), ID_RE, JSON.stringify(n));
  });
});

describe('idTaken (no suffixing, ever)', () => {
  test('exact match against any iterable of ids', () => {
    assert.equal(idTaken('kolon', ['kolon', 'chakka']), true);
    assert.equal(idTaken('kolon', new Set(['kolon'])), true);
    assert.equal(idTaken('kolon', []), false);
    assert.equal(idTaken('kolon', new Set()), false);
  });

  test('a different id is not a clash: no prefix, case or suffix matching', () => {
    assert.equal(idTaken('kolon', ['kolon-2']), false);
    assert.equal(idTaken('kolon', ['kolon-v2', 'kolonel']), false);
    assert.equal(idTaken('Kolon', ['kolon']), false, 'ids are already slugs: the comparison is exact');
  });

  test('returns a real boolean', () => {
    assert.equal(typeof idTaken('x', ['x']), 'boolean');
    assert.equal(typeof idTaken('x', []), 'boolean');
  });
});

describe('validateNewName', () => {
  test('a free name is ok and returns its slug; no reason', () => {
    assert.deepEqual(validateNewName('Kolon', []), { ok: true, id: 'kolon', reason: null });
    assert.deepEqual(validateNewName('  Kolon v2  ', ['chakka']), { ok: true, id: 'kolon-v2', reason: null }, 'the name is trimmed before slugging');
  });

  test('a blank name is `empty`', () => {
    for (const n of ['', '   ', '\t\n']) {
      const r = validateNewName(n, []);
      assert.equal(r.ok, false, JSON.stringify(n));
      assert.equal(r.reason, 'empty', JSON.stringify(n));
    }
  });

  test('a taken id is `taken` and the result names the clashing id (Kolon vs kolon! collide)', () => {
    assert.deepEqual(validateNewName('Kolon', ['kolon']), { ok: false, id: 'kolon', reason: 'taken' });
    assert.deepEqual(validateNewName('kolon!', ['kolon']), { ok: false, id: 'kolon', reason: 'taken' });
    assert.deepEqual(validateNewName('KOLON', new Set(['chakka', 'kolon'])), { ok: false, id: 'kolon', reason: 'taken' });
  });

  test('no suffixing: a taken name never yields kolon-2', () => {
    const r = validateNewName('Kolon', ['kolon']);
    assert.equal(r.id, 'kolon');
    assert.equal(r.ok, false);
  });

  test('a name with no Latin letters is not blank: it slugs to "character" and clashes only if that id is taken', () => {
    assert.deepEqual(validateNewName('日本語', []), { ok: true, id: 'character', reason: null });
    assert.deepEqual(validateNewName('日本語', ['character']), { ok: false, id: 'character', reason: 'taken' });
  });

  test('the engine returns codes only (no UI copy): reason is null, "empty" or "taken"', () => {
    for (const [n, taken] of [['A', []], ['', []], ['A', ['a']]]) {
      const r = validateNewName(n, taken);
      assert.deepEqual(Object.keys(r).sort(), ['id', 'ok', 'reason']);
      assert.ok([null, 'empty', 'taken'].includes(r.reason));
    }
  });
});

describe('buildNewCharacter: every race x Discipline', () => {
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  for (const race of RACES.map((r) => r.name)) {
    for (const discipline of DISCIPLINES) {
      test(`${race} ${discipline}: shape, seeded talents, kit, Karma, wealth, spells and creation block`, () => {
        const cap = capFor(race);
        const c = buildNewCharacter({ name: `Test ${race} ${discipline}`, race, discipline }, rules, { karmaMaxCap: cap });
        const raceEntry = RACES.find((r) => r.name === race);
        const magician = isMagician(discipline);

        // top level: exactly these keys (no derived values, no totalEarnt)
        const expectedKeys = ['schema', 'meta', 'attributes', 'disciplines', 'skills', 'knacks', 'traits', 'resources', 'items', 'wealth', 'creation', ...(magician ? ['spells'] : [])];
        assert.deepEqual(Object.keys(c).sort(), expectedKeys.sort());
        assert.equal(c.schema, 'ed-character/2');
        assert.deepEqual(c.meta, { id: slugifyId(`Test ${race} ${discipline}`), name: `Test ${race} ${discipline}`, race });

        // attributes: racial base, nothing bought; entries hold exactly the three inputs
        assert.deepEqual(Object.keys(c.attributes), attributesFile.order);
        for (const n of attributesFile.order) {
          assert.deepEqual(c.attributes[n], { base: raceEntry.startingAttributes[n], points: 0, increases: 0 }, n);
        }

        // one Circle-1 Discipline; Durability and Karma Ritual seeded (R1); free talents and the five Discipline Talents are NOT stored (R2)
        assert.deepEqual(c.disciplines, [
          { name: discipline, circle: 1, talents: [{ name: 'Durability', rank: 1, circle: 1 }, { name: 'Karma Ritual', rank: 1, circle: 1 }] },
        ]);
        assert.deepEqual([c.skills, c.knacks, c.traits], [[], [], []]);

        // resources: Karma starts full (R4), Legend nothing stored (R7)
        assert.deepEqual(c.resources, {
          karma: { converted: expectedKarma(race, cap), spent: 0 },
          legend: { earned: [] },
          health: { damage: 0, wounds: 0, recoveriesUsed: 0 },
        });

        // kit (R8) + Grimoire only for a magician (R9); each entry exactly {name, equipped}
        const kit = [...STARTING_KIT, ...(magician ? [GRIMOIRE] : [])];
        const byName = (a, b) => a.name.localeCompare(b.name);
        assert.deepEqual([...c.items].sort(byName), [...kit].sort(byName));
        for (const it of c.items) assert.deepEqual(Object.keys(it).sort(), ['equipped', 'name']);

        // wealth (R8)
        assert.deepEqual(c.wealth, { coins: { copper: 0, silver: 100, gold: 0, earth: 0, water: 0, air: 0, fire: 0, orichalcum: 0 }, gems: [] });

        // spells block only for a magician: one empty Standard matrix per free Standard Matrix talent
        if (magician) {
          assert.equal(matrixCount(discipline) >= 1, true);
          assert.deepEqual(c.spells, { known: [], matrices: Array.from({ length: matrixCount(discipline) }, () => ({ type: 'Standard', spell: null })) });
        } else {
          assert.ok(!('spells' in c));
        }

        // creation block: exactly open + free; Durability and Karma Ritual are in the free ledger
        assert.deepEqual(Object.keys(c.creation).sort(), ['free', 'open']);
        assert.equal(c.creation.open, true);
        assert.deepEqual(Object.keys(c.creation.free).sort(), ['skills', 'spells', 'talents']);
        assert.deepEqual(c.creation, {
          open: true,
          free: { talents: { [`${discipline}/Durability`]: 1, [`${discipline}/Karma Ritual`]: 1 }, skills: {}, spells: [] },
        });

        // worker checks (mirrored): schema tag, id rule, size
        assert.ok(['ed-character/1', 'ed-character/2'].includes(c.schema));
        assert.match(c.meta.id, ID_RE);
        assert.ok(JSON.stringify(c).length <= 512 * 1024);
      });
    }
  }
});

describe('buildNewCharacter: Karma, magicians, purity, errors', () => {
  test('only the Nethermancer is a magician (Spellcasting in the circle-1 talents), with two empty Standard matrices', () => {
    assert.deepEqual(DISCIPLINES.filter(isMagician), ['Nethermancer']);
    const c = buildNewCharacter({ name: 'Mage', race: 'Human', discipline: 'Nethermancer' }, rules);
    assert.equal(c.spells.matrices.length, 2);
    assert.deepEqual(c.items.map((i) => i.name).sort(), [...STARTING_KIT.map((k) => k.name), 'Grimoire'].sort());
    for (const d of DISCIPLINES.filter((x) => x !== 'Nethermancer')) {
      const other = buildNewCharacter({ name: 'Other', race: 'Human', discipline: d }, rules);
      assert.ok(!('spells' in other), d);
      assert.ok(!other.items.some((i) => i.name === 'Grimoire'), d);
    }
  });

  test('converted equals the Circle-1 Max Karma per race WITHOUT a cap (the plain Karma Modifier)', () => {
    for (const r of RACES) {
      const c = buildNewCharacter({ name: 'No Cap', race: r.name, discipline: 'Warrior' }, rules);
      assert.equal(c.resources.karma.converted, r.karmaModifier, r.name);
      const defaulted = buildNewCharacter({ name: 'No Cap', race: r.name, discipline: 'Warrior' }, rules, {});
      assert.equal(defaulted.resources.karma.converted, r.karmaModifier, `${r.name} (empty options)`);
    }
  });

  test('converted equals min(Karma Modifier, cap) per race WITH the house cap read from rules/homebrew.json', () => {
    for (const r of RACES) {
      const c = buildNewCharacter({ name: 'Capped', race: r.name, discipline: 'Archer' }, rules, { karmaMaxCap: capFor(r.name) });
      assert.equal(c.resources.karma.converted, Math.min(r.karmaModifier, capFor(r.name)), r.name);
    }
  });

  test('a cap below the Karma Modifier is honoured (min), so a hypothetical tight cap still starts full', () => {
    const c = buildNewCharacter({ name: 'Tight', race: 'Windling', discipline: 'Thief' }, rules, { karmaMaxCap: 2 });
    assert.equal(c.resources.karma.converted, 2);
  });

  test('stores inputs only: nothing derived appears anywhere in the draft (no Step, Value, max, available, totals)', () => {
    const c = buildNewCharacter({ name: 'Inputs', race: 'Ork', discipline: 'Archer' }, rules, { karmaMaxCap: 40 });
    const text = JSON.stringify(c);
    for (const banned of ['"step"', '"value"', '"max"', '"available"', '"totalEarnt"', '"totalSpent"', '"karmaBonus"', '"tier"']) {
      assert.ok(!text.includes(banned), `no ${banned}`);
    }
    for (const a of Object.values(c.attributes)) assert.deepEqual(Object.keys(a).sort(), ['base', 'increases', 'points']);
    assert.deepEqual(Object.keys(c.resources.karma).sort(), ['converted', 'spent']);
  });

  test('pure: neither the rules nor the shared kit constants are mutated, and two builds do not share objects', () => {
    const frozen = deepFreeze(structuredClone(rules));
    const a = buildNewCharacter({ name: 'Same', race: 'Dwarf', discipline: 'Nethermancer' }, frozen, { karmaMaxCap: 25 });
    const kitBefore = structuredClone(STARTING_KIT);
    a.items[0].equipped = true;
    a.items.push({ name: 'junk', equipped: true });
    a.wealth.coins.silver = 0;
    a.creation.free.talents['Nethermancer/Durability'] = 9;
    a.disciplines[0].talents.pop();
    assert.deepEqual(STARTING_KIT, kitBefore, 'the shared constants stay pristine');
    const b = buildNewCharacter({ name: 'Same', race: 'Dwarf', discipline: 'Nethermancer' }, frozen, { karmaMaxCap: 25 });
    assert.equal(b.wealth.coins.silver, 100);
    assert.equal(b.creation.free.talents['Nethermancer/Durability'], 1);
    assert.equal(b.disciplines[0].talents.length, 2);
    assert.equal(b.items.length, STARTING_KIT.length + 1);
  });

  test('an unknown race or Discipline throws', () => {
    assert.throws(() => buildNewCharacter({ name: 'X', race: 'Gnome', discipline: 'Archer' }, rules), /unknown race/);
    assert.throws(() => buildNewCharacter({ name: 'X', race: 'Human', discipline: 'Wizard' }, rules), /unknown discipline/);
  });

  test('meta.id is the slug of the name and meta.name keeps the name as typed', () => {
    const c = buildNewCharacter({ name: "Kol'on the Brave!", race: 'Ork', discipline: 'Warrior' }, rules);
    assert.equal(c.meta.id, 'kol-on-the-brave');
    assert.equal(c.meta.name, "Kol'on the Brave!");
  });
});
