// ui/ed-custom-item.js — the custom-item manager modal (docs/PLAN-CUSTOM-ITEMS.md
// §5.2 / §6). Opened from the Equipment tab's "＋ Custom items" affordance in edit
// mode; owns the kind-driven item form (ref fields + effect quick-templates) and
// the working-set list with staged deletes.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or computes
// game values. It renders `catalog` (the player-created items from the model) and
// dispatches up — every working-set change dispatches `ed-edit-custom-items`
// { items, delete, action:'draft' } so ed-app writes the `ed-custom-items`
// overlay instantly (resilient: a draft survives reload / an offline worker); the
// footer Save dispatches the same event with action:'save' and ed-app POSTs to
// the worker, reconciles the overlay, re-reads the catalog and toasts. This modal
// closes with `close` (Escape / backdrop / Cancel / after Save).
//
// Validation is the shared engine/validate-item.js gate (layer 1 of 3): Save-item
// and Save-to-GitHub are disabled while any row fails it, with inline messages.
// Enter confirms (primary buttons are autofocused); Escape closes the form first,
// then the modal; theme-aware via light-dark().

import { LitElement, html, css, nothing } from 'lit';
import { validateItem } from '../engine/validate-item.js';
import { applyCustomEdits } from '../store-custom-items.js';

const KLABEL = {
  weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ammunition: 'Ammunition',
  gear: 'Gear', 'magic-item': 'Magic item', 'blood-charm': 'Blood charm', 'healing-aid': 'Healing aid',
};
const KIND_ORDER = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'magic-item', 'blood-charm', 'healing-aid'];

// §6.2 — kind-driven reference fields (cost/description are common to all kinds).
const REF_FIELDS = {
  weapon: [
    { k: 'category', label: 'Category', type: 'select', options: ['melee', 'missile', 'throwing'] },
    { k: 'strMin', label: 'STR min', type: 'number' },
    { k: 'size', label: 'Size', type: 'number' },
    { k: 'damageStep', label: 'Damage Step', type: 'number' },
    { k: 'shortRange', label: 'Short range', type: 'text' },
    { k: 'longRange', label: 'Long range', type: 'text' },
    { k: 'weight', label: 'Weight', type: 'text' },
    { k: 'availability', label: 'Availability', type: 'text' },
  ],
  armor: [{ k: 'living', label: 'Living armour', type: 'checkbox' }, { k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }],
  shield: [{ k: 'living', label: 'Living shield', type: 'checkbox' }, { k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }],
  ammunition: [{ k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }, { k: 'quantity', label: 'Quantity', type: 'number' }],
  gear: [{ k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }],
  'magic-item': [{ k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }, { k: 'range', label: 'Range', type: 'text' }],
  'blood-charm': [{ k: 'craftingDifficultyNumber', label: 'Crafting DN', type: 'number' }, { k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }],
  'healing-aid': [{ k: 'weight', label: 'Weight', type: 'text' }, { k: 'availability', label: 'Availability', type: 'text' }],
};

