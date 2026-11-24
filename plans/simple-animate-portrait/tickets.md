# Feature: Simple animated portrait (simple-animate-portrait)

## Summary
Two optional, subtle animations for the character portrait, each a separate on/off switch in the Settings modal: **Slow Drift** (a 7 s push-in and pan that eases back, looping) and **Embers** (rising sparks over the portrait). Each runs alone or together. They are device-wide, default off, and apply to the Overview desktop portrait panel and the mobile header avatar only. The enlarged lightbox stays a still. A reference demo of both effects exists at https://claude.ai/artifact/LnG7mZ7FHEGmvMLSHkMEar (CSS keyframes `kb` at 7 s alternate; canvas particle emitter).

## Goals / Non-goals
- Goal: two independent switches in Settings, persisted in this browser, applied on Save.
- Goal: Slow Drift = 7 s per pass (push in, then ease back, 14 s full cycle), CSS only.
- Goal: Embers = canvas sparks/ash flecks over the portrait, clipped to the portrait frame.
- Goal: both off by default; both may be on at once.
- Goal: OS `prefers-reduced-motion: reduce` wins: nothing animates, and Settings shows a hint saying why.
- Goal: light and dark mode both work; no new font weights.
- Non-goal: per-character settings or any change to character JSON, the schema or the characters index.
- Non-goal: lightbox animation; animated image file uploads; eye/ear glow, tilt, ink-wash or breathing effects.
- Non-goal: changing the portrait upload pipeline.

## Guardrail alignment
Touches `ui/ed-settings.js`, `ui/ed-app.js` (persistence + data down), `ui/ed-overview.js` (render), a new small DOM-side helper for the embers canvas, `docs/UI-GUIDELINES.md` §8a (doc update), and the changelog data. No `engine/*`, `rules/*.json`, character data, schema or taxonomy change. Data flows down (ed-app passes the two booleans to ed-settings and ed-overview); the settings modal dispatches `ed-settings` up and only ed-app persists to localStorage. All Tier 3. Re-check on finish: Overview still fits the desktop viewport with no scroll, light and dark, Settings modal Escape/Enter contract intact, relative asset paths.

## Tickets
### T1 — Persist and pass down the two animation preferences
- **What:** ed-app reads/writes two device-wide localStorage keys (default off), extends `_applySettings` to accept them, and passes them down to ed-settings and the Overview.
- **Why:** Device-wide setting, applied on Save, owned by ed-app per the data-down/dispatch-up rule.
- **Tier:** 3 (sign-off: not required; qa-log entries 1, 4)
- **Acceptance criteria:** Unset keys read as off. Saving writes both. Cancel/Escape/backdrop changes nothing. Values survive reload. Unit test for the pure read/parse helper.
- **Open questions:** none

### T2 — Settings modal: two switches and reduce-motion hint
- **What:** A "Portrait animation" section in `ui/ed-settings.js` with a **Slow drift** switch and an **Embers** switch, drafted like the autosave switch and applied on Save. When the OS prefers reduced motion, show a hint that animations are paused by the system setting.
- **Why:** The user-facing control, following the existing modal contract (Enter saves, Escape closes).
- **Tier:** 3 (UI-GUIDELINES §8a extended, within the contract)
- **Acceptance criteria:** Switches reflect current values; independent; theme-aware; two font weights; keyboard operable with visible focus; hint appears only under reduce-motion; `ed-settings` detail carries both booleans.
- **Open questions:** none

### T3 — Slow Drift on the portrait
- **What:** A 7 s `ease-in-out infinite alternate` CSS scale-and-pan on the portrait image in the desktop `.portrait` panel and the mobile `.avatar`, clipped by the frame; class toggled by the switch; disabled under reduced motion; not applied in the lightbox.
- **Why:** Simple, zero-byte animation of any portrait.
- **Tier:** 3
- **Acceptance criteria:** Off by default and when switched off; image never leaves its frame or shifts layout; Overview still fits without vertical scroll; works with edit-mode click/keyboard on the portrait; no animation under reduce-motion.
- **Open questions:** none

### T4 — Embers on the portrait
- **What:** A small DOM-side embers module (canvas, requestAnimationFrame) layered over the portrait image in the desktop panel and mobile avatar, clipped to the frame, `pointer-events: none`, started/stopped by the switch and on visibility change and element removal.
- **Why:** The second animation option, independent of Slow Drift.
- **Tier:** 3
- **Acceptance criteria:** Sparks and ash flecks drift upward and fade; canvas sizes to its frame with devicePixelRatio and on resize; no work when off, hidden tab or reduced motion; no leaked frames after teardown; legible on light and dark portraits; does not intercept clicks; pure particle-step helper has a unit test.
- **Open questions:** none

### T5 — Docs and changelog
- **What:** Extend `docs/UI-GUIDELINES.md` §8a with the two switches, their scope, default and reduce-motion behavior; add a `data/changelog.json` entry.
- **Why:** Docs must stay true to the code.
- **Tier:** 3
- **Acceptance criteria:** Doc and code agree; changelog entry added in the existing format.
- **Open questions:** none
