// Tier-2 guard: rules/*.json must agree with docs/EFFECT-TAXONOMY.md.
//  1. every file's `effectTaxonomy` ref names the doc's current version
//  2. every `schema` tag is well-formed
//  3. every effect's controlled fields use vocabulary the doc defines
// Vocabulary is read from the doc's own tables, so a taxonomy bump that is not
// migrated everywhere fails here (docs/GUARDRAILS.md Tier 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = fs.readFileSync(path.join(root, 'docs/EFFECT-TAXONOMY.md'), 'utf8');
const rulesDir = path.join(root, 'rules');
const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.json')).sort();
const load = (f) => JSON.parse(fs.readFileSync(path.join(rulesDir, f), 'utf8'));

const docVersion = doc.match(/^# Effect Taxonomy — (v\d+)/m)?.[1];

// Text of "## <n>. …" up to the next "## " heading.
function section(n) {
  const m = doc.match(new RegExp(`^## ${n}\\. [\\s\\S]*?(?=^## \\d+\\. |(?![\\s\\S]))`, 'm'));
  assert.ok(m, `taxonomy doc has no section ${n}`);
  return m[0];
}
// Backticked first cells of table rows: "| `add` | …".
function tableVocab(n) {
  return new Set([...section(n).matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]));
}
// Backticked tokens in the prose list of §9.
function proseVocab(n) {
  return new Set([...section(n).matchAll(/`([a-z-]+)`/g)].map((m) => m[1]));
}

// §5.1 action values: backticked words in the prose (case-sensitive; `Sustained`
// and `NA` are listed there only as explicitly invalid). Valid ones are Free, Simple, Standard.
function actionVocab() {
  const m = doc.match(/^### 5\.1 [^\n]*\n([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m);
  assert.ok(m, 'taxonomy doc has no "### 5.1" subsection');
  const words = [...m[1].matchAll(/`([A-Za-z]+)`/g)].map((x) => x[1]);
  return words.filter((w) => !['Sustained', 'NA'].includes(w));
}
const ACTION = actionVocab();

// Violations of the action-modifier shape (taxonomy v5, §2/§5/§5.1).
function actionModifierProblems(e) {
  const p = [];
  if (e.operation !== 'set') p.push(`operation must be "set", got "${e.operation}"`);
  if (e.measure !== 'action') p.push(`measure must be "action", got "${e.measure}"`);
  if (e.target?.domain !== 'ability') p.push(`target.domain must be "ability", got "${e.target?.domain}"`);
  else if (typeof e.target?.name !== 'string' || !e.target.name) p.push('target.name must be a non-empty string');
  if (typeof e.value !== 'string' || !ACTION.includes(e.value)) p.push(`value must be one of ${ACTION.join('/')}, got ${JSON.stringify(e.value)}`);
  return p;
}

const VOCAB = {
  type: tableVocab(2),
  operation: tableVocab(4),
  measure: tableVocab(5),
  stacking: tableVocab(7),
  duration: tableVocab(8),
  source: proseVocab(9),
};

// Every object held in an `effects` array, at any depth.
function* walk(node, trail = '') {
  if (Array.isArray(node)) { for (const [i, v] of node.entries()) yield* walk(v, `${trail}[${i}]`); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'effects' && Array.isArray(v)) {
        for (const [i, e] of v.entries()) if (e && typeof e === 'object') yield [e, `${trail}.effects[${i}]`];
      }
      yield* walk(v, `${trail}.${k}`);
    }
  }
}

test('taxonomy doc exposes a version and non-empty vocabularies', () => {
  assert.match(docVersion ?? '', /^v\d+$/);
  for (const [k, set] of Object.entries(VOCAB)) assert.ok(set.size > 0, `no vocabulary parsed for ${k}`);
});

test('every rules file has a well-formed schema tag', () => {
  for (const f of files) {
    const d = load(f);
    assert.match(String(d.schema), /^ed-[a-z-]+\/\d+$/, `rules/${f}: bad or missing schema tag`);
  }
});