// §6.4 — type → target/measure constraints (mirrors engine/validate-item.js).
// `open` names allow a free-text target name (a named ability / natural appendage).
const TYPE_META = {
  'armor-modifier': { domain: 'armor', names: ['Physical', 'Mystic'], measure: 'rating', label: 'Armour' },
  'defense-modifier': { domain: 'defense', names: ['Physical', 'Mystic', 'Social'], measure: 'rating', label: 'Defence' },
  'attack-modifier': { domain: 'attack', names: ['Damage'], measure: 'step', label: 'Damage', open: true },
  'test-modifier': { domain: 'test', names: ['Action', 'Attack', 'Damage', 'Effect', 'Initiative', 'Recovery'], measure: 'result', label: 'Test', open: true },
  'characteristic-modifier': { domain: 'characteristic', names: ['WoundThreshold', 'DeathRating', 'UnconsciousnessRating', 'RecoveryTests', 'Initiative', 'Movement', 'CarryingCapacity'], measure: 'rating', label: '' },
  'attribute-modifier': { domain: 'attribute', names: ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'], measure: 'value', label: '' },
};
const TYPE_ORDER = Object.keys(TYPE_META);
const OPERATIONS = ['add', 'subtract', 'set'];
const MEASURES = ['rating', 'step', 'result', 'value', 'points', 'rank'];
const CONDITIONS = ['always', 'situational'];

// §6.2 — per-kind effect quick-templates. Each builds a raw effect; the builder
// sets source/condition/summary.
const QUICK_TEMPLATES = {
  weapon: [{ label: '＋ Damage Step', build: () => ({ type: 'attack-modifier', operation: 'add', value: 1, measure: 'step', target: { domain: 'attack', name: 'Damage' }, condition: 'always' }) }],
  armor: [
    { label: '＋ Physical Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' }, condition: 'always' }) },
    { label: '＋ Mystic Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Mystic' }, condition: 'always' }) },
    { label: '− Initiative', build: () => ({ type: 'characteristic-modifier', operation: 'subtract', value: 1, measure: 'step', target: { domain: 'characteristic', name: 'Initiative' }, condition: 'always' }) },
  ],
  shield: [{ label: '＋ Physical Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' }, condition: 'always' }) }],
  ammunition: [],
  gear: [],
  'magic-item': [],
  'blood-charm': [{ label: '− Unconsciousness', build: () => ({ type: 'characteristic-modifier', operation: 'subtract', value: 1, measure: 'rating', target: { domain: 'characteristic', name: 'UnconsciousnessRating' }, condition: 'situational' }) }],
  'healing-aid': [{ label: '＋ Recovery Result', build: () => ({ type: 'test-modifier', operation: 'add', value: 1, measure: 'result', target: { domain: 'test', name: 'Recovery' }, condition: 'always' }) }],
};

