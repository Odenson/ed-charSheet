#!/usr/bin/env node
// ============================================================================
// ONE-OFF SEEDER — provenance record (like import-xlsx.mjs). DO NOT re-run
// blindly: rules/spells.json is hand-maintained after this seed (taxonomy
// effects[] are enriched by hand per docs/EFFECT-TAXONOMY.md, and re-running
// would overwrite those). Reads the LOCAL, GITIGNORED rulebook extracts
// (copyrighted FASA text — never committed) and emits ONLY mechanics + terse
// mechanical effect strings (numbers/facts, no verbatim prose) into
// rules/spells.json (ed-spells/1). See PLAN-SPELLS.md §3.
//
//   node tools/archive/build-nethermancer-spells.mjs
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const EX = resolve(ROOT, 'rulebook extracts');
const TABLE = resolve(EX, 'text-spell-table-all.txt');
const PG = resolve(EX, 'manual/text-player-guide-nethermancer-spells.txt');

const CIRCLE = { First: 1, Second: 2, Third: 3, Fourth: 4, Fifth: 5, Sixth: 6,
  Seventh: 7, Eighth: 8, Ninth: 9, Tenth: 10, Eleventh: 11, Twelfth: 12,
  Thirteenth: 13, Fourteenth: 14, Fifteenth: 15 };

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

// Weaving "5 / 10" | "5/ 10" -> { value, reattune }
function weaving(cell) {
  const nums = clean(cell).match(/\d+/g)?.map(Number) ?? [];
  return { value: nums[0] ?? null, reattune: nums[1] ?? null };
}

// Casting cell -> castingTarget hint string. "TMD"->Mystic Defense; a bare
// number -> fixed target number; keep "(see text)"/"(special)" qualifier.
function castingTarget(cell) {
  const c = clean(cell);
  const seeText = /\(see text\)|\(special\)/i.test(c);
  const suffix = seeText ? ' (see text)' : '';
  if (/TMD/i.test(c)) {
    // e.g. "6; TMD (see text)" keeps the fixed alt in the label
    const alt = c.match(/^(\d+)\s*;/);
    return (alt ? `${alt[1]} or ` : '') + "Target's Mystic Defense" + suffix;
  }
  const n = c.match(/\d+/);
  return n ? `Fixed ${n[0]}${suffix}` : c;
}

// Duration cell may append "Area of Effect: ...". Split them.
function durationArea(cell) {
  const c = clean(cell);
  const m = c.match(/Area of Effect:\s*(.+)$/i);
  if (m) return { duration: clean(c.slice(0, m.index)) || null, area: clean(m[1]) };
  return { duration: c || null, area: null };
}

// ---- parse the master table for Nethermancer rows ----
const rows = readFileSync(TABLE, 'utf8').split('\n');
const spells = {};
const order = [];
for (const line of rows) {
  const cells = line.split('|').map((s) => s.trim());
  // "| Circle | Caster | Spell | Threads | Weaving | Casting | Range | Duration | Effect |"
  if (cells.length < 11) continue;
  const [, circleW, caster, name, threads, weav, cast, range, dur, eff] = cells;
  if (caster !== 'Nethermancer' || !CIRCLE[circleW]) continue;
  const { duration, area } = durationArea(dur);
  spells[name] = {
    name,
    discipline: 'Nethermancer',
    circle: CIRCLE[circleW],
    threadsToWeave: Number(threads) || 0,
    weavingDifficulty: weaving(weav),
    castingTarget: castingTarget(cast),
    range: clean(range) || null,
    duration,
    area,
    successes: [],
    extraThreads: [],
    effects: [],
    summary: clean(eff), // terse mechanical effect line (data, not prose)
  };
  order.push(name);
}

