---
status: implemented
shipped: unreleased
---
# Delivery Plan: Simple animated portrait (simple-animate-portrait)

## Context & learnings
The owner wants two optional, subtle animations on the character portrait, each its own switch in the Settings modal: **Slow Drift** (7 s ease-in-out alternate scale+pan, CSS only) and **Embers** (canvas sparks rising over the portrait). They can run alone or together. Decisions (qa-log 2026-11-24): device-wide (localStorage, like autosave, no schema/character change); play on the Overview desktop `.portrait` panel and the mobile header `.avatar` only (lightbox stays still); both default off; OS `prefers-reduced-motion: reduce` wins (nothing animates, Settings shows a hint saying why); apply on Save (draft semantics of the modal). Reference demo: CSS keyframes `kb` at 7 s alternate plus a canvas particle emitter.

## Discoveries
- `ui/ed-settings.js`: kit modal (`ModalController`, `modalFrame`). Takes `enabled`/`seconds` as props, seeds drafts `_enabled`/`_seconds` in `connectedCallback`, `_save()` dispatches `ed-settings` with `{enabled, seconds, discord?}`. Switch markup/CSS (`.eds-switch`, `.eds-row`, `.eds-sec`, `.hint`) already exists; reuse it.
- `ui/ed-app.js`: prefs read in constructor ~L297-303 (`localStorage 'ed-autosave'`, `'ed-autosave-seconds'`); `_applySettings({enabled, seconds, discord})` ~L2440 writes them and closes; `<ed-settings .enabled .seconds ...>` ~L2881; `<ed-overview ...>` rendered ~L2693. ed-app is the only persister.
- `ui/ed-overview.js`: desktop `.portrait` div (L1074-1081, CSS L80-82: `overflow:hidden; border-radius:12px; flex:1`) holding an `<img>` with `object-fit: cover`; mobile `_avatar()` (L275-287) renders a bare `<img class="avatar">` (52x52, CSS L84; `display:none` on desktop, shown at the mobile breakpoint ~L247-249) or a `.avatar.ph` div. An `<img>` cannot host a canvas child, so the avatar needs a small wrapper element for clipping and the canvas layer. Lightbox image is rendered separately (~L1156-1161) and must not get the classes.
- Edit mode: portrait click/keydown opens the picker (`_openPortraitEdit`, `_portraitKeydown`); view mode avatar click opens the lightbox. Handlers must keep working with overlays (`pointer-events: none` on canvas).
- Existing pure-helper + test pattern: `ui/portrait-image.js` + `ui/portrait-image.test.js`; `npm test` = `node --test`, `pretest` runs `tools/check-imports.mjs` and `tools/check-ui-kit.mjs` (a new ui module must satisfy check-imports; confirm bare/relative import rules when adding it).
- `data/changelog.json`: `unreleased: { summary, changes: [] }` and `releases[]` with `{type, ...}` change entries (format of 2.9.0 entry "added"). New work goes into `unreleased`.
- `docs/UI-GUIDELINES.md` §8a (L241+) documents the Settings modal.

## Guardrail classification
All items Tier 3. No `engine/*`, `rules/*.json`, character data, schema or taxonomy change. Data flows down (ed-app -> ed-settings / ed-overview booleans); ed-settings dispatches `ed-settings` up; only ed-app persists. No Tier-1 sign-off needed. Re-check before finishing: Overview fits desktop viewport with no vertical scroll, light and dark, Settings Escape/Enter contract, two font weights, relative asset paths, kit usage (check-ui-kit).

## Rules dependencies
None. `rules.md` confirms no Earthdawn rule is used.

## Implementation items
### I1 — Pure helpers: preference parsing and ember particle step
- **Covers tickets:** T1, T4
- **Rules:** none
- **Tier:** 3
- **What:** New DOM-free module `ui/portrait-anim.js` exporting: storage keys (`ed-portrait-drift`, `ed-portrait-embers`), `readPortraitAnim(getItem)` -> `{drift, embers}` (only the literal `'on'` is true; unset/garbage = off), `portraitAnimValue(bool)` -> `'on'|'off'`, `spawnEmber(w, h, rand)` and `stepEmbers(particles, dt, w, h, rand)` (rise, sway, fade, respawn/cull, capped count).
- **Where:** `ui/portrait-anim.js`, `ui/portrait-anim.test.js`.
- **Approach:** Pure functions taking injected `rand`/storage getter so tests are deterministic.
- **Dependencies:** none.
- **Acceptance criteria:** Unset keys read off; `'on'` reads on; step moves particles upward, reduces life, removes dead ones, keeps count <= cap, handles dt=0 and zero-size frame; tests pass under `node --test`; passes check-imports.
- **Risks / unknowns:** none.

