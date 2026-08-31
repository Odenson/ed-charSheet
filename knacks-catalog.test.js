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
