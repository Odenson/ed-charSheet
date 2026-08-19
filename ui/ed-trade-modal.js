// ui/ed-trade-modal.js — the buy/sell dialog behind every owned-item edit on the
// Equipment tab (plans/PLAN-TRADE-ITEMS.md). View-local UI state ONLY: it holds
// the item being traded, the editable amount, and the player's coin/gem
// allocation; it never writes state or computes derived values itself — the
// running totals reuse the engine's coinsSilver/gemsSilver, and on confirm it
// dispatches `confirm` ({ mode, itemName, amount, alloc }) so the Equipment view
// can compute the next inputs + purse and dispatch the single atomic `ed-trade`.
//
// Tier-1 modal rules: Escape / Cancel / backdrop close; Enter confirms (the
// primary button is autofocused when the action is allowed, Cancel otherwise);
// theme-aware light+dark with two font weights; amounts are silver at copper
// granularity (multiples of 0.1 sp) and never fabricated — an unparseable cost
// resolves to 0 via engine/wealth.js costSilver.
import { LitElement, html, css } from 'lit';
import { coinsSilver, gemsSilver, costSilver } from '../engine/wealth.js';
import { PICKER_LABELS } from './picker.js';
import { numFmt } from './format.js';

// Aggregated per-identity gem rows: matched by (name, valueSilver), oldest first.
const gemOptions = (gems = []) => {
  const byId = new Map();
  for (const g of gems) {
    if (!g || typeof g !== 'object') continue;
    const key = `${g.name}|${Number(g.valueSilver) || 0}`;
    const row = byId.get(key) ?? { name: String(g.name), valueSilver: Number(g.valueSilver) || 0, owned: 0 };
    row.owned += Math.max(1, Number(g.qty) || 1);
    byId.set(key, row);
  }
  return [...byId.values()];
};

// Greedy all-silver default allocation (plans/PLAN-TRADE-ITEMS.md DECISION A):
// cover `amount` with whole silver then copper, at copper granularity. `capped`
// (buy) stops at what the purse actually holds; sell credit is ungated — the
// proceeds are new coin the character receives.
const allSilverAlloc = (coins, amount, capped) => {
  const ownedSil = Math.max(0, Number(coins.silver) || 0);
  const ownedCop = Math.max(0, Number(coins.copper) || 0);
  const totalCu = Math.round(amount * 10);
  const wantSil = Math.floor(totalCu / 10);
  const wantCop = totalCu - wantSil * 10;
  const silver = capped ? Math.min(wantSil, ownedSil) : wantSil;
  const copper = capped ? Math.min(wantCop, ownedCop) : wantCop;
  const out = {};
  if (silver) out.silver = silver;
  if (copper) out.copper = copper;
  return out;
};

