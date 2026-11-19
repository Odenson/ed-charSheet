// ui/kit/button-css.js — the one button shape for the app's modals (V1/V2):
// `.btn` is the neutral button, `.btn.primary` the primary (weight 500, amber by
// default), and a tone class (`accent`, `danger`, `spell`, `karma`, `heal`)
// recolours it. Every colour is a host variable with a `light-dark()` fallback,
// because hosts name their variables differently. Sizes are `--fs-*` tokens and
// weights are 400/500 only. There is deliberately no focus-ring rule, so the UA
// ring stays and returnFocusToTrigger's inline suppression keeps working.
import { css } from 'lit';

export const buttonCss = css`
  .btn {
    font: inherit;
    font-size: var(--fs-body);
    font-weight: 400;
    line-height: 1.2;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
    background: var(--bg-chip, light-dark(#ffffff, #232833));
    color: var(--text, var(--fg, var(--txt, light-dark(#111418, #f0f3f7))));
    cursor: pointer;
  }
  .btn.primary {
    font-weight: 500;
    border-color: var(--accent, light-dark(#7a3e12, #d9944e));
    color: var(--accent, light-dark(#7a3e12, #d9944e));
    background: var(--accent-bg, light-dark(#f6e9dc, #3a2a17));
  }
  .btn.accent {
    border-color: var(--accent, light-dark(#7a3e12, #d9944e));
    color: var(--accent, light-dark(#7a3e12, #d9944e));
    background: var(--accent-bg, light-dark(#f6e9dc, #3a2a17));
  }
  .btn.danger {
    border-color: var(--danger, light-dark(#c0392b, #e06557));
    color: var(--danger, light-dark(#c0392b, #e06557));
    background: var(--danger-bg, light-dark(#fbe9e7, #3a1f1c));
  }
  .btn.spell {
    border-color: var(--spell, light-dark(#5b3fa6, #a99cf0));
    color: var(--spell, light-dark(#5b3fa6, #a99cf0));
    background: var(--spell-bg, light-dark(#efeafc, #2b2547));
  }
  .btn.karma {
    border-color: var(--karma, light-dark(#3d6b4a, #82c39a));
    color: var(--karma, light-dark(#3d6b4a, #82c39a));
    background: var(--karma-bg, light-dark(#e7f0ea, #223029));
  }
  .btn.heal {
    border-color: var(--heal, light-dark(#3d6b4a, #82c39a));
    color: var(--heal, light-dark(#3d6b4a, #82c39a));
    background: var(--heal-bg, light-dark(#e8f2ea, #23362a));
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
