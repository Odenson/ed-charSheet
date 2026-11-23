// engine/validate-skill.js — pure, DOM-free validator for owner-created custom skills
// (plans/gen-skill-other I1). Shared by the UI form, the worker and the CI fold.
// Rules: Knowledge/Artisan are Novice, Strain 0; General may be Novice or Journeyman with an
// owner-chosen attribute (owner house rule 2026-11-22). Never mutates its input.

import { MAX_TEXT } from './skill-options.js';

export const SKILL_KINDS = ['knowledge', 'artisan', 'general'];
export const MAX_DESCRIPTION = 500;
export const SKILLS_SCHEMA = 'ed-skills/1';

const ALLOWED_KEYS = new Set(['name', 'tier', 'category', 'strain', 'attribute', 'summary', 'custom']);
const lc = (v) => String(v).toLowerCase();

/**
 * @param {string} name - the map key / stored name
 * @param {object} skill - the catalog entry
 * @param {{coreNames?:string[],attributeNames?:string[],customNames?:string[]}} [opts]
 * @returns {{ok:boolean,errors:string[]}}
 */
export function validateSkill(name, skill, { coreNames, attributeNames, customNames } = {}) {
  const errors = [];
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    return { ok: false, errors: ['Skill must be an object.'] };
  }
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) errors.push('Name is required.');
  else {
    if (n.length > MAX_TEXT) errors.push(`Name must be ${MAX_TEXT} characters or fewer.`);
    if (/[()]/.test(n)) errors.push('Name may not contain parentheses.');
    if (Array.isArray(coreNames) && coreNames.some((c) => lc(c) === lc(n))) errors.push('That name is already a core skill.');
    if (Array.isArray(customNames) && customNames.some((c) => lc(c) === lc(n))) errors.push('A custom skill with that name already exists.');
  }
  if (skill.name !== name) errors.push('Name must match the skill entry name.');
  if (!SKILL_KINDS.includes(skill.category)) errors.push('Category must be knowledge, artisan or general.');
  if (Array.isArray(attributeNames) && !attributeNames.includes(skill.attribute)) errors.push('Choose a valid attribute.');
  if (skill.category === 'general') {
    if (skill.tier !== 1 && skill.tier !== 2) errors.push('Tier must be Novice or Journeyman.');
  } else if (skill.tier !== 1) errors.push('Knowledge and Artisan skills are Novice tier.');
  if (skill.strain !== 0) errors.push('Strain must be 0.');
  if (skill.custom !== true) errors.push('Entry must be marked custom.');
  if (skill.summary !== undefined) {
    if (typeof skill.summary !== 'string') errors.push('Description must be text.');
    else if (skill.summary.length > MAX_DESCRIPTION) errors.push(`Description must be ${MAX_DESCRIPTION} characters or fewer.`);
  }
  for (const k of Object.keys(skill)) if (!ALLOWED_KEYS.has(k)) errors.push(`Unknown field: ${k}.`);
  return { ok: errors.length === 0, errors };
}

/** Whole-file check for rules/custom-skills.json / data/custom-skills.json. */
export function validateSkillsFile(file, opts = {}) {
  const errors = [];
  if (!file || typeof file !== 'object') return { ok: false, errors: ['File must be an object.'] };
  if (file.schema !== SKILLS_SCHEMA) errors.push(`Schema must be ${SKILLS_SCHEMA}.`);
  if (!Array.isArray(file.skills)) {
    errors.push('"skills" must be an array.');
    return { ok: false, errors };
  }
  const seen = new Set();
  for (const s of file.skills) {
    const nm = s?.name;
    const key = typeof nm === 'string' ? lc(nm.trim()) : '';
    if (key && seen.has(key)) errors.push(`Duplicate skill name: ${nm}.`);
    if (key) seen.add(key);
    const r = validateSkill(nm, s, opts);
    for (const e of r.errors) errors.push(`${nm ?? '(unnamed)'}: ${e}`);
  }
  return { ok: errors.length === 0, errors };
}
