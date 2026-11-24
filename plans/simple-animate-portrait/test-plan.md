# Test Plan: Simple animated portrait (simple-animate-portrait)

## Test files
- ui/portrait-anim.test.js

## Coverage
All cases: Rule n/a (no Earthdawn rules used; rules.md).

### ui/portrait-anim.test.js::keys and MAX_DT constants
- **Validates:** localStorage keys and dt clamp constant per spec.
- **Rule:** n/a
- **Why:** persisted keys must not drift.

### readPortraitAnim (unset / per-key on-off / garbage / throwing getter)
- **Validates:** only literal 'on' is on; throwing storage reads off.
- **Rule:** n/a
- **Why:** corrupt or blocked storage must never enable animation.

### portraitAnimValue (+ round-trip)
- **Validates:** boolean -> 'on'|'off' as written by ed-app.
- **Rule:** n/a
- **Why:** write/read symmetry.

### emberCap (zero size, integer, monotonic, bounded)
- **Validates:** particle budget scales with area, bounded, 0 for no size.
- **Rule:** n/a
- **Why:** prevents runaway particle counts.

### spawnEmber (bounds, lower half, shape, determinism)
- **Validates:** spawns at/near bottom inside the frame with a valid Ember shape.
- **Rule:** n/a
- **Why:** embers must start inside the portrait.

### stepEmbers (zero frame, no mutation, rise + life decay, dt=0, negative dt, dt clamp, cull dead, cull out-of-frame, top-up/cap, over-cap, life > 0, determinism)
- **Validates:** spec invariants for the particle step.
- **Rule:** n/a
- **Why:** catches runaway counts, jumps on tab-resume (large dt), mutation of input, leaked dead particles.

## Not covered (and why)
No browser/DOM harness. Owner verifies by hand: Settings section, switches, aria-labels, focus ring, reduce-motion hint; Enter saves, Escape/Cancel leave prefs unchanged; prefs persist across reload and apply on Save only; Slow Drift on desktop portrait and mobile avatar (wrapper 52x52, radius, border, click/Enter still open lightbox/picker); embers legible on light and dark portraits and themes; canvas does not block clicks; no embers/rAF when tab hidden, element disconnected, or OS reduce-motion on (drift off too, hint shown); lightbox stays still; Overview fits the desktop viewport without scroll; `ed-portrait-embers.js` passes check-imports/check-ui-kit (pretest).

## How to run
`npm test`
