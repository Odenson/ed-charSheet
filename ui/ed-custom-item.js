// ui/ed-custom-item.js — the custom-item manager modal (plans/PLAN-CUSTOM-ITEMS.md
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
// Built on the UI kit (ui/kit/, docs/MODALS.md): Enter = OK (Ctrl/⌘+Enter from the
// description textarea); Escape closes the item form first (back to the list), then
// the modal, asking "Discard unsaved changes?" when changes are staged (a stacked
// ed-confirm, confirm label "Close": the working set stays in this browser);
// theme-aware via light-dark().

import { LitElement, html, css, nothing } from 'lit';
import { validateItem } from '../engine/validate-item.js';
import { seedWorking, deltaFrom, hasChanges, commitForm, removeWorking, weightToForm, weightFromForm } from './custom-item-state.js';
import {
  MAX_SHORT_EFFECT, TYPE_META, TYPE_ORDER, TYPE_HINT, OPERATIONS, MEASURES, CONDITIONS, measuresFor, reconcileMeasure,
  summaryFor, blankEffect, finishEffect, cleanItemForm, damageStepEffect, seedDamageStep,
} from './custom-item-builder.js';
import { cap, prettyName } from './format.js';
import './ed-confirm.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

const KLABEL = {
  weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ammunition: 'Ammunition',
  gear: 'Gear', 'magic-item': 'Magic item', 'blood-charm': 'Blood charm', 'healing-aid': 'Healing aid',
};
const KIND_ORDER = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'magic-item', 'blood-charm', 'healing-aid'];

// §6.2 — kind-driven reference fields (cost/description are common to all kinds).
const REF_FIELDS = {
  weapon: [
    { k: 'category', label: 'Category', type: 'select', options: ['melee', 'missile', 'throwing', 'unarmed'] },
    { k: 'strMin', label: 'STR min', type: 'number' },
    { k: 'size', label: 'Size', type: 'number' },
    { k: 'damageStep', label: 'Damage Step', type: 'number', hint: 'Added to your Strength step (also for unarmed weapons).' },
    { k: 'shortRange', label: 'Short range', type: 'text' },
    { k: 'longRange', label: 'Long range', type: 'text' },
    { k: 'weight', label: 'Weight', type: 'weight' },
    { k: 'availability', label: 'Availability', type: 'text' },
  ],
  armor: [{ k: 'living', label: 'Living armour', type: 'checkbox' }, { k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }],
  shield: [{ k: 'living', label: 'Living shield', type: 'checkbox' }, { k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }],
  ammunition: [{ k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }, { k: 'quantity', label: 'Quantity', type: 'number' }],
  gear: [{ k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }],
  'magic-item': [{ k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }, { k: 'range', label: 'Range', type: 'text' }],
  'blood-charm': [{ k: 'craftingDifficultyNumber', label: 'Crafting DN', type: 'number' }, { k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }],
  'healing-aid': [{ k: 'weight', label: 'Weight', type: 'weight' }, { k: 'availability', label: 'Availability', type: 'text' }],
};

