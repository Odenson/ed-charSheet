// ui/ed-equipment.js — the Equipment tab: the character's owned items (armour,
// shields, …) and, in edit mode, an "add item" control driven by the
// rules/items.json catalog.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or derives
// game values. It reads the resolved items + catalog off the model, and on any
// change dispatches `ed-edit-items` up to ed-app with the full *input* array
// ([{ name, equipped }]) — ed-app persists the overlay and re-derives, so armour
// / initiative on the Overview update through the normal cascade. The item stat
// chips shown here are the catalog effects' own summaries, not re-derived here.
import { LitElement, html, css, nothing } from 'lit';

export class EdEquipment extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { attribute: false },
    _pick: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --text: light-dark(#111418, #f0f3f7);
      display: block;
    }
    .blk { background: var(--bg-card); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
    .blk h4 { margin: 0 0 8px; font-size: 0.62rem; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: var(--bg-chip); border: 1px solid var(--border); margin-bottom: 6px; }
    .row.off { opacity: 0.55; }
    .nm { font-size: 0.9rem; font-weight: 500; }
    .kind { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); background: var(--accent-bg); padding: 2px 7px; border-radius: 999px; }
    .live { font-size: 0.58rem; color: var(--muted); border: 1px solid var(--border); padding: 2px 6px; border-radius: 999px; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-left: 2px; }
    .chip { font-size: 0.66rem; color: var(--muted); background: var(--bg-card); border: 1px solid var(--border); padding: 1px 7px; border-radius: 999px; }
    .warn { font-size: 0.66rem; color: #c0392b; }
    .spacer { flex: 1; }
    .btn { font: inherit; font-size: 0.78rem; padding: 4px 10px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    .btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .toggle { font-size: 0.66rem; display: flex; align-items: center; gap: 5px; color: var(--muted); cursor: pointer; user-select: none; }
    .del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 2px 4px; }
    .del:hover { color: #c0392b; }
    .add { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
    select { font: inherit; font-size: 0.82rem; color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; flex: 1; min-width: 0; }
    .empty { color: var(--muted); font-size: 0.85rem; padding: 0.5rem 0.25rem; }
    .hint { font-size: 0.68rem; color: var(--muted); margin: 6px 0 0; }
  `;

  // Current items as the *input* shape the character stores.
  _inputs() {
    return (this.model?.items ?? []).map((it) => ({ name: it.name, equipped: it.equipped }));
  }

  _commit(items) {
    this.dispatchEvent(new CustomEvent('ed-edit-items', { detail: items, bubbles: true, composed: true }));
  }

  _add() {
    const name = this._pick || Object.keys(this.model?.itemCatalog ?? {})[0];
    if (!name) return;
    this._commit([...this._inputs(), { name, equipped: true }]);
  }

  _remove(i) {
    const items = this._inputs();
    items.splice(i, 1);
    this._commit(items);
  }

  _toggle(i) {
    const items = this._inputs();
    items[i] = { ...items[i], equipped: !items[i].equipped };
    this._commit(items);
  }

  _itemRow(it, i) {
    return html`
      <div class="row ${it.equipped ? '' : 'off'}">
        <span class="nm">${it.name}</span>
        <span class="kind">${it.kind}</span>
        ${it.living ? html`<span class="live" title="Living armour">living</span>` : ''}
        <span class="chips">
          ${it.known
            ? (it.effects ?? []).map((e) => html`<span class="chip">${e.summary ?? e.type}</span>`)
            : html`<span class="warn" title="No catalog entry — contributes nothing">unknown item</span>`}
        </span>
        <span class="spacer"></span>
        ${this.editMode
          ? html`
              <label class="toggle" title="Equipped items apply their effects">
                <input type="checkbox" .checked=${it.equipped} @change=${() => this._toggle(i)} />equipped
              </label>
              <button class="del" title="Remove ${it.name}" aria-label="Remove ${it.name}" @click=${() => this._remove(i)}>✕</button>
            `
          : it.equipped
            ? nothing
            : html`<span class="chip">unequipped</span>`}
      </div>
    `;
  }

  render() {
    const m = this.model;
    if (!m) return html``;
    const items = m.items ?? [];
    const catalog = m.itemCatalog ?? {};
    const names = Object.keys(catalog);

    return html`
      <div class="blk">
        <h4>Equipment</h4>
        ${items.length
          ? items.map((it, i) => this._itemRow(it, i))
          : html`<div class="empty">No items yet.${this.editMode ? '' : ' Turn on edit mode to add some.'}</div>`}
        ${this.editMode && names.length
          ? html`
              <div class="add">
                <select @change=${(e) => (this._pick = e.target.value)} .value=${this._pick ?? ''}>
                  ${names.map((n) => html`<option value=${n}>${n} — ${catalog[n].kind}</option>`)}
                </select>
                <button class="btn primary" @click=${this._add}>Add item</button>
              </div>
              <p class="hint">Adds to this browser's saved copy. Equipped items feed Armour, Defences, and Initiative on the Overview.</p>
            `
          : ''}
      </div>
    `;
  }
}

customElements.define('ed-equipment', EdEquipment);
