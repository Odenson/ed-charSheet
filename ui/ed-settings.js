// ui/ed-settings.js — the Settings modal (autosave preferences).
//
// A small preferences dialog for the GitHub autosave: turn it on/off and set the
// idle interval (seconds of no changes before a background save fires). Rendered
// on the UI kit (ui/kit/, docs/MODALS.md) in its own shadow root; it is mounted at
// the top of `<ed-app>`'s template and stacks above other modals via layer 2200.
//
// Architecture (Tier-1 golden rule): this view NEVER persists anything itself. It
// takes the current values down as properties and, on Save, dispatches
// `ed-settings` up with `{ enabled, seconds }` — ed-app persists to localStorage
// and re-schedules the autosave. Escape / Cancel / backdrop close without change;
// Enter saves (the kit routes it). Theme-aware via light-dark(); two font weights.
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { isDiscordWebhookUrl, normalizeFormat } from '../store-discord.js';

const MIN_SECONDS = 10;
const MAX_SECONDS = 3600;
const DEFAULT_SECONDS = 60;

export class EdSettings extends LitElement {
  static properties = {
    enabled: { type: Boolean },
    seconds: { type: Number },
    // Discord die report (per character; device-local — ed-app owns persistence).
    discord: { attribute: false },
    characterId: { type: String },
    characterName: { type: String },
    hasCharacter: { type: Boolean },
    testResult: { attribute: false },
    _dUrl: { state: true },
    _dEnabled: { state: true },
    _dMasked: { state: true },
    _dFormat: { state: true },
    _enabled: { state: true },
    _seconds: { state: true },
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --text: light-dark(#111418, #f0f3f7);
    }
    .eds-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: var(--fs-body); }
    .eds-row + .eds-row { border-top: 1px solid var(--border); }
    .eds-row .lbl { font-weight: 500; }
    .eds-row .hint { font-size: var(--fs-small); color: var(--muted); margin-top: 2px; font-weight: 400; }
    .eds-num { font: inherit; font-size: var(--fs-body); width: 5rem; text-align: right; color: var(--text); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; }
    .eds-num:focus { outline: none; border-color: var(--accent); }
    .eds-num:disabled { opacity: 0.5; }
    .eds-sec { font-size: var(--fs-body); font-weight: 500; padding: 12px 0 2px; border-top: 1px solid var(--border); margin-top: 8px; }
    .eds-url { font: inherit; font-size: var(--fs-body); width: 100%; box-sizing: border-box; color: var(--text); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; margin-top: 6px; }
    .eds-url:focus { outline: none; border-color: var(--accent); }
    .eds-err { font-size: var(--fs-small); color: light-dark(#a3281d, #f08a80); margin-top: 4px; }
    .eds-test { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: var(--fs-small); }
    .eds-fmt { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px 0; font-size: var(--fs-body); }
    .eds-fmt .lbl { font-weight: 500; }
    .eds-fmt label { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; cursor: pointer; }
    .eds-fmt input { accent-color: var(--accent); margin: 0; }
    /* Switch */
    .eds-switch { position: relative; width: 40px; height: 22px; flex: none; }
    .eds-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
    .eds-track { position: absolute; inset: 0; border-radius: 999px; background: var(--border); transition: background 0.15s; }
    .eds-switch input:checked + .eds-track { background: var(--accent); }
    .eds-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    .eds-switch input:checked ~ .eds-knob { transform: translateX(18px); }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'input',
      onConfirm: () => this._save(),
      // Save is blocked while the webhook URL is invalid (the inline message shows why).
      canConfirm: () => !(this.hasCharacter && this._discordInvalid()),
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    // Seed the editable draft from the current settings passed down.
    this._enabled = this.enabled !== false;
    this._seconds = Number.isFinite(this.seconds) ? this.seconds : DEFAULT_SECONDS;
    this._loadDiscordDraft();
    this._ctl.opened(deepActiveElement());
  }

  // Reload the Discord draft whenever the stored config or character changes.
  _loadDiscordDraft() {
    this._dUrl = this.discord?.url ?? '';
    this._dEnabled = !!this.discord?.enabled;
    this._dFormat = normalizeFormat(this.discord?.format);
    this._dMasked = !!this._dUrl; // masked once a URL is saved; typing replaces it
  }

  willUpdate(changed) {
    // ed-app passes a fresh object each render: reload only on a real change.
    const prev = changed.get('discord');
    const moved = changed.has('discord') && (prev?.url !== this.discord?.url || prev?.enabled !== this.discord?.enabled || prev?.format !== this.discord?.format);
    if (this.hasUpdated && (moved || changed.has('characterId'))) this._loadDiscordDraft();
  }

  _discordInvalid() {
    const u = (this._dUrl ?? '').trim();
    return u !== '' && !isDiscordWebhookUrl(u);
  }

  _sendTest = () => {
    const url = (this._dUrl ?? '').trim();
    if (!isDiscordWebhookUrl(url)) return;
    this.dispatchEvent(new CustomEvent('ed-discord-test', { detail: { url, format: this._dFormat }, bubbles: true, composed: true }));
  };

  // Clamp to a sane range; a blank / non-numeric field falls back to the default.
  _clampSeconds(v) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return DEFAULT_SECONDS;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
  }