// ---- enrich Success Levels / Extra Threads from the players guide ----
const pg = readFileSync(PG, 'utf8').split('\n');
const names = new Set(order);
// de-hyphenate wrapped lines: a word split as "Ar-\nmor" rejoins to "Armor",
// while a real "-2" penalty keeps its hyphen.
function joinWrapped(lines) {
  return lines.join(' ')
    .replace(/([A-Za-z])-\s+([a-z])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}
let cur = null;
for (let i = 0; i < pg.length; i++) {
  const t = pg[i].trim();
  if (names.has(t)) { cur = t; continue; }
  if (!cur) continue;
  const grab = (label) => {
    const buf = [pg[i].replace(new RegExp(`^\\s*${label}:\\s*`), '')];
    let j = i + 1;
    for (; j < pg.length; j++) {
      const n = pg[j].trim();
      if (n === '' || /^(Success Levels|Extra Threads|Threads):/.test(n) || names.has(n) || n.startsWith('/page')) break;
      buf.push(pg[j]);
    }
    return joinWrapped(buf);
  };
  if (/^Success Levels:/.test(t)) {
    const v = grab('Success Levels');
    if (v && !/^NA$/i.test(v)) spells[cur].successes = [{ label: v, effects: [] }];
  } else if (/^Extra Threads:/.test(t)) {
    const v = grab('Extra Threads');
    if (v && !/^NA$/i.test(v)) {
      spells[cur].extraThreads = v.split(/,\s*(?=Increase|Additional|Increased)/)
        .map((s) => clean(s)).filter(Boolean)
        .map((label) => ({ label, effects: [] }));
    }
  }
}

// ---- curated taxonomy effects[] (hand-authored, §3.4 archetypes) ----
// SUSTAINED buffs fold into the subject's derived values (duration:sustained);
// INSTANTANEOUS attacks roll once (duration:test) via the set-as-base contract
// (docs/EFFECT-TAXONOMY.md §4.1). Uncurated spells fall back to a note effect so
// effects[] is never empty (rituals/summons/utility). Enriched incrementally.
const WIL = { ref: 'attribute|Willpower|Step' };
const dmg = (name) => ({ domain: 'attack', name });
const instAttack = (add, summary) => [
  { type: 'attack-modifier', target: dmg('Damage'), operation: 'set', value: WIL,
    measure: 'step', duration: 'test', source: 'spell', summary: 'Effect = Willpower step.' },
  { type: 'attack-modifier', target: dmg('Damage'), operation: 'add', value: add,
    measure: 'step', duration: 'test', source: 'spell', summary },
];
const sustainTest = (nm, add, summary) => [
  { type: 'test-modifier', target: { domain: 'test', name: nm }, operation: 'add',
    value: add, measure: 'rating', duration: 'sustained', source: 'spell', summary },
];
const EFFECTS = {
  // First Circle
  'Astral Spear': instAttack(4, '+4 Effect step (Willpower-based mystic damage).'),
  'Soul Armor': [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' },
    operation: 'add', value: 3, measure: 'rating', duration: 'sustained', source: 'spell',
    summary: '+3 Mystic Armor while the spell is active.' }],
  'Shadow Meld': sustainTest('Stealthy Stride', 4, '+4 to Stealthy Stride tests while active.'),
  'Soulless Eyes': sustainTest('Intimidation', 3, '+3 to Intimidation tests while active.'),
  'Spirit Dart': [
    ...instAttack(2, '+2 Effect step (Willpower-based mystic damage).'),
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' }, operation: 'subtract',
      value: 2, measure: 'rating', duration: 'rounds', rounds: 2, source: 'spell',
      summary: "Reduces the target's Mystic Armor by 2 (on the target, not the caster).",
      gmDiscretion: true },
  ],
  'Spirit Grip': [
    ...instAttack(2, '+2 Effect step (Willpower-based mystic damage).'),
    { type: 'defense-modifier', target: { domain: 'defense', name: 'Physical' }, operation: 'subtract',
      value: 2, measure: 'rating', duration: 'rounds', rounds: 2, source: 'spell',
      summary: "Reduces the target's Defenses by 2 (on the target, not the caster).",
      gmDiscretion: true },
  ],
  'Experience Death': instAttack(5, '+5 Effect step (Willpower-based).'),
  'Undead Struggle': instAttack(3, '+3 Effect step (Willpower-based mystic damage).'),
  // Second Circle
  'Shield Mist': sustainTest('Avoid Blow', 4, '+4 to Avoid Blow tests while active.'),
  'Aspect of the Fog Ghost': [
    { type: 'attack-modifier', target: dmg('Attack'), operation: 'add', value: 3, measure: 'rating',
      duration: 'sustained', source: 'spell', summary: '+3 close-combat Attack while active.' },
    { type: 'attack-modifier', target: dmg('Damage'), operation: 'add', value: 3, measure: 'rating',
      duration: 'sustained', source: 'spell', summary: '+3 close-combat Damage while active.' },
    { type: 'defense-modifier', target: { domain: 'defense', name: 'Physical' }, operation: 'add',
      value: 3, measure: 'rating', duration: 'sustained', source: 'spell',
      summary: '+3 Physical Defense while active.' },
  ],
  // Third Circle
  'Pattern Spike': instAttack(3, '+3 Effect step (Willpower-based mystic damage).'),
  'Arrow of Night': [
    { type: 'attack-modifier', target: dmg('Damage'), operation: 'add', value: 6, measure: 'rating',
      duration: 'test', source: 'spell', summary: '+6 to the enchanted missile Damage test.' },
  ],
  // Fifth Circle
  'Dust to Dust': instAttack(8, '+8 Effect step (Willpower-based mystic damage).'),
  'Wither Limb': instAttack(6, '+6 Effect step (Willpower-based mystic damage).'),
  // Sixth Circle
  'Bone Shatter': instAttack(6, '+6 Effect step (Willpower-based mystic damage).'),
  // Seventh Circle
  'Aspect of the Casual Murderer': [
    { type: 'attack-modifier', target: dmg('Attack'), operation: 'add', value: 5, measure: 'rating',
      duration: 'sustained', source: 'spell', summary: '+5 Attack while active.' },
    { type: 'attack-modifier', target: dmg('Damage'), operation: 'add', value: 5, measure: 'rating',
      duration: 'sustained', source: 'spell', summary: '+5 Damage while active.' },
  ],
  'Spirit Bolt': instAttack(8, '+8 Effect step (Willpower-based mystic damage).'),
  'Desiccate': instAttack(5, '+5 Effect step (Willpower-based mystic damage).'),
  // Eighth Circle
  'Blood Boil': instAttack(5, '+5 Effect step (Willpower-based mystic damage).'),
};
for (const name of order) {
  const sp = spells[name];
  sp.effects = EFFECTS[name] ?? [
    { type: 'note', source: 'spell', gmDiscretion: true, summary: sp.summary },
  ];
}

