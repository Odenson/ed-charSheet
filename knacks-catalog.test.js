// knacks-catalog.test.js — run with `npm test` (node --test, no deps).
// Catalog-integrity guard (PLAN-ADD-KNACKS §7.1a/§7.6): every knack parent name in
// rules/knacks.json must resolve to a real talent in rules/talents.json. A knack whose
// parent name matches no talent key is permanently unlearnable under the Add-a-knack
// gate (which qualifies a knack by its Discipline-taught parent talent). This fails
// loudly if a future catalog edit reintroduces an orphan shorthand name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const knacksFile = JSON.parse(readFileSync(new URL('./rules/knacks.json', import.meta.url)));
const knacks = knacksFile.knacks;
const talents = JSON.parse(readFileSync(new URL('./rules/talents.json', import.meta.url))).talents;

test('every knack parent name is a real talent key (no orphans)', () => {
  const talentNames = new Set(Object.keys(talents));
  const orphans = [];
  for (const [knack, entry] of Object.entries(knacks)) {
    for (const p of entry.parents ?? []) {
      const name = typeof p === 'string' ? p : p?.name;
      if (name && !talentNames.has(name)) orphans.push(`${knack} → ${name}`);
    }
  }
  assert.deepEqual(
    orphans,
    [],
    `knack parents with no matching talent (unlearnable): ${orphans.join('; ')}`,
  );
});

// --- restrictions migration guard (PLAN-KNACK-RESTRICTIONS §2) -----------------
// Every restriction was migrated from a free-text string to a structured object
// (docs/RESTRICTION-TAXONOMY.md v1). A bare string would silently disable the
// structured discipline gate.

test('every knack restriction is a structured object, never a bare string', () => {
  assert.equal(knacksFile.schema, 'ed-knacks/2');
  assert.equal(knacksFile.restrictionTaxonomy, 'docs/RESTRICTION-TAXONOMY.md (v1)');
  const bad = [];
  for (const [name, entry] of Object.entries(knacks)) {
    const r = entry.restrictions;
    if (r == null) continue;
    if (typeof r !== 'object' || Array.isArray(r)) bad.push(`${name} → not an object`);
    else if (!Object.keys(r).length) continue; // {} = no restriction
    else if (r.note != null) continue; // free-text fallback is fine
    else if (r.attribute || r.race || r.ability) continue; // GM types fine
    else if (typeof r.discipline !== 'string' && !Array.isArray(r.discipline)) bad.push(`${name} → unrecognised restriction keys ${Object.keys(r).join(',')}`);
  }
  assert.deepEqual(bad, [], `restrictions not structured: ${bad.join('; ')}`);
});

test('every discipline-restricted knack names a well-formed discipline', () => {
  // The crafted disciplines file ships only 4 of the 8 magician/adept disciplines
  // (Archer, Nethermancer, Thief, Warrior), but restrictions legitimately reference
  // Elementalist, Wizard, Illusionist, Weaponsmith, Beastmaster, etc. — so this only
  // checks the entries are well-formed (a non-empty name + optional numeric circle),
  // not that they exist in the partial base file.
  const bad = [];
  for (const [name, entry] of Object.entries(knacks)) {
    const disc = entry.restrictions?.discipline;
    if (disc == null) continue;
    const entries = Array.isArray(disc) ? disc : [disc];
    for (const d of entries) {
      const dn = typeof d === 'string' ? d : d?.name;
      if (typeof dn !== 'string' || !dn) bad.push(`${name} → empty discipline name`);
      if (typeof d !== 'string' && d.circle != null && typeof d.circle !== 'number') bad.push(`${name} → non-numeric circle`);
    }
  }
  assert.deepEqual(bad, [], `malformed discipline restrictions: ${bad.join('; ')}`);
});

// T-001 (docs/TAXONOMY-AUDIT.md): the rulebook plurals ("Melee Weapons", ...) once
// leaked into knack parents and were papered over with attribute-only stub talents,
// so the orphan check above passed while a character owning the real singular talent
// could never qualify for those knacks. The stubs are gone; the weapon talents that
// knacks parent on must be the ones disciplines actually teach.
test('weapon-talent knack parents are the singular talents disciplines teach', () => {
  const disciplines = JSON.parse(readFileSync(new URL('./rules/disciplines.json', import.meta.url))).disciplines;
  const taught = new Set();
  const add = (t) => taught.add(typeof t === 'string' ? t : t?.name);
  for (const d of disciplines) {
    for (const c of d.circles ?? []) [c.freeTalents ?? []].flat().concat(c.talents ?? []).forEach(add);
    for (const list of Object.values(d.talentOptions ?? {})) (Array.isArray(list) ? list : []).forEach(add);
  }
  const weaponParents = new Set();
  for (const entry of Object.values(knacks)) {
    for (const p of entry.parents ?? []) {
      const name = typeof p === 'string' ? p : p?.name;
      if (/^(Melee|Missile|Throwing) Weapon/.test(name ?? '')) weaponParents.add(name);
    }
  }
  assert.deepEqual([...weaponParents].sort(), ['Melee Weapon', 'Missile Weapon', 'Throwing Weapon']);
  for (const n of weaponParents) assert.ok(taught.has(n), `${n} is not taught by any discipline`);
});

test('no plural weapon-talent stubs in the talent catalog', () => {
  for (const n of ['Melee Weapons', 'Missile Weapons', 'Throwing Weapons']) {
    assert.ok(!(n in talents), `${n} stub must not exist (use the singular discipline talent)`);
  }
});