  _save = () => {
    if (this.hasCharacter && this._discordInvalid()) return; // inline message blocks Save
    const seconds = this._clampSeconds(this._seconds);
    const detail = { enabled: !!this._enabled, seconds };
    if (this.hasCharacter) detail.discord = { url: (this._dUrl ?? '').trim(), enabled: !!this._dEnabled, format: this._dFormat };
    this.dispatchEvent(new CustomEvent('ed-settings', { detail, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  };

  _renderDiscord() {
    const invalid = this._discordInvalid();
    const t = this.testResult;
    const sending = t?.state === 'sending';
    const who = this.characterName ? ` for ${this.characterName}` : '';
    return html`
      <div class="eds-sec">Discord die reports</div>
      <div class="eds-row">
        <div>
          <div class="lbl">Post rolls to Discord</div>
          <div class="hint">Webhook${who}. Stored only in this browser.</div>
        </div>
        <label class="eds-switch">
          <input type="checkbox" .checked=${this._dEnabled} aria-label="Enable Discord die reports" @change=${(e) => (this._dEnabled = e.target.checked)} />
          <span class="eds-track"></span><span class="eds-knob"></span>
        </label>
      </div>
      <div>
        <input class="eds-url" type=${this._dMasked ? 'password' : 'text'} name="discord-hook" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://discord.com/api/webhooks/…" aria-label="Discord webhook URL" .value=${this._dUrl ?? ''} @input=${(e) => { this._dUrl = e.target.value; }} />
        ${invalid ? html`<div class="eds-err" role="alert">Not a Discord webhook URL.</div>` : ''}
      </div>
      <div class="eds-fmt" role="radiogroup" aria-label="Discord message format">
        <span class="lbl">Message format</span>
        <label><input type="radio" name="discord-format" value="plain" .checked=${this._dFormat !== 'embed'} @change=${() => (this._dFormat = 'plain')} /> Plain text</label>
        <label><input type="radio" name="discord-format" value="embed" .checked=${this._dFormat === 'embed'} @change=${() => (this._dFormat = 'embed')} /> Embed</label>
      </div>
      <div class="eds-test">
        <button type="button" class="btn" ?disabled=${invalid || !(this._dUrl ?? '').trim() || sending} @click=${this._sendTest}>Send test message</button>
        <span role="status">${t?.state === 'ok' ? `✅ ${t.message ?? 'Sent'}` : t?.state === 'error' ? `❌ ${t.message ?? 'Failed'}` : sending ? 'Sending…' : ''}</span>
      </div>
    `;
  }

  render() {
    return modalFrame(this._ctl, {
      title: 'Settings',
      layer: 2200,
      width: '26rem',
      scroll: true,
      primary: { label: 'Save', disabled: this.hasCharacter && this._discordInvalid() },
      body: html`
        <div class="eds-row">
          <div>
            <div class="lbl">Autosave to GitHub</div>
            <div class="hint">Save automatically after a pause in changes.</div>
          </div>
          <label class="eds-switch">
            <input type="checkbox" .checked=${this._enabled} aria-label="Enable autosave" @change=${(e) => (this._enabled = e.target.checked)} />
            <span class="eds-track"></span><span class="eds-knob"></span>
          </label>
        </div>
        <div class="eds-row">
          <div>
            <div class="lbl">Idle interval</div>
            <div class="hint">Seconds of no changes before an autosave (10–3600).</div>
          </div>
          <input class="eds-num" type="number" min=${MIN_SECONDS} max=${MAX_SECONDS} step="5" .value=${String(this._seconds)} ?disabled=${!this._enabled} aria-label="Autosave idle interval in seconds" @input=${(e) => (this._seconds = e.target.value)} />
        </div>
        ${this.hasCharacter ? this._renderDiscord() : ''}`,
    });
  }
}

customElements.define('ed-settings', EdSettings);
