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
| Overview | At-a-glance: hero portrait + header, attributes, defences, armour, movement, health (Damage and Wounds as emphasised rows (no backing) with a damage gauge and amber/red levels from `model.healthDanger`; clicking Damage opens the shared `ed-damage-modal`; healing is the ⚄ Recovery test on the Recoveries row; in edit mode Damage, Wounds and Recoveries used are direct number fields, with no modal and no ⚄), combat, and a compact Active Effects strip (live conditions only: Knocked Down with a Stand up control, encumbrance stages, each active Situational chip with a clear (✕) button, and a transient emergency-heal row); the strip scrolls internally so the Overview still fits the viewport |
| Disciplines | Per-discipline detail with a toggle between the character's disciplines (talents live here — there is no separate Talents tab) |
| Combat | Per-encounter scratchpad: a floating header line (Defence, Armour, Initiative with roll, Available Karma); the Weapon picker (None for a free-action roll, Unarmed for Unarmed Combat with Strength-step Damage, then the equipped weapons) + attack talent card (attack/damage/strain stat-lines, target-# field) beside a Damage taken card (its Take damage action opens the shared `ed-damage-modal`, the same one as the Overview Damage row; incl. the Knocked Down Stand-up control); a segmented control over combat-option / situational / blood-charm chips (active-count badges, session-remembered selection; Situational chips (Blindsided, Cover, Darkness, Harried, Impaired Movement, Range — Long, Surprised) are global session-only live conditions, not scratch toggles: clicking one dispatches `ed-toggle-situation`, folds its Defence into derived Defence on every tab and lists it in Overview Active Effects with a clear (✕) button; the Knocked Down chip sets the app-wide live Knocked Down condition, locked until Stand up, and an encumbrance Harried is locked on. Scoped penalties apply automatically in Combat pools — Darkness and Impaired Movement in the attack pool, Range Long in both the attack and damage pools — and appear as pre-ticked per-roll checkboxes in the roll modal elsewhere; unscoped penalties (Harried −2 Step, Knocked Down −3 to the result) apply to every roll on every tab except the Karma die); a Potions card; and the device-local roll log as a full-width table |
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

*Disciplines tab, edit mode (start-new-discipline): the Available Legend bar carries a "＋ Add Discipline" button (hidden when nothing is addable) and, on a Circle-1 Discipline missing its Circle-1 talents, a "Seed Circle 1" button. Both open one `ui/kit` confirm modal: auto-granted talents with per-talent Legend, an optional Circle-1 Talent Option, Legend and editable silver rows; an unpriceable value shows the dashed pill and disables confirm.*

*Disciplines Circle track (homebrew-circle-adv, 2026-11-14): the next-Circle pill tooltip states the advancement gate. Standard (PG p.452): all Circle 1–N Discipline Talents at the new Circle's rank. With the homebrew `hb-optional-circle-advancement` rule on (PG p.453) the tooltip reads "Circle C needs N talents at rank R, one from Circle F" with live progress, and the Train modal adds a read-only requirement row (count and from-Circle checks, the counted talents). When there is no higher Circle (or no higher row in the optional table) the next pill shows `—`, never a fabricated number.*

*Disciplines free talents (display-free-talents, 2026-11-21): a Discipline's free talents (Archer Call Missile, Thief Danger Sense, Nethermancer's two Standard Matrix) render in their granting Circle's group with a small "Free" chip beside the name; the legend row adds "Free — granted by Discipline" and the talent info modal shows a "Free" chip in place of Required/Optional. Their rank equals that Discipline's Circle and is read-only: in edit mode they show the plain rank, with no rank stepper and no Increase price. A free talent with a Rank+attribute Step rolls like any learned talent (dice button, Karma, Strain on roll, thread/item rank bonuses) and appears in the Combat Talent / Skill picker, deduped by name keeping the highest Step; a step-less one (Standard Matrix) shows `—` and a disabled dice button and never appears in the picker. A stored talent of the same name in the same Discipline replaces the free row; the same talent from another Discipline shows as its own row.*

