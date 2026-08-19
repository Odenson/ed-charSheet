// Shared Legend-spent breakdown — the modal body + its styles, rendered
// identically on the Overview tab (Available Legend ⓘ) and the Notes tab's
// Legend log (Legend spent ⓘ). Both read the same derived audit
// (`model.legend.spent`, from engine/legend-spent.js), so the breakdown must
// look and behave the same wherever it opens. Kept here as one source rather
// than duplicated per-tab.
//
// Self-contained: every rule is scoped under `.legend-spent-body`, and the body
// wraps its content in that class, so the styles never collide with a host
// component's own `.line`/`.mpara`/`.ldetail` rules. A host adds
// `legendSpentStyles` to its `static styles` and renders `legendSpentBody(spent)`
// inside its own modal shell — nothing else is required.

import { html, css } from 'lit';

export const legendSpentStyles = css`
  .legend-spent-body .mpara { margin: 0 0 0.6rem; }
  .legend-spent-body .mpara b { color: light-dark(#111418, #f0f3f7); font-weight: 500; }
  .legend-spent-body .line { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 0; font-size: var(--fs-body); }
  /* Collapsible per-section breakdown + reconciliation footer. */
  .legend-spent-body .lspent-sec { border-bottom: 1px solid var(--border); }
  .legend-spent-body .lspent-sec > summary { display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; color: light-dark(#111418, #f0f3f7); padding: 6px 0; list-style: none; }
  .legend-spent-body .lspent-sec > summary::-webkit-details-marker { display: none; }
  .legend-spent-body .lspent-sec .sleft { display: flex; align-items: center; gap: 7px; }
  .legend-spent-body .lspent-sec .sleft::before { content: '▸'; color: var(--muted); font-size: 0.8em; transition: transform 0.12s ease; }
  .legend-spent-body .lspent-sec[open] > summary .sleft::before { transform: rotate(90deg); }
  .legend-spent-body .lspent-sec.additional > summary { color: var(--accent); }
  .legend-spent-body .sbadge { font-size: var(--fs-eyebrow); font-weight: 500; padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); white-space: nowrap; }
  .legend-spent-body .sbadge.add { background: var(--accent-bg); color: var(--accent); }
  .legend-spent-body .lspent-sec .lines { padding: 0 0 6px 14px; }
  .legend-spent-body .lspent-sec .ldetail { color: var(--muted); font-size: 0.9em; }
  .legend-spent-body .lspent-recon { border-top: 2px solid var(--border); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 500; color: light-dark(#111418, #f0f3f7); }
`;

// The Legend-spent audit — each advancement priced against the ED4 cost tables,
// grouped into sections, with a footer summing the sections. Each section is a
// collapsible <details> (default closed — the summaries give a compact overview
// of a long list), and talents are grouped per Discipline so the
// additional-Discipline surcharge stands out (an accent "Nth Discipline" badge
// on the 2nd+ Discipline sections).
export function legendSpentBody(spent) {
  const fmt = (n) => (n == null ? '—' : n.toLocaleString());
  return html`
    <div class="legend-spent-body">
      <p class="mpara">
        Legend spent, reconstructed from the sheet by pricing each advancement against
        the cost tables — attributes, talents (2nd+ Discipline talents cost more), skills,
        knacks, woven thread items, and learnt spells.
      </p>
      ${spent.sections.map(
        (sec) => html`
          <details class="lspent-sec${sec.additional ? ' additional' : ''}">
            <summary class="sechead">
              <span class="sleft"
                >${sec.label}${sec.kind === 'talents'
                  ? html`<span class="sbadge ${sec.additional ? 'add' : ''}">${sec.ordinalLabel} Discipline</span>`
                  : ''}</span
              >
              <span class="sval">${fmt(sec.total)}</span>
            </summary>
            <div class="lines">
              ${sec.lines.length
                ? sec.lines.map(
                    (li) => html`<div class="line"><span>${li.name} <span class="ldetail">${li.detail}</span></span><span>${fmt(li.cost)}</span></div>`,
                  )
                : html`<div class="line"><span class="ldetail">Nothing purchased</span><span>0</span></div>`}
            </div>
          </details>
        `,
      )}
      <div class="lspent-recon">
        <div class="line"><span>Total</span><span>${fmt(spent.total)}</span></div>
      </div>
    </div>
  `;
}
