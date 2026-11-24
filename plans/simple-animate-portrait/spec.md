# Tech Spec: Simple animated portrait (simple-animate-portrait)

## Overview
Two optional, device-wide portrait animations toggled in the Settings modal: Slow Drift (CSS keyframes on the portrait image) and Embers (a canvas custom element layered over the portrait). Preferences live in localStorage, are persisted only by `ui/ed-app.js`, flow down as booleans to `ed-settings` and `ed-overview`, and are changed via the existing `ed-settings` event (apply on Save). Pure parsing and particle-step logic go in a new DOM-free `ui/portrait-anim.js` so it can be tested with node:test.

## Guardrail alignment
All items Tier 3 (new UI content, in-guideline styling, no engine/rules/schema/taxonomy/character change); no Tier-1 sign-off needed. Data flows down (ed-app -> ed-settings / ed-overview props), events flow up (`ed-settings` CustomEvent with `drift`/`embers`). Nothing is added to the character or its store; the prefs are device UI preferences like `ed-autosave`. No derived game values, so no placeholder pills are involved. The engine is untouched. No Tier-1 item missed.

## Design
### Data / types
- localStorage keys: `ed-portrait-drift`, `ed-portrait-embers`; value `'on'` or `'off'`. Unset or any other value reads as off.
- Reactive state in ed-app: `_animDrift`, `_animEmbers` (booleans). No schema change.
- `Ember`: `{x, y, vx, vy, r, life, maxLife, kind}` where `kind` is `'spark' | 'ash'`.

### Modules & functions
- `ui/portrait-anim.js` (new, no imports, no DOM):
  - `PORTRAIT_DRIFT_KEY`, `PORTRAIT_EMBERS_KEY`, `MAX_DT = 0.05`.
  - `readPortraitAnim(getItem) -> {drift, embers}` (`getItem` may throw; treat as off).
  - `portraitAnimValue(bool) -> 'on'|'off'`.
  - `emberCap(w, h) -> int` (scales with area, min small, max bounded; 0 for non-positive size).
  - `spawnEmber(w, h, rand) -> Ember` (spawns at/near the bottom, inside the frame).
  - `stepEmbers(particles, dt, w, h, rand) -> Ember[]` (returns a new array; dt clamped to [0, MAX_DT]; rises (y decreases), sways, life decreases; removes dead or out-of-frame; tops up toward `emberCap`; returns `[]` for zero/negative w or h).
- `ui/portrait-anim.test.js` (new): node:test with seeded `rand`.
- `ui/ed-app.js`: constructor (~L297) reads via `readPortraitAnim(k => localStorage.getItem(k))`, in the same try/guard style as neighbours. `_applySettings({enabled, seconds, discord, drift, embers})` (~L2440): when `drift`/`embers` is a boolean, set state and `localStorage.setItem(key, portraitAnimValue(v))` guarded; if undefined keep the current value. Render: `<ed-settings .drift=${this._animDrift} .embers=${this._animEmbers}>` (~L2881); `<ed-overview .animDrift=... .animEmbers=...>` (~L2693). Declare state in `static properties`/`state` like the autosave fields.
- `ui/ed-settings.js`: props `drift`, `embers`; drafts `_drift`, `_embers` seeded in `connectedCallback`; `_reduceMotion` read once there via `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches`; `_save()` adds `drift`, `embers` to the detail. Update the header comment.
- `ui/ed-portrait-embers.js` (new): `class EdPortraitEmbers extends LitElement` (or HTMLElement with shadow root), `customElements.define('ed-portrait-embers', ...)`. Imports `./portrait-anim.js` via relative path. Details under UI / behavior.
- `ui/ed-overview.js`: `import './ed-portrait-embers.js'`; props `animDrift`, `animEmbers` (Boolean, default false); CSS and markup as below.
- `docs/UI-GUIDELINES.md` §8a and `data/changelog.json` (docs/data only).

### UI / behavior
Settings modal: after the autosave rows, before Discord, a `.eds-sec` "Portrait animation" with two `.eds-row` switch rows ("Slow drift", "Embers") reusing `.eds-switch`; each has an aria-label. Under reduce-motion, a `.hint` under the section title: "Paused by your system's reduce-motion setting." Switches stay operable. Add `:focus-visible` outline on the switch track if missing (hidden native input). Only 400/500 weights, `light-dark()` colors. Enter saves, Escape closes without changes (existing kit contract); Cancel/backdrop leave prefs unchanged.

