// ui/custom-skill-state.js — pure state behind the create-custom-skill form
// (plans/gen-skill-other I8a). No DOM; validation is delegated to the shared validator.
// Knowledge/Artisan prefill the attribute from the generic template entry in data
// (`templateAttribute`, never hard-coded here) and are always Novice; General has no
// attribute prefill and an owner-chosen Novice/Journeyman tier.

import { validateSkill } from '../engine/validate-skill.js';

/** @returns {{kind:string,name:string,attribute:string,summary:string,tier:number}} */
export function initialForm(kind, { templateAttribute } = {}) {
  const attribute = kind === 'general' ? '' : (templateAttribute ?? '');
  return { kind, name: '', attribute, summary: '', tier: 1 };
}

export function setField(form, field, value) {
  return { ...form, [field]: value };
}

/** The catalog entry the form would save (trimmed; `summary` omitted when blank). */
export function toSkill(form) {
  const name = String(form.name ?? '').trim();
  const summary = String(form.summary ?? '').trim();
  return {
    name,
    category: form.kind,
    tier: form.kind === 'general' && Number(form.tier) === 2 ? 2 : 1,
    strain: 0,
    attribute: form.attribute,
    ...(summary ? { summary } : {}),
    custom: true,
  };
}

/** Human-readable problems with the form (empty array = ready to create). */
export function formErrors(form, opts = {}) {
  const errors = [];
  if (!form.attribute) errors.push('Choose an attribute.');
  const skill = toSkill(form);
  for (const e of validateSkill(skill.name, skill, opts).errors) {
    if (!form.attribute && /attribute/i.test(e)) continue; // already reported above
    errors.push(e);
  }
  return errors;
}
