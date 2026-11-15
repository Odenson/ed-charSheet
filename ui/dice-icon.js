// ui/dice-icon.js — the shared roll-button die icon. Draws with currentColor
// only, so each button's accent / karma / danger / disabled colour rule still
// drives it. Geometry is in ui/dice-geometry.js (centred by construction).
import { svg, css } from 'lit';
import { DIE_VIEWBOX, DIE_FRAME as F, DIE_PIP_R, DIE_PIPS } from './dice-geometry.js';

export const diceIcon = svg`<svg class="dice-ico" viewBox="0 0 ${DIE_VIEWBOX} ${DIE_VIEWBOX}" aria-hidden="true" focusable="false">
  <rect x=${F.x} y=${F.y} width=${F.size} height=${F.size} rx=${F.rx} fill="none" stroke="currentColor" stroke-width=${F.stroke}/>
  <g fill="currentColor">${DIE_PIPS.map(([cx, cy]) => svg`<circle cx=${cx} cy=${cy} r=${DIE_PIP_R}/>`)}</g>
</svg>`;

// Round 22px roll buttons: icon fills 16px (even, so the 20px inner box centres on whole pixels) and is centred by the button's flex.
// Inline use (text buttons, modal titles): 1em, aligned with the text.
export const diceIconCss = css`
  .dice-ico { width: 1em; height: 1em; display: inline-block; vertical-align: -0.125em; flex: none; }
  .roll .dice-ico, .initbtn .dice-ico { width: 16px; height: 16px; display: block; vertical-align: baseline; }
`;
