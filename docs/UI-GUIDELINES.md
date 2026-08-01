# UI Guidelines

Interface rules for the Earthdawn character sheet. These are constraints the UI
must respect; design and implementation both follow them.

## 1. Fit-to-viewport (desktop)
Real estate is at a premium. The **Overview** tab must fit within a desktop
browser viewport **without vertical scrolling**. It is a dense, multi-panel
dashboard, not a long scrolling page. Other tabs may scroll if their content
genuinely requires it, but prefer compact layouts everywhere.

## 2. Compact-collapse (mobile)
On narrow screens the multi-column layouts fold to a **single stacked column**
(hero portrait first), tiles shrink, and spacing tightens. Nothing overflows
horizontally.

## 3. Minimal chrome
Tight padding, small section labels (never below 11px), and **two font weights
only** (400 / 500). Whitespace is distributed so related panels align to shared
top/bottom edges ("spaced within the dimensions of relative others") — e.g. on
Overview the portrait, Movement, and Combat panels share one bottom edge.

## 4. Tabs
Five tabs, each a distinct lens on the character:

| Tab | Contents |
|-----|----------|
| Overview | At-a-glance: hero portrait + header, attributes, defences, armour, movement, health, combat |
| Disciplines | Per-discipline detail with a toggle between the character's disciplines (talents live here — there is no separate Talents tab) |
| Spells | Matrices and spells by circle (later) |
| Gear | Weapons, armour, thread items, kit (later) |
| Notes | Running character history / log over time |

## 5. Derived values are placeholder pills
Any value the rules engine will compute (defences, armour, health ratings,
initiative, knockdown, karma step, carry/lift, …) shows as a **muted dashed
placeholder pill** (`—`) until the engine (Phase 3) computes it. **Never show a
fabricated number.** Only values we actually have (attributes, damage, wounds,
talent steps, etc.) render as real numbers.

## 6. Portrait is a repo image
The hero portrait is an image file committed to the repo, referenced by
`meta.portrait` in `character.json` (e.g. `data/chakka.jpg`). If the field is
absent the UI falls back to a placeholder icon.

## 7. Modal keyboard conventions
Every modal/overlay follows the same keyboard contract:
- **Escape closes** the modal (equivalent to clicking the backdrop or the ✕).
  This is mandatory for *any* modal that appears.
- **Enter confirms** — for modals that accept input or ask for confirmation,
  Enter triggers the primary action (Save / OK / Confirm). Read-only modals (like
  the current roll and ability modals) have no primary action, so Enter is a
  no-op there; wire it as soon as a modal gains an accept action.

## Other conventions
- **Roll affordance:** every rollable stat (attributes, initiative, knockdown,
  karma, talents) carries a small dice button. Rolling itself is wired in Phase 4.
- **Theme-aware:** all colours work in light and dark mode (CSS variables /
  `light-dark()`); never hardcode a colour that fails in one mode.
- **Dev pill:** a `DEV` pill shows only on the `/dev/` instance; production shows
  no environment indicator (see `ui/ed-app.js`).
