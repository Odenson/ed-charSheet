// ui/kit/scope-css.js — pure helper: wrap a stylesheet in a scope selector using
// native CSS nesting, so kit styles can live in the light DOM (ed-save-key)
// without leaking. No lit, no DOM. See docs/MODALS.md.
export function scopeCss(cssText, scopeSelector) {
  return `${scopeSelector} { ${cssText} }`;
}