test('effectTaxonomy refs name the current taxonomy version', () => {
  for (const f of files) {
    const d = load(f);
    const uses = [...walk(d)].length > 0;
    if (d.effectTaxonomy == null) {
      assert.ok(!uses, `rules/${f}: has effects but no effectTaxonomy reference`);
      continue;
    }
    assert.equal(d.effectTaxonomy, `docs/EFFECT-TAXONOMY.md (${docVersion})`,
      `rules/${f}: effectTaxonomy is "${d.effectTaxonomy}", doc is ${docVersion} — half-migrated Tier-2 change`);
  }
});

test('every effect uses the documented vocabulary', () => {
  const bad = [];
  let scanned = 0;
  for (const f of files) {
    for (const [e, where] of walk(load(f))) {
      scanned++;
      if (!VOCAB.type.has(e.type)) bad.push(`rules/${f}${where}: type "${e.type}"`);
      if (e.type === 'action-modifier')
        for (const pr of actionModifierProblems(e)) bad.push(`rules/${f}${where}: ${pr}`);
      for (const field of ['operation', 'measure', 'stacking', 'duration', 'source']) {
        if (e[field] != null && !VOCAB[field].has(e[field]))
          bad.push(`rules/${f}${where}: ${field} "${e[field]}"`);
      }
    }
  }
  assert.ok(scanned > 0, 'no effects scanned — the walker is broken');
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} vocabulary violations (first 20 shown)`);
});

// ---- taxonomy v6: dice values + `object` selector (spell-nights-edge I1) ----
// (v5 added action-modifier; its tests below are unchanged.)

test('taxonomy doc is v6 and every rules ref that carries one names v6', () => {
  assert.equal(docVersion, 'v6');
  for (const f of files) {
    const d = load(f);
    if (d.effectTaxonomy != null) assert.equal(d.effectTaxonomy, 'docs/EFFECT-TAXONOMY.md (v6)', `rules/${f}`);
  }
});

// Grammar from the spec: optional leading count, die sizes matching engine/dice.js, `+` joins only.
const DICE_RE = /^(\d*D(4|6|8|10|12|20))(\+\d*D(4|6|8|10|12|20))*$/;
const OBJECT_KINDS = ['weapon', 'melee-weapon', 'missile-weapon', 'character', 'item'];

// Violations of the optional `object` selector (taxonomy v6 §1).
function validateObject(o) {
  const p = [];
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return ['object must be an object'];
  if (!OBJECT_KINDS.includes(o.kind)) p.push(`object.kind "${o.kind}" is not one of ${OBJECT_KINDS.join('/')}`);
  if (o.require !== undefined && o.require !== 'equipped') p.push(`object.require must be "equipped" or absent, got ${JSON.stringify(o.require)}`);
  return p;
}

// Violations of a `measure:"dice"` value, and of dice strings on other measures.
function validateDiceValue(e) {
  const p = [];
  if (e.measure === 'dice') {
    if (typeof e.value !== 'string' || !DICE_RE.test(e.value)) p.push(`measure "dice" needs a dice string, got ${JSON.stringify(e.value)}`);
  } else if (typeof e.value === 'string' && DICE_RE.test(e.value)) {
    p.push(`dice string ${JSON.stringify(e.value)} on measure "${e.measure}"`);
  }
  return p;
}

test('v6 doc defines the dice grammar and the object field', () => {
  assert.ok(VOCAB.measure.has('dice'));
  assert.match(doc, /`object`/);
  for (const kind of OBJECT_KINDS) assert.ok(doc.includes(`\`${kind}\``), `doc names object kind ${kind}`);
  assert.match(doc, /D4\+D6/, 'doc shows the joined-dice example');
  assert.match(doc, /Night.s Edge/, 'doc carries the Night\u2019s Edge worked example');
});

test('every effect in rules/*.json has a valid object and dice value', () => {
  const bad = [];
  let objects = 0;
  for (const f of files) {
    for (const [e, where] of walk(load(f))) {
      if (e.object !== undefined) { objects++; for (const pr of validateObject(e.object)) bad.push(`rules/${f}${where}: ${pr}`); }
      for (const pr of validateDiceValue(e)) bad.push(`rules/${f}${where}: ${pr}`);
    }
  }
  assert.ok(objects > 0, 'no object-bearing effect scanned (Night\u2019s Edge should carry one)');
  assert.deepEqual(bad.slice(0, 20), []);
});

