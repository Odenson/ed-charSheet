# Brief: Simple animated portrait (simple-animate-portrait)
## What & why
Two optional portrait animations, each a Settings switch: Slow Drift (7 s CSS push-in/pan, alternate, infinite) and Embers (canvas sparks). Device-wide localStorage, default off, apply on Save, Overview desktop `.portrait` + mobile `.avatar` only (not lightbox). OS reduce-motion wins and Settings shows a hint.
## Tickets & tiers
- T1 persist + pass down prefs — Tier 3 — n/a
- T2 Settings switches + reduce-motion hint — Tier 3 — n/a
- T3 Slow Drift CSS — Tier 3 — n/a
- T4 Embers canvas — Tier 3 — n/a
- T5 Docs + changelog — Tier 3 — n/a
## Items
- I1 — Pure helpers (prefs parse, ember step) — ui/portrait-anim.js(+test) — T1,T4 — none
- I2 — ed-app persistence + data down — ui/ed-app.js (~L297, 2440, 2693, 2881) — T1 — none
- I3 — Settings section + hint — ui/ed-settings.js — T2 — none
- I4 — Overview markup + drift CSS, avatar wrapper — ui/ed-overview.js — T3 — none
- I5 — `ed-portrait-embers` element — ui/ed-portrait-embers.js, ed-overview.js — T4 — none
- I6 — UI-GUIDELINES §8a + changelog `unreleased` — docs/UI-GUIDELINES.md, data/changelog.json — T5 — none
## Rules
No Earthdawn rules used (rules.md).
## Owner decisions
- 2026-11-24: device-wide, localStorage, no schema change.
- 2026-11-24: desktop panel + mobile avatar only; lightbox still.
- 2026-11-24: both default off.
- 2026-11-24: reduce-motion wins, with a Settings hint.
- 2026-11-24: apply on Save.
## Constraints & gotchas
- Mobile `.avatar` is a bare `<img>` (ed-overview.js L275-287); wrapper owns size/radius/border/overflow/display, img fills it; keep handlers/classes; `.avatar.ph` untouched.
- Reduce-motion: CSS media query disables drift only; the embers element owns its own check (renders nothing, no rAF). Settings hint is read once (accepted).
- Owner manual checks needed: focus ring, themes, mobile avatar, no-scroll, ember legibility.
- Overview must still fit the desktop viewport with no scroll; scale inside `overflow:hidden` frame.
- Only ed-app persists; ed-settings dispatches `ed-settings` with `drift`/`embers`.
- Canvas `pointer-events:none`; stop rAF on disconnect, hidden tab, reduce-motion.
- Two font weights, light-dark() colors, relative paths; `npm test` pretest runs check-imports and check-ui-kit.
