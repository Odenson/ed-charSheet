// ui/ed-app.js — root: loads the model, renders the tab shell, routes tabs.
import { LitElement, html, css } from 'lit';
import { loadCharacter, listCharacters, loadCustomItems, deriveModel, saveMetaEdits, saveItemEdits, saveWealthEdits, saveTradeEdits, saveHealthEdits, saveKarmaEdits, saveAdvancementEdits, saveNotesEdits, saveHistoryEdits, saveLegendEdits, reconcileOverlay, hasPendingEdits } from '../store.js';
import { applyHealth, knockdownOutcome, KNOCKED_DOWN_EFFECT, recoveriesRemaining } from '../engine/health.js';
import { armPotion, armedRecoveryBonus, boostHasNoEffect, consumePotion, immediateWoundHeal } from '../engine/potions.js';
import { auditLegendSpent } from '../engine/legend-spent.js';
import { legendAvailable } from '../engine/legend.js';
import { saveServer, SaveError, SaveConflictError, DEFAULT_ENDPOINT } from '../store-server.js';
import { saveCustomItems, saveCustomEdits, loadCustomEdits, reconcileCustomEdits, hasCustomPendingEdits, applyCustomEdits, isItemsReflected, DEFAULT_ITEMS_ENDPOINT } from '../store-custom-items.js';
import { nextSaveAction } from '../save-action.js';
import { exportCharacter } from '../store-export.js';
import './ed-overview.js';
import './ed-disciplines.js';
import './ed-equipment.js';
import './ed-combat.js';
import './ed-custom-item.js';
import './ed-roll-modal.js';
import './ed-changelog.js';
import './ed-homebrew.js';
import './ed-notes.js';
import './ed-edit-meta.js';
import './ed-save-key.js';
import './ed-confirm.js';
import './ed-character-picker.js';
import './ed-conflict.js';
import './ed-settings.js';
import { saveRollLog } from '../store-rolllog.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '▤' },
  { id: 'disciplines', label: 'Disciplines', icon: '◈' },
  { id: 'combat', label: 'Combat', icon: '◎' },
  { id: 'spells', label: 'Spells', icon: '✦' },
  { id: 'equipment', label: 'Equipment', icon: '⚔' },
  { id: 'notes', label: 'Notes', icon: '❋' },
];