// Presentation-only formatters (no game values computed here).
const prettyName = (n) => (n ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const absVal = (v) => Math.abs(Number(v) || 0);
const effectLabel = (e) => {
  const meta = TYPE_META[e.type];
  const name = prettyName(e.target?.name ?? '');
  const suffix = meta?.label ?? '';
  return `${name}${suffix ? ` ${suffix}` : ''}`.trim();
};
const summaryFor = (e) => {
  if (e.type === 'note') return e.summary ?? '';
  const m = e.measure && e.measure !== 'rating' ? ` ${e.measure}` : '';
  if (e.operation === 'subtract') return `Reduces ${effectLabel(e)} by ${absVal(e.value)}${m}`;
  if (e.operation === 'set') return `Sets ${effectLabel(e)} to ${Number(e.value) || 0}${m}`;
  return `Adds +${absVal(e.value)} ${effectLabel(e)}${m}`;
};
const finishEffect = (e, summary) => ({
  ...e,
  source: 'item',
  condition: e.condition ?? 'always',
  summary: summary ?? summaryFor(e),
});

// Build the editable item object the form works on.
const blankItem = (kind) => ({ kind, effects: [] });
const blankEffect = (type = 'armor-modifier') => {
  const meta = TYPE_META[type];
  return {
    type,
    operation: 'add',
    value: 1,
    measure: meta.measure,
    target: meta ? { domain: meta.domain, name: meta.names[0] } : undefined,
    condition: 'always',
    summary: '',
  };
};

export class EdCustomItem extends LitElement {
  static properties = {
    committed: { attribute: false }, // branch-truth custom catalog { name: item } — the delta baseline
    overlay: { attribute: false },   // pending ed-custom-items delta { items?, delete? } or null
    canonKeys: { attribute: false }, // canon item names (collision warning)
    _form: { state: true },          // item form open: { name, item, originalName }
    _confirmClose: { state: true },  // staged-changes close confirmation
  };

  constructor() {
    super();
    this._form = null;
    this._confirmClose = false;
    // Working set derived once on open: the *committed* catalog plus any pending
    // overlay delta (so a pending item still shows, and a reopen after a reload
    // still knows what is uncommitted). Edits mutate this map; the delta vs
    // `committed` is recomputed on every change and dispatched up as the overlay
    // draft — never the overlay-applied set, so re-deriving the model on each
    // draft can't wipe the pending count.
    this._working = new Map();
    this._summaryOverride = new Set(); // effects whose summary the user typed
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (this._form) this._form = null;
      else if (this._confirmClose) this._confirmClose = false;
      else this._requestClose();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
    this._seed();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  firstUpdated() {
    // Focus the primary action so Enter confirms (Tier-1 modal rule).
    this.renderRoot.querySelector('.m-primary')?.focus();
  }

  // Open (or reopen) with the committed catalog + any pending overlay delta as
  // the working set. Runs once per mount — prop updates while open never reseed.
  _seed() {
    this._working = new Map(Object.entries(applyCustomEdits(this.committed, this.overlay)?.items ?? {}));
    this._summaryOverride = new Set();
    this._form = null;
    this._confirmClose = false;
  }

  // True when any working-set item differs from the loaded catalog.
  _hasChanges() {
    const { items, delete: dels } = this._delta();
    return Object.keys(items).length > 0 || dels.length > 0;
  }

  // Diff the working set against the *committed* catalog: { items (create/edit),
  // delete }. Matching the overlay semantics, so a reload-then-reopen or a draft
  // re-derive all agree on what still needs saving.
  _delta() {
    const items = {};
    for (const [name, item] of this._working) {
      const orig = this.committed?.[name];
      if (!orig || JSON.stringify(orig) !== JSON.stringify(item)) items[name] = item;
    }
    const del = Object.keys(this.committed ?? {}).filter((name) => !this._working.has(name));
    return { items, delete: del };
  }

  _dispatch(action) {
    const { items, delete: deleteNames } = this._delta();
    this.dispatchEvent(
      new CustomEvent('ed-edit-custom-items', {
        detail: { items, delete: deleteNames, action },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _onWorkingChange() {
    this._dispatch('draft'); // ed-app writes the overlay instantly
  }

  _requestClose() {
    if (this._hasChanges()) this._confirmClose = true;
    else this._close();
  }
  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  _saveAll() {
    this._dispatch('save'); // ed-app POSTs, reconciles, re-reads, toasts
    this._close();
  }

  // --- working-set mutations ---
  _remove(name) {
    this._working.delete(name);
    this._working = new Map(this._working);
    this._onWorkingChange();
  }
  _editItem(name) {
    const item = this.committed?.[name] ?? this._working.get(name);
    if (!item) return;
    this._form = { name, item: JSON.parse(JSON.stringify(item)), originalName: name };
    this._summaryOverride = new Set();
  }
  _newItem() {
    this._form = { name: '', item: blankItem('gear'), originalName: null };
    this._summaryOverride = new Set();
  }

  // Commit the item form into the working set (upsert semantics: a name that
  // matches an existing custom item edits it in place).
  _commitForm() {
    const { name, item, originalName } = this._form;
    const clean = this._cleanForm();
    if (!clean || !clean.ok) return;
    const finalName = clean.name;
    if (originalName && originalName !== finalName) this._working.delete(originalName);
    this._working.set(finalName, clean.item);
    this._working = new Map(this._working);
    this._form = null;
    this._onWorkingChange();
  }

  // --- the item form ---
  _cleanForm() {
    const { name, item } = this._form;
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;
    const effects = (item.effects ?? [])
      .map((e) => {
        const { _openTarget, ...rest } = e;
        return rest;
      })
      .filter((e) => e.summary && e.summary.trim());
    const clean = { kind: item.kind, effects };
    const ref = {};
    for (const [k, v] of Object.entries(item.ref ?? {})) {
      if (k === 'cost') {
        if (typeof v === 'number' && v >= 0) ref.cost = v;
      } else if (v !== undefined && v !== '' && v !== false && v !== 0) {
        ref[k] = v;
      }
    }
    if (Object.keys(ref).length) clean.ref = ref;
    const checked = validateItem(trimmed, clean);
    return checked.ok ? { ok: true, name: trimmed, item: clean } : { ok: false, errors: checked.errors };
  }
  _formErrors() {
    const { name } = this._form;
    if (!(name ?? '').trim()) return ['Name is required.'];
    const clean = this._cleanForm();
    return clean ? clean.errors ?? [] : [];
  }

  _setForm(patch) {
    this._form = { ...this._form, ...patch };
  }
  _setFormItem(patch) {
    this._form = { ...this._form, item: { ...this._form.item, ...patch } };
  }
  _setRef(k, value) {
    this._form = {
      ...this._form,
      item: { ...this._form.item, ref: { ...(this._form.item.ref ?? {}), [k]: value } },
    };
  }
  _setEffect(i, patch) {
    const effects = (this._form.item.effects ?? []).map((e, j) => (j === i ? { ...e, ...patch } : e));
    // A type change resets target/measure to that type's defaults.
    if (patch.type && patch.type !== this._form.item.effects[i]?.type) {
      effects[i] = { ...effects[i], ...blankEffect(patch.type), value: effects[i].value };
    }
    this._setFormItem({ effects });
  }
  _setEffectSummary(i, summary) {
    this._summaryOverride.add((this._form.item.effects ?? [])[i]);
    this._setEffect(i, { summary });
  }
  _addEffect(template) {
    const e = finishEffect(template.build(), null);
    const effects = [...(this._form.item.effects ?? []), e];
    this._setFormItem({ effects });
  }
  _addBlankEffect() {
    this._addEffect({ build: () => blankEffect('armor-modifier') });
  }
  _removeEffect(i) {
    this._setFormItem({ effects: (this._form.item.effects ?? []).filter((_, j) => j !== i) });
  }
  _setTargetName(i, name) {
    const e = this._form.item.effects[i];
    const meta = TYPE_META[e.type];
    const isOther = name === '__other__';
    const target = { ...(e.target ?? {}), domain: meta.domain, name: isOther ? (e.target?.name ?? '') : name };
    if (isOther) {
      this._setEffect(i, { target, _openTarget: true });
    } else {
      this._setEffect(i, { target, _openTarget: false });
    }
  }

  _effectTargetInput(e, i) {
    const meta = TYPE_META[e.type];
    const preset = (meta?.names ?? []).includes(e.target?.name) ? e.target.name : '__other__';
    const open = e._openTarget || preset === '__other__';
    return html`
      <span class="fld target">
        <label>Target</label>
        <select .value=${preset} @change=${(ev) => this._setTargetName(i, ev.target.value)} aria-label="Target">
          ${(meta?.names ?? []).map((n) => html`<option value=${n}>${prettyName(n)}</option>`)}
          ${meta?.open ? html`<option value="__other__">Other…</option>` : ''}
        </select>
        ${meta?.open && open
          ? html`<input type="text" class="other" .value=${e.target?.name ?? ''} placeholder="named ability"
              @input=${(ev) => this._setTargetNameOther(i, ev.target.value)} aria-label="Named target" />`
          : ''}
      </span>
    `;
  }
  _setTargetNameOther(i, name) {
    const e = this._form.item.effects[i];
    this._setEffect(i, { target: { ...(e.target ?? {}), name } });
  }

  render() {
    return html`
      <div class="overlay" @click=${this._requestClose}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Custom items" @click=${(e) => e.stopPropagation()}>
          ${this._form ? this._formView() : this._listView()}
        </div>
      </div>
      ${this._confirmClose ? this._closeConfirm() : ''}
    `;
  }

  _listView() {
    const names = new Set([...this._working.keys(), ...Object.keys(this.committed ?? {})]);
    const rows = [...names].map((name) => ({
      name,
      item: this._working.get(name) ?? this.committed?.[name],
      toDelete: !this._working.has(name),
    }));
    const { items, delete: dels } = this._delta();
    const pending = Object.keys(items).length + dels.length;
    const valid = Object.entries(items).every(([name, item]) => validateItem(name, item).ok);

    return html`
      <div class="mhead">
        <span class="mtitle">✎ Custom items</span>
        <button class="mclose" aria-label="Close" @click=${this._requestClose}>✕</button>
      </div>
      <p class="sub">Items you create are shared by every character and, once saved, folded into the rule files. Thread items can't be created here.</p>

      <div class="clist">
        ${rows.length
          ? rows.map((r) => html`
              <div class="crow ${r.toDelete ? 'del' : ''}">
                <button class="cinfo" @click=${() => this._editItem(r.name)} ?disabled=${r.toDelete}>
                  <span class="cnm">${r.name}</span>
                  <span class="csub">${KLABEL[r.item?.kind] ?? r.item?.kind ?? ''}${r.item?.effects?.length ? ` · ${r.item.effects[0]?.summary ?? ''}` : ''}</span>
                </button>
                ${r.toDelete
                  ? html`<span class="ctag">to delete</span>`
                  : html`<button class="cdel" aria-label="Remove ${r.name}" title="Remove ${r.name}" @click=${() => this._remove(r.name)}>✕</button>`}
              </div>`)
          : html`<div class="empty">No custom items yet — create your first one below.</div>`}
      </div>

      <div class="mfoot">
        <button class="fbtn new" @click=${this._newItem}>＋ New item</button>
        <span class="spacer"></span>
        <button class="fbtn m-primary" @click=${this._saveAll} ?disabled=${!pending || !valid} title=${valid ? '' : 'Fix the item errors before saving.'}>
          Save to GitHub${pending ? ` (${pending})` : ''}
        </button>
      </div>
    `;
  }

  _formView() {
    const f = this._form;
    const item = f.item;
    const kind = item.kind;
    const errors = this._formErrors();
    const isNew = f.originalName == null;
    const collides = !isNew ? false : this.canonKeys?.includes(f.name?.trim());
    const refFields = REF_FIELDS[kind] ?? [];
    const templates = QUICK_TEMPLATES[kind] ?? [];

    return html`
      <div class="mhead">
        <span class="mtitle">${isNew ? 'New item' : `Edit ${f.originalName}`}</span>
        <button class="mclose" aria-label="Close" @click=${() => (this._form = null)}>✕</button>
      </div>

      <form @submit=${(e) => { e.preventDefault(); this._commitForm(); }}>
        <div class="frow">
          <span class="fld name">
            <label for="f-name">Name</label>
            <input id="f-name" .value=${f.name} placeholder="Item name"
              @input=${(e) => this._setForm({ name: e.target.value })} />
          </span>
          <span class="fld kind">
            <label for="f-kind">Kind</label>
            <select id="f-kind" .value=${kind} @change=${(e) => this._setFormItem({ kind: e.target.value, ref: {} })}>
              ${KIND_ORDER.map((k) => html`<option value=${k}>${KLABEL[k]}</option>`)}
            </select>
          </span>
        </div>
        ${collides
          ? html`<p class="warn">Custom overrides the catalog item of the same name.</p>`
          : ''}

        <div class="fgroup">
          <div class="fh">Reference</div>
          <div class="refgrid">
            <span class="fld"><label>Cost (sp)</label><input type="number" min="0" .value=${item.ref?.cost ?? ''} @change=${(e) => this._setRef('cost', e.target.value === '' ? undefined : Number(e.target.value))} /></span>
            ${refFields.map((rf) =>
              rf.type === 'checkbox'
                ? html`<label class="chk"><input type="checkbox" ?checked=${item.ref?.living === true} @change=${(e) => this._setRef('living', e.target.checked)} /> ${rf.label}</label>`
                : rf.type === 'select'
                  ? html`<span class="fld"><label>${rf.label}</label><select .value=${item.ref?.[rf.k] ?? ''} @change=${(e) => this._setRef(rf.k, e.target.value)}>${['', ...rf.options].map((o) => html`<option value=${o}>${o || '—'}</option>`)}</select></span>`
                  : html`<span class="fld"><label>${rf.label}</label><input type=${rf.type === 'number' ? 'number' : 'text'} .value=${item.ref?.[rf.k] ?? ''} @change=${(e) => this._setRef(rf.k, rf.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} /></span>`,
            )}
            <span class="fld desc"><label>Description</label><textarea .value=${item.ref?.description ?? ''} @input=${(e) => this._setRef('description', e.target.value)}></textarea></span>
          </div>
        </div>

        <div class="fgroup">
          <div class="fh">Effects</div>
          ${templates.length
            ? html`<div class="qt">${templates.map((t) => html`<button type="button" class="qtbtn" @click=${() => this._addEffect(t)}>${t.label}</button>`)}</div>`
            : ''}
          <div class="elist">
            ${(item.effects ?? []).length
              ? item.effects.map((e, i) => this._effectRow(e, i))
              : html`<div class="empty">No effects yet — add one or use a template above.</div>`}
          </div>
          <button type="button" class="qtbtn add" @click=${this._addBlankEffect}>＋ Add effect row</button>
        </div>

        ${errors.length
          ? html`<ul class="errs">${errors.map((er) => html`<li>${er}</li>`)}</ul>`
          : ''}

        <div class="mfoot">
          <button type="button" class="fbtn" @click=${() => (this._form = null)}>Cancel</button>
          <span class="spacer"></span>
          <button type="submit" class="fbtn f-primary" ?disabled=${errors.length > 0}>${isNew ? 'Add item' : 'Save item'}</button>
        </div>
      </form>
    `;
  }

  _effectRow(e, i) {
    const meta = TYPE_META[e.type];
    const overridden = this._summaryOverride.has(e);
    const value = e.value ?? '';
    return html`
      <div class="erow">
        <span class="fld type"><label>Type</label>
          <select .value=${e.type} @change=${(ev) => this._setEffect(i, { type: ev.target.value })} aria-label="Effect type">
            ${TYPE_ORDER.map((t) => html`<option value=${t}>${cap(t.replace(/-/g, ' '))}</option>`)}
          </select>
        </span>
        ${e.type !== 'note' ? this._effectTargetInput(e, i) : ''}
        ${e.type !== 'note'
          ? html`<span class="fld"><label>Op</label>
              <select .value=${e.operation} @change=${(ev) => this._setEffect(i, { operation: ev.target.value })} aria-label="Operation">
                ${OPERATIONS.map((o) => html`<option value=${o}>${o}</option>`)}
              </select></span>
            <span class="fld v"><label>Value</label><input type="number" .value=${value} @change=${(ev) => this._setEffect(i, { value: Number(ev.target.value) || 0 })} /></span>
            <span class="fld"><label>Measure</label>
              <select .value=${e.measure ?? meta?.measure ?? 'rating'} @change=${(ev) => this._setEffect(i, { measure: ev.target.value })} aria-label="Measure">
                ${MEASURES.map((m) => html`<option value=${m}>${m}</option>`)}
              </select></span>
            <span class="fld"><label>Condition</label>
              <select .value=${e.condition ?? 'always'} @change=${(ev) => this._setEffect(i, { condition: ev.target.value })} aria-label="Condition">
                ${CONDITIONS.map((c) => html`<option value=${c}>${c}</option>`)}
              </select></span>`
          : ''}
        <button type="button" class="cdel" aria-label="Remove effect" @click=${() => this._removeEffect(i)}>✕</button>
        <span class="fld summary">
          <label>Summary</label>
          <input type="text" .value=${e.summary ?? ''} placeholder="Auto-generated — edit to override"
            @input=${(ev) => this._setEffectSummary(i, ev.target.value)} />
          ${e.type !== 'note' && !overridden && e.summary && e.summary !== summaryFor(e)
            ? html`<span class="hint">Auto: “${summaryFor(e)}”</span>`
            : ''}
        </span>
      </div>
    `;
  }

  _closeConfirm() {
    return html`
      <div class="overlay sub" @click=${(e) => e.stopPropagation()}>
        <div class="modal sml" role="alertdialog" aria-modal="true" aria-label="Unsaved changes">
          <div class="mhead"><span class="mtitle">Unsaved changes</span></div>
          <p class="msg">Your custom-item changes are kept in this browser until you save them to GitHub. Close anyway?</p>
          <div class="mfoot">
            <button class="fbtn" @click=${() => (this._confirmClose = false)}>Keep editing</button>
            <span class="spacer"></span>
            <button class="fbtn f-primary" @click=${() => { this._confirmClose = false; this._close(); }}>Close</button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --danger: light-dark(#c0392b, #e57373);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --warn: light-dark(#8a5a00, #e0b35c);
      --warn-bg: light-dark(#f6ecd6, #33290f);
      --shadow: 0 10px 30px light-dark(rgba(20, 24, 33, 0.18), rgba(0, 0, 0, 0.5));
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .overlay.sub { z-index: 2200; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; width: 40rem; max-width: 100%; max-height: 85vh; overflow: auto; padding: 14px 16px; box-sizing: border-box; }
    .modal.sml { width: 24rem; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
    .mtitle { font-size: 1rem; font-weight: 500; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1rem; line-height: 1; cursor: pointer; }
    .sub { font-size: 0.72rem; color: var(--muted); line-height: 1.5; margin: 0 0 10px; }
    .msg { font-size: 0.85rem; line-height: 1.5; color: var(--fg); margin: 0 0 0.75rem; }

    /* List */
    .clist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .crow { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 7px 10px; }
    .crow.del { opacity: 0.55; }
    .cinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: var(--fg); }
    .cinfo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
    .cnm { font-size: 0.88rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .csub { font-size: 0.62rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ctag { font-size: 0.62rem; color: var(--danger); border: 1px solid var(--danger); border-radius: 999px; padding: 2px 9px; }
    .cdel { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.92rem; line-height: 1; padding: 2px 4px; border-radius: 6px; flex: 0 0 auto; }
    .cdel:hover { color: var(--danger); }
    .cdel:focus-visible { outline: 2px solid var(--danger); outline-offset: 1px; }
    .empty { color: var(--muted); font-size: 0.78rem; padding: 4px 2px; }

    .mfoot { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--border); margin-top: 4px; padding-top: 10px; }
    .mfoot .spacer { flex: 1; }
    .fbtn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 8px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--fg); }
    .fbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .fbtn[disabled] { opacity: 0.45; cursor: default; }
    .fbtn.m-primary, .fbtn.f-primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .fbtn.new { border-style: dashed; }

    /* Item form */
    form { display: flex; flex-direction: column; gap: 4px; }
    .frow { display: flex; gap: 10px; flex-wrap: wrap; }
    .fld { display: flex; flex-direction: column; gap: 3px; flex: 0 0 auto; }
    .fld label { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 500; }
    .fld input, .fld select, .fld textarea { font: inherit; font-size: 0.82rem; color: var(--fg); background: var(--bg-card); border: 1px solid var(--border); border-radius: 7px; padding: 6px 8px; outline: none; min-width: 0; }
    .fld input:focus, .fld select:focus, .fld textarea:focus { border-color: var(--accent); }
    .fld.name { flex: 1 1 180px; }
    .fld.kind { flex: 0 0 150px; }
    .fld.v { flex: 0 0 76px; }
    .fld.desc { flex: 1 1 100%; }
    .fld.desc textarea { resize: vertical; min-height: 44px; }
    .fld.target { flex: 1 1 170px; }
    .fld.target input.other { margin-top: 2px; }
    .fld.summary { flex: 1 1 100%; margin-top: 4px; }
    .fld .hint { font-size: 0.62rem; color: var(--muted); }
    .chk { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--fg); padding: 7px 0; }
    .warn { font-size: 0.72rem; color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn); border-radius: 8px; padding: 5px 9px; margin: 2px 0 8px; }
    .errs { margin: 4px 0 0; padding: 0 0 0 18px; color: var(--danger); font-size: 0.7rem; line-height: 1.5; }

    .fgroup { border: 1px solid var(--border); border-radius: 10px; padding: 9px 10px; margin-bottom: 8px; }
    .fh { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 500; margin-bottom: 7px; }
    .refgrid { display: flex; flex-wrap: wrap; gap: 8px; }
    .qt { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .qtbtn { font: inherit; font-size: 0.72rem; border: 1px dashed var(--accent); background: var(--accent-bg); color: var(--accent); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
    .qtbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .qtbtn.add { margin-top: 6px; }
    .elist { display: flex; flex-direction: column; gap: 8px; }
    .erow { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 8px; }
    .erow .cdel { align-self: flex-start; }
  `;
}

customElements.define('ed-custom-item', EdCustomItem);