*Improve attributes (improve-attributes, 2026-11-23): after creation, in edit mode, each Overview attribute tile has a compact `+` (same `.astepbtn` look) on its name line that opens a confirm modal (Value/Step before and after, Legend cost and remaining, training days, silver and weeks-wait as info, a rested-and-healthy reminder); confirming spends Legend and raises `increases` by one. Cap +3, blocked while the character has any Damage or Wounds (rested and healthy, PG pp. 447-448; owner decision 2026-11-23), one improvement per save: while one is pending every other `+` is disabled with a reason title, and the pending tile shows a small "+1" badge with an undo (↺) until saved. Hidden in read mode, while creation is open, and for unsaved drafts. View-state is the pure `ui/attribute-improve-state.js`; rules in `engine/attribute-improve.js`.*

*Creation mode (create-new-adept, 2026-11-22): while a character's creation is open and edit mode is on, the Overview, Disciplines and Spells tabs carry free-point steppers, chips and pickers instead of the Legend controls; see §6b. Characters without a `creation` block are unchanged.*

*Overview Health card redesigned 2026-11-15 by owner decision ([update-health-overview plan](../plans/update-health-overview/plan.md), decisions in its qa-log). Damage and Wounds are emphasised rows with no grey backing, numbers right-aligned with the stats below (the ⚄ sits left of the Recoveries value); the gauge is Damage out of Death with a tick at Unconscious. Damage goes amber from Unconscious−10 (an owner UI choice, not a rule) and red at or past Unconscious; Wounds are red at 1+. The state chip and title carry headroom text, so colour is never the only signal. A missing Death rating shows the dashed placeholder pill instead of a gauge. The ✚ free-entry Take/Heal/Recovery-used modal was removed: damage goes in through the shared Take-damage modal, and healing only through the Recovery test.*

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
**Changing the portrait (edit mode only).** In edit mode the desktop portrait panel and
the mobile header avatar (image or placeholder; a same-size placeholder avatar
appears in edit mode when there is no image) get the dashed edit outline and open
the **Change portrait** modal (`ui/ed-edit-portrait.js`, kit modal): upload a
JPEG/PNG/WebP (source <= 10 MB), pick any image already on the branch, or
**Remove portrait**. An upload is downscaled in the browser (longest side 1024,
JPEG q0.85, PNG if transparent, stored blob <= ~1 MB), named
`data/<charId>-<timestamp>.<ext>` (never overwritten), and kept in the browser
(`ed-character-image:<id>`, not in the character JSON) until the next **Save**,
which uploads the image first and then the character JSON (`POST /save-image`
then `POST /save`). Discard drops it. View mode is unchanged (lightbox). Removing
the portrait sets `meta.portrait` to `null` and leaves the file on the branch.
The same public portrait URL is used as the Discord embed thumbnail and, on the Pages site, as the Discord message avatar (§8a).

## 6a. Character chooser (first-run picker + load icon)
The header row carries a **load icon** (always visible, before the theme toggle)
that opens the character chooser. The chooser:
- Opens automatically on first run when there is no valid saved character
  (`localStorage 'ed-character'` is stale or absent) and the store holds more
  than one character; a single-entry store (a saved character or a local draft)
  auto-loads instead. An **empty store** — no index yet (a 404 is an empty store,
  not an error) and no drafts — also opens it, showing only the "Start a new
  character" section below; a real list failure (network, a malformed index)
  still shows the error.
- Lists every character in the store, sorted by id, each row showing the portrait
  thumbnail and a label of `meta.name` (falling back to the id). The rows come
  from the **discovery index** (`data/characters/index.json`, one fetch) — the
  index row carries `{ name, portrait }` copied from `meta` at creation; a later
  save refreshes only its `portrait` (name stays create-only), so a character
  renamed later still shows the original label until the index is refreshed
  (accepted; the file is authoritative).