### I2 — ed-app persistence and data down
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** In the constructor read the two keys via `readPortraitAnim(localStorage.getItem.bind(localStorage))` into reactive state `_animDrift`, `_animEmbers`. Extend `_applySettings` to accept `drift`/`embers` booleans, write both keys, update state. Pass `.drift/.embers` to `<ed-settings>` and `.animDrift/.animEmbers` to `<ed-overview>`.
- **Where:** `ui/ed-app.js` (~L297, L2440, L2693, L2881).
- **Approach:** Mirror the autosave handling; `_applySettings` ignores a missing field (keeps current) so older callers are safe. Guard localStorage writes as the neighbors do.
- **Dependencies:** I1.
- **Acceptance criteria:** Defaults off; Save writes both keys; values survive reload; Cancel/Escape/backdrop change nothing; autosave behaviour unchanged.
- **Risks / unknowns:** Make sure the new state is declared reactive so Overview rerenders on Save.

### I3 — Settings modal: Portrait animation section
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Add props `drift`, `embers`; drafts `_drift`, `_embers` seeded in `connectedCallback`; a "Portrait animation" `.eds-sec` section with **Slow drift** and **Embers** switch rows (reusing `.eds-row`/`.eds-switch`, aria-labels); `_save` includes `drift`, `embers` in the `ed-settings` detail. When `matchMedia('(prefers-reduced-motion: reduce)').matches`, show a hint (e.g. "Paused by your system's reduce-motion setting.") under the section title.
- **Where:** `ui/ed-settings.js`.
- **Approach:** Place the section after the autosave rows and before Discord (applies with or without a loaded character). Read the media query in `connectedCallback` (guard for `matchMedia` absence); it is not live-updated while the modal is open (accepted limitation). Update the file header comment.
- **Dependencies:** I2 for wiring.
- **Acceptance criteria:** Switches show current values, independent, keyboard operable with visible focus (add `:focus-visible` outline on the track if the existing switch lacks one), theme-aware, weights 400/500 only; hint only under reduce-motion; Enter saves, Escape closes; modal still fits/scrolls on small screens.
- **Risks / unknowns:** Existing switch hides the native input (opacity 0); verify focus ring is visible.

