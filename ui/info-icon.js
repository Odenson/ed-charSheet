// ui/info-icon.js — the one info glyph: a small outlined circle with an italic
// "i" (the Disciplines-tab look). Add class "ibadge" to a <button> or <span>
// whose content is the letter "i"; colour follows --muted, hover → --accent.
import { css } from 'lit';

export const infoIconCss = css`
  .ibadge, button.ibadge {
    width: 14px; height: 14px; border-radius: 50%; flex: none; box-sizing: border-box; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: 1.5px solid var(--muted); color: var(--muted);
    font-family: system-ui, sans-serif; font-style: italic; font-weight: 500;
    font-size: var(--fs-eyebrow); line-height: 1; vertical-align: -2px; margin-left: 5px;
    cursor: pointer; transition: border-color 0.12s ease, color 0.12s ease;
  }
  span.ibadge { cursor: default; margin-left: 0; vertical-align: baseline; }
  button.ibadge:hover { border-color: var(--accent); color: var(--fg); }
  button.ibadge:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
`;