- Also lists the **local drafts** (new characters not saved to GitHub yet) among
  the rows. A draft row carries an "unsaved draft" badge and a **Discard ✕**
  button beside it (a sibling of the row's load button, never nested in it, and
  keyboard reachable). Discard asks first (`ed-confirm`, "Discard this draft?"),
  removes only the local draft (its base, its edits, any staged portrait image and
  its device-local roll log and Discord settings) and never touches the branch. A character on the branch
  with the same id hides its draft. A loaded draft shows the usual Save dot
  (it is always unsaved) and the Save tooltip says it creates the character;
  "Discard local changes" is not offered for a draft.
- **Every** row (saved or draft) carries a trash **Delete** button (a sibling of the
  load button, `aria-label="Delete <name>"`). It opens `ui/ed-delete-character.js`, a
  type-the-name modal stacked above the chooser: Delete stays disabled until the typed
  name matches (trimmed, case-sensitive), Enter confirms only then, Escape closes only
  that modal. It warns the deletion is permanent (saved: recovery only via git history;
  draft: nothing was saved), warns about unsaved edits, and offers an unchecked "Also
  delete the portrait image" box when the character has one (never removed while another
  character uses it). A failure shows inline; deleting the open character empties the
  sheet to the loader.
- Ends with a **"Start a new character"** section: one button per Discipline
  in `rules/disciplines.json` (today Archer, Nethermancer, Thief, Warrior), each an inline "+" glyph and the
  Discipline name, shown even when the list is empty. A button opens the
  name-and-race modal (`ui/ed-new-character.js`, stacked above the chooser):
  a name field (autofocused) and a race select with a disabled "Choose a race"
  placeholder; **Create** needs a valid name and a race. The character's id is
  derived from the name and is never suffixed: when the id already exists (on the
  branch or as a draft) a blocking inline warning names the clashing id and
  disables Create. On Create the draft loads in edit mode on the Disciplines tab
  (see §6b). The first Save re-checks the id against a fresh index read and, on a
  clash, posts nothing and opens the same modal in rename mode.
- Is a modal: **Escape/backdrop closes** it, **Enter confirms** the focused row,
  and the first row is autofocused. Escape closes only the top modal (the
  new-character modal or the discard confirm above the chooser); a focused "+" or
  Discard button activates natively on Enter, and focus returns to it on close.
- With pending unsaved edits, a switch asks for confirmation first (drafts stay in
  the browser — closing the chooser abandons the switch, not the edits).
- Closing without a selection leaves the app in a **"No character selected"**
  state with a "Choose a character" button to reopen the picker.

## 6b. Creation mode (a new character)
A character whose `creation.open` is true (a new draft, or a saved character still
in creation) opens in edit mode, and **while creation is open and edit mode is on**
the existing tabs spend the free creation points instead of Legend. Leaving edit
mode hides the controls (nothing is changed); a character with no `creation` block,
and a finished one, show none of this and look exactly as they always did. Every
number below is the engine's (`model.creation`): the views only dispatch
`ed-creation-edit`, and a refused change (the engine says why) shows a notice and
changes nothing.
- **Disciplines tab.** A *creation bar* replaces the Available Legend bar: a
  "Talent points left N" chip on a Discipline sub-tab; "Skill ranks left N" plus a
  chip for each free skill pool with ranks left (Knowledge, Artisan, Speak Language,
  Read/Write Language) on the Skills sub-tab. The **Finish creation** button lives in the
  top bar, between the tab names and the round buttons, on every tab (owner, 2026-11-22).
  A chip whose budget is over-spent takes the warning colour. The Circle 1
  Discipline Talents each get a −/+ stepper (Rank 0 to 3, unlearned ones shown at
  Rank 0 with the Step as `—` and the dice disabled); Durability, Karma Ritual and
  free talents stay plain. Skill rows get a −/+ stepper (its tooltip names the pool
  a raise draws on) and a ✕ to remove the skill. "+ add skill" opens a picker of
  starting skills (Knowledge with a free-text subject and Horror Lore, Artisan with
  the Discipline's skills first and a free-text craft, Speak Language, Read/Write
  Language, General Novice skills, one search box); each option is badged "free
  rank" or "uses 1 of N", and a free-text field has its own Add button (Enter in the
  field adds). On the Disciplines tab, one "+ add option" button (Circle 1 group) picks the
  single Novice-pool Talent Option, which then steps like the five (owner, 2026-11-22).
  "+ Add Discipline", "Seed Circle 1", "+ add knack" and the Legend steppers are not offered, and the green next-Circle pill is a plain
  pill, not a Train button.