### I4 — Overview markup and Slow Drift CSS
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Add props `animDrift`, `animEmbers`. Desktop: add class `drift` to the `.portrait` img (or panel) when on. Mobile: wrap the avatar `<img>` in a `span.avatar-wrap` (52x52, `border-radius:12px; overflow:hidden; position:relative`, hidden on desktop, shown at the mobile breakpoint) so the image and canvas clip together. The wrapper owns size (52x52), radius, border, overflow and display (none on desktop, inline-flex/block at the mobile breakpoint); the img inside fills it at 100% with its own border/radius/size/display:none removed, keeping its class, handlers, `editable` class and aria attributes. The `.avatar.ph` placeholder branch is left untouched (no wrapper, no animation). CSS: `@keyframes pdrift` (scale 1 -> ~1.08 with small translate), `animation: pdrift 7s ease-in-out infinite alternate`, `will-change: transform`; `@media (prefers-reduced-motion: reduce)` sets `animation: none` for drift only (CSS cannot prevent mounting; embers reduce-motion is owned by I5's element, and the overview may also gate mounting with `matchMedia`). Lightbox untouched.
- **Where:** `ui/ed-overview.js` (CSS L80-84, L247-249; `_avatar` L275-287; render L1074-1081).
- **Approach:** Scale is applied to the img inside the overflow-hidden frame so layout never shifts. The `.avatar.ph` placeholder branch needs no animation.
- **Dependencies:** I2.
- **Acceptance criteria:** Off by default and when switched off; image never leaves frame or shifts layout; Overview still fits the desktop viewport with no scroll; mobile avatar still same size and clickable (lightbox in view mode, picker in edit mode, keyboard Enter/Space); no animation under reduce-motion.
- **Risks / unknowns:** Wrapper changes avatar flex sizing in `.head`; verify mobile layout. Existing selectors on `.avatar` (e.g. `.avatar.editable`) must still match.

### I5 — Embers canvas element
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** New DOM-side custom element `ed-portrait-embers` (`ui/ed-portrait-embers.js`): shadow-root canvas, `position:absolute; inset:0; width:100%; height:100%; pointer-events:none`. Uses `ResizeObserver` for size with `devicePixelRatio`, `requestAnimationFrame` loop driving `stepEmbers`, draws warm sparks/ash flecks (colors via a mix that reads on light and dark portraits, e.g. additive-looking glow with `globalCompositeOperation: 'lighter'` plus soft dark ash flecks). Stops on `disconnectedCallback`, on `visibilitychange` hidden (resumes when visible), and when reduce-motion matches (renders nothing). Mounted in the desktop `.portrait` panel (position:relative) and the avatar wrapper only when `animEmbers` is on and a portrait image exists.
- **Where:** `ui/ed-portrait-embers.js` (new), imported from `ui/ed-overview.js`; mount points in render and `_avatar`.
- **Approach:** Clamp dt (e.g. <= 50 ms) to avoid jumps after tab restore; cap particle count by area (smaller on the 52 px avatar); cancel the rAF id and observers on teardown; listen to the reduce-motion media query change to stop/start live.
- **Dependencies:** I1, I4.
- **Reduce-motion:** this element owns the check: under reduce-motion it renders nothing and runs no rAF.
- **Acceptance criteria:** Sparks and ash drift upward and fade; canvas sized to its frame with DPR and on resize; no rAF running when off, tab hidden or reduce-motion; no leaked frames after removal (verified by connect/disconnect); does not intercept clicks or keyboard focus; legible on light and dark portraits; clipped to frame by parent `overflow:hidden`; Slow Drift and Embers work together.
- **Risks / unknowns:** Performance on low-end phones (mitigated by the cap); legibility tuning on light portraits is visual and needs a manual check in both themes.

### I6 — Docs and changelog
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** Extend `docs/UI-GUIDELINES.md` §8a: a **Portrait animation** section with the two switches, device-wide scope, default off, apply-on-Save, scope (Overview desktop panel + mobile avatar, not lightbox), reduce-motion behaviour and hint. Add an `added` entry under `unreleased` in `data/changelog.json` in the existing format. Update the ed-settings header comment (done in I3). Mention the new files in ARCHITECTURE.md only if it lists UI modules per file (check first).
- **Where:** `docs/UI-GUIDELINES.md`, `data/changelog.json`.
- **Approach:** Write after the code so the doc matches it.
- **Dependencies:** I2-I5.
- **Acceptance criteria:** Doc and code agree; changelog entry validates in the existing format (check any changelog test).
- **Risks / unknowns:** none.

## Sequencing
1. I1 (pure, testable, no dependencies).
2. I2 (state/persistence) then I3 (UI to change it), so the switches work end to end.
3. I4 (Slow Drift + avatar wrapper), then I5 (embers on top of the wrappers).
4. I6 last, so docs match the final behaviour. Finish with the guardrail re-check and `npm test`.

## Open questions
- Exact drift amplitude (suggested scale ~1.08, translate a few percent) and ember colours/density are tuning choices to settle visually against the reference demo; not blocking.

## Owner manual verification
node:test cannot cover these UI checks: switch focus ring (hidden-input switch), light and dark themes, mobile avatar layout and border, desktop Overview no-scroll, ember legibility on light and dark portraits, reduce-motion behaviour (OS setting).

## Review responses
- F1 (minor): fixed. I4 media query only disables drift; I5's element owns the embers reduce-motion check; optional matchMedia gate noted.
- F2 (minor): fixed. I4 now specifies the wrapper owns size, radius, border, overflow and display; img fills it; `.avatar.ph` untouched.
- F3 (minor): fixed. Hint read-once recorded as an accepted limitation in I3; manual verification list added.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