export class EdTradeModal extends LitElement {
  static properties = {
    item: { type: Object },
    mode: { type: String }, // 'buy' | 'sell'
    wealth: { type: Object },
    _amount: { state: true },
    _coins: { state: true },
    _gems: { state: true },
    _revealed: { state: true },
    _gName: { state: true },
    _gVal: { state: true },
    _gQty: { state: true },
  };
  static styles = css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --bg-card: light-dark(#ffffff, #1f242e);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --danger: light-dark(#c0392b, #e06557);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --txt: light-dark(#111418, #f0f3f7);
      --fs-value: 1.1rem; --fs-body: 0.9rem; --fs-small: 0.75rem; --fs-fine: 0.7rem;
    }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2150; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--txt); border: 1px solid var(--border); border-radius: 12px; width: 27rem; max-width: 100%; max-height: min(88vh, 44rem); overflow-y: auto; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 0.25rem; }
    .mtitle { font-size: var(--fs-value); font-weight: 500; line-height: 1.25; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 2px; }
    .sub { font-size: var(--fs-small); color: var(--muted); margin: 0 0 0.75rem; }
    .row { display: flex; align-items: center; gap: 8px; margin: 0.75rem 0; }
    .row label { font-size: var(--fs-small); color: var(--muted); flex: 0 0 auto; }
    .row input.amt { font: inherit; font-size: var(--fs-body); color: var(--txt); background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; width: 6rem; text-align: right; }
    .row .hint { font-size: var(--fs-small); color: var(--muted); }
    .tot { font-size: var(--fs-small); font-weight: 500; color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
    .grid { display: flex; flex-direction: column; gap: 6px; margin: 0.5rem 0; border-top: 1px solid var(--border); padding-top: 0.5rem; }
    .gh { font-size: var(--fs-fine); font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 4px 0 2px; }
    .grow { display: flex; align-items: center; gap: 8px; font-size: var(--fs-body); justify-content: space-between; }
    .glab { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .glab .n { font-weight: 500; }
    .glab .r { font-size: var(--fs-fine); color: var(--muted); }
    .qty { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-card); overflow: hidden; flex: 0 0 auto; }
    .qty button { font: inherit; font-size: var(--fs-body); line-height: 1; border: none; background: none; color: var(--accent); cursor: pointer; width: 22px; height: 22px; padding: 0; }
    .qty button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .qty .cnt { font-size: var(--fs-fine); font-weight: 500; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; min-width: 18px; text-align: center; color: var(--txt); }
    .qty .own { font-size: var(--fs-fine); color: var(--muted); padding: 0 4px; }
    .addcoin { font-size: var(--fs-small); }
    .addcoin button { font: inherit; font-size: var(--fs-small); color: var(--accent); background: none; border: 1px dashed var(--border); border-radius: 6px; padding: 2px 8px; cursor: pointer; }
    .gemsub { display: flex; gap: 6px; align-items: center; margin: 4px 0; flex-wrap: wrap; }
    .gemsub input { font: inherit; font-size: var(--fs-small); color: var(--txt); background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; width: 6rem; }
    .gemsub input.gq { width: 3rem; }
    .gemsub .gadd { font: inherit; font-size: var(--fs-small); color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-weight: 500; }
    .warn { font-size: var(--fs-body); line-height: 1.4; color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px; padding: 8px 10px; margin: 0.5rem 0 0.75rem; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 0.75rem; }
    button.btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--txt); }
    button.btn.accent { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    button.btn[disabled] { opacity: 0.4; cursor: not-allowed; }
    .price { font-size: var(--fs-small); color: var(--muted); }
    .gbox { border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 4px; }
  `;

  constructor() {
    super();
    this.item = null;
    this.mode = 'buy';
    this.wealth = { coins: {}, gems: [], denominations: [] };
    this._amount = null;
    this._coins = {};
    this._gems = [];
    this._revealed = new Set();
    this._gName = '';
    this._gVal = '';
    this._gQty = '1';
    this._listener = null;
  }

  // Suggested price = the catalogue cost where it parses, else 0 (thread items
  // included — Decision D revised). The amount is silver at copper granularity.
  _suggested() {
    return costSilver(this.item?.ref?.cost);
  }
  _page() {
    return this.mode === 'buy' ? 'buy' : 'sell';
  }
  _denoms() {
    return Array.isArray(this.wealth.denominations) ? this.wealth.denominations : [];
  }
  _coinAt(key) {
    return Math.max(0, Number(this.wealth?.coins?.[key]) || 0);
  }
  _allocAt(key) {
    return Math.max(0, Number(this._coins[key]) || 0);
  }
  _coinsSilver() {
    return coinsSilver(this._coins);
  }
  _gemsSilver() {
    return gemsSilver(this._gems);
  }
  _allocTotal() {
    return this._coinsSilver() + this._gemsSilver();
  }
  _amountSilver() {
    const n = Number(this._amount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  _canConfirm() {
    const a = this._amountSilver();
    const alloc = this._allocTotal();
    return this._page() === 'buy' ? alloc + 1e-6 >= a : Math.abs(alloc - a) < 1e-6;
  }
  _buyGems() {
    return gemOptions(this.wealth?.gems);
  }
  _sellGems() {
    return this._gems;
  }
  _gemAt(name, valueSilver) {
    return this._gems.find((g) => g.name === name && Number(g.valueSilver) === Number(valueSilver)) ?? null;
  }
  _setGem(name, valueSilver, qty) {
    const rest = this._gems.filter((g) => !(g.name === name && Number(g.valueSilver) === Number(valueSilver)));
    if (qty > 0) this._gems = [...rest, { name, valueSilver: Number(valueSilver) || 0, qty: Math.floor(qty) }];
    else this._gems = rest;
  }

  // --- handlers ---
  _setAmount(v) {
    if (v === '') return; // a wiped field keeps the previous amount (0 is a choice, not a typo)
    const n = Number(v);
    const next = Number.isFinite(n) && n >= 0 ? n : this._amountSilver();
    if (next === this._amountSilver()) return;
    // A custom price (the item need not be bought/sold for the catalogue value)
    // changes what must be paid or received: re-seed the default all-silver
    // allocation against the NEW amount — sell just needs it to sum exactly,
    // buy just needs it to cover. The player then fine-tunes the grid.
    this._amount = next;
    this._coins = allSilverAlloc(this.wealth?.coins ?? {}, next, this.mode === 'buy');
    this._gems = [];
  }
  _bumpCoin(key, d) {
    const cap = this._page() === 'buy' ? this._coinAt(key) : Infinity;
    const next = Math.min(Math.max(0, (this._allocAt(key) || 0) + d), cap);
    if (next <= 0) { const { [key]: _, ...rest } = this._coins; this._coins = rest; }
    else this._coins = { ...this._coins, [key]: next };
  }
  _reveal(key) {
    this._revealed = new Set([...this._revealed, key]);
  }
  _bumpBuyGem(name, valueSilver, d) {
    const row = this._buyGems().find((g) => g.name === name && Number(g.valueSilver) === Number(valueSilver));
    const cap = row?.owned ?? 0;
    const cur = this._gemAt(name, valueSilver);
    this._setGem(name, valueSilver, Math.max(0, Math.min((cur?.qty ?? 0) + d, cap)));
  }
  _bumpSellGem(name, valueSilver, d) {
    const cur = this._gemAt(name, valueSilver);
    this._setGem(name, valueSilver, Math.max(0, (cur?.qty ?? 0) + d));
  }
  _addGem() {
    const name = this._gName.trim();
    const valueSilver = Math.max(0, parseInt(this._gVal || '0', 10) || 0);
    const qty = Math.max(1, parseInt(this._gQty || '1', 10) || 1);
    if (!name) return;
    const cur = this._gemAt(name, valueSilver);
    this._setGem(name, valueSilver, (cur?.qty ?? 0) + qty);
    this._gName = ''; this._gVal = ''; this._gQty = '1';
  }

  connectedCallback() {
    super.connectedCallback();
    // Seed from a fresh open: the item/mode/wealth are set before attach.
    this._amount = this._suggested();
    this._coins = allSilverAlloc(this.wealth?.coins ?? {}, this._amountSilver(), this.mode === 'buy');
    this._revealed = new Set();
    this._gems = [];
    this._listener = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this._close(); } };
    document.addEventListener('keydown', this._listener);
  }
  disconnectedCallback() {
    if (this._listener) document.removeEventListener('keydown', this._listener);
    super.disconnectedCallback();
  }
  firstUpdated() {
    // Focus the primary action when allowed, else Cancel (so Enter can't fire a
    // blocked confirm). One-shot — typing in the amount field must never be
    // stolen by a re-focus, so no `updated` re-focus here.
    const primary = this._canConfirm() ? this.renderRoot.querySelector('.btn.accent') : null;
    (primary ?? this.renderRoot.querySelector('.btn')).focus();
  }
  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  _confirm() {
    if (!this._canConfirm()) return;
    this.dispatchEvent(new CustomEvent('confirm', {
      detail: {
        mode: this.mode,
        itemName: this.item?.name,
        amount: this._amountSilver(),
        alloc: { coins: { ...this._coins }, gems: this._gems.map((g) => ({ ...g })) },
      },
      bubbles: true, composed: true,
    }));
  }

  // A short, theme-safe detail line: kind · category · parsed price.
  _detail() {
    const it = this.item ?? {};
    const kind = PICKER_LABELS[it.kind] || it.kind || 'item';
    const cat = it.ref?.category ? ` · ${it.ref.category}` : '';
    const price = it.ref?.cost != null ? ` · ${numFmt(costSilver(it.ref.cost))} sp catalogue` : '';
    return `${kind}${cat}${price}`;
  }

  _coinRow(d, side) {
    const owned = this._coinAt(d.key);
    if (side === 'buy' && owned === 0) return '';
    const cur = this._allocAt(d.key);
    return html`<div class="grow">
      <span class="glab"><span class="n">${d.label}</span><span class="r">×${numFmt(d.rate)} sp</span>
        ${side === 'buy' ? html`<span class="r">own ${owned}</span>` : html`<span class="r">have ${owned}</span>`}</span>
      <span class="qty">
        <button aria-label="Decrease ${d.label}" @click=${() => this._bumpCoin(d.key, -1)}>−</button>
        <span class="cnt">${cur}</span>
        <button aria-label="Increase ${d.label}" @click=${() => this._bumpCoin(d.key, 1)}>＋</button>
      </span>
    </div>`;
  }

  render() {
    const page = this._page();
    const amount = this._amountSilver();
    const alloc = this._allocTotal();
    const can = this._canConfirm();
    const denoms = this._denoms();
    const shown = page === 'buy'
      ? denoms.filter((d) => this._coinAt(d.key) > 0)
      : denoms.filter((d) => this._coinAt(d.key) > 0 || this._revealed.has(d.key));
    const hidden = denoms.filter((d) => !shown.includes(d));
    const gems = this.wealth?.gems ?? [];

    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${page === 'buy' ? 'Buy' : 'Sell'} ${this.item?.name ?? ''}" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">${page === 'buy' ? 'Buy' : 'Sell'} · ${this.item?.name ?? 'item'}</span>
            <button class="mclose" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <p class="sub">${this._detail()}</p>

          <div class="row">
            <label for="trade-amt">Amount (sp)</label>
            <input class="amt" id="trade-amt" type="number" min="0" step="0.1" .value=${amount}
              @input=${(e) => this._setAmount(e.target.value)} aria-label="Trade amount in silver" />
            <span class="tot">${page === 'buy' ? 'Paying' : 'Receiving'} ${numFmt(alloc)} sp</span>
          </div>

          ${page === 'buy'
            ? html`
                <div class="grid">
                  <div class="gh">Pay from your purse</div>
                  ${shown.length ? shown.map((d) => this._coinRow(d, 'buy')) : 'Nothing to spend — no coins recorded.'}
                  ${gems.length
                    ? html`<div class="gh">Gems (full face value)</div>
                        ${this._buyGems().map((g) => {
                          const cur = this._gemAt(g.name, g.valueSilver)?.qty ?? 0;
                          return html`<div class="grow">
                            <span class="glab"><span class="n">${g.name}</span><span class="r">×${numFmt(g.valueSilver)} sp · own ${g.owned}</span></span>
                            <span class="qty">
                              <button aria-label="Decrease ${g.name}" @click=${() => this._bumpBuyGem(g.name, g.valueSilver, -1)}>−</button>
                              <span class="cnt">${cur}</span>
                              <button aria-label="Increase ${g.name}" @click=${() => this._bumpBuyGem(g.name, g.valueSilver, 1)}>＋</button>
                            </span>
                          </div>`;
                        })}`
                    : ''}
                  ${!shown.length && !gems.length ? html`<div class="sub" style="margin:0">Nothing to spend — no coins or gems recorded.</div>` : ''}
                </div>
                ${!can ? html`<div class="warn">You cannot add it yet — allocate ${numFmt(amount - alloc)} sp more.</div>` : ''}
              `
            : html`
                <div class="grid">
                  <div class="gh">Take proceeds as</div>
                  ${shown.length ? shown.map((d) => this._coinRow(d, 'sell')) : 'No coins yet — credit coins below.'}
                  ${hidden.length
                    ? html`<div class="addcoin">
                        ${hidden.map((d) => html`<button @click=${() => this._reveal(d.key)}>＋ ${d.label} ×${numFmt(d.rate)} sp</button>`)}
                      </div>`
                    : ''}
                  <div class="gh">Gems paid to you</div>
                  ${this._sellGems().map((g, i) => html`<div class="grow">
                    <span class="glab"><span class="n">${g.name}</span><span class="r">×${numFmt(g.valueSilver)} sp</span></span>
                    <span class="qty">
                      <button aria-label="Decrease ${g.name}" @click=${() => this._bumpSellGem(g.name, g.valueSilver, -1)}>−</button>
                      <span class="cnt">${g.qty}</span>
                      <button aria-label="Increase ${g.name}" @click=${() => this._bumpSellGem(g.name, g.valueSilver, 1)}>＋</button>
                    </span>
                  </div>`)}
                  <div class="gbox">
                    <div class="gh">Define a gem you were paid in</div>
                    <div class="gemsub">
                      <input class="gq" placeholder="Gem name" maxlength="40" aria-label="Gem name" .value=${this._gName} @input=${(e) => (this._gName = e.target.value)} />
                      <input placeholder="value sp" type="number" min="0" aria-label="Value in silver" .value=${this._gVal} @input=${(e) => (this._gVal = e.target.value)} />
                      <input class="gq" placeholder="qty" type="number" min="1" aria-label="Quantity" .value=${this._gQty} @input=${(e) => (this._gQty = e.target.value)} />
                      <button class="gadd" @click=${this._addGem}>Add</button>
                    </div>
                  </div>
                </div>
                ${!can ? html`<div class="warn">${alloc < amount
                  ? `Receiving ${numFmt(alloc)} sp — add ${numFmt(amount - alloc)} sp more to reach ${numFmt(amount)} exactly.`
                  : `Receiving ${numFmt(alloc)} sp — that is more than ${numFmt(amount)}; lower it to exactly ${numFmt(amount)}.`}</div>` : ''}
              `}

          <div class="actions">
            <button type="button" class="btn" @click=${this._close}>Cancel</button>
            <button type="button" class="btn accent" ?disabled=${!can} @click=${this._confirm}>${page === 'buy' ? 'Buy' : 'Sell'}</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-trade-modal', EdTradeModal);