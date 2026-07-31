#!/usr/bin/env node
// Phase 0 importer: Chakka-v7.13.xlsx  ->  data/character.json + rules/*.json
//
// This is a one-off DEV tool. It is not shipped to GitHub Pages.
// It reads the source spreadsheet (the "source of truth") and emits the clean
// JSON the web app consumes. Re-run with:  npm run import
//
// Design notes:
//  - character.json holds INPUTS only (base/points/increases, ranks, resources).
//    Derived values (attribute Value/Step, talent Step) are recomputed by the
//    engine, so we do NOT persist them -- but we DO read them here to VERIFY our
//    understanding of the rules and to flag any house rules (see report at end).
//  - rules/*.json holds shared Earthdawn reference data.

import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const srcPath = resolve(process.argv[2] || resolve(ROOT, 'Chakka-v7.13.xlsx'));
const wb = XLSX.readFile(srcPath);

// ---------- cell helpers ----------
const S = (name) => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  return ws;
};
const raw = (ws, addr) => (ws[addr] ? ws[addr].v : undefined);
const str = (ws, addr) => {
  const v = raw(ws, addr);
  return v === undefined || v === null ? undefined : String(v).trim();
};
const num = (ws, addr) => {
  const v = raw(ws, addr);
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
// iterate every non-empty cell of a sheet as {r, c(0-based), addr, v}
function* cells(ws) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== '') {
        yield { r: r + 1, c, addr, v: cell.v };
      }
    }
  }
}
const COL = (letter) => XLSX.utils.decode_col(letter);
const at = (ws, letter, row) => raw(ws, `${letter}${row}`);

const report = []; // house-rule / gap notes
const note = (msg) => report.push(msg);

// =====================================================================
// character.json  (from Stats + "Disciplines & Skills")
// =====================================================================
function buildCharacter() {
  const st = S('Stats');
  const attrOrder = ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'];

  // Attribute block rows 15..20: B name, C points, D increase, F base, G value, H step
  const attributes = {};
  const attrVerify = {};
  for (let row = 15; row <= 20; row++) {
    const name = str(st, `B${row}`);
    if (!name) continue;
    attributes[name] = {
      base: num(st, `F${row}`),
      points: num(st, `C${row}`) ?? 0,
      increases: num(st, `D${row}`) ?? 0,
    };
    attrVerify[name] = { value: num(st, `G${row}`), step: num(st, `H${row}`) };
  }

  const character = {
    schema: 'ed-character/1',
    meta: {
      name: str(st, 'D3'),
      race: str(st, 'D4'),
      description: str(st, 'D5'),
      age: num(st, 'D8'),
      weight: str(st, 'D9'),
      sex: str(st, 'D10'),
      height: str(st, 'D11'),
      sourceSheetVersion: str(st, 'M20'),
    },
    attributes,
    disciplines: buildDisciplines(),
    skills: buildSkills(),
    knacks: buildKnacks(),
    resources: {
      karma: {
        available: num(st, 'M5'),
        converted: num(st, 'M6'),
        spent: num(st, 'M7'),
        fromRace: num(st, 'M8'),
        legend: num(st, 'M9'),
      },
      legend: {
        totalSpent: num(st, 'D27'),
        totalEarnt: num(st, 'D28'),
        available: num(st, 'D29'),
      },
      health: {
        damage: num(st, 'M12') ?? 0,
        wounds: num(st, 'M14') ?? 0,
        recoveriesUsed: num(st, 'M13') ?? 0,
      },
      roundTracker: num(st, 'M24'),
    },
    extraTraits: buildExtraTraits(),
  };

  return { character, attrVerify };
}

function buildDisciplines() {
  const ds = S('Disciplines & Skills');
  // Three discipline blocks: name col / circle col / talent(tier,circle,name,rank) cols
  const blocks = [
    { name: 'B2', circle: 'D2', tier: 'B', c: 'C', talent: 'D', rank: 'E' },
    { name: 'G2', circle: 'I2', tier: 'G', c: 'H', talent: 'I', rank: 'J' },
    { name: 'L2', circle: 'N2', tier: 'L', c: 'M', talent: 'N', rank: 'O' },
  ];
  const out = [];
  for (const b of blocks) {
    const dName = str(ds, b.name);
    if (!dName) continue;
    const talents = [];
    for (let row = 4; row <= 60; row++) {
      const tName = str(ds, `${b.talent}${row}`);
      if (!tName) continue;
      // These columns list the WHOLE discipline talent tree by circle; a blank
      // rank means the talent is available but not learned. character.json keeps
      // only LEARNED talents (rank present); the full tree lives in
      // rules/disciplineTalents.json.
      const rank = num(ds, `${b.rank}${row}`);
      if (rank === undefined) continue;
      talents.push({
        name: tName,
        rank,
        tier: str(ds, `${b.tier}${row}`),
        circle: num(ds, `${b.c}${row}`),
      });
    }
    out.push({ name: dName, circle: num(ds, b.circle), talents });
  }
  return out;
}

