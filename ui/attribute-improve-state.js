// ui/attribute-improve-state.js — pure, DOM-free view-state for the Overview attribute `+`
// (plans/improve-attributes). Decides, per attribute row, whether an Improve control shows, whether
// it is enabled, whether the row is the one pending improvement (offering undo), and the modal's
// content. All numbers come from engine/attribute-improve.js; nothing is computed here.

import { attributeImprovePlan, pendingAttribute } from '../engine/attribute-improve.js';

/** Human text for an engine refusal reason (notice + disabled-button title). */
export function improveRefusalText(reason, plan) {
  switch (reason) {
    case 'cap': return 'This attribute already has the maximum of +3 increases.';
    case 'insufficient-legend': return plan?.cost != null ? `Not enough Legend (${plan.cost.toLocaleString('en-US')} needed).` : 'Not enough Legend.';
    case 'damaged': return 'Must be rested and healthy: heal all Damage and Wounds first.';
    case 'already-pending': return 'One attribute improvement per save: save first (or undo the pending one).';
    case 'no-baseline': return 'Save the character first before improving attributes.';
    case 'unknown-attribute': return 'Unknown attribute.';
    case 'nothing-to-undo': return 'Nothing to undo.';
    default: return 'Cannot improve this attribute.';
  }
}

/**
 * @returns {{ rows: Record<string, {name, show, canImprove, pending, title, plan}> }}
 */
export function attributeImproveView({ attributes, savedAttributes, available, costTable, editMode, creationOpen, health }) {
  const rows = {};
  const names = Object.keys(attributes ?? {});
  const gated = !editMode || creationOpen || !savedAttributes;
  const pend = gated ? null : pendingAttribute(attributes, savedAttributes);
  for (const name of names) {
    const hidden = { name, show: false, canImprove: false, pending: false, title: '', plan: null };
    if (gated) { rows[name] = hidden; continue; }
    if (pend === name) {
      rows[name] = { name, show: true, canImprove: false, pending: true, title: 'Improved this save (undo until saved)', plan: null };
      continue;
    }
    const plan = attributeImprovePlan(attributes, savedAttributes, name, { costTable, available, health });
    if (plan.ok) rows[name] = { name, show: true, canImprove: true, pending: false, title: `Improve ${name} (${plan.cost.toLocaleString('en-US')} Legend)`, plan };
    else if (plan.reason === 'insufficient-legend' || plan.reason === 'damaged' || plan.reason === 'already-pending') {
      rows[name] = { name, show: true, canImprove: false, pending: false, title: improveRefusalText(plan.reason, plan), plan: null };
    } else rows[name] = hidden;
  }
  return { rows };
}
