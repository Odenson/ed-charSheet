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
| Gear | Weapons, armour, thread items, kit |
| Notes | Running character history / log over time |

## 5. Derived values are placeholder pills
Any value the rules engine will compute (defences, armour, health ratings,
initiative, knockdown, karma step, carry/lift, …) shows as a **muted dashed
placeholder pill** (`—`) until the engine (Phase 3) computes it. **Never show a
fabricated number.** Only values we actually have (attributes, damage, wounds,
talent steps, etc.) render as real numbers.

## 6. Portrait is a repo image
The hero portrait is an image file held on the `character-data` branch, like the
character store (the bundle ships no character data), referenced by
`meta.portrait` in each character's entry in `data/characters.json`
(e.g. `data/chakka.jpg`). On the Pages site the app reads it live from that
branch's raw CDN; locally it uses the gitignored working copy. If the field is
absent **or the image fails to load** the UI falls back to a placeholder icon.

## 6a. Character chooser (first-run picker + load icon)
The header row carries a **load icon** (always visible, before the theme toggle)
that opens the character chooser. The chooser:
- Opens automatically on first run when there is no valid saved character
  (`localStorage 'ed-character'` is stale or absent) and the store holds more
  than one character; a single-entry store auto-loads instead.
- Lists every character in the store, sorted by id, each row showing the portrait
  thumbnail (`meta.portrait`, name-initial placeholder when absent/broken) and a
  label of `meta.name` (falling back to the id).
- Is a modal: **Escape/backdrop closes** it, **Enter confirms** the focused row,
  and the first row is autofocused.
- With pending unsaved edits, a switch asks for confirmation first (drafts stay in
  the browser — closing the chooser abandons the switch, not the edits).
- Closing without a selection leaves the app in a **"No character selected"**
  state with a "Choose a character" button to reopen the picker.

## 7. Modal keyboard conventions
Every modal/overlay follows the same keyboard contract:
- **Escape closes** the modal (equivalent to clicking the backdrop or the ✕).
  This is mandatory for *any* modal that appears.
- **Enter confirms** — for modals that accept input or ask for confirmation,
  Enter triggers the primary action (Save / OK / Confirm). Read-only modals (like
  the current roll and ability modals) have no primary action, so Enter is a
  no-op there; wire it as soon as a modal gains an accept action.

## Gear tab — one armour worn
A character can wear **one set of armour**: equipping a second armour (from the
picker, the row toggle, or the item modal) asks for confirmation first —
Escape/backdrop/✕ keeps the current armour as-is, **Swap** (Enter confirms)
equips the new armour and stores every other armour. The single-slot rule is
decided by the item's kind (`armor`, incl. player-created custom armour); a
shield or any non-armour never blocks. Storing the worn armour needs no prompt.
The rule is enforced at input time (`ui/item-equip-state.js`); the engine stays
agnostic and folds whatever ends up equipped.

## Other conventions
- **Roll affordance:** every rollable stat (attributes, initiative, knockdown,
  karma, talents) carries a small dice button. Rolling itself is wired in Phase 4.
- **Theme-aware:** all colours work in light and dark mode (CSS variables /
  `light-dark()`); never hardcode a colour that fails in one mode.
- **Dev pill:** a `DEV` pill shows only on the `/dev/` instance; production shows
  no environment indicator (see `ui/ed-app.js`).
