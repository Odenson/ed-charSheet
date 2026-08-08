// ui/ed-equipment.js — the Equipment tab. The character's owned items grouped by
// function (Weapons & Armour · Gear · Charms & Consumables) in a two-column board,
// plus a Wealth card (coins + gems). A searchable picker adds from the
// rules/items.json catalog in edit mode.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or derives game
// values. It reads the resolved items + wealth off the model and, on any change,
// dispatches the full *input* up to ed-app — `ed-edit-items` ([{ name, equipped,
// threadRank? }]) or `ed-edit-wealth` ({ coins, gems }) — which persists and
// re-derives so armour / initiative on the Overview and the wealth totals update
// through the normal cascade. Only thread items carry `threadRank` (their woven
// rank). Magic is *inferred* from an item's kind (magic-item / blood-charm /
// healing-aid / thread-item); it is never a stored per-item flag. Item detail
// lives behind a click-through modal styled to match the Disciplines talent modal.
import { LitElement, html, css, nothing } from 'lit';

const MAGIC_KINDS = new Set(['magic-item', 'blood-charm', 'healing-aid', 'thread-item']);
const KLABEL = {
  weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ammunition: 'Ammunition',
  gear: 'Gear', 'magic-item': 'Magic item', 'blood-charm': 'Blood charm', 'healing-aid': 'Healing aid',
  'thread-item': 'Thread item',
};
// Sections group items by function; magic is a property that can appear in any of
// them (a thread weapon glows in Weapons, a light quartz glows in Gear). Thread
// items get their own section so the woven rank is legible across all of them.
const SECTIONS = [
  { title: 'Weapons & Armour', glyph: '⚔', kinds: ['weapon', 'armor', 'shield', 'ammunition'] },
  { title: 'Gear', glyph: '🎒', kinds: ['gear', 'magic-item'] },
  { title: 'Thread Items', glyph: '✦', kinds: ['thread-item'] },
  { title: 'Charms & Consumables', glyph: '✦', kinds: ['blood-charm', 'healing-aid'] },
];

const isMagic = (it) => !!it && MAGIC_KINDS.has(it.kind);
const grp = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US');
const costText = (ref) => {
  const c = ref?.cost;
  if (c == null) return null;
  return typeof c === 'number' ? `${grp(c)} sp` : String(c);
};
const subLine = (it) => {
  if (!it) return 'unknown item';
  const base = KLABEL[it.kind] || it.kind;
  if (it.kind === 'weapon' && it.ref?.category) return `${base} · ${it.ref.category}`;
  // A thread item's sub-line names its woven rank — the single most useful
  // read on the tile (Tier is a reference detail, in the modal).
  if (it.thread) {
    const r = it.thread.threadRank ?? 0;
    return `${base} · ${r > 0 ? `Thread ${r}` : 'no thread woven'}`;
  }
  return base;
};

// Presentation-only: the equipped tile's one-line effect for the right-hand space.
// A curated `presentation.shortEffect` (note items) wins; otherwise derive a
// `Label +N` from the item's first numeric effect. This is display formatting of
// data the modal already shows — no game value is computed here.
const TILE_SUFFIX = { 'armor-modifier': 'Armour', 'defense-modifier': 'Defence', 'attack-modifier': '', 'test-modifier': 'Test' };
const deriveTileEffect = (effects) => {
  const e = (effects ?? []).find((x) => x.type in TILE_SUFFIX && typeof x.value === 'number');
  if (!e) return null;
  const val = (e.operation === 'subtract' ? '-' : '+') + Math.abs(e.value);
  const name = e.target?.name ?? '';
  const suffix = TILE_SUFFIX[e.type];
  return { label: suffix ? `${name} ${suffix}` : name, val };
};
const tileEffect = (it) => {
  const short = it?.presentation?.shortEffect;
  return short ? { text: short } : deriveTileEffect(it?.effects);
};

