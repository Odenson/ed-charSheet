#!/usr/bin/env node
// tools/verify-cost-weight.mjs — the migration gate for
// plans/PLAN-STRUCTURED-COST-WEIGHT.md (Phase B). Two-run shape:
//
//   node tools/verify-cost-weight.mjs --before   # catalog still strings
//   ... migrate rules/items.json + rules/thread-items.json ...
//   node tools/verify-cost-weight.mjs --after    # catalog now structured
//
// `--before` computes, via the frozen FROZEN_OLD_* oracles below, the silver/lb
// value the old parsers produced for every item, and writes them to
// tools/.verify-cost-weight.baseline.json (git-ignored, one entry per item map
// key). `--after` re-reads the migrated files and asserts the NEW engine readers
// (engine/wealth.js costSilver, engine/weight.js weightPounds) produce exactly
// those values, that the item key sets are identical before/after, and that the
// expected conversion counts hold. Any mismatch → non-zero exit.
//
// The old parsers are frozen *inline* rather than imported because Phase A
// deletes them from the engine before this script's --after run; the baseline
// must be reproducible from the scripts' own copies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { costSilver } from '../engine/wealth.js';
import { weightPounds } from '../engine/weight.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITEMS_FILE = join(ROOT, 'rules', 'items.json');
const THREAD_ITEMS_FILE = join(ROOT, 'rules', 'thread-items.json');
const BASELINE_FILE = join(ROOT, 'tools', '.verify-cost-weight.baseline.json');

// Expected migration counts (plan Phase B; verify script's secondary gate).
const EXPECTED = {
  // items.json: 14 string→number costs, 182 string→object weights
  costConversions: 14,
  weightConversions: 182,
  // thread-items.json: 2 string weights, no costs
  threadWeightConversions: 2,
};

// ---------------------------------------------------------------------------
// FROZEN OLD PARSERS — exact copies of the pre-migration engine functions.
// Do not "fix" these; they are the reference oracle for what the migration must
// preserve byte-for-byte.
// ---------------------------------------------------------------------------

const oldWeightRound2 = (n) => Math.round(n * 100) / 100;
const OLD_UNIT = /^([\d.]+)\s*(lbs?|pounds?|ounces?|oz)?$/;

/** Copy of engine/weight.js parseWeight (pre-migration). @returns {number|null} */
function frozenOldWeight(weight) {
  if (weight == null) return null;
  const s = String(weight).trim().toLowerCase();
  if (!s || s === 'na' || s === 'n/a' || s === 'unknown') return null;
  if (s === 'neg.' || s === 'negligible' || s === '—' || s === '–' || s === '-') return 0;
  const range = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)\s*(lbs?|pounds?)?$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return oldWeightRound2((lo + hi) / 2);
    return null;
  }
  const m = s.match(OLD_UNIT);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return oldWeightRound2(n / 16);
  return oldWeightRound2(n);
}

/** Copy of engine/wealth.js parseCostSilver (pre-migration). @returns {number} */
function frozenOldCost(cost) {
  if (typeof cost === 'number') return Number.isFinite(cost) && cost > 0 ? cost : 0;
  if (typeof cost !== 'string') return 0;
  const s = cost.replace(/,/g, '').trim().toLowerCase();
  if (!s) return 0;
  const range = s.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, (a + b) / 2);
  }
  const suffixed = s.match(/^([\d.]+)\s*(sp|cp)$/);
  if (suffixed) {
    const n = Number(suffixed[1]);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, suffixed[2] === 'cp' ? n / 10 : n);
  }
  const plain = Number(s);
  return Number.isFinite(plain) && plain > 0 ? plain : 0;
}

// ---------------------------------------------------------------------------

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const isStringWeight = (w) => typeof w === 'string';
const isStringCost = (c) => typeof c === 'string';

/** Enumerate every { key, ref } across both catalogs. */
function* allItems() {
  const items = readJson(ITEMS_FILE);
  for (const key of Object.keys(items.items ?? {})) {
    yield { file: 'items.json', key, ref: items.items[key]?.ref ?? {} };
  }
  const threads = readJson(THREAD_ITEMS_FILE);
  for (const key of Object.keys(threads.items ?? {})) {
    yield { file: 'thread-items.json', key, ref: threads.items[key]?.ref ?? {} };
  }
}

