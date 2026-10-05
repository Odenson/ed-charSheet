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
Tight padding, small section labels, and **two font weights only** (400 / 500).
Whitespace is distributed so related panels align to shared top/bottom edges
("spaced within the dimensions of relative others") — e.g. on Overview the
portrait, Movement, and Combat panels share one bottom edge. Font sizes come from
the **type scale in §3a** — the smallest step (`--fs-eyebrow`, 0.62rem ≈ 10px) is
the floor; nothing renders smaller.

## 3a. Type scale
The UI uses **one canonical seven-step type scale**, defined once as CSS custom
properties on `:root` in `index.html` (custom properties inherit through every
component's shadow DOM, so any `ui/*.js` references them without redefining).
**Always use a scale token for `font-size`; never a raw `rem`/`px` literal.** A
new size that doesn't fit is a signal to reuse the nearest step, not to invent a
value — the scale is what keeps headings and body text consistent across tabs.

| Token | Size | Use for |
|-------|------|---------|
| `--fs-eyebrow` | 0.62rem | Uppercase section labels / card headers (`.h`, `h4`, `.k`, `.lab`). The floor. |
| `--fs-fine` | 0.68rem | Hints, thresholds, fine print, captions |
| `--fs-small` | 0.74rem | Dense body: chips, table rows, tiles |
| `--fs-body` | 0.82rem | Standard body text, buttons, modal copy |
| `--fs-value` | 0.95rem | Inline numeric values / emphasis |
| `--fs-title` | 1.1rem | Panel & modal titles |
| `--fs-hero` | 1.6rem | Hero name / large display numbers |

Weight stays two-only (400 / 500) at every step; emphasis is weight or the
`--accent` colour, not a new size. Existing components still carry ad-hoc `rem`
values from before the scale — migrate a component's `font-size`s to the nearest
token whenever you touch it (no mass rewrite was done when the scale landed).

*Type scale added 2026-08-14 by owner sign-off — reconciles §3 (the old "never
below 11px" line contradicted the ~10px section labels the UI already shipped;
the real floor is `--fs-eyebrow`) and replaces ~29 ad-hoc sizes with 7 steps.*

## 4. Tabs
Six tabs, each a distinct lens on the character:

| Tab | Contents |
|-----|----------|
| Overview | At-a-glance: hero portrait + header, attributes, defences, armour, movement, health, combat, and a compact Active Effects strip (live conditions only: Knocked Down with a Stand up control, encumbrance stages, each active Situational chip with a clear (✕) button, and a transient emergency-heal row); the strip scrolls internally so the Overview still fits the viewport |
| Disciplines | Per-discipline detail with a toggle between the character's disciplines (talents live here — there is no separate Talents tab) |
| Combat | Per-encounter scratchpad: a floating header line (Defence, Armour, Initiative with roll, Available Karma); the Weapon picker (None for a free-action roll, Unarmed for Unarmed Combat with Strength-step Damage, then the equipped weapons) + attack talent card (attack/damage/strain stat-lines, target-# field) beside a Damage taken card (incl. the Knocked Down Stand-up control); a segmented control over combat-option / situational / blood-charm chips (active-count badges, session-remembered selection; Situational chips (Blindsided, Cover, Darkness, Harried, Impaired Movement, Range — Long, Surprised) are global session-only live conditions, not scratch toggles: clicking one dispatches `ed-toggle-situation`, folds its Defence into derived Defence on every tab and lists it in Overview Active Effects with a clear (✕) button; the Knocked Down chip sets the app-wide live Knocked Down condition, locked until Stand up, and an encumbrance Harried is locked on. Scoped penalties apply automatically in Combat pools — Darkness and Impaired Movement in the attack pool, Range Long in both the attack and damage pools — and appear as pre-ticked per-roll checkboxes in the roll modal elsewhere; unscoped penalties (Harried −2 Step, Knocked Down −3 to the result) apply to every roll on every tab except the Karma die); a Potions card; and the device-local roll log as a full-width table |
| Spells | Grimoire + spell matrices by circle, the Weave/Cast/Effect cast flow, self-cast active effects, and target effects (cast on Other) — spellcasters only |
| Equipment | Weapons, armour, thread items, kit |
| Notes | Running character history / log over time |

*Sixth tab (Combat) added 2026-08-11 by owner sign-off
([PLAN-COMBAT-TAB.md](../plans/PLAN-COMBAT-TAB.md) — six labels still fit the desktop
tab bar on one row; the bar wraps to stacked rows on mobile). Reordered
2026-08-11 by owner request to sit directly after Disciplines (Overview ·
Disciplines · Combat · Spells · Equipment · Notes).*

*Combat tab layout redesigned 2026-10-04 by owner sign-off
([new-combat-ui plan](../plans/new-combat-ui/plan.md) — header line, side-by-side
Attack and Damage taken cards, tabbed combat modifiers, log as a table).*

## 5. Derived values are placeholder pills
Any value the rules engine will compute (defences, armour, health ratings,
initiative, knockdown, karma step, carry/lift, …) shows as a **muted dashed
placeholder pill** (`—`) until the engine (Phase 3) computes it. **Never show a
fabricated number.** Only values we actually have (attributes, damage, wounds,
talent steps, etc.) render as real numbers.

## 6. Portrait is a repo image
The hero portrait is an image file held on the `character-data` branch, like the
character store (the bundle ships no character data), referenced by
`meta.portrait` in each character's file `data/characters/<id>.json`
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
  thumbnail and a label of `meta.name` (falling back to the id). The rows come
  from the **discovery index** (`data/characters/index.json`, one fetch) — the
  create-only index row carries `{ name, portrait }` copied from `meta` at
  creation, so a character renamed later still shows the original label/portrait
  until the index is refreshed (accepted; the file is authoritative).
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

## 8. Save-conflict modal
When a GitHub save finds the character changed on another device or player since
you last loaded it (the save's `base` no longer matches the branch file), the app
shows a conflict modal instead of silently overwriting (per-character optimistic
concurrency — plans/PLAN-SAVE-CONCURRENCY.md):
- Copy: **"This character changed on another device or player."**
- **Keep mine** (primary, **Enter** confirms) — re-saves your draft over the
  branch copy, knowingly overwriting the newer version.
- **Take theirs** — reloads the branch version and clears the draft overlay.
- **Cancel** — closes, leaving your unsaved draft intact.
- Standard modal contract: **Escape/backdrop closes** (no action taken), theme-aware,
  two font weights. The same modal surfaces for background auto-saves (silent
  saves never suppress a conflict).

## Equipment tab — one armour worn
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
  karma, talents) carries a small dice button that opens the roll modal. The modal's breakdown lists every applied modifier: result mods add to the total, Step mods are tagged "Step" and already folded into the rolled Step (min Step 1). Live conditions ride every roll except the Karma die (Knocked Down −3 to the result, Harried −2 Step). Active scoped situational penalties (Darkness, Impaired Movement, Range Long; on a damage roll only Range Long) appear as pre-ticked per-roll checkboxes; unticking one drops it from the total and the Roll Log entry. Combat attack/damage pools already include them, so no checkboxes appear there.
- **Theme-aware:** all colours work in light and dark mode (CSS variables /
  `light-dark()`); never hardcode a colour that fails in one mode.
- **Dev pill:** a `DEV` pill shows only on the `/dev/` instance; production shows
  no environment indicator (see `ui/ed-app.js`).