function buildSkills() {
  const ds = S('Disciplines & Skills');
  // Skills block: Q tier, R name, S rank (data rows 4+)
  const out = [];
  for (let row = 4; row <= 60; row++) {
    const name = str(ds, `R${row}`);
    if (!name) continue;
    out.push({ name, rank: num(ds, `S${row}`) ?? 0, tier: str(ds, `Q${row}`) });
  }
  return out;
}

function buildKnacks() {
  const ds = S('Disciplines & Skills');
  // Knacks block: U tier, V knack (data rows 4+)
  const out = [];
  for (let row = 4; row <= 60; row++) {
    const name = str(ds, `V${row}`);
    if (!name) continue;
    out.push({ name, tier: str(ds, `U${row}`) });
  }
  return out;
}

function buildExtraTraits() {
  const st = S('Stats');
  const out = [];
  for (let row = 33; row <= 40; row++) {
    const v = str(st, `B${row}`);
    if (v) out.push(v);
  }
  return out;
}

// =====================================================================
// rules/steps.json  (from EDTables K..S)
// =====================================================================
function buildSteps() {
  const ed = S('EDTables');
  const kCol = COL('K'), lCol = COL('L'), sCol = COL('S');
  const diceCols = { D4: 'M', D6: 'N', D8: 'O', D10: 'P', D12: 'Q', D20: 'R' };
  const steps = [];
  for (let row = 2; row <= 200; row++) {
    const step = num(ed, `K${row}`);
    if (step === undefined) continue;
    const breakdown = {};
    for (const [die, col] of Object.entries(diceCols)) {
      const n = num(ed, `${col}${row}`);
      if (n) breakdown[die] = n;
    }
    steps.push({
      step,
      dice: str(ed, `L${row}`) || null,
      breakdown,
      modifier: num(ed, `S${row}`) ?? 0,
    });
  }
  return steps;
}

// =====================================================================
// rules/attributes.json  (order + point-cost curve)
// =====================================================================
function buildAttributesRules() {
  const ed = S('EDTables');
  const pointCost = [];
  for (let row = 2; row <= 40; row++) {
    const points = num(ed, `AJ${row}`);
    if (points === undefined) continue;
    pointCost.push({ points, cost: num(ed, `AK${row}`) });
  }
  return {
    order: ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'],
    pointCost,
    note: 'value = base + points + increases (+ any racial/other modifiers); attributeStep = valueToStep(value); talentStep = attributeStep + talentRank (+ talent modifiers).',
  };
}

// =====================================================================
// rules/races.json / rules/skills.json  (catalogs)
// =====================================================================
function buildRaces() {
  const ed = S('EDTables');
  const races = [];
  for (let row = 2; row <= 40; row++) {
    const r = str(ed, `AY${row}`);
    if (r) races.push(r);
  }
  return races;
}

function buildSkillCatalog() {
  const ed = S('EDTables');
  const out = [];
  for (let row = 2; row <= 400; row++) {
    const name = str(ed, `AG${row}`);
    if (!name) continue;
    out.push({ name, tier: num(ed, `AH${row}`) });
  }
  return out;
}

// =====================================================================
// rules/disciplineTalents.json  (discipline -> circle -> available talents)
// =====================================================================
function buildDisciplineTalents() {
  const ed = S('EDTables');
  const byDiscipline = {};
  for (let row = 2; row <= 4000; row++) {
    const disc = str(ed, `Z${row}`);
    if (!disc) continue;
    const talent = str(ed, `AB${row}`);
    if (!talent) continue;
    (byDiscipline[disc] ||= []).push({
      circle: num(ed, `AA${row}`),
      talent,
      optional: (num(ed, `AC${row}`) ?? 0) === 1,
      tier: num(ed, `AD${row}`),
    });
  }
  return byDiscipline;
}