Overview desktop: when `animDrift`, add class `drift` to the portrait `<img>` inside `.portrait` (L1074-1081; frame already `overflow:hidden`, so layout never shifts). When `animEmbers` and a portrait image exists, render `<ed-portrait-embers>` inside `.portrait` (give `.portrait` `position:relative`). Do not add either to the lightbox image (~L1156).

Overview mobile: in `_avatar` (L275-287) wrap the `<img class="avatar ...">` in `<span class="avatar-wrap">`. The wrapper owns `display:none` on desktop and shown at the mobile breakpoint (L247-249), 52x52, `border-radius:12px`, `border:1px solid var(--border)`, `overflow:hidden`, `position:relative`, `flex:none`. The inner img gets `width/height:100%`, `display:block`, no border/radius, and keeps its class `avatar`, `editable`, click/keydown handlers and aria attributes (restyle so `.avatar` inside the wrapper is not `display:none` on desktop; the wrapper hides it). `.avatar.ph` branch unchanged. Drift class and embers go inside the wrapper.

CSS: `@keyframes pdrift { from { transform: scale(1) translate(0,0) } to { transform: scale(1.08) translate(-1.5%, -1.5%) } }`; `.drift { animation: pdrift 7s ease-in-out infinite alternate; will-change: transform; }`; `@media (prefers-reduced-motion: reduce) { .drift { animation: none } }`. Tuning values are adjustable visually.

`ed-portrait-embers`: shadow-root `<canvas>` styled `position:absolute; inset:0; width:100%; height:100%; pointer-events:none`. `ResizeObserver` sizes the canvas with `devicePixelRatio`. rAF loop: compute dt in seconds (clamped by `stepEmbers`), call `stepEmbers`, draw sparks warm with `globalCompositeOperation='lighter'` and ash as soft dark flecks (legible on light and dark portraits). Starts on connect; stops (cancelAnimationFrame, observer disconnect, clear canvas) on `disconnectedCallback`, on `document.visibilitychange` hidden (resumes when visible), and when `matchMedia('(prefers-reduced-motion: reduce)')` matches (renders nothing, no rAF); listens to the media query `change` event to stop/start live and removes listeners on disconnect. Guard absence of `matchMedia`/`ResizeObserver`.

Overview must still fit the desktop viewport with no vertical scroll; check light and dark themes (owner manual).

### Rules
No Earthdawn rules used (rules.md confirms). Table not applicable.

### Edge cases & invariants
- Unset, garbage or throwing storage reads off; only literal `'on'` is on.
- `_applySettings` without `drift`/`embers` keeps current values; autosave behaviour unchanged.
- `stepEmbers` with dt=0 leaves positions unchanged and does not drop live particles; zero-size frame returns `[]`; count never exceeds `emberCap`; large dt is clamped; input array is not mutated.
- No portrait image: no drift class, no embers, avatar placeholder unchanged.
- Canvas never intercepts pointer events or focus; portrait/avatar click and Enter/Space (lightbox in view mode, picker in edit mode) still work.
- No rAF scheduled when embers off, tab hidden, reduce-motion on, or element disconnected.
- Reduce-motion hint is read once while the modal is open (accepted).

## Testability notes
- node:test (`ui/portrait-anim.test.js`): `readPortraitAnim` (unset, `'on'`, `'off'`, garbage, throwing getter), `portraitAnimValue`, `emberCap` (monotonic, zero size = 0), `spawnEmber` inside bounds with deterministic rand, `stepEmbers` (rises, life decreases, culls dead, cap respected, dt=0, zero frame, no mutation, dt clamp). Module must pass `tools/check-imports.mjs`; `ed-portrait-embers.js` imports `./portrait-anim.js` relatively and must satisfy check-imports/check-ui-kit (`npm test` pretest).
- Owner manual: switch focus ring, light/dark themes, mobile avatar layout/border/size/click, desktop Overview no-scroll, ember legibility on light and dark portraits, OS reduce-motion behaviour (drift off, no embers, hint shown), both animations together, lightbox stays still.

## Changelog entry
`{"type": "added", "text": "Optional portrait animations in Settings: Slow drift and Embers, off by default and paused by your system's reduce-motion setting."}`

## Out of scope
Per-character settings or any schema/character change; animating the lightbox or `.avatar.ph` placeholder; live updating of the reduce-motion hint while the modal is open; other animation effects; engine, rules and taxonomy changes.
