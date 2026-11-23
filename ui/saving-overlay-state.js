// ui/saving-overlay-state.js — pure visibility decision for the manual-save spinner overlay.
// No imports, no DOM. `handoff` is true while a conflict / rename modal takes over.
export function showSavingOverlay({ saving, dismissed, handoff } = {}) {
  return !!saving && !dismissed && !handoff;
}