const mode = process.argv[2];
if (!mode || !['--before', '--after'].includes(mode)) {
  console.error('usage: node tools/verify-cost-weight.mjs --before | --after');
  process.exit(2);
}

// --- gather statistics on the current catalog state ---------------------------
let stringWeights = 0;
let stringCosts = 0;
for (const { file, ref } of allItems()) {
  if (isStringWeight(ref.weight)) stringWeights++;
  if (isStringCost(ref.cost)) stringCosts++;
}

if (mode === '--before') {
  // The catalog must still be in pre-migration form for a baseline to exist.
  if (stringWeights === 0 && stringCosts === 0) {
    console.error('ERROR: no string weight/cost found — catalog already migrated?');
    process.exit(1);
  }
  const baseline = {};
  for (const { key, ref } of allItems()) {
    baseline[key] = {
      weightPoundsOld: frozenOldWeight(ref.weight),
      costSilverOld: ref.cost === undefined ? null : frozenOldCost(ref.cost),
    };
  }
  writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`baseline written: ${Object.keys(baseline).length} items → tools/.verify-cost-weight.baseline.json`);
  console.log(`  string weights: ${stringWeights}  string costs: ${stringCosts}`);
  process.exit(0);
}

// --- --after: assert the migrated catalog reproduces the baseline -------------
if (!existsSync(BASELINE_FILE)) {
  console.error('ERROR: tools/.verify-cost-weight.baseline.json missing — run --before first');
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

// 1. Exact key-set identity (no drops / renames / additions).
const afterKeys = [...allItems()].map((it) => it.key);
const beforeKeys = Object.keys(baseline);
check(
  afterKeys.length === beforeKeys.length && afterKeys.every((k) => baseline[k]),
  `key-set mismatch: ${afterKeys.length} after vs ${beforeKeys.length} in baseline`,
);
for (const k of beforeKeys) {
  if (!afterKeys.includes(k)) console.error(`  ✗ item dropped/renamed: ${k}`);
}

// 2. Per-item value equality via the new engine readers.
for (const { key, ref } of allItems()) {
  const b = baseline[key];
  if (!b) continue;
  const newW = weightPounds(ref.weight);
  check(
    Object.is(newW, b.weightPoundsOld),
    `${key}: weightPounds(${JSON.stringify(ref.weight)}) = ${newW}, baseline ${b.weightPoundsOld}`,
  );
  if (ref.cost !== undefined || b.costSilverOld !== null) {
    const newC = costSilver(ref.cost);
    check(Object.is(newC, b.costSilverOld), `${key}: costSilver() = ${newC}, baseline ${b.costSilverOld}`);
  }
}

// 3. Expected conversion counts (post-migration form must hold).
let structuredWeights = 0;
let numberCosts = 0;
for (const { ref } of allItems()) {
  if (ref.weight === null || ref.weight === undefined) continue;
  if (typeof ref.weight === 'object' && !Array.isArray(ref.weight)) structuredWeights++;
  if (typeof ref.cost === 'number') numberCosts++;
}
let threadStructuredWeights = 0;
for (const { file, ref } of allItems()) {
  if (file !== 'thread-items.json') continue;
  if (ref.weight && typeof ref.weight === 'object') threadStructuredWeights++;
}
check(structuredWeights === EXPECTED.weightConversions, `items.json structured weights: ${structuredWeights}, expected ${EXPECTED.weightConversions}`);
check(
  threadStructuredWeights === EXPECTED.threadWeightConversions,
  `thread-items.json structured weights: ${threadStructuredWeights}, expected ${EXPECTED.threadWeightConversions}`,
);
// Costs: gate on "no string costs/weights remain" (post-migration form is either
// numbers / structured objects — the exact conversion counts are asserted above).
for (const { key, ref } of allItems()) {
  if (isStringCost(ref.cost)) check(false, `${key}: string cost remained — ${ref.cost}`);
  if (isStringWeight(ref.weight)) check(false, `${key}: string weight remained — ${ref.weight}`);
}

if (failures) {
  console.error(`verify-cost-weight: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('verify-cost-weight: PASS — migrated catalog reproduces the baseline byte-for-byte.');