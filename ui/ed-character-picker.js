// ui/ed-character-picker.js — modal listing every character in the per-character
// store so the player can choose one to load, and start a new one.
//
// Presentational only (Tier-1 golden rule): it lists `characters` (the merged rows
// [{ id, name, portrait, draft? }] from store.js `listCharacters` plus the local drafts
// from store-drafts.js `listDrafts`, built by ed-app) and dispatches up:
//   `load-character { id }`      a row was chosen
//   `discard-draft { id }`       a draft's Discard was confirmed
//   `create-character { ... }`   (bubbles up from the nested <ed-new-character>)
// ed-app does the loading, creating and discarding. It opens both on first-run startup (no
// saved selection) and from the header icon, and it closes via `close` (Escape / backdrop /
// ✕). Built on the UI kit (docs/MODALS.md), kind `picker`.
//
// New-character section (create-new-adept): one "+" button per Discipline (`disciplines`,
// names from rules/disciplines.json), shown even when the list is empty. A "+" opens the
// nested <ed-new-character> modal (name + race, layer 2150); a draft row carries an "unsaved
// draft" badge and a Discard ✕ that opens an inline <ed-confirm>. A row is a wrapper holding
// two SIBLING buttons (load, Discard) — a <button> never nests in a <button>.
//
// Child modals are rendered in this shadow root, after the frame, and their `close` /
// `confirm` events are STOPPED here: they bubble composed, and an un-stopped `close` would
// reach ed-app's `@close` on <ed-character-picker> and shut the whole picker. Only the top
// modal closes (the kit stack routes Escape); focus returns to the "+" / ✕ that opened it.
//
// Tier-1 modal rules: Escape / backdrop close; Enter confirms (the list rows and new buttons
// are native <button>s, the kit focuses the first, so Enter activates it); theme-aware via
// light-dark(); two font weights only (400/500). Portrait thumbnails resolve through
// store.js `portraitUrlFor` (raw CDN on Pages, bundle-relative locally) and degrade to a
// name-initial placeholder on a missing/broken image (a draft has no portrait).
import { LitElement, html, css } from 'lit';
import { portraitUrlFor } from '../store.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import './ed-new-character.js';
import './ed-confirm.js';