- **Overview.** The Attributes heading carries a "Points left N" chip, and each
  attribute tile has a compact −/+ pair at the right end of its **existing name
  line** (no new row or column; the circles' outer height stays under the name
  line's own text height, so the Overview keeps its no-vertical-scroll fit; the
  pair is touch-sized on mobile, where the layout scrolls anyway). The tooltips name
  the points a step costs or returns.
- **Spells tab (magicians).** "+ Learn spell" becomes **+ Pick spell**, opening a
  picker of the Discipline's Circle 1 and 2 spells by Circle with their cost (a free
  pick: no roll, no silver); a "Spell points left N / Perception Step M" chip sits
  beside the Karma chip (a dashed placeholder pill while the Perception Step cannot
  be resolved, never a made-up budget); ✕ removes a spell and returns its points; a
  spell above the character's Circle cannot be placed in a matrix.
- **Finish creation.** Disabled, with a tooltip (and a visible line on the Disciplines bar) listing what is
  over-spent, until every budget is valid. Otherwise it opens a confirm
  (`ed-confirm`, heading "Finish creation?", Enter confirms, Escape cancels): unspent
  attribute points become Max Karma, unspent talent points, skill ranks and spell
  points are forfeited (listed in a warning line), and from then on ranks cost
  Legend. A cancelled or refused confirm changes nothing. After Finish the creation
  points are locked.

## 7. Modal keyboard conventions
Every modal/overlay follows the same keyboard contract:
- **Escape closes** the modal (equivalent to clicking the backdrop or the ✕).
  This is mandatory for *any* modal that appears.
- **Enter confirms** — for modals that accept input or ask for confirmation,
  Enter triggers the primary action (Save / OK / Confirm). Read-only modals:
  Enter closes (it is their OK).
- Textarea modals: Enter types a newline; Ctrl/⌘+Enter saves.

*§7 amended 2026-11-18 by owner sign-off (ui-kit-modal-keyboard-contract qa-log, D1); amended 2026-11-20 by owner sign-off (qa-log 2026-11-20T09:21:00Z, ui-kit-modal-migration-2).*

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

## 8a. Settings modal
The header's settings (gear) icon opens the Settings modal (`ui/ed-settings.js`).
It holds the autosave switch and idle interval and, when a character is loaded,
a **Discord die reports** section for that character:
- A **Post rolls to Discord** switch, with the hint "Webhook for <name>. Stored
  only in this browser."
- A webhook URL field (`https://discord.com/api/webhooks/…`; `ptb.`/`canary.`
  and `discordapp.com` are also accepted). Once a URL is saved the field is
  masked (`type=password`) and typing replaces it. A non-blank invalid URL shows
  "Not a Discord webhook URL." inline and blocks Save. Blank is allowed.
- A **Message format** radio group ("Plain text" default / "Embed"), between the
  URL field and the test button. It is per character, saved with the webhook
  config, and wraps on the narrow modal. Arrow keys move the selection; Enter
  still saves; Escape and backdrop discard the draft.
- A **Send test message** button (sends in the draft format), disabled while the URL is blank, invalid or a
  test is sending. The inline result (`role="status"`) is "Sending…",
  "✅ Test message sent" or "❌ <HTTP status | Network error>".
- Standard modal contract: **Escape / Cancel / backdrop close** with no change,
  **Enter saves** (form submit). The body scrolls on small screens. Theme-aware,
  two font weights.
- The webhook URL is a secret: it never appears in displayed text, toasts or
  console output (see ARCHITECTURE §7.6).

