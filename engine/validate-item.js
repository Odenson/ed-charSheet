// engine/validate-item.js — pure, DOM-free validation for the ed-items/2 custom
// item catalog (docs/PLAN-CUSTOM-ITEMS.md). The single gate that anything landing
// in rules/custom-items.json must pass, used in three runtimes: the UI (blocks
// Save with inline errors), the serverless worker (POST /save-items, fail-closed),
// and the fold job (before pushing to dev). Zero dependencies.
//
// It validates against the EFFECT-TAXONOMY v3 grammar — not the full vocabulary,
// but the item-appropriate subset the custom creator can emit (v1 scope). It is
// intentionally strict: the worker endpoint is publicly reachable (SAVE_KEY), so
// this is the filter between the open endpoint and the deployed rules.
//
// The engine derives game values; this module only *checks shape* — it never
// computes anything, and it never mutates the input.

/** The eight standard item kinds the custom creator supports (v1; thread items excluded). */
export const ITEM_KINDS = [
  'weapon',
  'armor',
  'shield',
  'ammunition',
  'gear',
  'magic-item',
  'blood-charm',
  'healing-aid',
];

/** Effect `type`s the custom creator can emit (taxonomy §2 subset for items). */
export const EFFECT_TYPES = [
  'attribute-modifier',
  'armor-modifier',
  'defense-modifier',
  'attack-modifier',
  'test-modifier',
  'characteristic-modifier',
  'note',
];

const OPERATIONS = new Set(['add', 'subtract', 'set']);
const MEASURES = new Set(['value', 'step', 'result', 'rating', 'rank', 'dice', 'points', 'yards', 'count']);
const CONDITIONS = new Set(['always', 'situational', 'on-success']);
const STACKING = new Set(['cumulative', 'highest', 'replace', 'unique']);
const DURATIONS = new Set(['permanent', 'sustained', 'rounds', 'test', 'encounter', 'special']);

const ATTRIBUTE_NAMES = new Set(['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma']);
const CHARACTERISTIC_NAMES = new Set([
  'WoundThreshold',
  'DeathRating',
  'UnconsciousnessRating',
  'RecoveryTests',
  'Initiative',
  'Movement',
  'CarryingCapacity',
]);

// Per-type target contract (taxonomy §3). `names: null` = open (a named ability,
// a natural-attack appendage) — structural check only.
const TARGET_RULES = {
  'attribute-modifier': { domain: 'attribute', names: ATTRIBUTE_NAMES },
  'armor-modifier': { domain: 'armor', names: new Set(['Physical', 'Mystic']) },
  'defense-modifier': { domain: 'defense', names: new Set(['Physical', 'Mystic', 'Social']) },
  'characteristic-modifier': { domain: 'characteristic', names: CHARACTERISTIC_NAMES },
  'attack-modifier': { domain: 'attack', names: null },
  'test-modifier': { domain: 'test', names: null },
};

/** Per-item size cap (bytes, UTF-8). */
export const MAX_ITEM_BYTES = 4096;
/** Per-file item-count cap for the custom-items catalog. */
export const MAX_ITEMS = 200;
/** Total size cap for the whole custom-items file (mirrors the character store). */
export const MAX_FILE_BYTES = 512 * 1024;

const byteLen = (s) => new TextEncoder().encode(s).length;

const isPlainObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNonEmptyString = (x) => typeof x === 'string' && x.length > 0;

// A catalog key may be any human item name, but never a path separator, control
// character, or leading/trailing whitespace — it is a map key, never a path.
const BAD_NAME_CHARS = /[/\\\u0000-\u001f\u007f]/;
const badName = (name) =>
  !isNonEmptyString(name) ||
  name.length > 64 ||
  name !== name.trim() ||
  BAD_NAME_CHARS.test(name);

function validateEffect(name, e, index, errors) {
  const at = `effects[${index}]`;
  if (!isPlainObject(e)) return push(errors, `${at}: effect must be an object`);
  if (!EFFECT_TYPES.includes(e.type)) return push(errors, `${at}: unknown type "${e.type}"`);

  if (e.type === 'note') {
    if (!isNonEmptyString(e.summary)) push(errors, `${at}: note requires a summary`);
    return checkOptionalEffectFields(e, at, errors);
  }

  if (!OPERATIONS.has(e.operation)) push(errors, `${at}: operation must be add | subtract | set`);
  const hasValue = typeof e.value === 'number' || (isPlainObject(e.value) && isNonEmptyString(e.value.ref));
  if (!hasValue) push(errors, `${at}: modifier requires a numeric value (or { ref })`);
  if (e.measure !== undefined && !MEASURES.has(e.measure)) push(errors, `${at}: invalid measure "${e.measure}"`);

  const rule = TARGET_RULES[e.type];
  if (rule) {
    const t = e.target;
    if (!isPlainObject(t)) {
      push(errors, `${at}: ${e.type} requires a target`);
    } else {
      if (t.domain !== rule.domain) push(errors, `${at}: target domain must be "${rule.domain}"`);
      if (!isNonEmptyString(t.name)) push(errors, `${at}: target name required`);
      else if (rule.names && !rule.names.has(t.name))
        push(errors, `${at}: target name "${t.name}" is not valid for ${rule.domain} (${[...rule.names].join(', ')})`);
      if (t.property !== undefined && typeof t.property !== 'string')
        push(errors, `${at}: target property must be a string`);
    }
  }

  if (!isNonEmptyString(e.summary)) push(errors, `${at}: summary required`);
  checkOptionalEffectFields(e, at, errors);
}

