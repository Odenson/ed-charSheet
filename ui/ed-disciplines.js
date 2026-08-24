// ui/ed-disciplines.js — the Disciplines tab: a toggle between the character's
// disciplines, each showing its detail, talents (with step/dice) and per-circle
// abilities. Talents live here (there is no separate Talents tab).
//
// Each talent carries one merged control: a small circle that shows whether the
// talent is a required Discipline Talent (filled) or a chosen Talent Option
// (outline) AND is the info button — clicking it opens a paraphrased detail
// modal. A terse Effect column summarises what the talent does (hidden on mobile,
// where the detail is a tap away). All talent wording is our own generic
// paraphrase (rules/talents.json), never verbatim rulebook prose.
import { LitElement, html, css } from 'lit';
import { ModalController } from './modal-controller.js';
import { payFromPurse, coinsSilver } from '../engine/wealth.js';

export class EdDisciplines extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    _sel: { state: true },
    _modal: { state: true },
    _trainSilver: { state: true },
    _skillSilver: { state: true },
  };

  static styles = css`
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
      display: block;
    }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
    .seg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
    .seg button { border: none; background: none; padding: 6px 16px; border-radius: 999px; font: inherit; font-size: var(--fs-body); color: var(--muted); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .circle { font-size: var(--fs-small); padding: 2px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); }
    /* Circle-advancement track: previous · current · next Circle, keeping the
       pill (ellipse) shape. Current is amber "Circle N"; the next pill turns
       green with an up-arrow when the talents meet its rank gate; the current
       pill flips to a warning tint when the stored Circle isn't justified. */
    .ctrack { display: inline-flex; align-items: center; gap: 8px; }
    /* One pill spec for all three so prev/current/next share height and shape; a
       transparent border on the filled pills keeps the box identical to the
       bordered step pills. Only colour and label differ. */
    .cpill { padding: 4px 13px; border: 1px solid transparent; box-sizing: border-box; border-radius: 999px; font-size: var(--fs-small); font-weight: 500; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; cursor: default; }
    .cpill.edge { border-color: var(--border); color: var(--muted); font-weight: 400; }
    .cpill.cur { background: var(--accent-bg); color: var(--accent); }
    .cpill.cur.warn { background: light-dark(#fbe9e7, #3a1f1c); color: light-dark(#c0392b, #e06557); }
    .cpill.edge.ready { background: var(--karma-bg); color: var(--karma); border-color: var(--karma); font-weight: 500; }
    .clnk { width: 14px; height: 2px; background: var(--border); flex: none; }
    .clnk.ready { background: var(--karma); }
    button.cpill { font-family: inherit; cursor: pointer; }
    button.cpill:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--karma-bg); }
    /* Confirm-modal actions (train to next Circle). */
    .mactions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .mbtn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--fg); }
    .mbtn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .mbtn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
    .mbtn:disabled { opacity: 0.4; cursor: not-allowed; }
    /* Train-to-Circle cost rows: Legend and the editable silver fee, each checked. */
    .cbox { background: var(--bg-chip); border: 1px solid var(--border); border-radius: 8px; padding: 2px 12px; margin: 10px 0; }
    .crow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .crow:last-child { border-bottom: none; }
    .ck { font-size: var(--fs-small); }
    .csub { font-size: var(--fs-fine); color: var(--muted); margin-top: 2px; }
    .cchk { font-size: var(--fs-small); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .cchk.ok { color: var(--karma); }
    .cchk.bad { color: light-dark(#c0392b, #e06557); }
    .silin { width: 66px; font: inherit; font-size: var(--fs-small); text-align: center; color: var(--fg); background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 3px 4px; }
    .mnote2 { display: flex; gap: 7px; align-items: flex-start; font-size: var(--fs-fine); color: var(--muted); line-height: 1.5; margin: 4px 0 12px; }
    /* Durability fits its label, Half-magic grows into the freed space, Artisan
       keeps its natural content width. */
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .mcell { background: var(--bg-card); border-radius: 8px; padding: 6px 9px; }
    .mcell.dur { flex: 0 0 auto; }
    .mcell.half { flex: 1 1 200px; min-width: 0; display: flex; align-items: center; gap: 10px; }
    .mcell.half .htext { min-width: 0; flex: 1 1 auto; }
    .mcell.half .hroll { display: flex; align-items: center; gap: 6px; flex: none; }
    .mcell.half .hstep { font-size: var(--fs-small); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mcell.art { flex: 0 0 auto; }
    /* Half-Magic attribute picker (in the shared modal): one button per attribute
       with its derived step·dice; the default (Perception) wears a chip. */
    .hmopts { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .hmopt { display: flex; justify-content: space-between; align-items: center; gap: 12px; font: inherit; font-size: var(--fs-body); text-align: left; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--fg); cursor: pointer; }
    .hmopt:hover { border-color: var(--accent); }
    .hmopt:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); border-color: var(--accent); }
    .hmatt { display: inline-flex; align-items: center; gap: 8px; }
    .hmdef { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); background: var(--accent-bg); border-radius: 999px; padding: 1px 7px; }
    .hmstep { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
    /* "+ add option" affordance and the Talent-Option picker rows. */
    .addopt { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: var(--fs-small); color: var(--accent); background: none; border: 1px dashed var(--border); border-radius: 8px; padding: 4px 10px; margin: 5px 0 3px; cursor: pointer; }
    .addopt:hover { border-color: var(--accent); }
    .addopt:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); border-color: var(--accent); }
    .addopt.muted { color: var(--muted); cursor: default; font-style: italic; }
    .lopt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font: inherit; font-size: var(--fs-body); text-align: left; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--fg); cursor: pointer; }
    .lopt:hover { border-color: var(--accent); }
    .lopt:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); border-color: var(--accent); }
    .lbrief { font-size: var(--fs-small); color: var(--muted); }
    .mcell .k { font-size: var(--fs-eyebrow); color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .mcell .v { font-size: var(--fs-body); margin-top: 1px; }
    .card { background: var(--bg-card); border-radius: 8px; padding: 8px 10px; }
    h4 { margin: 0 0 6px; font-size: var(--fs-eyebrow); font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .trow { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.3fr) 44px 100px 76px 24px; gap: 8px; align-items: center; font-size: var(--fs-body); padding: 5px 0; border-bottom: 1px solid var(--border); }
    .trow:last-child { border-bottom: none; }
    .trow.h { font-size: var(--fs-eyebrow); color: var(--muted); text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sd { font-size: var(--fs-small); color: var(--muted); }
    .eff { font-size: var(--fs-small); color: light-dark(#3a4250, #cbd3de); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tname { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
    .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .thpad { padding-left: 22px; }
    /* One control per talent: shows required (filled) vs optional (outline) AND is
       the info button that opens the detail modal. */
    .tinfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 500; font-style: italic; font-size: var(--fs-eyebrow); line-height: 1; font-family: system-ui, sans-serif;
      transition: filter 0.12s ease, border-color 0.12s ease; }
    .tinfo.req { background: var(--accent); border: 1px solid var(--accent); color: var(--accent-bg); }
    .tinfo.opt { background: transparent; border: 1.5px solid var(--muted); color: var(--muted); box-sizing: border-box; }
    .tinfo:hover { filter: brightness(1.12); }
    .tinfo.opt:hover { border-color: var(--accent); color: var(--fg); }
    .tinfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
    .trow.opt .lbl, .trow.opt .num, .trow.opt .sd, .trow.opt .eff { color: var(--muted); }
    .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin: 0 0 6px; font-size: var(--fs-eyebrow); color: var(--muted); }
    .legend .li { display: inline-flex; align-items: center; gap: 7px; }
    .legend .tinfo { cursor: default; }
    .roll { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--fs-fine); padding: 0; }
    .roll:disabled { opacity: 0.35; cursor: default; border-color: var(--border); background: none; color: var(--muted); }
    .abil { display: flex; gap: 10px; padding: 5px 0; font-size: var(--fs-body); align-items: baseline; }
    .cbadge { font-size: var(--fs-eyebrow); padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); flex: none; }
    .section-gap { margin-top: 14px; }

    /* Talent grouping by learned Circle (Option 2 — left circle spine). Each
       group is a flex row: a fixed left gutter carrying the Circle badge and a
       connecting line, and the talent rows to its right. The header row rides an
       empty gutter so its columns line up with every group's rows. */
    .tgroup { display: flex; gap: 12px; }
    .tspine { flex: none; width: 30px; display: flex; flex-direction: column; align-items: center; }
    .tbody { flex: 1; min-width: 0; }
    .cbadge2 { width: 26px; height: 26px; border-radius: 50%; background: var(--accent-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-small); font-weight: 500; flex: none; margin-top: 5px; }
    .cline { flex: 1; width: 2px; background: var(--border); margin-top: 6px; min-height: 8px; }

    /* Rank editing (edit mode): the Rank cell becomes a − rank + stepper. The
       grid widens its column to fit; the wide column swaps back on mobile. Only
       400/500 weights, theme-aware. */
    .trow.edit { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.3fr) 96px 100px 76px 24px; }
    .stepctl { display: inline-flex; align-items: center; gap: 5px; justify-self: end; }
    .step { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-chip); color: var(--fg); font: inherit; font-size: var(--fs-value); line-height: 1; cursor: pointer; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
    .step:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .step:disabled { opacity: 0.35; cursor: default; }
    .srank { min-width: 20px; text-align: center; font-variant-numeric: tabular-nums; }
    .legendbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .lchip { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
    .lchip b { font-weight: 500; color: var(--accent); font-family: var(--mono); }
    .hint { font-size: var(--fs-small); color: var(--karma); }
    .pend { font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 7px; }
    /* Rank-grant chip (PLAN-RANK-GRANTS.md D5): the folded +N beside the learned
       rank, source-named via tooltip. Theme-aware; never alters the stored rank. */
    .gchip { font-size: var(--fs-fine); font-weight: 500; color: var(--accent); background: var(--accent-bg); border-radius: 999px; padding: 0 5px; margin-left: 4px; }
    /* Active test-bonus (e.g. a sustained spell's +N to this talent's tests): a
       flat mod folded into the roll, shown as a compact accent pill beside the rank
       — styled identically to the rank-grant chip (.gchip) so a spell-fed test
       bonus and a thread-fed rank grant read the same. The measure (step/result)
       lives in the tooltip; the shown step already has the bonus folded in. */
    .rmod { font-size: var(--fs-fine); font-weight: 500; color: var(--accent); background: var(--accent-bg); border-radius: 999px; padding: 0 5px; margin-left: 5px; font-variant-numeric: tabular-nums; white-space: nowrap; }

    /* Skills tab: reuses the .trow grid so the columns line up with the talent
       table. Knacks derive from a skill or talent and render as an indented child
       row beneath the row that governs them. */
    .knrow { display: flex; align-items: center; padding: 3px 0 3px 24px; font-size: var(--fs-small); color: var(--muted); border-bottom: 1px solid var(--border); }
    .knrow:last-child { border-bottom: none; }
    .knrow .arr { color: var(--accent); margin-right: 6px; }
    .kninfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 500; font-style: italic; font-size: var(--fs-eyebrow); line-height: 1; font-family: system-ui, sans-serif; box-sizing: border-box;
      background: transparent; border: 1.5px solid var(--muted); color: var(--muted);
      margin-right: 7px; transition: border-color 0.12s ease, color 0.12s ease; }
    .kninfo:hover { border-color: var(--accent); color: var(--fg); }
    .kninfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
    .knlbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ktag { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 6px; margin-left: 7px; }
    /* Neutral info control per skill (skills have no required/optional split). Opens
       a detail modal — mirrors the talent info button. */
    .sinfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 500; font-style: italic; font-size: var(--fs-eyebrow); line-height: 1; font-family: system-ui, sans-serif; box-sizing: border-box;
      background: transparent; border: 1.5px solid var(--muted); color: var(--muted);
      transition: border-color 0.12s ease, color 0.12s ease; }
    .sinfo:hover { border-color: var(--accent); color: var(--fg); }
    .sinfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }

    /* Detail modal (Escape / backdrop / ✕ close), theme-aware. */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; max-width: 30rem; width: 100%; max-height: 85vh; overflow: auto; padding: 14px 16px; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
    .mtitle { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-value); font-weight: 500; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-value); line-height: 1; cursor: pointer; }
    .mchips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { font-size: var(--fs-eyebrow); color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; }
    .chip.effc { color: var(--accent); background: var(--accent-bg); border-color: transparent; }
    .mtext { font-size: var(--fs-body); line-height: 1.5; margin: 6px 0; }
    .mnote { font-size: var(--fs-small); color: var(--karma); background: var(--karma-bg); border-radius: 6px; padding: 6px 9px; margin-top: 8px; }

    @media (max-width: 620px) {
      .trow { grid-template-columns: minmax(0, 1fr) 40px 92px 24px; }
      .trow.edit { grid-template-columns: minmax(0, 1fr) 88px 92px 24px; }
      .trow .action, .effcol { display: none; }
      .meta { flex-direction: column; }
      .mcell.dur, .mcell.half, .mcell.art { flex: 1 1 auto; }
    }
  `;

  constructor() {
    super();
    this._sel = 0;
    this._modal = null;
    // Shared modal focus contract (docs/MODALS.md): Escape closes, focus moves
    // into the dialog on open and returns to the trigger on close (ring
    // suppressed for pointer opens). The controller owns the Escape listener and
    // the focus trap; this component only opens/closes it.
    this._modalCtl = new ModalController(this, { onClose: () => { this._modal = null; } });
  }

  // Open the detail modal for `entry` and hand the controller the trigger so
  // focus can return to it on close. Every info button routes through here.
  _openModal(entry, event) {
    this._modal = entry;
    this._modalCtl.opened(event?.currentTarget);
  }

  _talentRow(t, discName) {
    // Karma context for the roll modal: talents are Karma-eligible by default, so
    // t.karma carries the grant. Pull the pool's amount/die step from the derived
    // Karma characteristic, exactly like the Overview.
    const karmaCtx = t.karma?.grants?.length
      ? {
          grants: t.karma.grants,
          available: this.model?.characteristics?.karma?.available ?? null,
          step: this.model?.characteristics?.karma?.step ?? null,
        }
      : null;
    const status = t.required ? 'required Discipline talent' : 'chosen Talent option';
    return html`
      <div class="trow ${t.required ? '' : 'opt'}${this.editMode ? ' edit' : ''}">
        <span class="tname">
          <button
            class="tinfo ${t.required ? 'req' : 'opt'}"
            aria-label="${t.name} — ${status}, view details"
            title="${t.name} — ${status}. Click for details."
            @click=${(e) => this._openModal(t, e)}
          >i</button>
          <span class="lbl">${t.name}</span>
        </span>
        <span class="effcol eff" title=${t.brief ?? ''}>${t.brief ?? ''}</span>
        ${this.editMode ? this._rankCtl(t, discName) : html`<span class="num">${t.rank}${this._grantChip(t)}${this._modChip(t)}</span>`}
        <span class="sd">${t.step != null ? html`${t.step} · ${t.dice}` : '—'}</span>
        <span class="action sd">${t.action ?? ''}</span>
        <button
          class="roll"
          ?disabled=${t.step == null}
          title=${t.step == null ? 'No step to roll' : `Roll ${t.name}${karmaCtx ? ' (Karma available)' : ''}`}
          aria-label="Roll ${t.name}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('ed-roll', { detail: { label: t.name, step: t.step, karma: karmaCtx, mods: t.resultMods ?? [] }, bubbles: true, composed: true }),
            )}
        >⚄</button>
      </div>
    `;
  }

  // Edit-mode rank stepper for one talent/skill row. The prices come off the
  // derived `pricing` (increaseCost/refund/affordable); `+` needs the step priced
  // AND affordable, `−` needs a refund (Rank 1 is the floor and refunds null).
  // Tooltips name the Legend amount; when no Total Legend is recorded yet, every
  // increase is blocked and the hint explains why (UI-GUIDELINES §5: unpriceable
  // shows —, never a fabricated cost).
  _rankCtl(t, discName) {
    const p = t.pricing ?? null;
    const up = !!(p && p.increaseCost != null);
    const affordable = !!(p && p.affordable);
    const down = !!(p && p.refund != null);
    const noLegend = this.model?.legend == null;
    const upTitle = !up
      ? 'Cannot price this step'
      : noLegend
        ? `Costs ${p.increaseCost} Legend — enter Total Legend earned to enable`
        : affordable
          ? `Costs ${p.increaseCost} Legend (${t.rank} → ${t.rank + 1})`
          : `Costs ${p.increaseCost} Legend — not enough Available Legend`;
    const downTitle = !down
      ? t.rank <= 1
        ? 'Rank can’t go below 1'
        : 'Cannot price this step'
      : `Refunds ${p.refund} Legend (${t.rank} → ${t.rank - 1})`;
    return html`
      <span class="stepctl" role="group" aria-label="Edit ${t.name} rank">
        <button class="step" ?disabled=${!down} title=${downTitle} aria-label="Decrease ${t.name} rank" @click=${() => this._stepRank(t, discName, -1)}>−</button>
        <span class="srank">${t.rank}</span>
        <button class="step" ?disabled=${!up || !affordable} title=${upTitle} aria-label="Increase ${t.name} rank" @click=${() => this._stepRank(t, discName, 1)}>+</button>
      </span>
    `;
  }

  // One rank step, dispatched up to ed-app (data flows up, never mutated here).
  // Talents carry their Discipline name so the app can locate the row's input.
  _stepRank(t, discName, delta) {
    const talent = discName != null;
    this.dispatchEvent(
      new CustomEvent(talent ? 'ed-edit-talent-rank' : 'ed-edit-skill-rank', {
        detail: { name: t.name, rank: t.rank + delta, ...(talent ? { discipline: discName } : {}) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _talentModal(t) {
    const dt = t.detail ?? {};
    const chips = [
      t.brief ? { c: 'effc', v: t.brief } : null,
      { v: t.required ? 'Required' : 'Optional' },
      t.action ? { v: `${t.action} action` } : null,
      t.attribute ? { v: t.attribute } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
      dt.tier ? { v: dt.tier } : null,
      dt.skillUse && dt.skillUse.allowed === false ? { v: 'No skill use' } : null,
      dt.versus ? { v: `vs ${dt.versus}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${t.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="tinfo ${t.required ? 'req' : 'opt'}" aria-hidden="true">i</span>${t.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip ${c.c ?? ''}">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Full details coming.</div>`}
          ${(dt.notes ?? []).map((n) => html`<div class="mnote">${n}</div>`)}
          ${t.grantSources?.length
            ? html`<div class="mnote">Rank ${t.rank} ${this._grantSign(t.rankBonus)}${Math.abs(t.rankBonus ?? 0)} by ${this._grantTitle(t.grantSources)} — absorbed into the step above.</div>`
            : ''}
        </div>
      </div>
    `;
  }

  // One skill row, using the same .trow grid as talents so the columns line up.
  // Skills carry name/rank/tier today; Effect/Step/Action stay empty (— for step)
  // until that data is added, and the roll enables once a skill has a step. Tier
  // lives in the detail modal, matching how talents show their tier.
  _skillRow(s) {
    return html`
      <div class="trow${this.editMode ? ' edit' : ''}">
        <span class="tname">
          <button
            class="sinfo"
            aria-label="${s.name} — view details"
            title="${s.name} — click for details"
            @click=${(e) => this._openModal({ type: 'skill', skill: s }, e)}
          >i</button>
          <span class="lbl">${s.name}</span>
        </span>
        <span class="effcol eff" title=${s.brief ?? ''}>${s.brief ?? ''}</span>
        ${this.editMode ? this._rankCtl(s, null) : html`<span class="num">${s.rank}${this._grantChip(s)}${this._modChip(s)}</span>`}
        <span class="sd">${s.step != null ? html`${s.step} · ${s.dice}` : '—'}</span>
        <span class="action sd">${s.action ?? ''}</span>
        <button
          class="roll"
          ?disabled=${s.step == null}
          title=${s.step == null ? 'No step to roll' : `Roll ${s.name}`}
          aria-label="Roll ${s.name}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('ed-roll', { detail: { label: s.name, step: s.step, karma: null, mods: s.resultMods ?? [] }, bubbles: true, composed: true }),
            )}
        >⚄</button>
      </div>
    `;
  }

  // Skills tab: the character's skills in the same table shape as the talent list,
  // with any knacks nested under the skill they derive from. Knacks arrive already
  // resolved from the store ({ name, parent:{type,name} }) — only knacks whose parent
  // is a skill belong here, nested under that skill's row; a knack whose parent is a
  // talent renders on the discipline talent tables instead. No stray knacks at the end.
  _skillsView(skills, knacks) {
    const byParent = new Map();
    for (const k of knacks ?? []) {
      if (k.parent?.type !== 'skill') continue;
      const parent = k.parent?.name ?? null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(k);
    }
    return html`
      <div class="card">
        <div class="trow h${this.editMode ? ' edit' : ''}">
          <span class="thpad">Skill</span>
          <span class="effcol">Effect</span>
          <span class="num">Rank</span>
          <span>Step</span>
          <span class="action">Action</span>
          <span></span>
        </div>
        ${skills.map(
          (s) => html`
            ${this._skillRow(s)}
            ${(byParent.get(s.name) ?? []).map((k) => this._knackRow(k))}
          `,
        )}
        ${this.editMode ? this._addSkillSlot() : ''}
      </div>
    `;
  }

  // Edit-mode "+ add skill" affordance (PLAN-LEARN-SKILLS Q4). Shows whenever
  // there is at least one learnable catalog skill; opens the scoped picker.
  _addSkillSlot() {
    const opts = this.model?.skillOptions ?? [];
    if (!opts.length) return html`<div class="addopt muted">No skills left to learn</div>`;
    return html`<button class="addopt" title="Learn a new skill at Rank 1" @click=${(e) => this._openSkillLearnModal(e)}>＋ add skill</button>`;
  }

  _openSkillLearnModal(e) {
    const opts = this.model?.skillOptions ?? [];
    if (!opts.length) return;
    // Seed fee from costs.skillTraining[1] (data), or 10 sp if costs missing (fallback).
    this._skillSilver = opts[0]?.trainingSilver != null ? opts[0].trainingSilver : 10;
    this._openModal({ type: 'learn-skill', options: opts }, e);
  }

  // One indented child row for a knack nested under the skill/talent it derives from.
  // Carries the same info control as skills/talents, opening a knack detail modal.
  _knackRow(k) {
    return html`
      <div class="knrow">
        <span class="arr">↳</span>
        <button
          class="kninfo"
          aria-label="${k.name} — view details"
          title="${k.name} — click for details"
          @click=${(e) => this._openModal({ type: 'knack', knack: k }, e)}
        >i</button>
        <span class="knlbl">${k.name}</span>
        <span class="ktag">knack</span>
      </div>
    `;
  }

  // Knack detail modal. Shows what governs the knack (skill/talent + required rank),
  // its action/strain, and the paraphrased description. Placeholder when the knack has
  // no catalog detail yet.
  _knackModal(k) {
    const dt = k.detail ?? {};
    const chips = [
      k.parent ? { v: `${k.parent.type === 'talent' ? 'Talent' : 'Skill'}: ${k.parent.name}` } : null,
      k.requiredRank ? { v: `Req. rank ${k.requiredRank}` } : null,
      k.action ? { v: `${k.action} action` } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${k.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="kninfo" aria-hidden="true">i</span>${k.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip ${c.c ?? ''}">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Knack details not yet recorded.</div>`}
        </div>
      </div>
    `;
  }

  // Skill detail modal. Mirrors the talent modal: chips summarise the mechanics
  // (rank/tier/action/attribute/strain), the body shows the paraphrased summary, and
  // a note carries the test's target. Falls back to a placeholder when a skill has no
  // catalog detail (unknown/unenriched skill).
  _skillModal(s) {
    const dt = s.detail ?? {};
    const chips = [
      { v: `Rank ${s.rank}` },
      s.tier ? { v: s.tier } : null,
      s.action ? { v: `${s.action} action` } : null,
      s.attribute ? { v: s.attribute } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${s.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="sinfo" aria-hidden="true">i</span>${s.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Skill description not yet recorded.</div>`}
          ${dt.versus ? html`<div class="mnote">Tested against ${dt.versus}.</div>` : ''}
          ${s.grantSources?.length
            ? html`<div class="mnote">Rank ${s.rank} ${this._grantSign(s.rankBonus)}${Math.abs(s.rankBonus ?? 0)} by ${this._grantTitle(s.grantSources)} — absorbed into the step above.</div>`
            : ''}
        </div>
      </div>
    `;
  }

  // Edit-mode budget bar: Available Legend (derived, never stored) as a chip at
  // the tab top, so a player sees how many Legend points rank changes can burn.
  // No Total Legend earned yet → the chip falls back to the muted dashed
  // placeholder pill (UI-GUIDELINES §5) and a hint explains why the steppers are
  // locked. Unpriced sinks (spells) don't leak into the number: it's the same
  // derived available the audit backs.
  _legendBar() {
    const legend = this.model?.legend ?? null;
    const available = legend?.available ?? null;
    return html`
      <div class="legendbar">
        <span class="lchip">Available Legend
          ${available != null ? html`<b>${available}</b>` : html`<span class="pend">—</span>`}
        </span>
        ${legend == null ? html`<span class="hint">Enter Total Legend earned to price rank changes.</span>` : ''}
      </div>
    `;
  }

  // Rank-grant helpers (PLAN-RANK-GRANTS.md D5). The folded bonus is a real
  // engine-derived number displayed as a small chip beside the LEARNED rank —
  // never written back, and absent when there is no grant.
  _grantSign(b) {
    return (b ?? 0) >= 0 ? '+' : '−';
  }
  _grantTitle(sources) {
    return (sources ?? [])
      .map((s) => {
        const o = s.origin ?? {};
        if (o.kind === 'thread') return `${o.name} · Thread Rank ${o.rank ?? '?'}`;
        if (o.name) return o.name;
        return s.source ?? s.summary ?? 'grant';
      })
      .join(', ');
  }
  _grantChip(t) {
    // Only a *real* rank grant wears the amber pill. No grant (rankBonus null)
    // or a grant that nets to zero ranks renders nothing — never a fabricated +0.
    if (!t.rankBonus) return '';
    return html`<span class="gchip" title="+${Math.abs(t.rankBonus)} rank ${this._grantTitle(t.grantSources)}">${this._grantSign(t.rankBonus)}${Math.abs(t.rankBonus)}</span>`;
  }

  // An active test-modifier folded into this ability's roll (a sustained spell's
  // "+4 steps" or "+2 result", an equipped thread item's bonus, a condition).
  // Badges EVERY applied modifier regardless of measure so a step-measure bonus
  // shows as faithfully as a result-measure one; tooltip names each source.
  // Nets to zero per measure renders nothing.
  _modChip(t) {
    const mods = t.rollMods ?? [];
    if (!mods.length) return '';
    const netByMeasure = {};
    for (const m of mods) {
      const unit = m.measure ?? 'result';
      netByMeasure[unit] = (netByMeasure[unit] ?? []);
      netByMeasure[unit].push(m);
    }
    return Object.entries(netByMeasure).map(([measure, group]) => {
      const net = group.reduce((s, m) => s + (Number(m.value) || 0), 0);
      if (!net) return '';
      const src = group.map((m) => `${m.source} ${m.value > 0 ? '+' : '−'}${Math.abs(m.value)}`).join('; ');
      return html`<span class="rmod" title=${`Active (${measure}): ${src}`}>${net > 0 ? `+${net}` : `−${Math.abs(net)}`}</span>`;
    });
  }

  // One granted-ability row (possessed via a `set` grant the character hasn't
  // learned). Read-only: no rank editing — availability, not advancement.
  _grantedRow(g) {
    const title = this._grantTitle(g.grantSources);
    return html`
      <div class="trow">
        <span class="tname">
          <button
            class="sinfo"
            aria-label="${g.name} — view details"
            title="${g.name} — click for details"
            @click=${(e) => this._openModal({ type: 'granted', ability: g }, e)}
          >i</button>
          <span class="lbl">${g.name}</span>
        </span>
        <span class="effcol eff" title=${title}>${title}</span>
        <span class="num">${g.rank}</span>
        <span class="sd">${g.step != null ? `${g.step} · ${g.dice}` : '—'}</span>
        <span class="action sd"></span>
        <button
          class="roll"
          ?disabled=${g.step == null}
          title=${g.step == null ? 'Granted, not yet ranked — no step to roll' : `Roll ${g.name}`}
          aria-label="Roll ${g.name}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('ed-roll', { detail: { label: g.name, step: g.step, karma: null }, bubbles: true, composed: true }),
            )}
        >⚄</button>
      </div>
    `;
  }

  // Granted-ability detail modal — what granted it and at what standing.
  _grantedModal(g) {
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${g.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="sinfo" aria-hidden="true">i</span>${g.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mchips">
            ${[{ v: `Rank ${g.rank}` }, g.attribute ? { v: g.attribute } : null].filter(Boolean).map((c) => html`<span class="chip">${c.v}</span>`)}
          </div>
          <div class="mtext">Available by grant — not a learned rank, so it costs no Legend and stays here until learned. ${g.step != null ? 'Currently rollable.' : 'Rank it up by learning the talent to roll it.'}</div>
          <div class="mnote">Granted by ${this._grantTitle(g.grantSources)}.</div>
        </div>
      </div>
    `;
  }

  // Rightmost control of the Half-magic cell: opens a picker to choose the
  // Attribute for the Half-Magic test (PG p.81 — the GM picks the Attribute; the
  // Step is that Attribute's Step + Circle, all engine-derived in r.options). The
  // subtitle shows the default (Perception) step·dice at a glance. No options ⇒ a
  // disabled control (never a fabricated number).
  _halfMagicRoll(r) {
    const def = r ? (r.options.find((o) => o.attribute === r.defaultAttribute) ?? r.options[0]) : null;
    return html`
      <span class="hroll">
        ${def ? html`<span class="hstep">${def.step} · ${def.dice}</span>` : ''}
        <button
          class="roll"
          ?disabled=${!r}
          title=${r ? 'Choose an attribute for the Half-Magic test' : 'No step to roll'}
          aria-label="Choose attribute for Half-Magic test"
          @click=${(e) => r && this._openModal({ type: 'halfmagic', roll: r }, e)}
        >⚄</button>
      </span>
    `;
  }

  // Roll the Half-Magic test with the chosen attribute option. Close the picker
  // first (returns focus to the ⚄), then dispatch `ed-roll` so ed-app opens the
  // roll modal with the ⚄ as its trigger. Karma-eligible like a talent — the pool
  // amount/step come off the derived Karma characteristic.
  _rollHalfMagic(r, option) {
    const karmaCtx = r.karma?.grants?.length
      ? {
          grants: r.karma.grants,
          available: this.model?.characteristics?.karma?.available ?? null,
          step: this.model?.characteristics?.karma?.step ?? null,
        }
      : null;
    this._modalCtl.close();
    this.dispatchEvent(
      new CustomEvent('ed-roll', {
        detail: { label: `Half-Magic (${option.attribute})`, step: option.step, karma: karmaCtx, mods: [] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Attribute picker for the Half-Magic test. Lists every attribute with its
  // derived step·dice; the default (Perception) carries `autofocus` so the modal
  // opens focused on it (ModalController honours [autofocus]). Escape/backdrop/✕
  // close via the controller; Enter fires the focused option.
  _halfMagicModal(r) {
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Half-Magic test attribute" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">Half-Magic test</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mtext" style="color: var(--muted)">Pick the attribute — the GM has final say. Step = attribute step + Circle ${r.circle}.</div>
          <div class="hmopts">
            ${r.options.map(
              (o) => html`
                <button class="hmopt" ?autofocus=${o.attribute === r.defaultAttribute} @click=${() => this._rollHalfMagic(r, o)}>
                  <span class="hmatt">${o.attribute}${o.attribute === r.defaultAttribute ? html`<span class="hmdef">default</span>` : ''}</span>
                  <span class="hmstep">${o.step} · ${o.dice}</span>
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  // Circle-advancement track: previous · current · next. `circle` is the stored,
  // training-gated Circle (input); `circleStatus` (engine/advancement.js) derives
  // what the talents support. The current pill shows "Circle N" in amber, tinting
  // to a warning when the stored Circle exceeds what the talents justify; the next
  // pill turns green with an up-arrow when the talents already meet its Rank gate
  // (eligible to train). Nothing here fabricates or changes the Circle.
  _circleTrack(d) {
    const cs = d.circleStatus ?? { attained: d.circle, supported: d.circle, next: (d.circle ?? 1) + 1, eligible: false, consistent: true };
    const at = cs.attained;
    const curTitle = cs.consistent
      ? `Circle ${at}${cs.eligible ? ` — eligible to train to Circle ${cs.next}` : ''}`
      : `Stored as Circle ${at}, but this Discipline's talents only support Circle ${cs.supported} — its Circle 1–${at - 1} Discipline Talents are not all at Rank ${at}. Raise them, or correct the stored Circle.`;
    const nextTitle = cs.eligible
      ? `All Circle 1–${at} Discipline Talents meet Rank ${cs.next} — eligible to train to Circle ${cs.next}.`
      : `Circle ${cs.next} — not yet eligible.`;
    return html`
      <span class="ctrack">
        ${at > 1 ? html`<span class="cpill edge" aria-hidden="true">${at - 1}</span><span class="clnk"></span>` : ''}
        <span class="cpill cur ${cs.consistent ? '' : 'warn'}" title=${curTitle}>Circle ${at}</span>
        <span class="clnk ${cs.eligible ? 'ready' : ''}"></span>
        ${cs.eligible
          ? html`<button class="cpill edge ready" title=${`Ready to advance — train to Circle ${cs.next}`} aria-label=${`Train to Circle ${cs.next}`} @click=${(e) => this._trainClick(d, cs, e)}><span aria-hidden="true">↑</span>${cs.next}</button>`
          : html`<span class="cpill edge" title=${nextTitle}>${cs.next}</span>`}
      </span>
    `;
  }

  // Edit-mode "+ add option" affordance for a Circle group whose option slot is
  // open (PLAN-LEARN-TALENTS §7.5). A Circle with no pool data (Warden+) shows a
  // muted note instead of a button. Clicking opens the scoped picker modal.
  _addOptionSlot(d, circle) {
    const slot = (d.optionSlots ?? []).find((s) => s.circle === circle);
    if (!slot || !slot.open) return '';
    if (slot.available === false) {
      return html`<div class="addopt muted" title="This Circle's Talent-option pool isn't in the rules data yet.">pool data not yet added</div>`;
    }
    return html`<button class="addopt" title="Fill this Circle's open Talent Option slot" @click=${(e) => this._openModal({ type: 'learn', discipline: d.name, circle, learnable: slot.learnable }, e)}>＋ add option</button>`;
  }

  // Confirm training to the next Circle (PLAN-LEARN-TALENTS §7; PG p.454). Shows
  // the Legend to buy the granted Discipline Talent(s) checked against Available
  // Legend, and an editable, negotiable silver training fee (seeded from the
  // Circle Training Cost Table) checked against the purse. Train is blocked until
  // both cover; on confirm it dispatches ed-advance-circle with the agreed fee.
  // No test to learn — training is Legend + silver + time (the time/tutor are the
  // GM's; only the money is tracked).
  _advanceModal(m) {
    const available = this.model?.legend?.available ?? null;
    const coins = this.model?.wealth?.coins ?? {};
    const purse = coinsSilver(coins);
    const legendCost = m.cost?.legend ?? null;
    const silver = Number(this._trainSilver) || 0;
    const legendOk = legendCost == null ? true : available != null && available >= legendCost;
    const silverOk = silver <= 0 ? true : payFromPurse(coins, silver).ok;
    const canTrain = legendOk && silverOk;
    const grantText = m.grants.length ? m.grants.join(', ') : 'no new talent (already known)';
    const chk = (ok) => html`<span class="cchk ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✕'}</span>`;
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Train to next Circle" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">Train to Circle ${m.next}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mtext">Advancing ${m.discipline} to Circle ${m.next} grants ${grantText} at Rank 1, gains Circle ${m.next}'s Discipline abilities, and opens a new Talent Option slot to fill.</div>
          <div class="cbox">
            <div class="crow">
              <div><div class="ck">Purchase ${grantText} · Rank 1</div><div class="csub">Available Legend ${available ?? '—'}</div></div>
              <span class="cchk ${legendOk ? 'ok' : 'bad'}">${legendCost == null ? html`<span class="pend">—</span>` : html`${chk(legendOk)}${legendCost} Legend`}</span>
            </div>
            <div class="crow">
              <div><div class="ck">Training fee · silver</div><div class="csub">Circle ${m.next} average — negotiable · purse ${Math.round(purse)} sp</div></div>
              <span style="display:inline-flex;align-items:center;gap:6px">
                <input class="silin" type="number" min="0" step="1" .value=${String(silver)} aria-label="Training fee in silver"
                  @input=${(e) => (this._trainSilver = Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                <span class="csub" style="margin:0">sp</span>${chk(silverOk)}
              </span>
            </div>
          </div>
          <div class="mnote2"><span aria-hidden="true">ⓘ</span><span>No test to learn — training takes 40 hours over three weeks with a Circle ${m.next}+ tutor. Time and finding a teacher are the GM's call; only Legend and silver are tracked here.</span></div>
          <div class="mactions">
            <button class="mbtn" @click=${() => this._modalCtl.close()}>Cancel</button>
            <button class="mbtn primary" autofocus ?disabled=${!canTrain} title=${canTrain ? '' : 'Not enough Legend or silver'} @click=${() => canTrain && this._advancePick(m.discipline, silver)}>Train</button>
          </div>
        </div>
      </div>
    `;
  }

  _advancePick(discipline, silver) {
    this._modalCtl.close();
    this.dispatchEvent(new CustomEvent('ed-advance-circle', { detail: { discipline, silver }, bubbles: true, composed: true }));
  }

  // Clicking the green "ready to advance" pill trains up on the spot: enter edit
  // mode if not already (so the advancement can persist), seed the editable
  // training fee, then open the confirm.
  _trainClick(d, cs, e) {
    if (!this.editMode) this.dispatchEvent(new CustomEvent('ed-enter-edit', { bubbles: true, composed: true }));
    this._trainSilver = d.advanceCost?.trainingSilver ?? 0;
    this._openModal({ type: 'advance', discipline: d.name, next: cs.next, grants: d.nextGrant ?? [], cost: d.advanceCost ?? null }, e);
  }

  // Pick a talent for an open slot: close the picker (returns focus to the "+"),
  // then dispatch up to ed-app to persist it (data up, engine acts).
  _learnPick(discipline, name, circle) {
    this._modalCtl.close();
    this.dispatchEvent(new CustomEvent('ed-learn-talent', { detail: { discipline, name, circle }, bubbles: true, composed: true }));
  }

  // Scoped Talent-Option picker: the open slot's eligible pool, each with its
  // terse effect. First option autofocused; Escape/backdrop/✕ close via the
  // shared controller.
  _learnModal(m) {
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Add a talent option" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">Add a talent option · Circle ${m.circle}</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mtext" style="color: var(--muted)">Pick a talent from ${m.discipline}'s eligible pool — it joins at Rank 1, priced at Circle ${m.circle}.</div>
          <div class="hmopts">
            ${m.learnable.length
              ? m.learnable.map(
                  (o, i) => html`
                    <button class="lopt" ?autofocus=${i === 0} @click=${() => this._learnPick(m.discipline, o.name, m.circle)}>
                      <span>${o.name}</span>
                      ${o.brief ? html`<span class="lbrief">${o.brief}</span>` : ''}
                    </button>
                  `,
                )
              : html`<div class="mtext" style="color: var(--muted)">No eligible talents left to add at this Circle.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  // Pick a skill: close the picker (returns focus to the "+"), then dispatch up.
  _learnSkillPick(name) {
    const silver = Number(this._skillSilver) || 0;
    this._modalCtl.close();
    this.dispatchEvent(new CustomEvent('ed-learn-skill', { detail: { name, silver }, bubbles: true, composed: true }));
  }

  // Skill picker + editable fee (PLAN-LEARN-SKILLS §7.5). Seeded from
  // costs.skillTraining[1] (data, not code), negotiable like Circle training.
  _learnSkillModal(m) {
    const opts = m.options ?? [];
    const available = this.model?.legend?.available ?? null;
    const coins = this.model?.wealth?.coins ?? {};
    const purse = coinsSilver(coins);
    const silver = Number(this._skillSilver) || 0;
    const silverOk = silver <= 0 ? true : payFromPurse(coins, silver).ok;
    const chk = (ok) => html`<span class="cchk ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✕'}</span>`;
    return html`
      <div class="overlay" @click=${() => this._modalCtl.close()}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Learn a new skill" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle">Learn a new skill · Rank 1</span>
            <button class="mclose" aria-label="Close" @click=${() => this._modalCtl.close()}>✕</button>
          </div>
          <div class="mtext" style="color: var(--muted)">Pick a skill from the catalog — it joins at Rank 1, priced by its tier (${opts[0]?.tier ?? 'Novice'} etc.). Time and finding a teacher are the GM's call; only Legend and silver are tracked here.</div>
          <div class="cbox" style="margin: 8px 0">
            <div class="crow">
              <div><div class="ck">Training fee · silver</div><div class="csub">Average — negotiable · purse ${Math.round(purse)} sp</div></div>
              <span style="display:inline-flex;align-items:center;gap:6px">
                <input class="silin" type="number" min="0" step="1" .value=${String(silver)} aria-label="Training fee in silver"
                  @input=${(e) => (this._skillSilver = Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                <span class="csub" style="margin:0">sp</span>${chk(silverOk)}
              </span>
            </div>
          </div>
          <div class="hmopts">
            ${opts.length
              ? opts.map((o, i) => {
                  const legendOk = o.rank1Cost == null ? true : available == null ? true : available >= o.rank1Cost;
                  const canPick = legendOk && silverOk;
                  const costLabel = o.rank1Cost == null ? '—' : `${o.rank1Cost} Legend`;
                  const tierChip = o.tier === 'Journeyman' ? 'Journeyman' : 'Novice';
                  return html`
                    <button class="lopt" ?autofocus=${i === 0} ?disabled=${!canPick}
                      title=${canPick ? `${o.name} · ${tierChip} · ${costLabel}` : (!legendOk ? 'Not enough Available Legend' : !silverOk ? 'Not enough silver' : '')}
                      @click=${() => canPick && this._learnSkillPick(o.name)}>
                      <span>${o.name}<span style="margin-left:6px;font-size:var(--fs-fine);color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:0 6px">${tierChip}</span></span>
                      <span class="lbrief">${o.brief ?? ''} · Rank 1 · ${costLabel}</span>
                    </button>
                  `;
                })
              : html`<div class="mtext" style="color: var(--muted)">No skills left to learn.</div>`}
          </div>
          <div class="mnote2" style="margin-top:8px"><span aria-hidden="true">ⓘ</span><span>Learning a skill takes one week of training with a tutor; wait time before raising it again is tracked by the GM, not here. Silver fee from <code>rules/legend.json</code> <code>costs.skillTraining[1]</code> — edit that table to retune.</span></div>
        </div>
      </div>
    `;
  }

  // Group a discipline's talents by the Circle they were learned at, ascending
  // (a talent with no recorded Circle sorts last, under a "—" badge). Returns
  // [circle, talents[]] entries for the left-spine render.
  _talentGroups(talents) {
    const byCircle = new Map();
    for (const t of talents ?? []) {
      const c = t.circle ?? null;
      if (!byCircle.has(c)) byCircle.set(c, []);
      byCircle.get(c).push(t);
    }
    return [...byCircle.entries()].sort((a, b) => {
      if (a[0] == null) return 1;
      if (b[0] == null) return -1;
      return a[0] - b[0];
    });
  }

  render() {
    const list = this.model?.disciplines ?? [];
    if (!list.length) return html`<p>No disciplines.</p>`;
    const skills = this.model?.skills ?? [];
    const hasSkillsTab = skills.length > 0 || this.editMode;
    const showSkills = hasSkillsTab && this._sel === list.length;
    const d = list[Math.min(this._sel, list.length - 1)];
    // Knacks governed by a talent render beneath that talent's row (skill-governed
    // knacks already nest under their skill on the Skills tab).
    const knacksByTalent = new Map();
    for (const k of this.model?.knacks ?? []) {
      if (k.parent?.type !== 'talent') continue;
      const parent = k.parent?.name ?? null;
      if (!knacksByTalent.has(parent)) knacksByTalent.set(parent, []);
      knacksByTalent.get(parent).push(k);
    }
    const meta = [
      d.durability != null ? { k: 'Durability', v: d.durability, cls: 'dur' } : null,
      d.halfMagic ? { k: 'Half-magic', v: d.halfMagic, cls: 'half', roll: d.halfMagicRoll ?? null } : null,
      d.artisanSkills?.length ? { k: 'Artisan', v: d.artisanSkills.join(' · '), cls: 'art' } : null,
    ].filter(Boolean);

    return html`
      <div class="top">
        <div class="seg">
          ${list.map(
            (x, i) => html`<button aria-pressed=${!showSkills && i === this._sel} @click=${() => (this._sel = i)}>${x.name}</button>`,
          )}
          ${hasSkillsTab
            ? html`<button aria-pressed=${showSkills} @click=${() => (this._sel = list.length)}>Skills</button>`
            : ''}
        </div>
        ${showSkills
          ? html`<span class="circle">${skills.length} skill${skills.length === 1 ? '' : 's'}</span>`
          : this._circleTrack(d)}
      </div>

      ${this.editMode ? this._legendBar() : ''}

      ${showSkills
        ? this._skillsView(skills, this.model?.knacks ?? [])
        : html`
            <div class="meta">
              ${meta.map((m) =>
                m.cls === 'half'
                  ? html`<div class="mcell half"><div class="htext"><div class="k">${m.k}</div><div class="v">${m.v}</div></div>${this._halfMagicRoll(m.roll)}</div>`
                  : html`<div class="mcell ${m.cls}"><div class="k">${m.k}</div><div class="v">${m.v}</div></div>`,
              )}
            </div>

            <div class="legend">
              <span class="li"><span class="tinfo req" aria-hidden="true">i</span>required</span>
              <span class="li"><span class="tinfo opt" aria-hidden="true">i</span>optional</span>
              <span class="li">click a circle for details</span>
            </div>
            <div class="card">
              <div class="tgroup">
                <div class="tspine"></div>
                <div class="tbody">
                  <div class="trow h${this.editMode ? ' edit' : ''}">
                    <span class="thpad">Talent</span>
                    <span class="effcol">Effect</span>
                    <span class="num">Rank</span>
                    <span>Step</span>
                    <span class="action">Action</span>
                    <span></span>
                  </div>
                </div>
              </div>
              ${this._talentGroups(d.talents).map(
                ([circle, talents], gi, arr) => html`
                  <div class="tgroup">
                    <div class="tspine">
                      <span class="cbadge2" title=${circle != null ? `Talents learned at Circle ${circle}` : 'Circle not recorded'}>${circle ?? '—'}</span>
                      ${gi < arr.length - 1 ? html`<span class="cline"></span>` : ''}
                    </div>
                    <div class="tbody">
                      ${talents.map(
                        (t) => html`
                          ${this._talentRow(t, d.name)}
                          ${(knacksByTalent.get(t.name) ?? []).map((k) => this._knackRow(k))}
                        `,
                      )}
                      ${this.editMode ? this._addOptionSlot(d, circle) : ''}
                    </div>
                  </div>
                `,
              )}
            </div>

            ${d.abilities?.length
              ? html`
                  <h4 class="section-gap">Discipline abilities by circle</h4>
                  <div class="card">
                    ${d.abilities.map(
                      (a) => html`<div class="abil"><span class="cbadge">C${a.circle}</span><span>${a.summary}</span></div>`,
                    )}
                  </div>
                `
              : ''}
          `}
      ${(this.model?.grantedAbilities ?? []).length
        ? html`
            <h4 class="section-gap">Granted abilities (not learned)</h4>
            <div class="card">
              ${this.model.grantedAbilities.map((g) => this._grantedRow(g))}
            </div>
          `
        : ''}
      ${this._modal
        ? this._modal.type === 'skill'
          ? this._skillModal(this._modal.skill)
          : this._modal.type === 'knack'
            ? this._knackModal(this._modal.knack)
            : this._modal.type === 'granted'
              ? this._grantedModal(this._modal.ability)
              : this._modal.type === 'halfmagic'
                ? this._halfMagicModal(this._modal.roll)
                : this._modal.type === 'learn'
                  ? this._learnModal(this._modal)
                  : this._modal.type === 'learn-skill'
                    ? this._learnSkillModal(this._modal)
                    : this._modal.type === 'advance'
                      ? this._advanceModal(this._modal)
                      : this._talentModal(this._modal)
        : ''}
    `;
  }
}

customElements.define('ed-disciplines', EdDisciplines);