// =====================================================================
// Talent -> attribute backfill from the local rulebook extract.
// Reference file is gitignored (copyrighted); we read ONLY the mechanical
// "Step: Rank + <ATTR>" line, never the prose. Degrades gracefully if absent.
// =====================================================================
const ATTR_CODE = {
  DEX: 'Dexterity', STR: 'Strength', TOU: 'Toughness',
  PER: 'Perception', WIL: 'Willpower', CHA: 'Charisma',
};
function parseTalentAttributes() {
  const refPath = resolve(ROOT, 'rulebook extracts/text-talents-players.txt');
  if (!existsSync(refPath)) return { map: {}, found: false, count: 0 };
  const map = {};
  let current = null;
  for (const line of readFileSync(refPath, 'utf8').split(/\r?\n/)) {
    const t = /^Talents - (.+?)\s*$/.exec(line);
    if (t) { current = t[1].trim(); continue; }
    if (current && /^Step:/i.test(line)) {
      const a = /Rank\s*\+\s*(DEX|STR|TOU|PER|WIL|CHA)/i.exec(line);
      if (a) map[current] = ATTR_CODE[a[1].toUpperCase()];
      current = null;
    }
  }
  return { map, found: true, count: Object.keys(map).length };
}
// strip a discipline suffix, e.g. "Thread Weaving (Archer)" -> "Thread Weaving"
const baseTalentName = (n) => n.replace(/\s*\(.*\)\s*$/, '').trim();

// =====================================================================
// rules/talents.json  (catalog from EDTables Ability props + attribute links)
// =====================================================================
function buildTalentCatalog() {
  const ed = S('EDTables');
  const props = S('Properties');

  // Two outputs, kept separate for COPYRIGHT reasons:
  //  - mechanics: name, attribute, action  -> safe to commit (game mechanics)
  //  - prose:     summary, description      -> verbatim copyrighted FASA text;
  //               written to a gitignored file, never published.
  const mechanics = {};
  const prose = {};

  // EDTables reference props: E=Target, F=Characteristic, G=Property, H=Value
  for (const { r, c } of cells(ed)) {
    if (c !== COL('E')) continue; // walk the Target column
    const target = String(at(ed, 'E', r) ?? '').trim();
    if (target !== 'Ability') continue;
    const name = String(at(ed, 'F', r) ?? '').trim();
    const prop = String(at(ed, 'G', r) ?? '').trim();
    const val = at(ed, 'H', r);
    if (!name || !prop) continue;
    const m = (mechanics[name] ||= { name });
    if (prop === 'Action') m.action = String(val).trim();
    else if (prop === 'Summary') (prose[name] ||= { name }).summary = String(val).trim();
    else if (prop === 'Description') (prose[name] ||= { name }).description = String(val).trim();
  }

  // Attribute links live only in the computed Properties sheet (per-character).
  // Pull what exists so the engine can derive dice for Chakka's talents.
  let linked = 0;
  for (const { r, c } of cells(props)) {
    if (c !== COL('B')) continue; // Target column on Properties
    if (String(at(props, 'B', r) ?? '').trim() !== 'Ability') continue;
    if (String(at(props, 'D', r) ?? '').trim() !== 'Attribute') continue;
    const name = String(at(props, 'C', r) ?? '').trim();
    const attr = String(at(props, 'E', r) ?? '').trim();
    if (!name || !attr) continue;
    const m = (mechanics[name] ||= { name });
    if (!m.attribute) {
      m.attribute = attr;
      linked++;
    }
  }

  // Backfill attributes from the rulebook extract (authoritative core rules).
  const ref = parseTalentAttributes();
  let refLinked = 0;
  const conflicts = [];
  if (ref.found) {
    // Add any core talents not present in the workbook catalog.
    for (const name of Object.keys(ref.map)) {
      if (!mechanics[name]) mechanics[name] = { name };
    }
    for (const m of Object.values(mechanics)) {
      const a = ref.map[m.name] ?? ref.map[baseTalentName(m.name)];
      if (!a) continue;
      if (m.attribute && m.attribute !== a) {
        conflicts.push(`${m.name}: Properties=${m.attribute} vs rulebook=${a}`);
      }
      m.attribute = a; // rulebook wins
      refLinked++;
    }
  }

  const total = Object.keys(mechanics).length;
  const missing = Object.values(mechanics).filter((t) => !t.attribute).length;
  note(
    `talents.json: ${total} talents catalogued (mechanics only); ${total - missing} now have an ` +
      `attribute link. Sources: ${linked} from the computed Properties sheet, ${refLinked} matched ` +
      `to the rulebook extract` +
      (ref.found ? ` (${ref.count} talents parsed)` : ` (rulebook extract NOT found -- using ` +
        `Properties only)`) +
      `. ${missing} still have no attribute link.`
  );
  if (conflicts.length) {
    note(`talent attribute conflicts (rulebook preferred): ${conflicts.join('; ')}`);
  }
  note(
    `talent descriptions/summaries written to rules/talents.descriptions.json (gitignored) -- ` +
      `verbatim copyrighted rulebook text kept out of the public repo.`
  );
  return { mechanics, prose };
}