function checkOptionalEffectFields(e, at, errors) {
  if (e.condition !== undefined && typeof e.condition === 'string' && !CONDITIONS.has(e.condition))
    push(errors, `${at}: invalid condition "${e.condition}"`);
  if (e.scope !== undefined && typeof e.scope !== 'string') push(errors, `${at}: scope must be a string`);
  if (e.gmDiscretion !== undefined && typeof e.gmDiscretion !== 'boolean')
    push(errors, `${at}: gmDiscretion must be a boolean`);
  if (e.perSuccess !== undefined && typeof e.perSuccess !== 'boolean')
    push(errors, `${at}: perSuccess must be a boolean`);
  if (e.stacking !== undefined && !STACKING.has(e.stacking)) push(errors, `${at}: invalid stacking "${e.stacking}"`);
  if (e.duration !== undefined && !DURATIONS.has(e.duration)) push(errors, `${at}: invalid duration "${e.duration}"`);
}

const push = (errors, message) => errors.push(message);

/**
 * Validate one item against the ed-items/2 shape + taxonomy.
 *
 * @param {string} name   the item's catalog key
 * @param {object} item   the item: `{ kind, living?, ref?, effects?, presentation? }`
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateItem(name, item) {
  const errors = [];
  if (badName(name)) push(errors, `name: must be 1–64 chars, no "/", no control chars, no leading/trailing space`);
  if (!isPlainObject(item)) return { ok: false, errors: errors.length ? errors : ['item: must be an object'] };
  if (!ITEM_KINDS.includes(item.kind)) push(errors, `kind: must be one of ${ITEM_KINDS.join(', ')}`);

  if (item.living !== undefined && typeof item.living !== 'boolean') push(errors, `living: must be a boolean`);
  if (item.ref !== undefined) {
    if (!isPlainObject(item.ref)) push(errors, `ref: must be an object`);
    else {
      if (item.ref.cost !== undefined && !(typeof item.ref.cost === 'number' && item.ref.cost >= 0))
        push(errors, `ref.cost: must be a non-negative number (sp)`);
      for (const k of ['weight', 'availability', 'description', 'category', 'range', 'shortRange', 'longRange']) {
        if (item.ref[k] !== undefined && typeof item.ref[k] !== 'string')
          push(errors, `ref.${k}: must be a string`);
      }
    }
  }
  if (item.presentation !== undefined && (!isPlainObject(item.presentation) || (item.presentation.shortEffect !== undefined && typeof item.presentation.shortEffect !== 'string')))
    push(errors, `presentation: must be an object with an optional string shortEffect`);

  if (!Array.isArray(item.effects)) {
    push(errors, `effects: must be an array`);
    return { ok: errors.length === 0, errors };
  }
  item.effects.forEach((e, i) => validateEffect(name, e, i, errors));

  const size = byteLen(JSON.stringify(item));
  if (size > MAX_ITEM_BYTES) push(errors, `item too large (${size} bytes > ${MAX_ITEM_BYTES})`);

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a whole custom-items file (ed-items/2) — the shape the worker writes
 * to `character-data` and the fold job mirrors into `rules/custom-items.json`.
 *
 * @param {object} file `{ schema, effectTaxonomy?, source?, notes?, items }`
 * @param {object} [opts] `{ maxItems, maxTotalBytes }`
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateItemsFile(file, { maxItems = MAX_ITEMS, maxTotalBytes = MAX_FILE_BYTES } = {}) {
  const errors = [];
  if (!isPlainObject(file)) return { ok: false, errors: ['file: must be an object'] };
  if (file.schema !== 'ed-items/2') push(errors, `schema: must be "ed-items/2"`);
  if (!isPlainObject(file.items)) return { ok: false, errors: [...errors, 'items: must be an object'] };

  const entries = Object.entries(file.items);
  if (entries.length > maxItems) push(errors, `items: too many (${entries.length} > ${maxItems})`);
  for (const [name, item] of entries) {
    const r = validateItem(name, item);
    for (const e of r.errors) push(errors, `items["${name}"]: ${e}`);
  }

  const total = byteLen(JSON.stringify(file));
  if (total > maxTotalBytes) push(errors, `file too large (${total} bytes > ${maxTotalBytes})`);

  return { ok: errors.length === 0, errors };
}