export class EdCharacterPicker extends LitElement {
  static properties = {
    characters: { type: Array },
    current: { type: String },
    disciplines: { attribute: false }, // Discipline names (rules/disciplines.json) — one "+" each
    races: { attribute: false }, // race names (rules/races.json) for the new-character modal
    _newFor: { state: true }, // the Discipline whose new-character modal is open
    _discardFor: { state: true }, // the draft row whose discard confirm is open
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --danger: light-dark(#c0392b, #e06557);
      --text: light-dark(#111418, #f0f3f7);
    }
    .hint { font-size: var(--fs-fine); color: var(--muted); margin: 0 0 0.6rem; line-height: 1.4; }
    .list { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow-y: auto; }
    .rowwrap { display: flex; align-items: stretch; gap: 6px; }
    .row {
      display: flex; align-items: center; gap: 10px; flex: 1 1 auto; min-width: 0; text-align: left;
      padding: 8px 10px; border-radius: 8px; cursor: pointer; box-sizing: border-box;
      border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); color: var(--text);
      font: inherit; font-size: var(--fs-body);
    }
    .row:hover { border-color: var(--accent); }
    .row.current { border-color: var(--accent); background: var(--accent-bg); }
    .thumb { width: 38px; height: 38px; border-radius: 6px; flex: 0 0 auto; object-fit: cover; background: var(--accent-bg); }
    .thumb.fallback {
      display: flex; align-items: center; justify-content: center;
      font-weight: 500; color: var(--accent); font-size: var(--fs-value); text-transform: uppercase;
    }
    .who { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
    .nmline { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .nm { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .id { font-size: var(--fs-fine); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge {
      flex: 0 0 auto; padding: 1px 7px; border-radius: 999px; line-height: 1.4; white-space: nowrap;
      font-size: var(--fs-fine); font-weight: 500; color: var(--accent);
      background: var(--accent-bg); border: 1px solid var(--accent);
    }
    .rdiscard {
      flex: 0 0 auto; width: 34px; border-radius: 8px; cursor: pointer; padding: 0;
      border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); color: var(--muted);
      font: inherit; font-size: var(--fs-value); line-height: 1;
    }
    .rdiscard:hover { border-color: var(--danger); color: var(--danger); }
    .new { margin-top: 0.9rem; padding-top: 0.7rem; border-top: 1px solid var(--border); }
    .sec { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 0.45rem; }
    .newgrid { display: flex; flex-wrap: wrap; gap: 6px; }
    .newbtn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); color: var(--text);
      font: inherit; font-size: var(--fs-body);
    }
    .newbtn:hover { border-color: var(--accent); }
    .newbtn svg { width: 13px; height: 13px; flex: 0 0 auto; color: var(--accent); }
  `];

  constructor() {
    super();
    this.characters = [];
    this.current = null;
    this.disciplines = [];
    this.races = [];
    this._newFor = null;
    this._discardFor = null;
    this._refocusAfterDiscard = false;
    this._broken = new Set(); // ids whose portrait failed to load
    this._ctl = new ModalController(this, { kind: 'picker', onClose: () => this._close() });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  // After a discard the row (and the ✕ the focus would return to) is gone: re-run the kit's
  // initial-focus order once the shorter list has rendered, so focus stays inside the picker.
  updated(changed) {
    if (changed.has('characters') && this._refocusAfterDiscard) {
      this._refocusAfterDiscard = false;
      this._ctl.refocus();
    }
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _pick(id) {
    this.dispatchEvent(new CustomEvent('load-character', { detail: { id }, bubbles: true, composed: true }));
  }

  // A "+" button opened the new-character modal. Focus the button first so the modal's trigger
  // is that button even where a click does not focus it (Safari); the kit returns focus to it.
  _openNew(discipline, e) {
    e?.currentTarget?.focus?.();
    this._newFor = discipline;
  }

  _openDiscard(row, e) {
    e?.currentTarget?.focus?.();
    this._discardFor = { id: row.id, name: row?.name ?? row.id };
  }

  // The discard confirm said yes: dispatch up (ed-app removes the draft and its overlay).
  _confirmDiscard() {
    const target = this._discardFor;
    this._discardFor = null;
    if (!target) return;
    this._refocusAfterDiscard = true;
    this.dispatchEvent(new CustomEvent('discard-draft', { detail: { id: target.id }, bubbles: true, composed: true }));
  }

  _portraitError(id) {
    this._broken.add(id);
    this.requestUpdate();
  }

  // A row's thumbnail: the character's portrait via portraitUrlFor, degrading to
  // a name-initial placeholder when the path is empty or the image fails.
  _thumb(id, row) {
    const url = portraitUrlFor(row?.portrait);
    if (!url || this._broken.has(id)) {
      const initial = (row?.name ?? id).trim().charAt(0).toUpperCase();
      return html`<div class="thumb fallback" aria-hidden="true">${initial || '?'}</div>`;
    }
    return html`<img class="thumb" src=${url} alt="" loading="lazy" @error=${() => this._portraitError(id)} />`;
  }

  // One list row: the load button, and for a draft the sibling Discard button.
  _row(row) {
    const loaded = row.id === this.current;
    const facts = row.draft ? [row.race, row.discipline].filter(Boolean).join(' ') : '';
    return html`
      <div class="rowwrap">
        <button type="button" class="row ${loaded ? 'current' : ''}" @click=${() => this._pick(row.id)}>
          ${this._thumb(row.id, row)}
          <span class="who">
            <span class="nmline">
              <span class="nm">${row?.name ?? row.id}</span>
              ${row.draft ? html`<span class="badge">unsaved draft</span>` : ''}
            </span>
            <span class="id">${row.id}${facts ? ` · ${facts}` : ''}${loaded ? ' — loaded' : ''}</span>
          </span>
        </button>
        ${row.draft
          ? html`<button type="button" class="rdiscard" title="Discard this draft" aria-label=${`Discard draft ${row?.name ?? row.id}`}
              @click=${(e) => this._openDiscard(row, e)}>✕</button>`
          : ''}
      </div>`;
  }

  // "Start a new character": one "+" button per Discipline. Rendered only when the Disciplines
  // are known; shown with an empty list too (the first-run store).
  _newSection() {
    const disciplines = this.disciplines ?? [];
    if (!disciplines.length) return '';
    return html`
      <div class="new">
        <p class="sec">Start a new character</p>
        <div class="newgrid">
          ${disciplines.map((d) => html`
            <button type="button" class="newbtn" @click=${(e) => this._openNew(d, e)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              <span>${d}</span>
            </button>`)}
        </div>
      </div>`;
  }

  render() {
    const rows = [...(this.characters ?? [])].sort((a, b) => (a?.id ?? '').localeCompare(b?.id ?? ''));
    const canStart = (this.disciplines ?? []).length > 0;
    // The ids a new name must not take: every row (index + drafts). ed-app re-checks.
    const takenIds = rows.map((r) => r.id);
    return html`
      ${modalFrame(this._ctl, {
        title: 'Load a character',
        layer: 2100,
        width: '24rem',
        scroll: true,
        body: html`
          ${rows.length ? html`<p class="hint">Pick a character to load. The choice is remembered for the next visit.</p>` : ''}
          <div class="list">
            ${rows.map((row) => this._row(row))}
            ${rows.length === 0
              ? html`<p class="hint">${canStart ? 'No characters yet — start one below.' : 'No characters found.'}</p>`
              : ''}
          </div>
          ${this._newSection()}`,
      })}
      ${this._newFor
        ? html`<ed-new-character
            mode="create"
            .discipline=${this._newFor}
            .races=${this.races ?? []}
            .takenIds=${takenIds}
            @close=${(e) => { e.stopPropagation(); this._newFor = null; }}
          ></ed-new-character>`
        : ''}
      ${this._discardFor
        ? html`<ed-confirm
            heading="Discard this draft?"
            message=${`This removes the unsaved draft "${this._discardFor.name}" from this browser. Nothing has been saved to GitHub, so it can't be undone.`}
            confirmLabel="Discard"
            @confirm=${(e) => { e.stopPropagation(); this._confirmDiscard(); }}
            @close=${(e) => { e.stopPropagation(); this._discardFor = null; }}
          ></ed-confirm>`
        : ''}`;
  }
}

customElements.define('ed-character-picker', EdCharacterPicker);