const out = {
  schema: 'ed-spells/1',
  effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
  source: "Earthdawn 4E Player's Guide + Deeper Secrets — Nethermancer spells. Mechanics + terse original-wording effect lines distilled from the rulebook; no verbatim prose. taxonomy effects[] are hand-enriched per docs/EFFECT-TAXONOMY.md (§3.4 sustained vs instantaneous).",
  notes: [
    `${order.length} Nethermancer spells, Circles 1-15. Mechanics (threads/weaving/casting/range/duration/area/effect) + Success Levels/Extra Threads for all; taxonomy effects[] enriched incrementally (combat/numeric spells first), rituals/summons carry a note effect.`,
    'threadCap: extra-thread cap by Circle band (rules data, not engine logic) — PLAN-SPELLS.md §3.1.',
    'weavingDifficulty.reattune: on-the-fly matrix-swap difficulty, a POST-v1 mechanic carried in the shape now.',
    'castingTarget is a HINT for the cast prompt; the test is always vs a NUMBER entered at cast time.',
  ],
  threadCap: [
    { minCircle: 1, maxCircle: 4, extraThreads: 1 },
    { minCircle: 5, maxCircle: 8, extraThreads: 2 },
    { minCircle: 9, maxCircle: 12, extraThreads: 3 },
    { minCircle: 13, maxCircle: 15, extraThreads: 4 },
  ],
  spells,
};

writeFileSync(resolve(ROOT, 'rules/spells.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote rules/spells.json — ${order.length} Nethermancer spells.`);
const withSucc = order.filter((n) => spells[n].successes.length).length;
const withXt = order.filter((n) => spells[n].extraThreads.length).length;
console.log(`  Success Levels on ${withSucc}, Extra Threads on ${withXt}.`);