When the switch is on and the URL is valid, each finished roll interaction posts
**one** message in the character's chosen format (plain text by default, or a Discord embed), sent once the roll modal closes or applies, so it
carries the final total after any Karma or optional-mod toggles. An embed (including
the Embed test message) carries an automatic thumbnail: the character's portrait on
the Pages site, a shipped "no image" placeholder on Pages when the character has no
portrait, or a shipped "local test" placeholder on a local run. Every message in either
format, including the test message, also uses the character's portrait as its Discord
avatar, but only on the Pages site and only when a portrait exists; no placeholder is
used as the avatar, so otherwise Discord shows the webhook's default icon. There is no
Settings control for the thumbnail or the avatar, and the text of plain-text messages
is unchanged. A failed send
shows a ~4 s error toast "Discord report failed: <HTTP status | Network error>"
with no retry; the roll, the Roll Log and Karma are unaffected.

## Equipment tab — one armour worn
A character can wear **one set of armour**: equipping a second armour (from the
picker, the row toggle, or the item modal) asks for confirmation first —
Escape/backdrop/✕ keeps the current armour as-is, **Swap** (Enter confirms)
equips the new armour and stores every other armour. The single-slot rule is
decided by the item's kind (`armor`, incl. player-created custom armour); a
shield or any non-armour never blocks. Storing the worn armour needs no prompt.
The rule is enforced at input time (`ui/item-equip-state.js`); the engine stays
agnostic and folds whatever ends up equipped.

**Add-item picker.** "＋ Add item" (edit mode) opens a kit modal (kind `picker`, layer
2000, 30rem scroll, ✕ only) like the skill learn picker: an autofocused search
(name, type, effect text), type chips (`ui/picker.js` `ITEM_CHIPS`: All · Custom ·
one per kind; matching in `ui/item-filter.js`), a "N of M items" count and the list
grouped into sections — player-made items first, then Weapon · Armour · Shield ·
Ammunition · Gear · Magic item · Blood charm · Healing aid · Thread item. The list is
uncapped (chips and search narrow it). Rows show the name, Custom / Owned pills, a
one-line effect and an ⓘ that expands the description; picking a row opens the
buy dialog and closes the picker. ↑/↓ + Enter in the search field also pick.

## Other conventions
- **Roll affordance:** every rollable stat (attributes, initiative, knockdown,
  karma, talents, skills, and knacks that print a Rank+attribute Step) carries a small dice button (the shared SVG pip-face die, `ui/dice-icon.js`, drawn in `currentColor` so accent/karma/danger/disabled colours still apply) that opens the roll modal. The modal's breakdown lists every applied modifier: result mods add to the total, Step mods are tagged "Step" and already folded into the rolled Step (min Step 1). Live conditions ride every roll except the Karma die (Knocked Down −3 to the result, Harried −2 Step). Active scoped situational penalties (Darkness, Impaired Movement, Range Long; on a damage roll only Range Long) appear as pre-ticked per-roll checkboxes; unticking one drops it from the total and the Roll Log entry. Combat attack/damage pools already include them, so no checkboxes appear there. When Discord die reports are on (§8a), the finished roll is also posted to the character's Discord webhook. Knacks with no Step (Step N/A, Special Maneuver, crafting) get no dice button; the app never invents a Step for them. **Strain on roll:** a talent or knack rolled from the Disciplines tab charges its printed Strain to Health as plain damage (no armour, no Wound check); a knack's Strain replaces its parent's. An ordinary roll charges once, when the modal opens and auto-rolls, so Escape afterwards does not refund it, and toggling Karma or an optional Step mod does not charge again. Mystic Aim (aim) and set-dice (True Shot) modals charge when the roll is committed, as before. When Strain is above 0 the modal hint reads "N Strain on roll."; a talent or knack roll that charged it also shows a "Strain N" chip in its Roll Log entry and Discord report (aim and set-dice rolls get no Strain line).
- **Theme-aware:** all colours work in light and dark mode (CSS variables /
  `light-dark()`); never hardcode a colour that fails in one mode.
- **Dev pill:** a `DEV` pill shows only on the `/dev/` instance; production shows
  no environment indicator (see `ui/ed-app.js`).