// =====================================================================
// Verification / house-rule flagging
// =====================================================================
function verify(character, attrVerify, steps, talentCatalog) {
  // Build value->step from the step table for cross-checking.
  const valueToStep = (value) => {
    // Earthdawn: Step = ceil(value/3) + 1 for value>=1 ... but the sheet has an
    // explicit curve. We trust the sheet's derived Step and just re-derive from
    // its own attribute value->step pairs to detect anomalies.
    return null; // handled below by direct comparison
  };

  // 1) Attribute Value == base + points + increases. Flag any residual delta
  //    (that would indicate a racial/other modifier not captured in inputs).
  for (const [name, a] of Object.entries(character.attributes)) {
    const derivedValue = (a.base ?? 0) + (a.points ?? 0) + (a.increases ?? 0);
    const sheetValue = attrVerify[name]?.value;
    if (sheetValue !== undefined && sheetValue !== derivedValue) {
      note(
        `attribute "${name}": sheet Value=${sheetValue} but base(${a.base})+points(${a.points})+increases(${a.increases})=${derivedValue}. ` +
          `Delta ${sheetValue - derivedValue} => modifier not captured in inputs (racial/other).`
      );
    }
  }

  // 2) talentStep == attributeStep + rank ? Use sheet attribute steps + talent ranks.
  const attrStep = {};
  for (const [name, v] of Object.entries(attrVerify)) attrStep[name] = v.step;
  const props = S('Properties');
  // gather Chakka ability Step + Rank + Type from Properties
  const tStep = {}, tRank = {}, tType = {};
  for (const { r, c } of cells(props)) {
    if (c !== COL('B')) continue;
    if (String(at(props, 'B', r) ?? '').trim() !== 'Ability') continue;
    const name = String(at(props, 'C', r) ?? '').trim();
    const prop = String(at(props, 'D', r) ?? '').trim();
    const val = at(props, 'E', r);
    if (prop === 'Step') tStep[name] = Number(val);
    else if (prop === 'Rank') tRank[name] = Number(val);
    else if (prop === 'Type') tType[name] = String(val).trim();
  }
  let checked = 0, anomalies = 0, knacks = 0;
  for (const name of Object.keys(tStep)) {
    // Knacks derive their step from a parent ability, not attribute+rank -- a
    // separate mechanic. Don't check them against the talent rule.
    if (tType[name] === 'Knack') { knacks++; continue; }
    const attr = talentCatalog[name]?.attribute;
    if (!attr || attrStep[attr] === undefined || tRank[name] === undefined) continue;
    checked++;
    const expected = attrStep[attr] + tRank[name];
    if (tStep[name] !== expected) {
      anomalies++;
      note(
        `talent "${name}": sheet Step=${tStep[name]} but ${attr}Step(${attrStep[attr]})+rank(${tRank[name]})=${expected}. ` +
          `Delta ${tStep[name] - expected} => talent modifier / house rule to confirm.`
      );
    }
  }
  note(
    `talent-step rule (attributeStep + rank) verified on ${checked} of Chakka's talents with ` +
      `${anomalies} anomalies. ${knacks} knacks skipped (knacks derive their step from a parent ` +
      `ability -- a separate mechanic the engine must model).`
  );
}

// =====================================================================
// write everything
// =====================================================================
function writeJSON(relPath, obj) {
  const full = resolve(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(obj, null, 2) + '\n');
  console.log('  wrote', relPath);
}

console.log('Reading', srcPath);
const { character, attrVerify } = buildCharacter();
const steps = buildSteps();
const { mechanics: talentCatalog, prose: talentProse } = buildTalentCatalog();

console.log('Writing outputs...');
// character.json is user-owned (hand-editable, and fully so from Phase 2). Don't
// clobber existing edits on re-import unless --force is given. rules/*.json are
// derived reference data and always regenerate.
const FORCE = process.argv.includes('--force');
if (existsSync(resolve(ROOT, 'data/character.json')) && !FORCE) {
  console.log('  SKIP data/character.json (exists; user-owned — pass --force to overwrite)');
} else {
  writeJSON('data/character.json', character);
}
writeJSON('rules/steps.json', steps);
writeJSON('rules/attributes.json', buildAttributesRules());
writeJSON('rules/races.json', buildRaces());
writeJSON('rules/skills.json', buildSkillCatalog());
writeJSON('rules/disciplineTalents.json', buildDisciplineTalents());
writeJSON('rules/talents.json', talentCatalog); // mechanics only (committed)
writeJSON('rules/talents.descriptions.json', talentProse); // prose (gitignored)

verify(character, attrVerify, steps, talentCatalog);

console.log('\n=== IMPORT REPORT (house rules / gaps to confirm) ===');
report.forEach((m, i) => console.log(`${i + 1}. ${m}\n`));

// Persist the report next to the data for the record.
writeJSON(
  'data/IMPORT-NOTES.json',
  { generatedAt: new Date().toISOString(), source: srcPath.split('/').pop(), notes: report }
);
console.log('Done.');