// Modal presentation-only formatters. The detail modal renders four zones in a
// fixed order for every item — base-ref chips · main-effect chips · white notes ·
// green situational — so items read consistently. None of this computes a game
// value; it only formats effect/ref data the engine already resolved.
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const prettyName = (n) => (n ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
const EFFECT_SUFFIX = { 'armor-modifier': 'Armour', 'defense-modifier': 'Defence', 'attack-modifier': '', 'test-modifier': 'Test', 'characteristic-modifier': '' };
// A short `Label ±N` chip for an always-on numeric modifier (the item's main effect).
const modifierChip = (e) => {
  const val = (e.operation === 'subtract' ? '−' : '+') + Math.abs(e.value);
  const suffix = EFFECT_SUFFIX[e.type] ?? '';
  const name = prettyName(e.target?.name);
  return { v: `${suffix ? `${name} ${suffix}` : name} ${val}`.trim() };
};

export class EdEquipment extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { attribute: false },
    _modal: { state: true },      // owned item name whose detail is open
    _addOpen: { state: true },    // searchable picker visible
    _query: { state: true },      // picker search text
    _hi: { state: true },         // highlighted picker result index
    _coinMenu: { state: true },   // "add coin" menu open
    _shownCoins: { state: true }, // coin keys pinned visible at 0 (edit mode)
  };

  constructor() {
    super();
    this._modal = null;
    this._addOpen = false;
    this._query = '';
    this._hi = 0;
    this._coinMenu = false;
    this._shownCoins = new Set();
    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this._modal) { e.stopPropagation(); this._closeModal(); }
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  // Drop keyboard focus from the trigger tile so an Escape close ends the same way a
  // mouse close does — otherwise the item button keeps :focus-visible (accent outline)
  // after the modal is gone. Matches ed-overview's _closeModal.
  _closeModal() {
    this.renderRoot.activeElement?.blur();
    this._modal = null;
  }

  updated(changed) {
    // Focus the search field the moment the picker opens, so typing filters at once.
    if (changed.has('_addOpen') && this._addOpen) {
      this.renderRoot.querySelector('.combo input')?.focus();
    }
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
      --arcane: light-dark(#6c3fb5, #b98cff);
      --arcane-line: light-dark(#9a6ee0, #b98cff);
      --arcane-bg: light-dark(#efe7fb, #2a2140);
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
      --danger: light-dark(#c0392b, #e57373);
      --shadow: 0 10px 30px light-dark(rgba(20, 24, 33, 0.18), rgba(0, 0, 0, 0.5));
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: block;
    }

    /* Add bar */
    .addbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; position: relative; }
    .addbtn { font: inherit; font-size: 0.82rem; font-weight: 500; cursor: pointer; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); padding: 8px 14px; border-radius: 9px; white-space: nowrap; }
    .addbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .combo { position: relative; flex: 1; min-width: 0; }
    .combo input { width: 100%; font: inherit; font-size: 0.88rem; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--accent); border-radius: 9px; padding: 8px 11px; outline: none; }
    .drop { position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 20; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); max-height: 300px; overflow-y: auto; padding: 6px; }
    .res { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
    .res:hover, .res.hi { background: var(--bg-chip); border-color: var(--border); }
    .res .rk { font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 84px; flex: 0 0 84px; }
    .res.mg .rk { color: var(--arcane); }
    .res .rn { font-size: 0.86rem; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .res.owned { opacity: 0.45; }
    .res .star { color: var(--arcane); width: 12px; }
    .nores { padding: 20px; text-align: center; color: var(--muted); font-size: 0.85rem; }

    /* Two-column board — each column is an independent stack (CSS multi-column),
       so sections sit flush under the one above and never wait on the block
       across the gap (a grid's shared row track would push them down together). */
    .board { column-count: 2; column-gap: 12px; }
    .blk { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 11px 13px; break-inside: avoid; margin-bottom: 12px; }
    .blk > h4 { display: flex; align-items: center; gap: 8px; font-size: 0.62rem; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 2px 2px 9px; }
    .blk > h4 .ct { margin-left: auto; color: var(--muted); font-weight: 400; letter-spacing: 0; }
    .blk > h4 .total { margin-left: auto; color: var(--accent); font-weight: 500; letter-spacing: 0; font-family: var(--mono); font-size: 0.76rem; }
    .glyph { font-size: 0.82rem; color: var(--accent); }

    .item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 9px; background: var(--bg-chip); border: 1px solid var(--border); margin-bottom: 6px; }
    .item:last-child { margin-bottom: 0; }
    .item.stored { opacity: 0.6; }
    .item.compact { padding-top: 4px; padding-bottom: 4px; }
    .iteminfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: var(--fg); }
    .iteminfo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
    .nm { font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item.magic .nm { color: var(--arcane); }
    .nm .star { color: var(--arcane); font-size: 0.76rem; }
    .sub { font-size: 0.62rem; color: var(--muted); }
    .eq { font: inherit; font-size: 0.66rem; font-weight: 500; border: 1px solid var(--border); background: var(--bg-card); color: var(--muted); padding: 4px 11px; border-radius: 999px; cursor: pointer; flex: 0 0 auto; white-space: nowrap; }
    .eq.on { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }
    .eq:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .statechip { font-size: 0.62rem; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; }
    /* Quiet main-effect on the right of an equipped tile: notes read as plain muted
       text; numeric effects emphasise the value. */
    .quiet { font-size: 0.72rem; color: var(--muted); white-space: nowrap; flex: 0 0 auto; text-align: right; }
    .quiet b { font-weight: 500; color: var(--accent); font-family: var(--mono); }
    .del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.92rem; line-height: 1; padding: 2px 4px; border-radius: 6px; }
    .del:hover { color: var(--danger); }
    .del:focus-visible { outline: 2px solid var(--danger); outline-offset: 1px; }
    .empty { color: var(--muted); font-size: 0.78rem; padding: 3px 2px; }

    /* Wealth */
    .subh { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 500; margin: 2px 2px 6px; }
    .subh.arc { color: var(--arcane); }
    .coingroup { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-bottom: 10px; }
    .coin { display: flex; align-items: center; gap: 7px; background: var(--bg-chip); border: 1px solid var(--border); border-radius: 9px; padding: 4px 6px 4px 10px; }
    .coin.ro { padding: 4px 10px; }
    .coin.elem { border-color: var(--arcane-line); }
    .coin .clab { font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 500; }
    .coin.elem .clab { color: var(--arcane); }
    .coin .cval { font-size: 0.9rem; font-weight: 500; font-family: var(--mono); }
    .coin input { width: 62px; font: inherit; font-size: 0.9rem; font-weight: 500; font-family: var(--mono); color: var(--fg); background: transparent; border: none; border-bottom: 1px solid var(--border); padding: 1px 0; outline: none; text-align: right; }
    .coin input:focus { border-bottom-color: var(--accent); }
    .coin .crm { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.7rem; line-height: 1; padding: 2px 3px; border-radius: 5px; }
    .coin .crm:hover { color: var(--danger); }
    .addcoin { position: relative; }
    .addcoin > button { font: inherit; font-size: 0.72rem; border: 1px dashed var(--border); background: none; color: var(--muted); border-radius: 9px; padding: 5px 11px; cursor: pointer; }
    .addcoin > button:hover { border-color: var(--accent); color: var(--accent); }
    .coinmenu { position: absolute; z-index: 15; top: calc(100% + 5px); left: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); padding: 5px; min-width: 170px; }
    .coinmenu .mgh { font-size: 0.52rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 5px 8px 3px; }
    .coinmenu button { display: flex; justify-content: space-between; gap: 12px; width: 100%; font: inherit; font-size: 0.78rem; border: none; background: none; color: var(--fg); padding: 6px 8px; border-radius: 6px; cursor: pointer; text-align: left; }
    .coinmenu button:hover { background: var(--bg-chip); }
    .coinmenu button .mr { color: var(--muted); font-family: var(--mono); font-size: 0.68rem; }
    .coinmenu button.arc { color: var(--arcane); }
    .gems { display: flex; flex-direction: column; gap: 6px; }
    .gem { display: flex; align-items: center; gap: 9px; background: var(--bg-chip); border: 1px solid var(--border); border-radius: 9px; padding: 6px 9px; }
    .gem .gn { flex: 1; min-width: 0; font-size: 0.83rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gem .gq { font-size: 0.62rem; color: var(--muted); font-family: var(--mono); }
    .gem .gv { font-size: 0.72rem; color: var(--muted); font-family: var(--mono); white-space: nowrap; }
    .gem .gdel { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 2px 4px; border-radius: 6px; }
    .gem .gdel:hover { color: var(--danger); }
    .gemadd { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .gemadd input { font: inherit; font-size: 0.8rem; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; outline: none; min-width: 0; }
    .gemadd input:focus { border-color: var(--accent); }
    .gemadd .gname { flex: 1 1 100px; }
    .gemadd .gvalw { width: 78px; flex: 0 0 auto; }
    .gemadd .gqtyw { width: 52px; flex: 0 0 auto; }
    .gemadd button { font: inherit; font-size: 0.76rem; font-weight: 500; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); border-radius: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap; }
    .resale { font-size: 0.66rem; color: var(--muted); margin: 8px 2px 0; }

    /* Detail modal — matches the Disciplines talent modal. */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; max-width: 30rem; width: 100%; max-height: 85vh; overflow: auto; padding: 14px 16px; }
    .modal.magic { box-shadow: var(--shadow); }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
    .mtitle { display: inline-flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 500; }
    .modal.magic .mtitle { color: var(--arcane); }
    .mtitle .star { color: var(--arcane); font-size: 0.76rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1rem; line-height: 1; cursor: pointer; }
    .mchips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { font-size: 0.62rem; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; }
    .chip.effc { color: var(--accent); background: var(--accent-bg); border-color: transparent; }
    .chip.mag { color: var(--arcane); background: var(--arcane-bg); border-color: transparent; }
    .mtext { font-size: 0.82rem; line-height: 1.5; margin: 6px 0; }
    /* Flavour description (layer 1) reads as italic lore; the effect paragraph
       (layer 2, .mtext) carries the rules in plain text. */
    .mdesc { font-size: 0.82rem; line-height: 1.5; margin: 6px 0; font-style: italic; color: var(--muted); }
    .mact { display: flex; align-items: center; gap: 10px; margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
    .mact .spacer { flex: 1; }
    /* Thread-item rank list — woven ranks are accent-tinted, unwoven muted. */
    .mthread { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 9px; display: flex; flex-direction: column; gap: 6px; }
    .trk { border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; font-size: 0.74rem; line-height: 1.45; color: var(--muted); }
    .trk.woven { border-color: var(--arcane-line); background: var(--arcane-bg); color: var(--fg); }
    .trh { display: inline-block; font-size: 0.6rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--arcane); margin-bottom: 2px; }
    .tkey { font-style: italic; color: var(--muted); }
    .teff { color: inherit; }
    .eq.rank { font-size: 0.62rem; padding: 3px 8px; background: var(--bg-card); }

    @media (max-width: 620px) {
      .board { column-count: 1; }
    }
  `;

  // Items as the *input* shape the character stores. Only thread items carry
  // `threadRank` (a woven-rank input); toggling equipment or editing the rank
  // must never drop it, and non-thread items keep their plain entry.
  _inputs() {
    return (this.model?.items ?? []).map((it) => ({
      name: it.name,
      equipped: it.equipped,
      ...(it.thread ? { threadRank: it.thread.threadRank } : {}),
    }));
  }
  _commitItems(items) {
    this.dispatchEvent(new CustomEvent('ed-edit-items', { detail: items, bubbles: true, composed: true }));
  }
  _add(name) {
    if (!name || this._inputs().some((i) => i.name === name)) return;
    this._commitItems([...this._inputs(), { name, equipped: true }]);
  }
  _remove(name) {
    this._commitItems(this._inputs().filter((i) => i.name !== name));
    if (this._modal === name) this._modal = null;
  }
  _toggle(name) {
    this._commitItems(this._inputs().map((i) => (i.name === name ? { ...i, equipped: !i.equipped } : i)));
  }
  // A thread item's woven rank is an input; the select dispatches it upward and the
  // whole sheet re-derives (effects, Legend audit) through the normal cascade.
  _setThreadRank(name, rank) {
    this._commitItems(this._inputs().map((i) => (i.name === name ? { ...i, threadRank: rank } : i)));
  }

  // --- wealth commits (dispatch the full { coins, gems } input) ---
  _wealth() { return this.model?.wealth ?? {}; }
  _commitWealth(next) {
    this.dispatchEvent(new CustomEvent('ed-edit-wealth', { detail: next, bubbles: true, composed: true }));
  }
  _setCoin(key, raw) {
    const coins = { ...(this._wealth().coins ?? {}) };
    coins[key] = Math.max(0, parseInt(raw || '0', 10) || 0);
    this._commitWealth({ coins, gems: this._wealth().gems ?? [] });
  }
  _removeCoin(key) {
    const coins = { ...(this._wealth().coins ?? {}) };
    coins[key] = 0;
    const shown = new Set(this._shownCoins); shown.delete(key); this._shownCoins = shown;
    this._commitWealth({ coins, gems: this._wealth().gems ?? [] });
  }
  _pinCoin(key) {
    const shown = new Set(this._shownCoins); shown.add(key); this._shownCoins = shown;
    this._coinMenu = false;
  }
  _addGem() {
    const root = this.renderRoot;
    const name = (root.getElementById('gName')?.value || '').trim();
    const valueSilver = Math.max(0, parseInt(root.getElementById('gVal')?.value || '0', 10) || 0);
    const qty = Math.max(1, parseInt(root.getElementById('gQty')?.value || '1', 10) || 1);
    if (!name) return;
    this._commitWealth({ coins: this._wealth().coins ?? {}, gems: [...(this._wealth().gems ?? []), { name, valueSilver, qty }] });
    ['gName', 'gVal', 'gQty'].forEach((id) => { const el = root.getElementById(id); if (el) el.value = id === 'gQty' ? '1' : ''; });
    root.getElementById('gName')?.focus();
  }
  _removeGem(i) {
    this._commitWealth({ coins: this._wealth().coins ?? {}, gems: (this._wealth().gems ?? []).filter((_, j) => j !== i) });
  }

  // --- picker ---
  // Thread items live in their own catalogue (rules/thread-items.json); the picker
  // offers both catalogues, tagging each with its kind for the left-hand label.
  _catalogs() {
    return {
      ...(this.model?.itemCatalog ?? {}),
      ...(this.model?.threadItemCatalog ?? {}),
    };
  }
  _matches() {
    const q = this._query.trim().toLowerCase();
    const catalog = this._catalogs();
    return Object.keys(catalog)
      .filter((n) => {
        if (!q) return true;
        const it = catalog[n];
        // Effect entries are objects carrying a `summary`; reduce every catalog
        // shape (plain `effects`, thread `base`/`threadRanks`) to strings first,
        // so the search always compares text.
        const summaries = [
          ...(it.effects ?? []).map((e) => e.summary ?? ''),
          ...(it.base?.effects ?? []).map((e) => e.summary ?? ''),
          ...(it.threadRanks ?? []).flatMap((r) => r.effects ?? []).map((e) => e.summary ?? ''),
        ];
        return n.toLowerCase().includes(q) || (KLABEL[it.kind] || '').toLowerCase().includes(q) ||
          summaries.some((s) => s.toLowerCase().includes(q));
      })
      .slice(0, 50);
  }
  _pickKeydown(e) {
    const list = this._matches();
    if (e.key === 'ArrowDown') { this._hi = Math.min(this._hi + 1, list.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { this._hi = Math.max(this._hi - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter' && list[this._hi]) { this._add(list[this._hi]); }
    else if (e.key === 'Escape') { this._addOpen = false; }
  }

  _itemRow(it) {
    const mg = isMagic(it);
    const stored = !it.equipped;
    // Stored items sink to the bottom of their section and collapse to just the
    // name — the type/effect detail is a click away in the modal.
    const cls = `item ${mg ? 'magic' : ''} ${stored ? 'stored compact' : ''}`;
    // The right-hand quiet effect shows on equipped tiles in read mode; edit mode
    // gives that space to the toggle + remove instead.
    const eff = !stored && !this.editMode ? tileEffect(it) : null;
    // A thread item's woven rank is an *input*; the select feeds _setThreadRank,
    // which dispatches it up so the engine re-derives effects + Legend cost.
    const thread = it.thread;
    const rankSelect = thread
      ? html`<select class="eq rank" aria-label="Woven thread rank for ${it.name}"
            .value=${String(thread.threadRank ?? 0)} @change=${(e) => this._setThreadRank(it.name, Number(e.target.value))}>
            ${[0, ...thread.threadRanks.map((r) => r.rank)].map((r) =>
              html`<option value=${r}>${r === 0 ? 'No thread' : `Thread ${r}`}</option>`)}
          </select>`
      : '';
    return html`
      <div class=${cls}>
        <button class="iteminfo" @click=${() => (this._modal = it.name)} title="View ${it.name} details">
          <span class="nm">${mg ? html`<span class="star" aria-hidden="true">✦</span>` : ''}${it.name}</span>
          ${stored ? nothing : html`<span class="sub">${subLine(it)}</span>`}
        </button>
        ${eff
          ? html`<span class="quiet">${eff.text != null ? eff.text : html`${eff.label} <b>${eff.val}</b>`}</span>`
          : ''}
        ${this.editMode
          ? html`
              ${rankSelect}
              <button class="eq ${it.equipped ? 'on' : ''}" @click=${() => this._toggle(it.name)}
                title=${it.equipped ? 'On the character — click to store' : 'Owned but not carried — click to equip'}>
                ${it.equipped ? 'Equipped' : 'Stored'}
              </button>
              <button class="del" aria-label="Remove ${it.name}" title="Remove ${it.name}" @click=${() => this._remove(it.name)}>✕</button>
            `
          : it.equipped
            ? nothing
            : html`<span class="statechip">Stored</span>`}
      </div>
    `;
  }

  _section(sec, items) {
    const rows = items.filter((it) => sec.kinds.includes(it.kind));
    // Equipped items first (in their existing order), stored items last.
    const ordered = [...rows.filter((it) => it.equipped), ...rows.filter((it) => !it.equipped)];
    return html`
      <div class="blk">
        <h4><span class="glyph">${sec.glyph}</span>${sec.title}<span class="ct">${rows.length}</span></h4>
        ${ordered.length ? ordered.map((it) => this._itemRow(it)) : html`<div class="empty">— nothing here —</div>`}
      </div>
    `;
  }

  _coinTile(d, count) {
    if (!this.editMode) {
      return html`<div class="coin ro ${d.elemental ? 'elem' : ''}"><span class="clab">${d.label}</span><span class="cval">${grp(count)}</span></div>`;
    }
    return html`
      <div class="coin ${d.elemental ? 'elem' : ''}">
        <span class="clab" title="×${grp(d.rate)} sp each">${d.label}</span>
        <input type="number" min="0" step="1" .value=${String(count)} aria-label="${d.label} coins"
          @change=${(e) => this._setCoin(d.key, e.target.value)} />
        <button class="crm" aria-label="Remove ${d.label}" title="Remove ${d.label}" @click=${() => this._removeCoin(d.key)}>✕</button>
      </div>
    `;
  }

  _wealthCard() {
    const w = this._wealth();
    const denoms = w.denominations ?? [];
    const coins = w.coins ?? {};
    const gems = w.gems ?? [];
    const visible = (d) => (Number(coins[d.key]) || 0) > 0 || (this.editMode && this._shownCoins.has(d.key));
    const metal = denoms.filter((d) => !d.elemental && visible(d));
    const elem = denoms.filter((d) => d.elemental && visible(d));
    const hidden = denoms.filter((d) => !((Number(coins[d.key]) || 0) > 0) && !this._shownCoins.has(d.key));
    const hm = hidden.filter((d) => !d.elemental);
    const he = hidden.filter((d) => d.elemental);

    return html`
      <div class="blk">
        <h4><span class="glyph">💰</span>Wealth<span class="total">≈ ${grp(w.totalSilver ?? 0)} sp</span></h4>

        <div class="subh">Metal coins</div>
        <div class="coingroup">
          ${metal.length ? metal.map((d) => this._coinTile(d, coins[d.key] ?? 0)) : html`<span class="empty">None.</span>`}
          ${this.editMode && hidden.length
            ? html`
                <div class="addcoin">
                  <button type="button" @click=${(e) => { e.stopPropagation(); this._coinMenu = !this._coinMenu; }}>＋ Add coin</button>
                  ${this._coinMenu
                    ? html`<div class="coinmenu">
                        ${hm.length ? html`<div class="mgh">Metal</div>${hm.map((d) => html`<button @click=${() => this._pinCoin(d.key)}>${d.label}<span class="mr">×${grp(d.rate)} sp</span></button>`)}` : ''}
                        ${he.length ? html`<div class="mgh">Elemental</div>${he.map((d) => html`<button class="arc" @click=${() => this._pinCoin(d.key)}>${d.label}<span class="mr">×${grp(d.rate)} sp</span></button>`)}` : ''}
                      </div>`
                    : ''}
                </div>
              `
            : ''}
        </div>

        ${elem.length
          ? html`<div class="subh arc">Elemental coins</div><div class="coingroup">${elem.map((d) => this._coinTile(d, coins[d.key] ?? 0))}</div>`
          : ''}

        <div class="subh">Gems &amp; stones — value in silver</div>
        <div class="gems">
          ${gems.length
            ? gems.map((g, i) => html`
                <div class="gem">
                  <span class="gn">${g.name}</span>
                  <span class="gq">×${g.qty ?? 1}</span>
                  <span class="gv">${grp(g.valueSilver)} sp${(g.qty ?? 1) > 1 ? html` → ${grp((g.valueSilver || 0) * (g.qty || 1))} sp` : ''}</span>
                  ${this.editMode ? html`<button class="gdel" aria-label="Remove ${g.name}" title="Remove ${g.name}" @click=${() => this._removeGem(i)}>✕</button>` : ''}
                </div>`)
            : html`<div class="empty">No gems recorded.</div>`}
        </div>
        ${this.editMode
          ? html`<div class="gemadd">
              <input class="gname" id="gName" placeholder="Gem or stone…" aria-label="Gem name" />
              <input class="gvalw" id="gVal" type="number" min="0" placeholder="value" aria-label="Value in silver" />
              <input class="gqtyw" id="gQty" type="number" min="1" .value=${'1'} placeholder="qty" aria-label="Quantity" />
              <button @click=${this._addGem}>Add</button>
            </div>`
          : ''}
        ${(w.gemTotalSilver ?? 0) > 0
          ? html`<p class="resale">Gems ≈ ${grp(w.gemTotalSilver)} sp · resale ≈ ${grp(w.gemResaleSilver)} sp (70–80%)</p>`
          : ''}
      </div>
    `;
  }

  _detailModal(it) {
    const mg = isMagic(it);
    const ref = it.ref ?? {};
    // ① Base-ref chips — fixed order, each labelled, shown only when present.
    // (Magic is marked by the ✦ star, not a chip; damageStep is covered by the
    // Damage main-effect chip below, so neither is repeated here.)
    const baseChips = [
      { v: subLine(it) },
      it.living ? { v: 'Living' } : null,
      ref.category && it.kind !== 'weapon' ? { v: cap(ref.category) } : null,
      costText(ref) ? { v: `Cost ${costText(ref)}` } : null,
      ref.weight ? { v: `Weight ${ref.weight}` } : null,
      ref.availability ? { v: `Availability ${ref.availability}` } : null,
      ref.strMin != null ? { v: `STR min ${ref.strMin}` } : null,
      ref.size != null ? { v: `Size ${ref.size}` } : null,
      ref.range ? { v: `Range ${ref.range}` } : null,
      ref.shatterThreshold != null ? { v: `Shatter ${ref.shatterThreshold}` } : null,
      ref.craftingDifficultyNumber != null ? { v: `Craft DN ${ref.craftingDifficultyNumber}` } : null,
    ].filter(Boolean);
    const effects = it.known ? (it.effects ?? []).filter((e) => e.summary) : [];
    const always = (e) => (e.condition ?? 'always') !== 'situational';
    // ② Main-effect chips — always-on numeric modifiers as a short `Label ±N`
    // quick-read; their full wording also lands in the summary paragraph below.
    const mainChips = effects.filter((e) => e.type !== 'note' && always(e) && typeof e.value === 'number').map(modifierChip);
    // Thread items add a reference zone: tier · mystic defense · max threads ·
    // legendary, plus the per-rank key knowledges/effects (the woven rank is the
    // rank select, shown in edit mode).
    const th = it.thread;
    const threadChips = th
      ? [
          th.tier ? { v: `Tier ${th.tier}` } : null,
          th.mysticDefense != null ? { v: `MD ${th.mysticDefense}` } : null,
          th.maximumThreads != null ? { v: `Max threads ${th.maximumThreads}` } : null,
          th.legendary ? { v: 'Legendary' } : null,
        ].filter(Boolean)
      : [];
    // Two paragraphs after the chips: (1) the item's flavour description, (2) every
    // effect summary accumulated into one paragraph. Each summary is defensively
    // terminated so authored punctuation gaps don't run sentences together.
    const description = ref.description ?? null;
    const effectText = effects.map((e) => e.summary.trim()).map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' ');
    return html`
      <div class="overlay" @click=${() => (this._modal = null)}>
        <div class="modal ${mg ? 'magic' : ''}" role="dialog" aria-modal="true" aria-label=${it.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">${mg ? html`<span class="star" aria-hidden="true">✦</span>` : ''}${it.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._modal = null)}>✕</button>
          </div>
          <div class="mchips">
            ${baseChips.map((c) => html`<span class="chip">${c.v}</span>`)}
            ${threadChips.map((c) => html`<span class="chip mag">${c.v}</span>`)}
            ${mainChips.map((c) => html`<span class="chip effc">${c.v}</span>`)}
          </div>
          ${!it.known
            ? html`<div class="mtext" style="color: var(--muted)">Not in the catalog — contributes nothing to the sheet.</div>`
            : html`
                ${description ? html`<p class="mdesc">${description}</p>` : ''}
                ${effectText ? html`<p class="mtext">${effectText}</p>` : ''}
                ${!description && !effectText && !mainChips.length
                  ? html`<div class="mtext" style="color: var(--muted)">No special rules — reference gear.</div>`
                  : ''}
                ${th
                  ? html`<div class="mthread">
                      ${th.threadRanks.map((r) => {
                        const rr = (r.effects ?? []).map((e) => e.summary).filter(Boolean).map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' ');
                        return html`<div class="trk ${r.rank <= th.threadRank ? 'woven' : ''}">
                            <span class="trh">Thread ${r.rank}</span>
                            ${r.keyKnowledge ? html`<div class="tkey">${r.keyKnowledge}</div>` : ''}
                            ${rr ? html`<div class="teff">${rr}</div>` : ''}
                          </div>`;
                      })}
                      ${th.threadRank === 0 ? html`<div class="trk"><span class="trh">No thread woven</span><div class="teff">Rank effects are inactive until a thread is woven.</div></div>` : ''}
                    </div>`
                  : ''}
              `}
          ${this.editMode
            ? html`<div class="mact">
                <button class="eq ${it.equipped ? 'on' : ''}" @click=${() => this._toggle(it.name)}>${it.equipped ? 'Equipped' : 'Stored'}</button>
                <span class="spacer"></span>
                <button class="del" @click=${() => this._remove(it.name)} style="font-size:0.8rem">Remove item</button>
              </div>`
            : ''}
        </div>
      </div>
    `;
  }

  render() {
    const m = this.model;
    if (!m) return html``;
    const items = m.items ?? [];
    const catalog = this._catalogs();
    const modalItem = this._modal ? items.find((it) => it.name === this._modal) : null;

    return html`
      ${this.editMode
        ? html`
            <div class="addbar">
              ${this._addOpen
                ? html`
                    <div class="combo">
                      <input type="text" placeholder="Search items by name, type, or effect…" .value=${this._query}
                        aria-label="Find item" @input=${(e) => { this._query = e.target.value; this._hi = 0; }} @keydown=${this._pickKeydown} />
                      <div class="drop">
                        ${this._matches().length
                          ? this._matches().map((n, i) => {
                              const it = catalog[n]; const mg = MAGIC_KINDS.has(it.kind); const owned = this._inputs().some((x) => x.name === n);
                              return html`<div class="res ${mg ? 'mg' : ''} ${i === this._hi ? 'hi' : ''} ${owned ? 'owned' : ''}"
                                @click=${() => this._add(n)}>
                                <span class="rk">${KLABEL[it.kind] || it.kind}</span>
                                <span class="star">${mg ? '✦' : ''}</span>
                                <span class="rn">${n}</span>
                              </div>`;
                            })
                          : html`<div class="nores">No item matches “${this._query}”.</div>`}
                      </div>
                    </div>
                    <button class="addbtn" @click=${() => { this._addOpen = false; this._query = ''; }}>Done</button>
                  `
                : html`<button class="addbtn" @click=${() => { this._addOpen = true; this._query = ''; this._hi = 0; }}>＋ Add item</button>`}
            </div>
          `
        : ''}

      <div class="board">
        ${SECTIONS.map((sec) => this._section(sec, items))}
        ${this._wealthCard()}
      </div>

      ${modalItem ? this._detailModal(modalItem) : ''}
    `;
  }
}

customElements.define('ed-equipment', EdEquipment);