// §6.2 — per-kind effect quick-templates. Each builds a raw effect; the builder
// sets source/condition/summary.
const QUICK_TEMPLATES = {
  weapon: [],
  armor: [
    { label: '＋ Physical Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' }, condition: 'always' }) },
    { label: '＋ Mystic Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Mystic' }, condition: 'always' }) },
    { label: '− Initiative', build: () => ({ type: 'characteristic-modifier', operation: 'subtract', value: 1, measure: 'step', target: { domain: 'characteristic', name: 'Initiative' }, condition: 'always' }) },
  ],
  shield: [{ label: '＋ Physical Armour', build: () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' }, condition: 'always' }) }],
  ammunition: [],
  gear: [],
  'magic-item': [],
  'blood-charm': [{ label: '− Unconsciousness', build: () => ({ type: 'characteristic-modifier', operation: 'subtract', value: 1, measure: 'rating', target: { domain: 'characteristic', name: 'UnconsciousnessRating' }, condition: 'always' }) }],
  'healing-aid': [{ label: '＋ Recovery Result', build: () => ({ type: 'test-modifier', operation: 'add', value: 1, measure: 'result', target: { domain: 'test', name: 'Recovery' }, condition: 'always' }) }],
};

// Build the editable item object the form works on.
const blankItem = (kind) => ({ kind, effects: [] });

export class EdCustomItem extends LitElement {
  static properties = {
    committed: { attribute: false }, // branch-truth custom catalog { name: item } — the delta baseline
    overlay: { attribute: false },   // pending ed-custom-items delta { items?, delete? } or null
    canonKeys: { attribute: false }, // canon item names (collision warning)
    _form: { state: true },          // item form open: { name, item, originalName }
    _discard: { state: true },       // staged-changes close prompt
  };

  constructor() {
    super();
    this._form = null;
    this._discard = false;
    // Working set derived once on open: the *committed* catalog plus any pending
    // overlay delta (so a pending item still shows, and a reopen after a reload
    // still knows what is uncommitted). Edits mutate this map; the delta vs
    // `committed` is recomputed on every change and dispatched up as the overlay
    // draft — never the overlay-applied set, so re-deriving the model on each
    // draft can't wipe the pending count.
    this._working = new Map();
    this._seeded = false;
    this._weightMode = 'none'; // transient UI-only weight unit while typing (see _weightField)
    this._summaryOverride = new Set(); // effects whose summary the user typed
    this._ctl = new ModalController(this, {
      kind: 'input',
      // Dirty doubles as "back one step": in the item form Escape/✕/backdrop/Cancel
      // return to the list; in the list, staged changes ask before closing.
      isDirty: () => !!this._form || this._hasChanges(),
      onDiscardPrompt: () => { if (this._form) this._form = null; else this._discard = true; },
      onConfirm: () => (this._form ? this._commitForm() : this._saveAll()),
      canConfirm: () => (this._form ? this._formErrors().length === 0 : this._canSave()),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  willUpdate(changedProps) {
    // The bound `committed`/`overlay` properties are applied after the element
    // connects, so a seed in connectedCallback sees empty values and flags every
    // committed item as deleted. Seed before the first render instead.
    if (!this._seeded && (changedProps.has('committed') || changedProps.has('overlay'))) this._seed();
  }

  updated(changed) {
    // Moving between the list and the item form re-runs the kit's initial focus
    // (the form's name field is `autofocus`). Edits inside the form replace
    // `_form` too, so only react to open/closed flips.
    if (changed.has('_form') && !!changed.get('_form') !== !!this._form) this._ctl.refocus();
  }

  // Open (or reopen) with the committed catalog + any pending overlay delta as
  // the working set (see seedWorking — overlay wins, so a just-saved edit still
  // pending in the overlay is the freshest copy). Runs once per mount — prop
  // updates while open never reseed.
  _seed() {
    this._seeded = true;
    this._working = seedWorking(this.committed, this.overlay);
    this._summaryOverride = new Set();
    this._form = null;
    this._discard = false;
  }

  // True when any working-set item differs from the loaded catalog.
  _hasChanges() {
    return hasChanges(this._delta());
  }

  // Diff the working set against the *committed* catalog: { items (create/edit),
  // delete }. Matching the overlay semantics (deltaFrom), so a reload-then-reopen
  // or a draft re-derive all agree on what still needs saving.
  _delta() {
    return deltaFrom(this._working, this.committed);
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

  // Save to GitHub is allowed when something is staged and every row passes validation.
  _canSave() {
    const { items, delete: dels } = this._delta();
    return (Object.keys(items).length + dels.length) > 0
      && Object.entries(items).every(([name, item]) => validateItem(name, item).ok);
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  _saveAll() {
    this._dispatch('save'); // ed-app POSTs, reconciles, re-reads, toasts
    this._ctl.close({ reason: 'confirm' });
  }

  // --- working-set mutations ---
  _remove(name) {
    this._working = removeWorking(this._working, name);
    this._onWorkingChange();
  }
  _editItem(name) {
    // The working set is seeded from committed ∪ overlay (overlay wins), so it is
    // always the freshest copy — a just-saved edit stays pending in the overlay
    // until the branch re-read reflects the PUT, and reading `committed` first
    // showed that stale copy in the form until a page refresh (PLAN-CUSTOM-ITEMS
    // §6.6). `committed` is only a fallback for a name the overlay never touched.
    const item = this._working.get(name) ?? this.committed?.[name];
    if (!item) return;
    this._form = { name, item: seedDamageStep(JSON.parse(JSON.stringify(item))), originalName: name };
    this._summaryOverride = new Set();
    this._weightMode = 'none';
  }
  _newItem() {
    this._form = { name: '', item: blankItem('gear'), originalName: null };
    this._summaryOverride = new Set();
    this._weightMode = 'none';
  }

  // Commit the item form into the working set (commitForm: upsert semantics — a
  // name that matches an existing custom item edits it in place; a rename drops
  // the old key). The clean step supplies the final trimmed name the item is
  // stored under.
  _commitForm() {
    const { originalName } = this._form;
    const clean = this._cleanForm();
    if (!clean || !clean.ok) return;
    this._working = commitForm(this._working, originalName, clean.name, clean.item);
    this._form = null;
    this._onWorkingChange();
  }

  // --- the item form ---
  _cleanForm() {
    const { name, item } = this._form;
    if (!(name ?? '').trim()) return null;
    return cleanItemForm(name, item);
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
  // Switching kind drops the kind-specific ref fields but keeps the ones every
  // kind shares, so converting e.g. Gear -> Weapon does not wipe cost/weight.
  _setKind(kind) {
    const old = this._form.item.ref ?? {};
    const ref = {};
    for (const k of ['cost', 'description', 'weight', 'availability']) if (old[k] !== undefined) ref[k] = old[k];
    this._setFormItem({ kind, ref });
  }
  _setCategory(value) {
    const ref = { ...(this._form.item.ref ?? {}), category: value };
    if (value === 'unarmed') { delete ref.shortRange; delete ref.longRange; }
    this._setFormItem({ ref });
  }
  _setShortEffect(value) {
    this._form = {
      ...this._form,
      item: { ...this._form.item, presentation: { ...(this._form.item.presentation ?? {}), shortEffect: value } },
    };
  }

  // Structured weight input (ref.weight, schema ed-items/3): a unit/kind select
  // plus a numeric amount, mapped to/from the stored shape via weightToForm /
  // weightFromForm. A legacy pre-migration string surfaces as "needs re-entry"
  // (the stored weight is never silently dropped), and a bare number / numeric
  // string migrates to pounds on first save. `_weightMode` is transient UI-only
  // state: it remembers a unit the user just picked before an amount is entered,
  // so the select doesn't snap back to "— none".
  _weightField(item) {
    const f = weightToForm(item.ref?.weight);
    const mode = f.mode !== 'none' ? f.mode : this._weightMode;
    const amount = f.amount;
    return html`
      <span class="fld weight">
        <label>Weight</label>
        <span class="wrow">
          ${mode === 'lb' || mode === 'oz'
            ? html`<input type="number" min="0" step="0.01" .value=${amount} @change=${(e) => this._setWeight(mode, e.target.value)} placeholder="0" />`
            : ''}
          <select .value=${mode} @change=${(e) => this._setWeight(e.target.value, amount)} aria-label="Weight unit">
            <option value="none">— none —</option>
            <option value="negligible">Negligible</option>
            <option value="lb">lb</option>
            <option value="oz">oz</option>
          </select>
        </span>
        ${f.legacy !== undefined
          ? html`<span class="hint">Stored "${f.legacy}" — re-enter its weight.</span>`
          : ''}
      </span>
    `;
  }
  _setWeight(mode, amount) {
    this._weightMode = mode;
    this._setRef('weight', weightFromForm(mode, amount));
  }
  _setEffect(i, patch) {
    const effects = (this._form.item.effects ?? []).map((e, j) => (j === i ? { ...e, ...patch } : e));
    // A type change resets target/measure to that type's defaults — and drops any
    // override, since a typed summary described the previous type.
    if (patch.type && patch.type !== this._form.item.effects[i]?.type) {
      this._summaryOverride.delete(i);
      effects[i] = { ...effects[i], ...blankEffect(patch.type), value: effects[i].value };
    }
    // Keep the auto summary in sync with the fields unless the user typed one.
    // (Fix: the old reset blanked the summary, and the clean step then silently
    // dropped the effect on save — plans/PLAN-CUSTOM-ITEMS.md §6.6.)
    if (effects[i].type !== 'note' && !this._summaryOverride.has(i)) {
      effects[i] = { ...effects[i], summary: summaryFor(effects[i]) };
    }
    this._setFormItem({ effects });
  }
  _setEffectSummary(i, summary) {
    this._summaryOverride.add(i);
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
    // Indices above the removed row shift down — keep the override set in step.
    const next = new Set();
    for (const idx of this._summaryOverride) next.add(idx < i ? idx : idx - 1);
    this._summaryOverride = next;
    this._setFormItem({ effects: (this._form.item.effects ?? []).filter((_, j) => j !== i) });
  }
  _setTargetName(i, name) {
    const e = this._form.item.effects[i];
    const meta = TYPE_META[e.type];
    const isOther = name === '__other__';
    const target = { ...(e.target ?? {}), domain: meta.domain, name: isOther ? (e.target?.name ?? '') : name };
    // A different target may fold with a different measure (Initiative → step): keep the
    // current one only if it is still valid, else take the target's default (T-006).
    const measure = reconcileMeasure(e.type, target.name, e.measure);
    this._setEffect(i, { target, measure, _openTarget: isOther });
  }

  _effectTargetInput(e, i) {
    const meta = TYPE_META[e.type];
    const preset = (meta?.names ?? []).includes(e.target?.name) ? e.target.name : '__other__';
    const open = e._openTarget || preset === '__other__';
    return html`
      <span class="fld target">
        <label>Target</label>
        <select .value=${preset} @change=${(ev) => this._setTargetName(i, ev.target.value)} aria-label="Target">
          ${(meta?.names ?? []).map((n) => html`<option value=${n} ?selected=${n === preset}>${prettyName(n)}</option>`)}
          ${meta?.open ? html`<option value="__other__" ?selected=${preset === '__other__'}>Other…</option>` : ''}
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
    const f = this._form;
    const { items, delete: dels } = this._delta();
    const pending = Object.keys(items).length + dels.length;
    const errors = f ? this._formErrors() : [];
    return html`
      ${modalFrame(this._ctl, {
        title: f ? (f.originalName == null ? 'New item' : `Edit ${f.originalName}`) : '✎ Custom items',
        label: 'Custom items',
        layer: 2100,
        width: '40rem',
        scroll: true,
        hasTextarea: !!f,
        body: f ? this._formView(errors) : this._listView(),
        primary: f
          ? { label: f.originalName == null ? 'Add item' : 'Save item', disabled: errors.length > 0 }
          : {
              label: `Save to GitHub${pending ? ` (${pending})` : ''}`,
              disabled: !this._canSave(),
              title: Object.entries(items).every(([name, item]) => validateItem(name, item).ok) ? '' : 'Fix the item errors before saving.',
            },
      })}
      ${this._discard
        ? html`<ed-confirm heading="Discard unsaved changes?"
            message="Your custom-item changes are kept in this browser until you save them to GitHub. Close anyway?"
            confirmLabel="Close" cancelLabel="Keep editing" focusCancel
            @confirm=${() => { this._discard = false; this._ctl.close(); }}
            @close=${() => { this._discard = false; this._ctl.refocus(); }}></ed-confirm>`
        : ''}
    `;
  }

  _listView() {
    const names = new Set([...this._working.keys(), ...Object.keys(this.committed ?? {})]);
    const rows = [...names].map((name) => ({
      name,
      item: this._working.get(name) ?? this.committed?.[name],
      toDelete: !this._working.has(name),
    }));
    return html`
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

      <button type="button" class="btn new" @click=${this._newItem}>＋ New item</button>
    `;
  }

  _formView(errors) {
    const f = this._form;
    const item = f.item;
    const kind = item.kind;
    const isNew = f.originalName == null;
    const collides = !isNew ? false : this.canonKeys?.some((k) => k.toLowerCase() === f.name?.trim().toLowerCase());
    const refFields = REF_FIELDS[kind] ?? [];
    const templates = QUICK_TEMPLATES[kind] ?? [];
    const shortEffect = item.presentation?.shortEffect ?? '';

    return html`
      <form @submit=${(e) => { e.preventDefault(); this._ctl.confirm(); }}>
        <div class="frow">
          <span class="fld name">
            <label for="f-name">Name</label>
            <input id="f-name" .value=${f.name} placeholder="Item name" autofocus
              @input=${(e) => this._setForm({ name: e.target.value })} />
          </span>
          <span class="fld kind">
            <label for="f-kind">Kind</label>
            <select id="f-kind" .value=${kind} @change=${(e) => this._setKind(e.target.value)}>
              ${KIND_ORDER.map((k) => html`<option value=${k} ?selected=${k === kind}>${KLABEL[k]}</option>`)}
            </select>
          </span>
        </div>
        ${collides
          ? html`<p class="warn">This new Custom Item will override the catalog item of the same name if you continue.</p>`
          : ''}

        <div class="fgroup">
          <div class="fh">Reference</div>
          <div class="refgrid">
            <span class="fld"><label>Cost (sp)</label><input type="number" min="0" .value=${item.ref?.cost ?? ''} @change=${(e) => this._setRef('cost', e.target.value === '' ? undefined : Number(e.target.value))} /></span>
            ${refFields.filter((rf) => !(kind === 'weapon' && item.ref?.category === 'unarmed' && (rf.k === 'shortRange' || rf.k === 'longRange'))).map((rf) =>
              rf.type === 'checkbox'
                ? html`<label class="chk"><input type="checkbox" ?checked=${item.ref?.living === true} @change=${(e) => this._setRef('living', e.target.checked)} /> ${rf.label}</label>`
                : rf.type === 'select'
                  ? html`<span class="fld"><label>${rf.label}</label><select .value=${item.ref?.[rf.k] ?? ''} @change=${(e) => (rf.k === 'category' ? this._setCategory(e.target.value) : this._setRef(rf.k, e.target.value))}>${['', ...rf.options].map((o) => html`<option value=${o} ?selected=${o === (item.ref?.[rf.k] ?? '')}>${o || '—'}</option>`)}</select></span>`
                  : rf.type === 'weight'
                    ? this._weightField(item)
                    : html`<span class="fld"><label>${rf.label}</label><input type=${rf.type === 'number' ? 'number' : 'text'} min=${rf.type === 'number' ? '0' : nothing} step=${rf.type === 'number' ? '1' : nothing} .value=${item.ref?.[rf.k] ?? ''} @input=${(e) => this._setRef(rf.k, rf.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} />${rf.hint ? html`<span class="hint">${rf.hint}</span>` : ''}</span>`,
            )}
            <span class="fld desc"><label>Description</label><textarea .value=${item.ref?.description ?? ''} @input=${(e) => this._setRef('description', e.target.value)}></textarea></span>
            <span class="fld desc">
              <label for="f-short">Short effect</label>
              <input id="f-short" type="text" maxlength=${MAX_SHORT_EFFECT} .value=${shortEffect}
                placeholder="e.g. Holds ~50 lb"
                @input=${(e) => this._setShortEffect(e.target.value)} />
              <span class="hint">${shortEffect.length}/${MAX_SHORT_EFFECT} — the one-line label on the equipped tile.</span>
            </span>
          </div>
        </div>

        <div class="fgroup">
          <div class="fh">Effects</div>
          ${templates.length
            ? html`<div class="qt">${templates.map((t) => html`<button type="button" class="qtbtn" @click=${() => this._addEffect(t)}>${t.label}</button>`)}</div>`
            : ''}
          <div class="elist">
            ${kind === 'weapon' ? this._generatedRow(damageStepEffect(item.ref?.damageStep)) : ''}
            ${(item.effects ?? []).length
              ? item.effects.map((e, i) => this._effectRow(e, i))
              : kind === 'weapon' && damageStepEffect(item.ref?.damageStep)
                ? ''
                : html`<div class="empty">${templates.length ? 'No effects yet — add one or use a template above.' : 'No effects yet — add one with the button below.'}</div>`}
          </div>
          <button type="button" class="qtbtn add" @click=${this._addBlankEffect}>＋ Add effect row</button>
        </div>

        ${errors.length
          ? html`<ul class="errs">${errors.map((er) => html`<li>${er}</li>`)}</ul>`
          : ''}

      </form>
    `;
  }

  _generatedRow(e) {
    if (!e) return '';
    return html`<div class="erow gen"><span class="gtag">from Damage Step</span><span class="gsum">${e.summary}</span></div>`;
  }

  _effectRow(e, i) {
    const meta = TYPE_META[e.type];
    const value = e.value ?? '';
    return html`
      <div class="erow">
        <span class="fld type"><label>Type</label>
          <select .value=${e.type} title=${TYPE_HINT[e.type] ?? ''} @change=${(ev) => this._setEffect(i, { type: ev.target.value })} aria-label="Effect type">
            ${TYPE_ORDER.map((t) => html`<option value=${t} ?selected=${t === e.type}>${cap(t.replace(/-/g, ' '))}</option>`)}
          </select>
        </span>
        ${e.type !== 'note' ? this._effectTargetInput(e, i) : ''}
        ${e.type !== 'note'
          ? html`<span class="fld"><label>Op</label>
              <select .value=${e.operation} @change=${(ev) => this._setEffect(i, { operation: ev.target.value })} aria-label="Operation">
                ${OPERATIONS.map((o) => html`<option value=${o} ?selected=${o === e.operation}>${o}</option>`)}
              </select></span>
            <span class="fld v"><label>Value</label><input type="number" .value=${value} @change=${(ev) => this._setEffect(i, { value: Number(ev.target.value) || 0 })} /></span>
            <span class="fld"><label>Measure</label>
              <select .value=${e.measure ?? meta?.measure ?? 'rating'} @change=${(ev) => this._setEffect(i, { measure: ev.target.value })} aria-label="Measure">
                ${(measuresFor(e.type, e.target?.name) ?? MEASURES).map((m) => html`<option value=${m} ?selected=${m === (e.measure ?? meta?.measure ?? 'rating')}>${m}</option>`)}
              </select></span>
            <span class="fld"><label>Condition</label>
              <select .value=${e.condition ?? 'always'} @change=${(ev) => this._setEffect(i, { condition: ev.target.value })} aria-label="Condition">
                ${CONDITIONS.map((c) => html`<option value=${c} ?selected=${c === (e.condition ?? 'always')}>${c}</option>`)}
              </select></span>`
          : ''}
        <button type="button" class="cdel" aria-label="Remove effect" @click=${() => this._removeEffect(i)}>✕</button>
        <span class="fld summary">
          <label>Summary</label>
          <input type="text" .value=${e.summary ?? ''} placeholder="Auto-generated — edit to override"
            @input=${(ev) => this._setEffectSummary(i, ev.target.value)} />
        </span>
      </div>
    `;
  }

  static styles = [modalCss, css`
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
    .sub { font-size: var(--fs-small); color: var(--muted); line-height: 1.5; margin: 0 0 10px; }

    /* List */
    .clist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .crow { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 7px 10px; }
    .crow.del { opacity: 0.55; }
    .cinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: var(--fg); }
    .cinfo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
    .cnm { font-size: var(--fs-body); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .csub { font-size: var(--fs-eyebrow); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ctag { font-size: var(--fs-eyebrow); color: var(--danger); border: 1px solid var(--danger); border-radius: 999px; padding: 2px 9px; }
    .cdel { background: none; border: none; color: var(--muted); cursor: pointer; font-size: var(--fs-value); line-height: 1; padding: 2px 4px; border-radius: 6px; flex: 0 0 auto; }
    .cdel:hover { color: var(--danger); }
    .cdel:focus-visible { outline: 2px solid var(--danger); outline-offset: 1px; }
    .btn.new { border-style: dashed; }
    .empty { color: var(--muted); font-size: var(--fs-small); padding: 4px 2px; }


    /* Item form */
    form { display: flex; flex-direction: column; gap: 4px; }
    .frow { display: flex; gap: 10px; flex-wrap: wrap; }
    .fld { display: flex; flex-direction: column; gap: 3px; flex: 0 0 auto; }
    .fld label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 500; }
    .fld input, .fld select, .fld textarea { font: inherit; font-size: var(--fs-body); color: var(--fg); background: var(--bg-card); border: 1px solid var(--border); border-radius: 7px; padding: 6px 8px; outline: none; min-width: 0; }
    .fld input:focus, .fld select:focus, .fld textarea:focus { border-color: var(--accent); }
    .fld.name { flex: 1 1 180px; }
    .fld.kind { flex: 0 0 150px; }
    .fld.v { flex: 0 0 76px; }
    .fld.desc { flex: 1 1 100%; }
    .fld.desc textarea { resize: vertical; min-height: 44px; }
    .fld.target { flex: 1 1 170px; }
    .fld.weight .wrow { display: flex; gap: 5px; }
    .fld.weight .wrow select { flex: 0 0 auto; }
    .fld.weight .wrow input { flex: 0 0 76px; }
    .fld.target input.other { margin-top: 2px; }
    .fld.summary { flex: 1 1 100%; margin-top: 4px; }
    .fld .hint { font-size: var(--fs-eyebrow); color: var(--muted); }
    .chk { display: flex; align-items: center; gap: 6px; font-size: var(--fs-body); color: var(--fg); padding: 7px 0; }
    .warn { font-size: var(--fs-small); color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn); border-radius: 8px; padding: 5px 9px; margin: 2px 0 8px; }
    .errs { margin: 4px 0 0; padding: 0 0 0 18px; color: var(--danger); font-size: var(--fs-fine); line-height: 1.5; }

    .fgroup { border: 1px solid var(--border); border-radius: 10px; padding: 9px 10px; margin-bottom: 8px; }
    .fh { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 500; margin-bottom: 7px; }
    .refgrid { display: flex; flex-wrap: wrap; gap: 8px; }
    .qt { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .qtbtn { font: inherit; font-size: var(--fs-small); border: 1px dashed var(--accent); background: var(--accent-bg); color: var(--accent); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
    .qtbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .qtbtn.add { margin-top: 6px; }
    .elist { display: flex; flex-direction: column; gap: 8px; }
    .erow { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 8px; }
    .erow .cdel { align-self: flex-start; }
    .erow.gen { align-items: center; opacity: 0.85; }
    .erow.gen .gtag { font-size: var(--fs-eyebrow); color: var(--muted); }
    .erow.gen .gsum { font-size: var(--fs-small); color: var(--fg); }
  `];
}

customElements.define('ed-custom-item', EdCustomItem);