test('validateObject accepts weapon/equipped and every documented kind', () => {
  assert.deepEqual(validateObject({ kind: 'weapon', require: 'equipped' }), []);
  for (const kind of OBJECT_KINDS) assert.deepEqual(validateObject({ kind }), [], kind);
});

test('validateObject rejects a malformed kind, require, or shape', () => {
  assert.ok(validateObject({ kind: 'sword' }).length > 0);
  assert.ok(validateObject({}).length > 0);
  assert.ok(validateObject({ kind: 'weapon', require: 'worn' }).length > 0);
  assert.ok(validateObject('weapon').length > 0);
  assert.ok(validateObject(null).length > 0);
});

test('validateDiceValue accepts D4, 2D6, D4+D6 on measure dice', () => {
  for (const value of ['D4', '2D6', 'D4+D6', '3D20', '2D8+D10+D12']) {
    assert.deepEqual(validateDiceValue({ measure: 'dice', value }), [], value);
  }
});

test('validateDiceValue rejects malformed dice strings, numbers on dice, and dice strings on other measures', () => {
  for (const value of ['D7', 'banana', '', 'D4+', 'D4 + D6', '4', 'd4', undefined, null]) {
    assert.ok(validateDiceValue({ measure: 'dice', value }).length > 0, `value ${JSON.stringify(value)}`);
  }
  assert.ok(validateDiceValue({ measure: 'dice', value: 4 }).length > 0, 'numeric value on dice measure');
  assert.ok(validateDiceValue({ measure: 'step', value: 'D4' }).length > 0, 'dice string on step measure');
  assert.ok(validateDiceValue({ measure: 'rating', value: '2D6' }).length > 0);
  assert.deepEqual(validateDiceValue({ measure: 'step', value: 3 }), []);
});

test('doc defines type action-modifier and measure action', () => {
  assert.ok(VOCAB.type.has('action-modifier'));
  assert.ok(VOCAB.measure.has('action'));
});

test('§5.1 ACTION is exactly Free, Simple, Standard and does not pollute the measure vocab', () => {
  assert.deepEqual(ACTION, ['Free', 'Simple', 'Standard']);
  for (const w of [...ACTION, 'Sustained', 'NA']) assert.ok(!VOCAB.measure.has(w), `measure vocab contains ${w}`);
});

test('Death’s Head carries a valid action-modifier in rules/spells.json', () => {
  const dh = load('spells.json').spells['Death’s Head'];
  const mods = (dh.effects ?? []).filter((e) => e.type === 'action-modifier');
  assert.equal(mods.length, 1);
  assert.deepEqual(actionModifierProblems(mods[0]), []);
});

const validAction = { type: 'action-modifier', target: { domain: 'ability', name: 'Frighten' }, operation: 'set', measure: 'action', value: 'Simple' };

test('actionModifierProblems accepts a valid Simple effect', () => {
  assert.deepEqual(actionModifierProblems(validAction), []);
});

test('actionModifierProblems rejects invalid values: Sustained, NA, Instant, number, missing', () => {
  for (const value of ['Sustained', 'NA', 'Instant', 2, undefined]) {
    assert.ok(actionModifierProblems({ ...validAction, value }).length > 0, `value ${String(value)}`);
  }
});

test('actionModifierProblems rejects operation add, wrong measure and wrong domain', () => {
  assert.ok(actionModifierProblems({ ...validAction, operation: 'add' }).length > 0);
  assert.ok(actionModifierProblems({ ...validAction, measure: 'step' }).length > 0);
  assert.ok(actionModifierProblems({ ...validAction, target: { domain: 'test', name: 'Frighten' } }).length > 0);
  assert.ok(actionModifierProblems({ ...validAction, target: { domain: 'ability', name: '' } }).length > 0);
});