// Id for one roll interaction (PLAN-NOTES-TAB decision #5): generated when the
// roll modal opens, owned by ed-app, and passed down — so Karma toggles / "Roll
// again" upsert the same Roll Log row instead of stacking a duplicate.
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export class EdApp extends LitElement {
  static properties = {
    _model: { state: true },
    _error: { state: true },
    _tab: { state: true },
    _dark: { state: true },
    _roll: { state: true },
    _editMode: { state: true },
    _dirty: { state: true },
    _saving: { state: true },
    _saveError: { state: true },
    _saveOk: { state: true },
    _notice: { state: true }, // transient status message (e.g. Karma Ritual performed)
    _keyPrompt: { state: true },
    _confirmDiscard: { state: true },
    _confirmSwitch: { state: true },
    _picker: { state: true },
    _noSelection: { state: true },
    _conflict: { state: true },
    _settings: { state: true }, // Settings modal open?
    // Session-only armed-potion state (dies on reload). At most ONE armed
    // recovery entry (no stacking); never persisted (store-only-inputs), same
    // ephemeral contract as the Combat scratchpad. Cleared on character switch,
    // manual clear, a successful roll, and the new-day recovery reset.
    _pendingUse: { state: true },
  };

  // Raw editable inputs (character.json + overlay) and the loaded rules. Edits
  // dispatched up from views mutate these here, then re-derive _model (data
  // flows back down). Not reactive state — _model is the render trigger.
  _character = null;
  _rules = null;
  // The selected character's id (its per-character file name). Persisted to
  // localStorage 'ed-character' so the same character loads next session.
  _characterId = null;
  // The per-character index rows [{ id, name, portrait }] — the character picker
  // lists from them. Fetched at startup (and refreshed on each load path).
  _characters = null;
  // The last-seen blob sha of the loaded character's file (from the read ETag or
  // the last save's commit sha) — the optimistic-concurrency `base` sent on the
  // next /save. Null locally / on the CDN fallback (no ETag → overwrite path).
  _baseSha = null;
  // The SAVE_KEY for GitHub saves. Held in memory for the session only — never
  // localStorage (runbook §0). A plain field, not reactive state.
  _saveKey = null;
  // A custom-item save interrupted by the key prompt (saveKey absent). Replayed
  // once the prompt confirms; cleared on any prompt close.
  _pendingCustomSave = null;
  // A character save interrupted by the key prompt — whether it was silent
  // (background) so the replay preserves the toast behaviour. Cleared on any
  // prompt close.
  _pendingSaveSilent = null;
  // An open stale_base conflict ({ sha, silent }) — the worker rejected a save
  // because the character changed on the branch; the modal resolves it. `sha` is
  // the branch's current file sha (the acknowledged-overwrite base), `silent`
  // whether the rejected save was a background auto-save.
  _conflict = null;

  static styles = css`
    :host {
      display: block;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem 1rem 1.5rem;
      color: light-dark(#111418, #f0f3f7);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .tabbar {
      display: flex;
      align-items: center;
      gap: 2px;
      border-bottom: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .tab {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 13px; font-size: var(--fs-body); font-family: inherit;
      color: var(--muted, #6b7280); background: none; border: none;
      border-bottom: 2px solid transparent; cursor: pointer;
    }
    .tab[aria-selected='true'] { color: light-dark(#111418, #f0f3f7); border-bottom-color: var(--accent, #b26a00); }
    .tab .ico { font-size: var(--fs-body); opacity: 0.8; }
    /* Edit / Save / Theme: uniform round icon-only buttons. */
    .icon-btn {
      position: relative; width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      color: var(--muted, #6b7280); cursor: pointer; font-size: var(--fs-value); line-height: 1;
    }
    .icon-btn + .icon-btn { margin-left: 6px; }
    .icon-btn:hover { color: light-dark(#111418, #f0f3f7); }
    .icon-btn[disabled] { opacity: 0.5; cursor: default; }
    .ico-svg { width: 15px; height: 15px; display: block; }
    .icon-btn.edit { margin-left: auto; }
    .icon-btn.edit.active {
      background: var(--accent, #b26a00); border-color: var(--accent, #b26a00); color: #fff;
    }
    /* Accent dot: local edits not yet committed to GitHub. */
    .icon-btn.save.dirty::after {
      content: ''; position: absolute; top: -2px; right: -2px;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent, #b26a00);
      border: 1.5px solid light-dark(#f4f5f7, #12151b);
    }
    .toast {
      position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%);
      z-index: 2200; max-width: 90vw;
      padding: 0.5rem 0.9rem; border-radius: 8px; font-size: var(--fs-body);
      background: light-dark(#fff, #232833);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    .toast.error { color: #c0392b; border: 1px solid #c0392b; }
    .toast.ok { color: light-dark(#1a7a3e, #6ecb8f); border: 1px solid light-dark(#1a7a3e, #6ecb8f); }
    .toast a { color: inherit; font-weight: 500; }
    .status { padding: 2rem 0; color: var(--muted, #667); font-weight: 500; }
    .status.error { color: #c0392b; }
    .stub { text-align: center; color: var(--muted, #889); padding: 3rem 0; font-size: var(--fs-value); }
    .stub .big { font-size: var(--fs-hero); display: block; margin-bottom: 0.5rem; opacity: 0.7; }
    footer {
      margin-top: 1.25rem; font-size: var(--fs-small);
      color: var(--muted, #889);
    }
    .dev-pill {
      position: fixed; top: 0.75rem; right: 0.75rem; z-index: 1000;
      padding: 0.25rem 0.7rem; border-radius: 999px;
      background: #b26a00; color: #fff;
      font-weight: 500; font-size: var(--fs-fine); line-height: 1; font-family: system-ui, sans-serif; letter-spacing: 0.08em;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); pointer-events: none;
    }
  `;

  constructor() {
    super();
    this._model = null;
    this._error = null;
    this._tab = 'overview';
    // Editing is a transient, global mode: read mode stays clean (no per-field
    // affordances); flip this on to reveal editable regions. Not persisted —
    // the sheet always opens in read mode.
    this._editMode = false;
    // GitHub save state. _dirty = local edits not yet committed (survives reload
    // via the overlay); _saving = in-flight; _saveError / _saveOk = last result;
    // _keyPrompt = the key modal is open. Dirty is per-character and only known
    // after a character is selected, so it starts false and is set on load.
    this._dirty = false;
    this._saving = false;
    this._saveError = null;
    this._saveOk = null;
    this._notice = null;
    this._keyPrompt = false;
    this._confirmDiscard = false;
    this._confirmSwitch = false;
    this._picker = false;
    this._noSelection = false;
    // Theme: honour a saved preference, else follow the system setting.
    const saved = localStorage.getItem('ed-theme');
    this._dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    this._applyTheme();
    this._settings = false;
    // Autosave prefs (localStorage): on by default, 60s idle interval. Off = pure
    // manual save (the always-visible Save icon). The idle timer coalesces a lull
    // in edits into one background save; a max-wait cap bounds continuous activity;
    // and visibilitychange/pagehide flush on leaving. See plans/PLAN-SAVE-VISIBILITY.
    this._autosaveEnabled = localStorage.getItem('ed-autosave') !== 'off';
    const secs = Number(localStorage.getItem('ed-autosave-seconds'));
    this._autosaveSeconds = Number.isFinite(secs) && secs >= 10 ? secs : 60;
    this._autosaveTimer = null; // idle debounce
    this._autosaveMaxTimer = null; // max-wait cap
  }

  async connectedCallback() {
    super.connectedCallback();
    // Flush a pending autosave when the tab is hidden or the page is unloading —
    // the natural moment work would otherwise be stranded (a tab switch, a close,
    // mobile backgrounding). keepalive lets the request outlive the document.
    this._onHide = () => { if (document.visibilityState === 'hidden') this._flushSave(); };
    this._onPageHide = () => this._flushSave();
    document.addEventListener('visibilitychange', this._onHide);
    window.addEventListener('pagehide', this._onPageHide);
    // Any roll button in a child view bubbles an 'ed-roll' event up to here.
    this.addEventListener('ed-roll', (e) => {
      const { label, karma, apply, kind, difficulty } = e.detail;
      // A recovery roll made while a step-boost is armed rolls at the bumped step
      // (Booster/Healing +8) — the dice and the log then show the boosted step.
      // The +N comes from the armed potion's catalog data, never a view literal.
      let step = e.detail.step;
      const recBonus = armedRecoveryBonus(this._pendingUse);
      if (apply?.action === 'recovery-heal' && recBonus.stepBonus) step += recBonus.stepBonus;
      const stepRow = this._model?.stepByNumber?.[step];
      if (!stepRow) return;
      // Resolve the Karma die's step row (D6) so the modal can offer +D6.
      const karmaCtx =
        karma?.step != null && this._model?.stepByNumber?.[karma.step]
          ? { grants: karma.grants, available: karma.available, stepRow: this._model.stepByNumber[karma.step] }
          : null;
      // Rolling the Karma die IS spending a point of Karma: the Overview's Karma
      // roll has no +D6 toggle (it is the die), so charge the spend here. Charge,
      // no refund (owner decision) — each button click opens a fresh roll
      // interaction, while the modal's "Roll again" never re-fires `ed-roll`.
      if (kind === 'karma') this._editKarma({ spend: 1 });
      this._roll = {
        rollId: uid(),
        label,
        stepRow,
        karma: karmaCtx,
        apply: apply ?? null,
        difficulty: difficulty ?? null,
        // The view's pool result-mods (e.g. Desperate Blow's +6) ride first;
        // the universal Knocked Down −3 (every test, Karma die only excluded)
        // is added after — it applies to every roll, combat or not.
        mods: [...(e.detail.mods ?? []), ...this._rollTimeMods({ kind, apply })],
      };
    });
    // A completed roll in the modal (PLAN-NOTES-TAB, decision #5): the modal
    // sends ONLY the dice result it just computed — `_result`, the resolved
    // `_karmaResult`, the derived outcome, and the per-open `rollId`. This
    // listener merges them with the roll config it already holds (`this._roll`)
    // and saves one Roll Log entry per interaction, upserted by rollId — so
    // Karma toggles / "Roll again" replace the row, never duplicate it. The log
    // is device-local (decision #2) and never rides the overlay or an export.
    this.addEventListener('ed-roll-logged', (e) => {
      if (!this._roll || !this._characterId) return;
      const { rollId, result, karmaResult, outcome } = e.detail ?? {};
      const r = result;
      if (!r || !rollId) return;
      saveRollLog(
        {
          rollId,
          at: new Date().toISOString(),
          label: this._roll.label,
          step: r.step,
          dice: r.dice,
          groups: r.groups,
          modifier: r.modifier,
          // The full displayed number the modal showed: dice + Karma die +
          // roll-time mods — so the log matches what the player saw, and the
          // recorded `mods`/`karma` sub-objects explain a total that isn't the
          // raw dice sum without double-counting on render (decision #8).
          total: r.total + (karmaResult?.total ?? 0) + (this._roll.mods ?? []).reduce((s, m) => s + (Number(m.value) || 0), 0),
          difficulty: this._roll.difficulty?.value ?? null,
          outcome: outcome ?? null,
          karma: karmaResult ? { step: karmaResult.step, dice: karmaResult.dice, total: karmaResult.total } : null,
          mods: this._roll.mods ?? [],
        },
        this._characterId,
      );
    });
    // A roll modal with an apply context (e.g. a Recovery test) hands its total
    // back up; apply it to the character's inputs via the pure engine and
    // re-derive. The UI never computes the value.
    this.addEventListener('ed-roll-apply', (e) => {
      const { action, result, difficulty } = e.detail;
      if (action === 'recovery-heal') {
        // Recovery Tests are a per-day budget, so the apply site is the authority
        // (the buttons also disable themselves): a roll can never heal when the
        // character has none left, even if a stale view slipped one through.
        const health = this._character?.resources?.health ?? {};
        const maxRec = this._model?.characteristics?.recoveries?.value ?? null;
        const remaining = recoveriesRemaining(health?.recoveriesUsed, maxRec);
        if (remaining != null && remaining <= 0) {
          this._showNotice(`No Recovery Tests left today — used all ${maxRec}. Start a new day to reset.`);
          this._roll = null;
          return;
        }
        this._editHealth(applyHealth(health, { damage: -result, recoveriesUsed: 1 }));
        // The armed step-boost is spent once the recovery roll actually lands —
        // it survives a refused roll (the 0-remaining guard returns above before
        // the heal), matching "stays until rolled AND recorded".
        if (this._pendingUse?.kind === 'step-boost') this._pendingUse = null;
        this._roll = null; // button-driven: apply and close
      } else if (action === 'emergency-recovery-heal') {
        // The Healing Potion emergency: an immediate, budget-free Recovery test —
        // heal by the result with NO recoveriesUsed increment. Fail closed if no
        // emergency is armed, so a stale modal can never grant a free heal.
        if (this._pendingUse?.kind !== 'emergency-heal') {
          this._roll = null;
          return;
        }
        const health = this._character?.resources?.health ?? {};
        this._editHealth(applyHealth(health, { damage: -result }));
        this._pendingUse = null;
        this._roll = null;
      } else if (action === 'knockdown-result') {
        // A Knockdown test resolves itself at roll time — no verify button: a
        // failed test knocks the character down. The big hit's damage and any
        // Wound were already applied by the damage modal; this stores the
        // knocked-down input that the engine's condition effect reads. The roll
        // modal stays open so the player sees the roll and its outcome line,
        // then dismisses it.
        this._editHealth({ knockedDown: knockdownOutcome(result, difficulty) === 'down' });
      }
    });
    // A view edited character inputs. Apply the patch, persist the overlay, and
    // re-derive the model from inputs — the UI never mutates derived state.
    this.addEventListener('ed-edit-meta', (e) => this._editMeta(e.detail));
    this.addEventListener('ed-edit-items', (e) => this._editItems(e.detail));
    // Drink/Use a consumable potion (Equipment or Combat). Clear an armed one-shot
    // benefit (the pending pill's ✕).
    this.addEventListener('ed-use-potion', (e) => this._usePotion(e.detail?.name));
    this.addEventListener('ed-clear-pending-use', () => { this._pendingUse = null; });
    this.addEventListener('ed-edit-wealth', (e) => this._editWealth(e.detail));
    this.addEventListener('ed-edit-health', (e) => this._editHealth(e.detail));
    // A trade (plans/PLAN-TRADE-ITEMS.md): one dispatch carrying BOTH the next
    // item list and the resulting purse, persisted atomically + one re-derive.
    this.addEventListener('ed-trade', (e) => this._editTrade(e.detail));
    // A roll spent Karma (the shared roll modal, so this fires for ANY tab's
    // roll). Decrement the stored `available` balance app-wide — charge, no
    // refund (owner decision).
    this.addEventListener('ed-edit-karma', (e) => this._editKarma(e.detail));
    this.addEventListener('ed-edit-talent-rank', (e) => this._editTalentRank(e.detail));
    this.addEventListener('ed-edit-skill-rank', (e) => this._editSkillRank(e.detail));
    // Notes-tab surfaces (PLAN-NOTES-TAB): the player's hand-written notes and
    // dated history replace their top-level arrays; Legend-earned entries replace
    // resources.legend.earned only — the legacy totalEarnt is never written
    // (decision #1) and re-derives from the log (Phase B).
    this.addEventListener('ed-edit-notes', (e) => this._editNotes(e.detail));
    this.addEventListener('ed-edit-history', (e) => this._editHistory(e.detail));
    this.addEventListener('ed-edit-legend-earned', (e) => this._editLegendEarned(e.detail));
    // The key-prompt modal supplies a SAVE_KEY; keep it in memory and retry.
    // A custom-item save paused for the key replays first; otherwise retry the
    // character save (preserving whether it was a silent background save). The
    // pending is consumed either way.
    this.addEventListener('ed-save-key', (e) => {
      this._saveKey = e.detail?.key || null;
      this._keyPrompt = false;
      const pending = this._pendingCustomSave;
      this._pendingCustomSave = null;
      const silent = this._pendingSaveSilent ?? false;
      this._pendingSaveSilent = null;
      if (!this._saveKey) return;
      if (pending) this._saveCustomItems(pending.items, pending.delete);
      else this._doSave({ silent });
    });
    // A stale_base conflict modal choice (keep-mine / take-theirs / cancel) —
    // route it through the pure nextSaveAction helper (save-action.js).
    this.addEventListener('ed-conflict', (e) => {
      this._applyConflictChoice(e.detail?.choice);
    });
    // A custom-item delta from the manager modal (PLAN-CUSTOM-ITEMS §5.3).
    // 'draft' writes the overlay instantly (resilient) and re-derives so pending
    // items resolve this session; 'save' POSTs to /save-items with the session
    // key (re-prompting via ed-save-key if absent), reconciles on success.
    this.addEventListener('ed-edit-custom-items', (e) => this._editCustomItems(e.detail));
    // The character picker dispatched a choice — load that character.
    this.addEventListener('load-character', (e) => {
      if (e.detail?.id) this._loadCharacter(e.detail.id);
    });
    try {
      const characters = await listCharacters();
      const ids = characters.map((c) => c.id);
      if (!ids.length) {
        this._error = 'No characters found in the character store.';
        return;
      }
      const id = this._initialId(ids, characters);
      if (id) await this._loadCharacter(id, { characters });
      else {
        // First run with no saved selection: keep the fetched index so the
        // picker has characters to list (only _loadCharacter sets it otherwise).
        this._characters = characters;
        this._picker = true;
      }
    } catch (e) {
      this._error = String(e);
    }
  }

  // Which character to load on startup: the saved 'ed-character' selection if
  // it still exists in the index; the single entry if there's only one (no real
  // choice); otherwise null — the picker asks the user (first run).
  _initialId(ids, characters) {
    const saved = localStorage.getItem('ed-character');
    if (saved && characters.some((c) => c.id === saved)) return saved;
    if (ids.length === 1) return ids[0];
    return null;
  }

  // Load a character by id: read its per-character file (unless the index was
  // passed in), apply its per-id overlay, derive the model, and keep the file's
  // current blob sha as `_baseSha` (the concurrency token for the next save).
  // Persists the selection so the same character loads next session. Sets
  // _dirty from the id's own overlay.
  async _loadCharacter(id, { characters } = {}) {
    try {
      const { character, rules, base } = await loadCharacter(id);
      this._characterId = id;
      if (characters) this._characters = characters;
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
      // A character switch starts with no armed potion (session state is per
      // character and never persisted).
      this._pendingUse = null;
      this._baseSha = base;
      this._dirty = hasPendingEdits(id) || hasCustomPendingEdits();
      this._picker = false;
      this._noSelection = false;
      this._error = null;
      this._saveError = null;
      localStorage.setItem('ed-character', id);
    } catch (e) {
      this._saveError = `Couldn't load "${id}": ${e?.message ? String(e.message) : String(e)}`;
      this._picker = false;
    }
  }

  // Header icon: open the picker. A dirty character first confirms — the switch
  // proceeds without discarding the draft (overlays are per-id and survive).
  _pickCharacter() {
    if (this._dirty) this._confirmSwitch = true;
    else this._picker = true;
  }

  _editMeta(patch) {
    if (!this._character || !patch) return;
    this._character = { ...this._character, meta: { ...this._character.meta, ...patch } };
    saveMetaEdits(patch, this._characterId); // overlay: always-on autosave, instant, no permissions
    // Local edits are now ahead of the last GitHub commit until the next Save.
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's item list. Same flow as meta: replace the
  // inputs, persist the overlay, mark the file dirty, and re-derive so armour /
  // defences / initiative recompute from the equipped items (data flows down).
  _editItems(items) {
    if (!this._character || !Array.isArray(items)) return;
    this._character = { ...this._character, items };
    saveItemEdits(items, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // Drink/Use a consumable potion (plans/PLAN-POTIONS.md). The engine decides what
  // the consume does from the catalog; ed-app owns the persistence + session arm.
  // Always: decrement one dose (removes the entry at 0) + log the consume — even
  // a no-effect one. Then apply any immediate wound heal and arm the one-shot
  // recovery benefit. No stacking: a second arm is blocked while one is pending.
  _usePotion(name) {
    if (!this._character || !name) return;
    const model = this._model;
    const item = model?.items?.find((i) => i.name === name);
    if (!item || !item.consumable || (item.qty ?? 1) < 1) return;
    const entry = model?.itemCatalog?.[name] ?? null;
    if (!entry) return;
    const health = this._character.resources?.health ?? {};
    const maxRec = model?.characteristics?.recoveries?.value ?? null;
    const remaining = recoveriesRemaining(health.recoveriesUsed, maxRec);
    const armed = armPotion({ name, entry, recoveriesRemaining: remaining });
    // No stacking — block a second arm while one is pending (the UI also disables
    // the confirm; this is the fail-safe if a stale view slips one through).
    if (armed && this._pendingUse) {
      this._showNotice('A Recovery boost is already pending — use or clear it before drinking another potion.');
      return;
    }
    // Hard block — a pure step-boost with no Recovery test to use has no effect,
    // so refuse the drink entirely (the dose is not spent). The UI disables the
    // confirm; this is the fail-safe.
    if (boostHasNoEffect(entry.consumable?.use, remaining)) {
      this._showNotice('No Recovery tests left today — that potion would have no effect, so it was not used.');
      return;
    }
    // Always spend the dose + log, whether or not it did anything.
    this._editItems(consumePotion({ items: this._character.items ?? [], name }));
    saveRollLog({ rollId: uid(), at: new Date().toISOString(), kind: 'action', label: `Drink ${name}` }, this._characterId);
    // Immediate wound heal (Healing Potion), only when there IS a Wound to heal —
    // otherwise the dose is still spent (the confirm dialog warned).
    const heal = immediateWoundHeal(entry);
    const wounds = Number(this._character.resources?.health?.wounds) || 0;
    if (heal > 0 && wounds > 0) {
      this._editHealth(applyHealth(this._character.resources?.health ?? {}, { wounds: -heal }));
    }
    // Arm the one-shot benefit (null for a consume-only aid).
    if (armed) {
      this._pendingUse = armed;
      // Chain straight into the heal roll so the player rolls it right after the
      // drink, rather than hunting for the recovery button. The pending pill
      // remains as a fallback if they dismiss the roll modal.
      if (armed.kind === 'emergency-heal') {
        this.dispatchEvent(new CustomEvent('ed-roll', {
          detail: { label: `${name} — emergency heal`, step: armed.step, apply: { action: 'emergency-recovery-heal', label: 'Heal this amount' } },
          bubbles: true, composed: true,
        }));
      } else if (armed.kind === 'step-boost') {
        const tou = (this._model?.attributes ?? []).find((a) => a.name === 'Toughness');
        if (tou?.step != null) {
          this.dispatchEvent(new CustomEvent('ed-roll', {
            detail: { label: 'Recovery test', step: tou.step, apply: { action: 'recovery-heal', label: 'Heal this amount' } },
            bubbles: true, composed: true,
          }));
        }
      }
    }
  }

  // The curated arming state passed down to the tabs: the single pending entry
  // and the owned consumable potions (equipped or stored) with their quantity.
  _arming() {
    return {
      pending: this._pendingUse ?? null,
      potions: (this._model?.items ?? [])
        .filter((it) => it.consumable)
        .map((it) => ({ name: it.name, qty: it.qty ?? 1, equipped: it.equipped })),
    };
  }

  // A view changed the character's wealth (coin counts / gems). Same inputs-only
  // flow: replace the wealth input, persist the overlay, mark the file dirty, and
  // re-derive so the totals recompute (data flows down).
  _editWealth(wealth) {
    if (!this._character || !wealth) return;
    this._character = { ...this._character, wealth };
    saveWealthEdits(wealth, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A trade (plans/PLAN-TRADE-ITEMS.md): the Equipment view computes the next
  // item list (buy: add/bump; sell: drop a unit) and the next purse (spend or
  // credit allocation) through the pure equity engine, then dispatches both
  // together as one input write. Persist, mark dirty, and re-derive ONCE so the
  // whole cascade (armour, weapons, wealth totals) refreshes together — never
  // two overlapping saves. Nothing but the two existing input shapes is written.
  _editTrade({ items, wealth }) {
    if (!this._character || !Array.isArray(items) || !wealth || !wealth.coins) return;
    this._character = { ...this._character, items, wealth };
    saveTradeEdits({ items, wealth }, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's current health (damage / wounds / recovery
  // tests used / knocked-down state). Same inputs-only flow: merge the patch
  // into the health inputs, persist the overlay, mark the file dirty, and
  // re-derive so the standing (conscious / unconscious / dead) and headroom
  // recompute from the new damage. The overlay always stores the FULL merged
  // health object — a partial patch (e.g. `knockedDown: true`) must never
  // replace the recorded damage/wounds on the next replay.
  _editHealth(health) {
    if (!this._character || !health) return;
    const prevUsed = Number(this._character.resources?.health?.recoveriesUsed) || 0;
    const merged = { ...(this._character.resources?.health || {}), ...health };
    // New-day reset: recoveries drop from used back to 0 — the armed potion boost
    // expires with the day (an incidental 0→0 wound-heal must not clear it).
    if (prevUsed > 0 && (Number(merged.recoveriesUsed) || 0) === 0) this._pendingUse = null;
    this._character = {
      ...this._character,
      resources: {
        ...(this._character.resources || {}),
        health: merged,
      },
    };
    saveHealthEdits(merged, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // The Karma ledger (plans/PLAN-LEGEND-KARMA-RITUAL-LOG.md): the stored inputs are
  // `resources.karma.converted` (lifetime Karma gained) and `spent` (lifetime Karma
  // spent rolling dice); the spendable pool `available` is DERIVED
  // (`clamp(converted − spent, 0, max)`) and never written. Every branch below is an
  // input write on the ledger, persisted via saveKarmaEdits. Also refreshes the open
  // roll's karma snapshot so the modal's "N Karma" readout decrements live (re-derived
  // after the model re-derives — the modal holds `this._roll.karma`, taken when opened).
  _editKarma(detail) {
    if (!this._character) return;
    const cur = this._character.resources?.karma ?? {};
    const karma = this._model?.characteristics?.karma;
    const converted = Number(cur.converted) || 0;
    const spent = Number(cur.spent) || 0;
    const max = karma?.max;
    const available =
      Number.isFinite(max) && max != null ? Math.max(0, Math.min(max, converted - spent)) : null;
    let nextKarma;
    if (detail?.ritual) {
      // Paid Karma Ritual (homebrew Karma economy, plans/PLAN-HOMEBREW-KARMA.md): buy N
      // Karma for N × race cost Legend. Clamp defensively to the room under max and to
      // what Legend affords, so available Legend can never go negative even if the
      // caller over-asks. The spend is a dated, undoable log event; the Legend sink is
      // derived (`converted × cost`), so available Legend reflects it automatically.
      const cost = karma?.ritualCost;
      if (!Number.isFinite(cost) || cost <= 0) return; // rule off / no cost → no paid ritual
      const currentK = available ?? 0;
      const room = Number.isFinite(max) ? Math.max(0, max - currentK) : Infinity;
      const availLegend = this._model?.legend?.available;
      const affordable = Number.isFinite(availLegend) ? Math.floor(availLegend / cost) : Infinity;
      const points = Math.max(0, Math.min(Number(detail.ritual.points) || 0, room, affordable));
      if (points <= 0) return;
      const event = { id: uid(), date: new Date().toISOString(), points, cost, legend: points * cost };
      nextKarma = { ...cur, converted: converted + points, rituals: [...(cur.rituals ?? []), event] };
      this._showNotice(`Karma Ritual — bought ${points} Karma for ${points * cost} Legend.`);
    } else if (detail?.removeRitual) {
      // Undo a ritual purchase: drop the event and the `converted` it added. The Legend
      // returns via the derived sink (`converted × cost` drops by points × cost) — no
      // stored `available` to touch.
      const rituals = cur.rituals ?? [];
      const ev = rituals.find((r) => r.id === detail.removeRitual);
      if (!ev) return;
      const evPoints = Number(ev.points) || 0;
      nextKarma = { ...cur, converted: Math.max(0, converted - evPoints), rituals: rituals.filter((r) => r.id !== detail.removeRitual) };
      this._showNotice(`Undid a Karma Ritual — returned ${Number(ev.legend) || (evPoints * (Number(ev.cost) || 0))} Legend.`);
    } else if (detail?.refill) {
      // Free Karma Ritual (PG p.83, rule OFF): restore the derived pool to the derived
      // maximum by raising the ledger (`converted := spent + max`); no Legend cost. Max
      // is derived (Circle × racial modifier) — never stored.
      if (available == null) return;
      if (available >= max) return; // already full
      nextKarma = { ...cur, converted: spent + max };
      this._showNotice(`Karma Ritual performed — Karma restored to ${max}.`);
    } else {
      const spend = Number(detail?.spend) || 0;
      if (spend <= 0) return;
      if (available == null || available <= 0) return;
      nextKarma = { ...cur, spent: spent + Math.min(spend, available) };
    }
    this._character = {
      ...this._character,
      resources: { ...(this._character.resources || {}), karma: nextKarma },
    };
    saveKarmaEdits(nextKarma, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
    if (this._roll?.karma) {
      const derived = this._model?.characteristics?.karma?.available ?? null;
      this._roll = { ...this._roll, karma: { ...this._roll.karma, available: derived } };
    }
  }

  // A transient status message (auto-dismisses; click to dismiss early). Distinct
  // from the save toasts — used for in-app actions like the Karma Ritual.
  _showNotice(text) {
    this._notice = text;
    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => { this._notice = null; }, 3500);
  }

  // A view replaced the character's hand-written notes. Same inputs-only flow:
  // replace the top-level `notes` array, persist the overlay, re-derive (the
  // Notes tab just shows the inputs through — nothing derived feeds on them).
  _editNotes(notes) {
    if (!this._character || !Array.isArray(notes)) return;
    this._character = { ...this._character, notes };
    saveNotesEdits(notes, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A view replaced the character's dated history timeline. Same flow as notes.
  _editHistory(history) {
    if (!this._character || !Array.isArray(history)) return;
    this._character = { ...this._character, history };
    saveHistoryEdits(history, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A view replaced the character's Legend-earned entries (PLAN-NOTES-TAB,
  // decisions #1/#6). The earned log is now the source of truth for Total
  // Legend Earned: this merges the real entries into the legend inputs and
  // NEVER touches `totalEarnt` — the legacy branch value stays put and the
  // derived total is the pure sum (Phase B). The overlay stores `earned` only.
  _editLegendEarned(earned) {
    if (!this._character || !Array.isArray(earned)) return;
    this._character = {
      ...this._character,
      resources: {
        ...(this._character.resources || {}),
        legend: { ...(this._character.resources?.legend || {}), earned },
      },
    };
    saveLegendEdits(earned, this._characterId);
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // Rank editing guard (PLAN-RANK-EDITING §3.3): re-audit a *clone* carrying the
  // tentative rank and reject an increase that would push Available Legend below
  // 0. Defense-in-depth — the view only offers steps that fit — so a multi-step
  // or programmatic increase can never overdraw the sheet. Decreases always
  // pass (they refund). Mirrors deriveModel's audit inputs (resolved knacks).
  // Total Earned prices from the same derived total the Legend panel shows —
  // legacy `totalEarnt` plus the earned log (PLAN-NOTES-TAB Phase B) — so the
  // guard and the visible `available` can never disagree about affordability.
  _canAffordRank(character) {
    const totalEarnt = this._legendTotalEarnt(character);
    if (totalEarnt == null) return false;
    const spent = auditLegendSpent(character, this._rules.legendFile?.costs, {
      knacks: this._model?.knacks ?? [],
    });
    return legendAvailable(totalEarnt, spent.total) >= 0;
  }

  // The derived Total Legend Earned for a (possibly tentative) character:
  // the pure sum of the earned log plus any legacy `totalEarnt` input — the
  // single derivation path of PLAN-NOTES-TAB Phase B, mirrored here so the rank
  // guard prices off the same total the Legend panel derives. Null when neither
  // exists (nothing earned yet — the placeholder-pill case, never 0).
  _legendTotalEarnt(character) {
    const legend = character?.resources?.legend ?? {};
    const legacy = typeof legend.totalEarnt === 'number' ? legend.totalEarnt : null;
    const earned = Array.isArray(legend.earned) ? legend.earned : [];
    if (legacy == null && earned.length === 0) return null;
    return (legacy ?? 0) + earned.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }

  // A view bumped a talent's rank (edit mode). Ranks are inputs; the Legend
  // change is derived, so this handler owns the guard above plus persistence.
  // The overlay stores the FULL ranked disciplines/skills arrays — a partial
  // patch must never drop the other recorded ranks on replay.
  _editTalentRank({ discipline, name, rank }) {
    if (!this._character || !discipline || !name || !(rank >= 1)) return;
    const disc = (this._character.disciplines ?? []).find((d) => d.name === discipline);
    const talent = disc?.talents?.find((t) => t.name === name);
    if (!talent || rank === talent.rank) return;
    const increasing = rank > talent.rank;
    const nextCharacter = {
      ...this._character,
      disciplines: (this._character.disciplines ?? []).map((d) =>
        d.name === discipline
          ? { ...d, talents: (d.talents ?? []).map((t) => (t.name === name ? { ...t, rank } : t)) }
          : d,
      ),
    };
    if (increasing && !this._canAffordRank(nextCharacter)) return;
    this._character = nextCharacter;
    saveAdvancementEdits(
      { disciplines: nextCharacter.disciplines ?? [], skills: nextCharacter.skills ?? [] },
      this._characterId,
    );
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A view bumped a skill's rank (edit mode). Same inputs-only flow as talents:
  // guard increases against the derived Available Legend, persist the full
  // arrays, mark the file dirty, and re-derive.
  _editSkillRank({ name, rank }) {
    if (!this._character || !name || !(rank >= 1)) return;
    const skill = (this._character.skills ?? []).find((s) => s.name === name);
    if (!skill || rank === skill.rank) return;
    const increasing = rank > skill.rank;
    const nextCharacter = {
      ...this._character,
      skills: (this._character.skills ?? []).map((s) => (s.name === name ? { ...s, rank } : s)),
    };
    if (increasing && !this._canAffordRank(nextCharacter)) return;
    this._character = nextCharacter;
    saveAdvancementEdits(
      { disciplines: nextCharacter.disciplines ?? [], skills: nextCharacter.skills ?? [] },
      this._characterId,
    );
    this._markDirty();
    this._model = deriveModel(this._character, this._rules);
  }

  // A custom-item delta from the manager modal (PLAN-CUSTOM-ITEMS §5.3). The
  // view only dispatches the delta; this handler owns persistence.
  //   'draft' — write the `ed-custom-items` overlay instantly (a pending item
  //     survives a reload and an offline worker) and re-derive so the picker /
  //     catalog resolve it this session. Data still flows down through render.
  //   'save'  — POST the delta to /save-items with the session save key (re-prompt
  //     if absent, replaying on confirm); on success reconcile the overlay (the
  //     branch read becomes the truth), re-read the catalog, and toast the commit.
  _editCustomItems({ items, delete: deleteNames, action }) {
    if (!this._character) return;
    if (action === 'draft') {
      // Overlay write is instant and resilient; the committed catalog is
      // unchanged, so re-apply the overlay to it in place (no network fetch).
      // A net-empty delta (add-then-remove) clears the overlay — nothing pending.
      const delta = { items: items ?? {}, delete: deleteNames ?? [] };
      if (Object.keys(delta.items).length || delta.delete.length) saveCustomEdits(delta);
      else reconcileCustomEdits();
      this._dirty = hasPendingEdits(this._characterId) || hasCustomPendingEdits();
      this._rules = {
        ...this._rules,
        customItemsFile: applyCustomEdits(this._rules.customItemsCommittedFile, loadCustomEdits()),
      };
      this._model = deriveModel(this._character, this._rules);
      return;
    }
    if (action !== 'save') return;
    if (!Object.keys(items ?? {}).length && !(deleteNames ?? []).length) return;
    if (!this._saveKey) {
      this._pendingCustomSave = { items: items ?? {}, delete: deleteNames ?? [] };
      this._keyPrompt = true;
      return;
    }
    this._saveCustomItems(items ?? {}, deleteNames ?? []);
  }

  // The /save-items POST + catalog re-read (shared by the modal's Save and the
  // key-prompt replay). The overlay reconciles inside the re-read once the
  // branch reflects the delta (see _refreshCustomItems); on failure the overlay
  // keeps the delta so nothing is lost.
  async _saveCustomItems(items, deleteNames) {
    this._saving = true;
    this._saveError = null;
    this._saveOk = null;
    try {
      const commit = await saveCustomItems(items, { endpoint: this._endpointFor('save-items', DEFAULT_ITEMS_ENDPOINT), saveKey: this._saveKey, deleteNames });
      this._saveOk = commit; // { sha, url }
      await this._refreshCustomItems({ savedItems: items, deletedNames: deleteNames });
      this._dirty = hasPendingEdits(this._characterId) || hasCustomPendingEdits();
    } catch (e) {
      if (e instanceof SaveError && e.code === 'unauthorized') this._saveKey = null;
      this._saveError = e?.message ? String(e.message) : String(e);
    } finally {
      this._saving = false;
    }
  }

  // Re-read the custom-item catalog from the branch and re-derive the model with
  // the (possibly pending) overlay applied — keeps the picker, the merged
  // itemCatalog and the manager modal's committed baseline consistent.
  // A just-confirmed save passes its delta here: the overlay is reconciled only
  // once the re-read actually reflects it, so a git-consistent read that lags
  // the PUT never blanks a freshly saved item (PLAN-CUSTOM-ITEMS §6.6 P8.4).
  // The reflection check is content-aware (isItemsReflected): a lagged read that
  // returns the previous commit's file (same names, old content) stays pending
  // in the overlay instead of being reconciled away and masking the fresh edit.
  async _refreshCustomItems({ savedItems, deletedNames } = {}) {
    try {
      const committed = await loadCustomItems();
      const committedItems = committed?.items ?? {};
      const reflected = isItemsReflected(savedItems, deletedNames, committedItems);
      if (reflected) reconcileCustomEdits();
      this._rules = {
        ...this._rules,
        customItemsCommittedFile: committed,
        customItemsFile: applyCustomEdits(committed, loadCustomEdits()),
      };
      this._model = deriveModel(this._character, this._rules);
    } catch (e) {
      this._saveError = `Couldn't refresh custom items: ${e?.message ? String(e.message) : String(e)}`;
    }
  }

  // Local dev save targets: point the POSTs somewhere else via
  // `?save=<url>` / `?save-items=<url>` (tools/dev-server.mjs, README → Running
  // locally). Absent → the deployed worker (default behaviour — no config needed
  // to save). A bare origin or path resolves against the app's own origin.
  _endpointFor(param, fallback) {
    const raw = new URLSearchParams(location.search).get(param);
    return raw ? new URL(raw, location.href).href : fallback;
  }

  // Roll-time modifiers from live conditions. While Knocked Down every test
  // takes the condition's −3 (PG p.389: "suffers a –3 penalty to his tests" —
  // the worked example includes the next Initiative test, so there are no
  // Action-only or Initiative/Knockdown/Recovery exemptions). The only roll
  // that never takes it is the Karma die, which is a die roll, not a test. The
  // value comes from the engine's synthesized condition effect
  // (KNOCKED_DOWN_EFFECT) — a static number is never typed here, and the
  // penalty is applied at roll time, never folded into a stored/derived stat.
  _rollTimeMods({ kind } = {}) {
    if (!this._character?.resources?.health?.knockedDown) return [];
    if (kind === 'karma') return [];
    return [{ label: 'Knocked Down', value: KNOCKED_DOWN_EFFECT.value }];
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._onHide);
    window.removeEventListener('pagehide', this._onPageHide);
    this._clearAutosaveTimers();
    super.disconnectedCallback();
  }

  // A view edited an input: mark the local copy ahead of GitHub (the always-
  // visible Save icon shows its dot) and (re)arm the idle autosave.
  _markDirty() {
    this._dirty = true;
    this._scheduleAutosave();
  }

  // Debounced idle autosave: reset the idle timer on every change so a burst
  // coalesces into one save after `_autosaveSeconds` of quiet; a max-wait cap
  // (2× the interval) guarantees a save during continuous activity so a long
  // fight never goes unsaved. No-op when autosave is off.
  _scheduleAutosave() {
    if (!this._autosaveEnabled) return;
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => this._autosaveFire(), this._autosaveSeconds * 1000);
    if (!this._autosaveMaxTimer) {
      this._autosaveMaxTimer = setTimeout(() => this._autosaveFire(), this._autosaveSeconds * 2000);
    }
  }
  _clearAutosaveTimers() {
    clearTimeout(this._autosaveTimer);
    clearTimeout(this._autosaveMaxTimer);
    this._autosaveTimer = null;
    this._autosaveMaxTimer = null;
  }
  // Fire a background save — key-gated (never prompts) and silent (no toast). A
  // conflict is deferred (see _doSave); failures keep the dot dirty and the next
  // change re-arms the timer.
  _autosaveFire() {
    this._clearAutosaveTimers();
    if (!this._autosaveEnabled || !this._dirty || !this._saveKey || this._saving) return;
    this._doSave({ silent: true });
  }
  // Flush on tab-hide / page-unload — key-gated + silent, with keepalive so the
  // request survives the document going away. Best-effort: nothing is lost either
  // way (the overlay persists locally).
  _flushSave() {
    if (!this._autosaveEnabled || !this._dirty || !this._saveKey || this._saving) return;
    this._doSave({ silent: true, keepalive: true });
  }

  // Persist the autosave preferences (Settings modal) and re-arm/cancel the timer.
  _applySettings({ enabled, seconds } = {}) {
    this._autosaveEnabled = enabled !== false;
    if (Number.isFinite(seconds)) this._autosaveSeconds = seconds;
    localStorage.setItem('ed-autosave', this._autosaveEnabled ? 'on' : 'off');
    localStorage.setItem('ed-autosave-seconds', String(this._autosaveSeconds));
    this._settings = false;
    if (!this._autosaveEnabled) this._clearAutosaveTimers();
    else if (this._dirty) this._scheduleAutosave();
  }

  // Manual Save button → a loud save (toast on success/failure). The background
  // save path calls `_doSave({ silent: true })` — same store, no toast noise.
  _save() {
    this._doSave({ silent: false });
  }

  // Save to GitHub: POST the merged, inputs-only character to the worker, which
  // commits it to the character-data branch (store-server.js). Requires a
  // SAVE_KEY — if none is set for the session, open the key prompt first; the
  // overlay already holds the edits, so nothing is lost meanwhile. On success,
  // reconcile the overlay so the branch read becomes the source of truth (§4.5).
  //
  // `base` is the optimistic-concurrency token: the file sha this client last
  // saw (`_baseSha`). A `stale_base` rejection (the character changed on the
  // branch) opens the conflict modal instead of an error toast — the modal's
  // keep-mine re-save passes the branch's current sha as the acknowledged base.
  // `silent` (background) suppresses the success/error toasts; a conflict still
  // surfaces (never silently dropped).
  async _doSave({ silent = false, base = this._baseSha, keepalive = false } = {}) {
    if (!this._character || this._saving) return;
    if (!this._saveKey) {
      // Never prompt for the key from a background/flush save — those are
      // key-gated by the caller, so this only fires on a manual Save.
      this._pendingSaveSilent = silent;
      this._keyPrompt = true;
      return;
    }
    this._clearAutosaveTimers(); // a save is happening now — cancel any pending one
    this._saving = true;
    if (!silent) {
      this._saveError = null;
      this._saveOk = null;
    }
    try {
      let commit = await saveServer(this._character, { endpoint: this._endpointFor('save', DEFAULT_ENDPOINT), saveKey: this._saveKey, id: this._characterId, base, keepalive });
      this._baseSha = commit.sha; // the optimistic-concurrency token for the next save
      reconcileOverlay(undefined, this._characterId);
      // The save dot also reflects a pending custom-item delta, so a confirmed
      // Save commits that too — /save-items POST, reconcile, re-read the catalog.
      const pending = loadCustomEdits();
      if (pending && (Object.keys(pending.items ?? {}).length || (pending.delete ?? []).length)) {
        const customCommit = await saveCustomItems(pending.items ?? {}, { endpoint: this._endpointFor('save-items', DEFAULT_ITEMS_ENDPOINT), saveKey: this._saveKey, deleteNames: pending.delete ?? [] });
        commit = customCommit; // last commit link wins
        await this._refreshCustomItems({ savedItems: pending.items ?? {}, deletedNames: pending.delete ?? [] });
      }
      this._dirty = hasPendingEdits(this._characterId) || hasCustomPendingEdits();
      if (!silent) this._saveOk = commit; // { sha, url }
    } catch (e) {
      // A stale base — the character changed on the branch since this client
      // loaded (or last saved) it. Surface the conflict modal, never a toast:
      // the overlay still holds the local draft, and the modal decides whether
      // the branch version wins.
      if (e instanceof SaveConflictError) {
        // A LOUD (manual) save surfaces the conflict modal now. A SILENT
        // (autosave / flush-on-hide) one must NOT interrupt play — leave the
        // overlay dirty and defer the conflict to the next explicit Save.
        if (!silent) this._conflict = { sha: e.sha, silent };
      } else {
        // A rejected key: drop it so the next Save re-prompts.
        if (e instanceof SaveError && e.code === 'unauthorized') this._saveKey = null;
        if (!silent) this._saveError = e?.message ? String(e.message) : String(e);
        this._dirty = hasPendingEdits(this._characterId) || hasCustomPendingEdits();
      }
    } finally {
      this._saving = false;
    }
  }

  // Route a conflict-modal choice through the pure nextSaveAction helper:
  // keep-mine → re-save with the branch's current sha as the acknowledged base;
  // take-theirs → discard the local draft and reload the branch version; cancel
  // → close, the local overlay stays dirty and nothing is written.
  _applyConflictChoice(choice) {
    const step = nextSaveAction({ choice, conflictSha: this._conflict?.sha ?? null });
    const silent = this._conflict?.silent ?? false;
    this._conflict = null;
    if (step.action === 'none') return;
    if (step.action === 'resave') this._doSave({ silent, base: step.base });
    else if (step.action === 'reload') {
      reconcileOverlay(undefined, this._characterId); // clear the local draft
      this._reloadSaved();
    }
  }

  // Export a local copy: a portable download of the same inputs-only bytes. A
  // backup, independent of the GitHub save — no key, no network, all browsers.
  _export() {
    if (!this._character) return;
    try {
      exportCharacter(this._character);
    } catch (e) {
      this._saveError = `Export failed: ${e?.message ? String(e.message) : String(e)}`;
    }
  }

  _saveTitle() {
    if (this._saving) return 'Saving to GitHub…';
    return this._dirty ? 'Save to GitHub (unsaved changes)' : 'Saved to GitHub';
  }

  // Discard the local autosave draft and reload the saved (GitHub) version of
  // the current character. Clears the overlay so it can't mask the branch, then
  // re-loads from source — the fix for a stale local draft leaking over a newer
  // GitHub save. Also the "take theirs" half of a stale_base conflict.
  _discardLocal() {
    this._confirmDiscard = false;
    reconcileOverlay(undefined, this._characterId); // clear every saved category from the overlay
    this._reloadSaved();
  }

  // Reload the current character from the branch, refreshing `_baseSha` to the
  // file's current sha. A pending custom-item delta is a separate, global overlay
  // and survives.
  async _reloadSaved() {
    try {
      const { character, rules, base } = await loadCharacter(this._characterId);
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
      this._baseSha = base;
      this._dirty = hasCustomPendingEdits();
      this._saveError = null;
    } catch (e) {
      this._saveError = `Couldn't reload the saved version: ${e?.message ? String(e.message) : String(e)}`;
    }
  }

  _applyTheme() {
    // Force the color-scheme on the document root so light-dark() everywhere follows it.
    document.documentElement.style.colorScheme = this._dark ? 'dark' : 'light';
  }

  _toggleTheme() {
    this._dark = !this._dark;
    localStorage.setItem('ed-theme', this._dark ? 'dark' : 'light');
    this._applyTheme();
  }

  _panel() {
    const m = this._model;
    switch (this._tab) {
      case 'overview':
        return html`<ed-overview .model=${m} .editMode=${this._editMode} .arming=${this._arming()}></ed-overview>`;
      case 'disciplines':
        return html`<ed-disciplines .model=${m} .editMode=${this._editMode}></ed-disciplines>`;
      case 'spells':
        return html`<div class="stub"><span class="big">✦</span>Spellbook — matrices and spells by circle. Coming soon.</div>`;
      case 'equipment':
        return html`<ed-equipment
          .model=${m}
          .editMode=${this._editMode}
          .arming=${this._arming()}
          .customCommitted=${m.customCommittedCatalog}
          .customOverlay=${loadCustomEdits()}
          .customCanonKeys=${m.customCanonKeys}
        ></ed-equipment>`;
      case 'combat':
        return html`<ed-combat
          .model=${m}
          .editMode=${this._editMode}
          .characterId=${this._characterId}
          .arming=${this._arming()}
        ></ed-combat>`;
      case 'notes':
        return html`<ed-notes
          .model=${m}
          .editMode=${this._editMode}
          .characterId=${this._characterId}
        ></ed-notes>`;
      default:
        return html``;
    }
  }

  render() {
    const isDev = location.pathname.includes('/dev/');
    if (this._error) return html`<p class="status error">Could not load character: ${this._error}</p>`;
    return html`
      ${isDev ? html`<div class="dev-pill" title="Development environment">DEV</div>` : ''}
      <div class="tabbar" role="tablist">
        ${TABS.map(
          (t) => html`
            <button
              class="tab"
              role="tab"
              aria-selected=${this._tab === t.id}
              @click=${() => (this._tab = t.id)}
            >
              <span class="ico" aria-hidden="true">${t.icon}</span>${t.label}
            </button>
          `,
        )}
        <button
          class="icon-btn edit ${this._editMode ? 'active' : ''}"
          role="switch"
          aria-checked=${this._editMode}
          @click=${() => (this._editMode = !this._editMode)}
          title=${this._editMode ? 'Finish editing' : 'Edit character details'}
          aria-label=${this._editMode ? 'Finish editing' : 'Edit character details'}
        ><span aria-hidden="true">✎</span></button>
        ${this._editMode && this._dirty
          ? html`<button
                class="icon-btn revert"
                @click=${() => (this._confirmDiscard = true)}
                title="Discard local changes (reload the saved version)"
                aria-label="Discard local changes (reload the saved version)"
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3 -6.7l-3 2.7" />
                  <path d="M3 4v4h4" />
                </svg></button>`
          : ''}
        ${this._characterId
          ? html`<button
                class="icon-btn save ${this._dirty ? 'dirty' : ''}"
                @click=${this._save}
                ?disabled=${this._saving}
                title=${this._saveTitle()}
                aria-label=${this._saveTitle()}
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
                  <circle cx="12" cy="14" r="2" />
                  <path d="M14 4v4h-6v-4" />
                </svg></button>`
          : ''}
        ${this._editMode
          ? html`<button
                class="icon-btn export"
                @click=${this._export}
                title="Export a copy (download)"
                aria-label="Export a copy (download)"
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M8 11l4 4l4 -4" />
                  <path d="M5 19h14" />
                </svg></button>`
          : ''}
        <button
          class="icon-btn load"
          @click=${this._pickCharacter}
          title="Load a character"
          aria-label="Load a character"
        ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20h16a2 2 0 0 0 2 -2v-9a2 2 0 0 0 -2 -2h-7l-2 -3h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2" />
            <path d="M9.5 10v5" /><path d="M7 12.5h5" />
          </svg></button>
        <button
          class="icon-btn settings"
          @click=${() => (this._settings = true)}
          title="Settings (autosave)"
          aria-label="Settings"
        ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg></button>
        <button
          class="icon-btn theme"
          @click=${this._toggleTheme}
          title=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >${this._dark ? '☀' : '☾'}</button>
      </div>
      ${this._model
        ? this._panel()
        : this._noSelection
          ? html`<div class="stub">
              <span class="big">▤</span>No character selected
              <div style="margin-top: 0.5rem">
                <button class="icon-btn" style="border-radius: 6px; padding: 6px 14px; width: auto; height: auto"
                        @click=${() => (this._picker = true)}>Choose a character</button>
              </div>
            </div>`
          : html`<p class="status">Loading character…</p>`}
      ${this._picker
        ? html`<ed-character-picker
            .characters=${this._characters ?? []}
            .current=${this._characterId}
            @close=${() => {
              this._picker = false;
              if (!this._model) this._noSelection = true;
            }}
          ></ed-character-picker>`
        : ''}
      ${this._roll
        ? html`<ed-roll-modal
            .rollId=${this._roll.rollId}
            .label=${this._roll.label}
            .stepRow=${this._roll.stepRow}
            .karma=${this._roll.karma}
            .apply=${this._roll.apply}
            .difficulty=${this._roll.difficulty}
            .mods=${this._roll.mods}
            @close=${() => (this._roll = null)}
          ></ed-roll-modal>`
        : ''}
      ${this._keyPrompt ? html`<ed-save-key @close=${() => { this._keyPrompt = false; this._pendingCustomSave = null; this._pendingSaveSilent = null; }}></ed-save-key>` : ''}
      ${this._conflict
        ? html`<ed-conflict @close=${() => (this._conflict = null)}></ed-conflict>`
        : ''}
      ${this._settings
        ? html`<ed-settings
            .enabled=${this._autosaveEnabled}
            .seconds=${this._autosaveSeconds}
            @ed-settings=${(e) => this._applySettings(e.detail)}
            @close=${() => (this._settings = false)}
          ></ed-settings>`
        : ''}
      ${this._confirmDiscard
        ? html`<ed-confirm
            heading="Discard local changes?"
            message="This clears the unsaved edits stored in this browser and reloads the character saved on GitHub. It can't be undone."
            confirmLabel="Discard"
            @confirm=${this._discardLocal}
            @close=${() => (this._confirmDiscard = false)}
          ></ed-confirm>`
        : ''}
      ${this._confirmSwitch
        ? html`<ed-confirm
            heading="Load a different character?"
            message="Your unsaved edits for this character stay saved in this browser, and come back if you load it again."
            confirmLabel="Continue"
            @confirm=${() => {
              this._confirmSwitch = false;
              this._picker = true;
            }}
            @close=${() => (this._confirmSwitch = false)}
          ></ed-confirm>`
        : ''}
      <footer>Earthdawn Character Sheet : Created by Odenson : Inspired by ED4<ed-changelog></ed-changelog><ed-homebrew .rules=${this._model?.homebrewRules ?? []}></ed-homebrew></footer>
      ${this._saveError
        ? html`<div class="toast error" role="alert" @click=${() => (this._saveError = null)}>
            Couldn't save: ${this._saveError}
          </div>`
        : ''}
      ${this._saveOk
        ? html`<div class="toast ok" role="status" @click=${() => (this._saveOk = null)}>
            Saved to GitHub ✓ ${this._saveOk.url ? html`— <a href=${this._saveOk.url} target="_blank" rel="noopener">view commit</a>` : ''}
          </div>`
        : ''}
      ${this._notice
        ? html`<div class="toast ok" role="status" @click=${() => (this._notice = null)}>${this._notice}</div>`
        : ''}
    `;
  }
}

customElements.define('ed-app', EdApp);
