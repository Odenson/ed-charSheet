// ui/ed-notes.js — the Notes tab (PLAN-NOTES-TAB): four surfaces behind a
// segmented control — hand-written Notes (info cards), the per-character Roll
// Log (device-local, decisions #2/#5), the Legend-earned log (with the derived
// running total, decisions #1/#6), and a dated History timeline (decision #4).
//
// Architecture (Tier-1 golden rule): the view never mutates state or persists
// character data itself. Notes / History / Legend-earned edits dispatch
// `ed-edit-notes` / `ed-edit-history` / `ed-edit-legend-earned` up to ed-app,
// which applies the inputs, persists the overlay, and re-derives. The Roll Log
// is the deliberate exception — it is high-churn, per-character localStorage
// (decision #2), read/written here directly through store-rolllog.js; it never
// rides the overlay, an export, or a GitHub save.
import { LitElement, html, css } from 'lit';
import { legendSpentBody, legendSpentStyles } from './legend-spent-view.js';
import { loadRollLog, setRollLogMax, clearRollLog, DEFAULT_MAX, MAX_OPTIONS } from '../store-rolllog.js';
import './ed-confirm.js';
import './ed-add-legend.js';

// Ids for entries the player creates. Real entries only — the virtual
// "Starting total" row keeps its reserved '__starting_total__' id.
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// The segmented control's monoline glyphs (decision #3 — the tab bar's family,
// never color-emoji): ▤ ⬡ ✧ ◷.
const SEGS = [
  { id: 'notes', label: 'Notes', icon: '▤' },
  { id: 'history', label: 'History', icon: '◷' },
  { id: 'legend', label: 'Legend', icon: '✧' },
  { id: 'rolls', label: 'Roll Log', icon: '⬡' },
];