// ---- create-new-adept A1: rules/skills.json `category`, `generic`, `artisanKey`, tier fix ----
// Expected values come ONLY from plans/create-new-adept/rules.md R11 (RULES-FAQ Q041) and the
// spec's "Rules" table. Category is decided by book list membership, never by name guessing.
// These are failing-first until rules/skills.json carries the new fields.
const SKILL_CATEGORIES = ['general', 'knowledge', 'artisan', 'language-speak', 'language-readwrite'];
const LANGS = ['Drake', 'Dwarf', 'Elf', 'Human', 'Obsidiman', 'Ork', 'T`skrang', 'Theran', 'Throalic', 'Troll', 'Windling'];
// R11 verbatim: the closed lists.
const R11 = {
  'language-speak': ['Speak Language', ...LANGS.map((l) => `Speak Language (${l})`)],
  'language-readwrite': ['Read/Write Language', ...LANGS.map((l) => `Read/Write Language (${l})`)],
  knowledge: ['Knowledge', 'Horror Lore', 'Barsaive History', 'Creature Lore', 'Discipline Lore', 'Legends and Heroes', 'Racial Lore', 'Scourge History', 'Trade Routes'],
  artisan: [
    'Acting', 'Arrow Fletching (Artisan)', 'Artisan', 'Body Painting (Artisan)', 'Bone Carving (Artisan)',
    'Braiding (Artisan)', 'Craft Armor', 'Craft Weapon', 'Craftsman', 'Embroidery', 'Manuscript Illumination',
    'Map Making', 'Painting', 'Poetry', 'Robe Embroidery', 'Rune Carving', 'Sail Embroidery', 'Sculpting',
    'Tailor', 'Tanning', 'Tattooist', 'Wood Carving',
  ],
};
const GENERIC_NAMES = ['Knowledge', 'Artisan', 'Speak Language', 'Read/Write Language'];
const skillsFile = load('skills.json');
const skillEntries = skillsFile.skills;
const skillsInCategory = (c) => skillEntries.filter((s) => s.category === c);
const disciplineEntries = load('disciplines.json').disciplines;

test('skills: schema tag stays ed-skills/1 and the catalog keeps its 161 entries (154 + 7 Knowledge examples; duplicates stay)', () => {
  assert.equal(skillsFile.schema, 'ed-skills/1');
  assert.equal(skillEntries.length, 161);
  const names = skillEntries.map((s) => s.name);
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i).sort(), ['Bribery', 'Skinning']);
});

test('skills: every entry has a valid category', () => {
  const bad = skillEntries.filter((s) => !SKILL_CATEGORIES.includes(s.category)).map((s) => `${s.name}: ${s.category}`);
  assert.deepEqual(bad, []);
});

test('skills: category counts are 106 general / 9 knowledge / 22 artisan / 12 language-speak / 12 language-readwrite (R11 + 7 Knowledge examples, Q046)', () => {
  assert.equal(skillsInCategory('general').length, 106);
  assert.equal(skillsInCategory('knowledge').length, 9);
  assert.equal(skillsInCategory('artisan').length, 22);
  assert.equal(skillsInCategory('language-speak').length, 12);
  assert.equal(skillsInCategory('language-readwrite').length, 12);
});

test('skills: the closed R11 lists (knowledge, artisan, both language families) hold exactly their members', () => {
  for (const [cat, names] of Object.entries(R11)) {
    assert.deepEqual(skillsInCategory(cat).map((s) => s.name).sort(), [...names].sort(), cat);
  }
});

test('skills: every other entry is general (Artist, Entertaining, Animal Tracking, Hunting, Public Speaking, Riding, Skinning x2, Bribery x2)', () => {
  const listed = new Set(Object.values(R11).flat());
  for (const s of skillEntries) if (!listed.has(s.name)) assert.equal(s.category, 'general', s.name);
  for (const n of ['Artist', 'Entertaining', 'Animal Tracking', 'Hunting', 'Public Speaking', 'Riding']) {
    assert.equal(skillEntries.find((s) => s.name === n)?.category, 'general', n);
  }
  assert.deepEqual(skillEntries.filter((s) => s.name === 'Skinning').map((s) => s.category), ['general', 'general']);
  assert.deepEqual(skillEntries.filter((s) => s.name === 'Bribery').map((s) => s.category), ['general', 'general']);
});

test('skills: the dual-use entries the owner decided are artisan (Acting, Craft Armor, Craft Weapon, Craftsman, Map Making, Tailor, Tanning, Tattooist)', () => {
  for (const n of ['Acting', 'Craft Armor', 'Craft Weapon', 'Craftsman', 'Map Making', 'Tailor', 'Tanning', 'Tattooist']) {
    assert.equal(skillEntries.find((s) => s.name === n)?.category, 'artisan', n);
  }
});