export class EdNotes extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    characterId: { type: String },
    _view: { state: true },
    _rolls: { state: true },
    _rollMax: { state: true },
    _noteModal: { state: true }, // null | { id }  (id null → new)
    _historyModal: { state: true }, // null | { id }  (id null → new)
    _legendModal: { state: true }, // bool — the shared add-Legend form (Phase F)
    _spentModal: { state: true }, // bool — the Legend-spent breakdown (shared with Overview)
    _confirm: { state: true }, // null | { kind, id }
    _historySortAsc: { state: true }, // false = newest first (default)
  };

  static styles = [
    legendSpentStyles,
    css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
      --danger: light-dark(#c0392b, #e06557);
      display: block;
    }
    /* Segmented control — the ed-disciplines .seg pill pattern, as a tablist. */
    .seg { display: inline-flex; flex-wrap: wrap; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; margin-bottom: 12px; }
    .seg button { border: none; background: none; padding: 6px 14px; border-radius: 999px; font: inherit; font-size: var(--fs-body); color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .seg button[aria-selected='true'] { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .seg button .ico { color: var(--accent); }
    .headline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .hbig { font-size: var(--fs-value); font-weight: 500; }
    .info { background: none; border: none; color: var(--accent); cursor: pointer; font-size: var(--fs-body); padding: 0 0 0 4px; line-height: 1; vertical-align: -1px; }
    .htotal { display: inline-flex; align-items: baseline; gap: 6px; }
    .htotal .val { font-size: var(--fs-title); font-weight: 500; font-variant-numeric: tabular-nums; }
    .hsub { font-size: var(--fs-eyebrow); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .addbtn { margin-left: auto; font: inherit; font-size: var(--fs-small); font-weight: 500; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); cursor: pointer; }
    .sortbtn { font: inherit; font-size: var(--fs-small); font-weight: 500; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; }
    .sortbtn:hover { color: var(--fg); border-color: var(--fg); }
    .pend { font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 7px; }
    .empty { background: var(--bg-card); border: 1px dashed var(--border); border-radius: 8px; padding: 22px 14px; text-align: center; font-size: var(--fs-body); color: var(--muted); line-height: 1.5; }

    /* Notes: untimed info cards (decision #4). */
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 8px; }
    .ncard { background: var(--bg-card); border-radius: 8px; padding: 9px 11px; display: flex; flex-direction: column; gap: 8px; }
    .ntext { font-size: var(--fs-body); line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
    .nactions { display: flex; gap: 4px; justify-content: flex-end; }
    .edit, .del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: var(--fs-body); line-height: 1; padding: 2px 4px; }
    .edit:hover { color: var(--accent); }
    .del:hover { color: var(--danger); }

    /* Roll Log: newest-first rows (store order). */
    .rctl { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-small); color: var(--muted); }
    .rctl select { font: inherit; font-size: var(--fs-small); color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 3px 6px; }
    .clearbtn { font: inherit; font-size: var(--fs-small); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; }
    .clearbtn:hover { color: var(--danger); border-color: var(--danger); }
    .clearbtn:disabled { opacity: 0.4; cursor: default; }
    .rlist { display: flex; flex-direction: column; gap: 6px; }
    .rrow { background: var(--bg-card); border-radius: 8px; padding: 7px 10px; }
    .rtop { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .rlbl { font-size: var(--fs-body); font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rtotal { font-size: var(--fs-value); font-weight: 500; font-variant-numeric: tabular-nums; flex: none; }
    .rsub { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 5px; align-items: center; }
    .chip { font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
    /* The actual die outcome for a row — each die's rolled faces (an exploded
       die shows its chain, e.g. D6 6↦3). Recorded at roll time, never derived. */
    .chip.dieout { font-variant-numeric: tabular-nums; }
    .chip.ok { color: var(--karma); border-color: var(--karma); }
    .chip.no { color: var(--danger); border-color: var(--danger); }
    .chip.karma { color: var(--karma); border-color: var(--karma); }
    .chip.mod { color: var(--accent); border-color: var(--accent); }
    .ttime { margin-left: auto; font-size: var(--fs-eyebrow); color: var(--muted); flex: none; }

    /* Legend-earned table: amount, description, date, delete. The virtual
       "Starting total" row renders read-only / non-deletable (decision #6). */
    .ltable { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .lrow { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr) 7rem auto; gap: 8px; align-items: center; padding: 6px 10px; font-size: var(--fs-body); border-top: 1px solid var(--border); }
    .lrow:first-child { border-top: none; }
    .lamt { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--karma); }
    .ldesc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ldate { font-size: var(--fs-small); color: var(--muted); }
    .vrow { color: var(--muted); }
    .vrow .lamt { color: var(--muted); }
    .vtag { font-size: var(--fs-eyebrow); font-weight: 500; padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); border: 1px dashed var(--muted); color: var(--muted); white-space: nowrap; justify-self: end; }
    .lrow .del { justify-self: end; }
    .lcaption { font-size: var(--fs-fine); color: var(--muted); padding: 6px 10px; }

    /* History: dated, reverse-chronological timeline (decision #4). */
    .timeline { display: flex; flex-direction: column; }
    .trow { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr) auto auto; gap: 8px; align-items: baseline; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-body); }
    .trow:last-child { border-bottom: none; }
    .tdate { font-size: var(--fs-small); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .ttext { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }

    /* Modal (UI-GUIDELINES §7): Escape closes; Enter confirms where the form
       has a single-line control, and the primary button for textareas. */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; width: 30rem; max-width: 100%; max-height: 88vh; overflow: auto; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    form { display: flex; flex-direction: column; gap: 0.7rem; }
    .fld { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input, textarea { font: inherit; font-size: var(--fs-body); color: var(--fg); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
    textarea { resize: vertical; line-height: 1.4; }
    input:focus, textarea:focus { outline: none; border-color: var(--accent); }
    .hint { font-size: var(--fs-fine); color: var(--muted); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button.btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--fg); }
    button.btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }

    @media (max-width: 720px) {
      .cards { grid-template-columns: 1fr; }
      .lrow { grid-template-columns: 4.5rem minmax(0, 1fr) auto; }
      .ldate { display: none; }
    }
  `,
  ];

  constructor() {
    super();
    this._view = 'notes';
    this._rolls = [];
    this._rollMax = DEFAULT_MAX;
    this._noteModal = null;
    this._historyModal = null;
    this._legendModal = false;
    this._spentModal = false;
    this._confirm = null;
    this._historySortAsc = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
      if (this._noteModal) this._noteModal = null;
      else if (this._historyModal) this._historyModal = null;
      else if (this._spentModal) this._spentModal = false;
    };
    document.addEventListener('keydown', this._onKeydown);
    this._loadRolls();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  updated(changed) {
    if (changed.has('characterId')) this._loadRolls();
  }

  _pend() { return html`<span class="pend">—</span>`; }

  // --- data accessors (all inputs / the derived display list from the model) ---
  _notes() { return this.model?.notes ?? []; }
  _history() { return this.model?.history ?? []; }
  // The real earned entries only — the virtual seed row is never in a payload
  // (decision #6) and is not deletable.
  _earned() { return (this.model?.legendEarned ?? []).filter((e) => !e.virtual); }
  // YYYY-MM-DD sorts lexicographically; direction controlled by _historySortAsc.
  // Undated entries fall to the bottom in either direction.
  _sortedHistory() {
    const dir = this._historySortAsc ? 1 : -1;
    return [...this._history()].sort((a, b) => dir * String(a.date ?? '').localeCompare(String(b.date ?? '')));
  }

  // --- Roll Log (device-local, decision #2) ---
  _loadRolls() {
    if (!this.characterId) { this._rolls = []; this._rollMax = DEFAULT_MAX; return; }
    const { max, entries } = loadRollLog(this.characterId);
    this._rolls = entries;
    this._rollMax = max;
  }
  _setMax(e) {
    const max = Number(e.target.value);
    if (!MAX_OPTIONS.includes(max) || !this.characterId) return;
    setRollLogMax(max, this.characterId);
    this._loadRolls();
  }
  _rel(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    const w = Math.round(d / 7);
    if (w < 5) return `${w}w ago`;
    return new Date(iso).toLocaleDateString();
  }

  // --- dispatch up (views dispatch, ed-app acts) ---
  _dispatchNotes(notes) {
    this.dispatchEvent(new CustomEvent('ed-edit-notes', { detail: notes, bubbles: true, composed: true }));
  }
  _dispatchHistory(history) {
    this.dispatchEvent(new CustomEvent('ed-edit-history', { detail: history, bubbles: true, composed: true }));
  }
  _dispatchLegend(earned) {
    this.dispatchEvent(new CustomEvent('ed-edit-legend-earned', { detail: earned, bubbles: true, composed: true }));
  }

  // --- Notes CRUD (edit-mode gated; untimed cards, decision #4) ---
  _saveNote(e) {
    e.preventDefault();
    const text = (this.renderRoot.querySelector('.note-text')?.value ?? '').trim();
    if (!text) return;
    const list = [...this._notes()];
    const id = this._noteModal?.id ?? null;
    if (id == null) list.unshift({ id: uid(), text });
    else {
      const i = list.findIndex((n) => n.id === id);
      if (i >= 0) list[i] = { ...list[i], text };
    }
    this._noteModal = null;
    this._dispatchNotes(list);
  }

  // --- History CRUD (dated timeline) ---
  _saveHistory(e) {
    e.preventDefault();
    const f = this.renderRoot.querySelector('form');
    const date = (f?.elements.date?.value ?? '').trim();
    const text = (f?.elements.text?.value ?? '').trim();
    if (!text) return;
    const list = [...this._history()];
    const id = this._historyModal?.id ?? null;
    if (id == null) list.push({ id: uid(), date, text });
    else {
      const i = list.findIndex((h) => h.id === id);
      if (i >= 0) list[i] = { ...list[i], date, text };
    }
    this._historyModal = null;
    this._dispatchHistory(list);
  }

  // --- delete confirm ---
  _requestConfirm(kind, id) { this._confirm = { kind, id }; }
  _confirmDelete() {
    const c = this._confirm;
    if (!c) return;
    if (c.kind === 'note') {
      this._dispatchNotes(this._notes().filter((n) => n.id !== c.id));
    } else if (c.kind === 'history') {
      this._dispatchHistory(this._history().filter((h) => h.id !== c.id));
    } else if (c.kind === 'legend') {
      this._dispatchLegend(this._earned().filter((x) => x.id !== c.id));
    } else if (c.kind === 'rolls') {
      clearRollLog(this.characterId);
      this._loadRolls();
    }
    this._confirm = null;
  }
  _confirmMsg() {
    switch (this._confirm?.kind) {
      case 'note': return 'Delete this note? It can\'t be undone.';
      case 'history': return 'Delete this history entry? It can\'t be undone.';
      case 'legend': return 'Delete this Legend-earned entry? The running total adjusts.';
      case 'rolls': return 'Clear the entire Roll Log for this character?';
      default: return '';
    }
  }

  // --- modal shell ---
  _closeModal() {
    if (this._noteModal) this._noteModal = null;
    else if (this._historyModal) this._historyModal = null;
    else if (this._spentModal) this._spentModal = false;
  }
  _modalShell(title, body) {
    return html`
      <div class="overlay" @click=${this._closeModal}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${title} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>${title}</span>
            <button class="mclose" aria-label="Close" @click=${this._closeModal}>✕</button>
          </div>
          ${body}
        </div>
      </div>
    `;
  }

  _noteModalTmpl() {
    const entry = this._notes().find((n) => n.id === this._noteModal?.id);
    return this._modalShell(
      this._noteModal?.id == null ? 'Add note' : 'Edit note',
      html`
        <form @submit=${this._saveNote}>
          <textarea class="note-text" rows="6" .value=${entry?.text ?? ''} placeholder="An NPC, a location, a quest thread, a table reminder…"></textarea>
          <p class="hint">Saved with your character. Notes are timeless — the History tab keeps dated events.</p>
          <div class="actions">
            <button type="button" class="btn" @click=${this._closeModal}>Cancel</button>
            <button type="submit" class="btn primary">Save</button>
          </div>
        </form>
      `,
    );
  }

  _historyModalTmpl() {
    const entry = this._history().find((h) => h.id === this._historyModal?.id);
    return this._modalShell(
      this._historyModal?.id == null ? 'Add event' : 'Edit event',
      html`
        <form @submit=${this._saveHistory}>
          <div class="fld">
            <label for="n-date">Date</label>
            <input id="n-date" name="date" type="date" .value=${entry?.date ?? new Date().toISOString().slice(0, 10)} />
          </div>
          <div class="fld">
            <label for="n-text">What happened</label>
            <textarea id="n-text" name="text" rows="4" .value=${entry?.text ?? ''}></textarea>
          </div>
          <div class="actions">
            <button type="button" class="btn" @click=${this._closeModal}>Cancel</button>
            <button type="submit" class="btn primary">Save</button>
          </div>
        </form>
      `,
    );
  }

  _legendModalTmpl() {
    // Shared with the Overview Legend panel (Phase F) — one identical add form.
    return html`<ed-add-legend .earned=${this._earned()} @close=${() => (this._legendModal = false)}></ed-add-legend>`;
  }

  // --- views ---
  _notesView() {
    const list = this._notes();
    return html`
      <div class="headline">
        <span class="hbig">Notes</span>
        ${this.editMode ? html`<button class="addbtn" @click=${() => (this._noteModal = { id: null })}>+ Add note</button>` : ''}
      </div>
      ${list.length
        ? html`
            <div class="cards">
              ${list.map((n) => html`
                <div class="ncard">
                  <div class="ntext">${n.text}</div>
                  ${this.editMode
                    ? html`<div class="nactions">
                        <button class="edit" aria-label="Edit note" title="Edit note" @click=${() => (this._noteModal = { id: n.id })}>✎</button>
                        <button class="del" aria-label="Delete note" title="Delete note" @click=${() => this._requestConfirm('note', n.id)}>✕</button>
                      </div>`
                    : ''}
                </div>
              `)}
            </div>
          `
        : html`<div class="empty">${this.editMode
            ? 'No notes yet — add NPCs, locations, quest threads, or table reminders.'
            : 'No notes yet. Turn on edit mode to add some.'}</div>`}
    `;
  }

  _rollsView() {
    return html`
      <div class="headline">
        <span class="hbig">Roll Log</span>
        <span class="rctl">
          <label for="n-max">keep last</label>
          <select id="n-max" .value=${this._rollMax} @change=${this._setMax} aria-label="How many rolls to keep">
            ${MAX_OPTIONS.map((m) => html`<option value=${m}>${m}</option>`)}
          </select>
          <button class="clearbtn" @click=${() => this._requestConfirm('rolls')} ?disabled=${!this._rolls.length}>Clear</button>
        </span>
      </div>
      ${this._rolls.length
        ? html`
            <div class="rlist">
              ${this._rolls.map((r) => this._rollRow(r))}
            </div>
          `
        : html`<div class="empty">No rolls logged yet — roll a test anywhere in the sheet and it lands here.<br />The Roll Log lives in this browser only.</div>`}
    `;
  }

  _rollRow(r) {
    // Non-roll entries (e.g. a Combat-tab Stand up) render as a plain action
    // line — no step/dice/total, just the label and its age.
    if (r.kind === 'action') {
      return html`
        <div class="rrow">
          <div class="rtop">
            <span class="rlbl">${r.label ?? 'Action'}</span>
          </div>
          <div class="rsub">${r.at ? html`<span class="ttime">${this._rel(r.at)}</span>` : ''}</div>
        </div>`;
    }
    const mods = r.mods ?? [];
    return html`
      <div class="rrow">
        <div class="rtop">
          <span class="rlbl">${r.label ?? 'Roll'}</span>
          <span class="rtotal">${r.total != null ? r.total : this._pend()}</span>
        </div>
        <div class="rsub">
          ${r.step != null ? html`<span class="chip">Step ${r.step}</span>` : ''}
          ${r.dice ? html`<span class="chip">${r.dice}</span>` : ''}
          ${Array.isArray(r.groups) && r.groups.length
            ? html`${r.groups.map((g) => html`<span class="chip dieout" title=${`${g.label}: rolled ${g.rolls.join(', ')}${g.exploded ? ' — the max exploded and rerolled' : ''}`}>${g.label} ${g.rolls.join('↦')}</span>`)}`
            : ''}
          ${r.difficulty != null ? html`<span class="chip">vs D${r.difficulty}</span>` : ''}
          ${r.outcome
            ? html`<span class="chip ${r.outcome.ok ? 'ok' : 'no'}">${r.outcome.ok ? '✓' : '✗'} ${r.outcome.word}</span>`
            : ''}
          ${r.karma ? html`<span class="chip karma" title="Karma die">✦ ${r.karma.total}</span>` : ''}
          ${mods.map((m) => html`<span class="chip mod" title=${m.label}>${m.label} ${Number(m.value) > 0 ? '+' : ''}${m.value}</span>`)}
          ${r.at ? html`<span class="ttime">${this._rel(r.at)}</span>` : ''}
        </div>
      </div>
    `;
  }

  _legendView() {
    const list = this.model?.legendEarned ?? [];
    const spent = this.model?.legend?.spent ?? null;
    const total = this.model?.legend?.totalEarnt ?? null;
    const fmt = (n) => (n == null ? '' : Number(n).toLocaleString());
    return html`
      <div class="headline">
        <span class="hbig"
          >Legend earned${spent
            ? html`<button class="info" aria-label="Legend spent breakdown" title="Legend spent" @click=${() => (this._spentModal = true)}>ⓘ</button>`
            : ''}</span
        >
        <span class="htotal">
          ${total != null ? html`<span class="val">${total.toLocaleString()}</span>` : this._pend()}
          <span class="hsub">total earned</span>
        </span>
        <button class="addbtn" @click=${() => (this._legendModal = true)}>+ Add Legend earned</button>
      </div>
      ${list.length
        ? html`
            <div class="ltable">
              ${list.map((e) => html`
                <div class="lrow ${e.virtual ? 'vrow' : ''}">
                  <span class="lamt">+${fmt(e.amount)}</span>
                  <span class="ldesc" title=${e.description}>${e.description}</span>
                  <span class="ldate">${e.date ?? ''}</span>
                  ${e.virtual
                    ? html`<span class="vtag" title="Brings your recorded total forward — change it in the character file">starting total</span>`
                    : html`<button class="del" aria-label="Delete this entry" title="Delete" @click=${() => this._requestConfirm('legend', e.id)}>✕</button>`}
                </div>
              `)}
            </div>
          `
        : html`<div class="empty">No Legend earned recorded yet. Add your first award to start the running total.</div>`}
    `;
  }

  _historyView() {
    const list = this._sortedHistory();
    return html`
      <div class="headline">
        <span class="hbig">History</span>
        <button class="sortbtn" @click=${() => (this._historySortAsc = !this._historySortAsc)}
          title=${this._historySortAsc ? 'Switch to newest first' : 'Switch to oldest first'}>
          ${this._historySortAsc ? '↑ oldest' : '↓ newest'}
        </button>
        <button class="addbtn" @click=${() => (this._historyModal = { id: null })}>+ Add event</button>
      </div>
      ${list.length
        ? html`
            <div class="timeline">
              ${list.map((h) => html`
                <div class="trow">
                  <span class="tdate">${h.date || '—'}</span>
                  <span class="ttext">${h.text}</span>
                  <button class="edit" aria-label="Edit event" title="Edit" @click=${() => (this._historyModal = { id: h.id })}>✎</button>
                  <button class="del" aria-label="Delete event" title="Delete" @click=${() => this._requestConfirm('history', h.id)}>✕</button>
                </div>
              `)}
            </div>
          `
        : html`<div class="empty">No history yet — add dated events as they happen.</div>`}
    `;
  }

  render() {
    return html`
      <div class="seg" role="tablist" aria-label="Notes tab sections">
        ${SEGS.map((s) => html`
          <button role="tab" aria-selected=${this._view === s.id} @click=${() => (this._view = s.id)}>
            <span class="ico" aria-hidden="true">${s.icon}</span>${s.label}
          </button>
        `)}
      </div>
      <div>
        ${this._view === 'notes' ? this._notesView()
          : this._view === 'rolls' ? this._rollsView()
          : this._view === 'legend' ? this._legendView()
          : this._historyView()}
      </div>
      ${this._noteModal ? this._noteModalTmpl() : ''}
      ${this._historyModal ? this._historyModalTmpl() : ''}
      ${this._legendModal ? this._legendModalTmpl() : ''}
      ${this._spentModal ? this._modalShell('Legend spent', legendSpentBody(this.model?.legend?.spent)) : ''}
      ${this._confirm
        ? html`<ed-confirm
            heading=${this._confirm.kind === 'rolls' ? 'Clear the Roll Log?' : 'Delete this entry?'}
            message=${this._confirmMsg()}
            confirmLabel=${this._confirm.kind === 'rolls' ? 'Clear' : 'Delete'}
            @confirm=${this._confirmDelete}
            @close=${() => (this._confirm = null)}
          ></ed-confirm>`
        : ''}
    `;
  }
}

customElements.define('ed-notes', EdNotes);