test('skills: generic: true on exactly Knowledge, Artisan, Speak Language, Read/Write Language', () => {
  assert.deepEqual(skillEntries.filter((s) => s.generic === true).map((s) => s.name).sort(), [...GENERIC_NAMES].sort());
  for (const n of ['Horror Lore', 'Artist', 'Entertaining', 'Craftsman']) {
    assert.notEqual(skillEntries.find((s) => s.name === n)?.generic, true, `${n} is not generic`);
  }
});

test('skills: artisanKey is on exactly the 21 artisan entries except the Artisan template, = catalog name minus a trailing " (Artisan)"', () => {
  const keyed = skillEntries.filter((s) => s.artisanKey !== undefined);
  assert.equal(keyed.length, 21);
  assert.deepEqual(keyed.map((s) => s.name).sort(), R11.artisan.filter((n) => n !== 'Artisan').sort());
  for (const s of keyed) assert.equal(s.artisanKey, s.name.replace(/ \(Artisan\)$/, ''), s.name);
  assert.equal(skillEntries.find((s) => s.name === 'Artisan').artisanKey, undefined, 'the template carries no artisanKey');
  // The four entries that keep the suffix only in the catalog name.
  for (const [name, key] of [['Arrow Fletching (Artisan)', 'Arrow Fletching'], ['Body Painting (Artisan)', 'Body Painting'], ['Bone Carving (Artisan)', 'Bone Carving'], ['Braiding (Artisan)', 'Braiding']]) {
    assert.equal(skillEntries.find((s) => s.name === name).artisanKey, key);
  }
});

test('skills: each of the eight Discipline artisanSkills strings resolves to exactly one artisanKey (R11)', () => {
  const expected = {
    Archer: ['Arrow Fletching', 'Wood Carving'],
    Nethermancer: ['Bone Carving', 'Robe Embroidery'],
    Thief: ['Acting', 'Poetry'],
    Warrior: ['Sculpting', 'Rune Carving'],
  };
  for (const [disc, list] of Object.entries(expected)) {
    const entry = disciplineEntries.find((d) => d.name === disc);
    assert.deepEqual([...entry.artisanSkills].sort(), [...list].sort(), `${disc} list per R11`);
  }
  for (const d of disciplineEntries) {
    for (const key of d.artisanSkills ?? []) {
      assert.equal(skillEntries.filter((s) => s.artisanKey === key).length, 1, `${d.name}: "${key}" must match exactly one artisanKey`);
    }
  }
});

test('skills: both copies of the duplicated Bribery and Skinning entries carry identical new-field values', () => {
  for (const n of ['Bribery', 'Skinning']) {
    const [a, b] = skillEntries.filter((s) => s.name === n);
    assert.ok(a && b, `${n} appears twice`);
    assert.ok(SKILL_CATEGORIES.includes(a.category), `${n} carries a category`);
    for (const f of ['category', 'generic', 'artisanKey', 'tier']) assert.equal(a[f], b[f], `${n}.${f}`);
  }
});

test('skills: tier - Impressive Display and Tactics are 2; counts are 1:123, 2:31, 3:7 (116 + 7 Novice Knowledge examples); general-and-Novice = 68 (R11)', () => {
  assert.equal(skillEntries.find((s) => s.name === 'Impressive Display').tier, 2);
  assert.equal(skillEntries.find((s) => s.name === 'Tactics').tier, 2);
  const tier = (n) => skillEntries.filter((s) => s.tier === n).length;
  assert.deepEqual([tier(1), tier(2), tier(3)], [123, 31, 7]);
  assert.equal(skillEntries.filter((s) => s.category === 'general' && s.tier === 1).length, 68);
});

test('skills: no bulk re-tiering - well-known Novice entries stay tier 1', () => {
  for (const n of ['Acrobatic Defense', 'Awareness', 'Horror Lore', 'Knowledge', 'Melee Weapon', 'Tracking', 'Wilderness Survival']) {
    assert.equal(skillEntries.find((s) => s.name === n)?.tier, 1, n);
  }
});
