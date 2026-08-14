# Plan: Buy & Sell (edit-mode trade on the Equipment tab)

**Status:** Recommended — pending owner's WDYT sign-off.
**Owner:** Gary
**Created:** 2026-08-14
**Baseline:** `dev` @ 8470483 **+ uncommitted potions work** in the working tree (13 files, +637/−33). This plan layers on top of that branch; presume potions is landed first.
**Backup:** whole `/Users/garyfebbrarino/Work/workspace/EDCharSheet`.

## Context

Owned items today are pure fabrications: the picker adds at qty 1 with no cost, the
qty stepper bumps freely, the ✕ removes with a bare confirm, and the wealth card is
edited by hand. Nothing ties the catalogue price to the character's purse. This plan
adds the missing economy: **buying deducts payment from the character's wealth, selling
credits it**. It is an edit-mode-only feature scoped to the Equipment tab.

It requires one new controlled-vocabulary element — a *trade amount* — which must be
expressed as a normal number (in silver) in `character.json`, and must never be a field
on the item itself (the data-model invariant: only inputs are stored, and the price a
player *accepted* is a session input, not a property of the object). Decisions A/B/C
below lock that down.

## Source of truth

- Cost of an item: `rules/items.json` → `ref.cost` (a number in **silver**, or a display
  string such as `"8 cp"`, `"100-175"`, `"5,000"`). Display formatting today lives in
  `ui/ed-equipment.js:40 costText`.
- Wealth model & coin math: `engine/wealth.js` (`COIN_DENOMINATIONS`, `coinsSilver`,
  `gemsSilver`, `GEM_RESALE`, `deriveWealth`).
- Input plumbing: ed-app `_editWealth` / `_editItems` handlers; the Equipment view already
  dispatches `ed-edit-items` and `ed-edit-wealth` and never mutates or derives.
- Overlay/modal conventions: `ui/ed-confirm.js` (Escape-closes / Enter-confirms /
  theme-aware) is the template the new trade modal follows.
- Item-purchased side effects (qty, folding, equipping) are already handled by pure
  `ui/item-equip-state.js` (`bumpQuantity`, `equipArmour`, `applyArmourSwap`).

## Scope

In (all edit-mode only, Equipment tab): buy-new via picker; buy-one-more via the qty
stepper's **+**; sell/remove-one via the qty stepper's **−**; sell via the ✕. Wealth
deduction (pay with the character's own coins and gems) and credit (sell price, default
full catalogue cost). Custom items (no `ref`, cost unknown) keep today's plain remove.

Out (explicitly kept out, flag if you want them in):
- Read-mode purchase affordances (edit mode only).
- Buy/sell **quantities** beyond 1 (stepper semantics, see Decision B).
- **Thread items**: prices entered as an editable amount (default **0**), as requested.
- An inventory "purse" — trade hands wealth in/out, nothing else.
- Auto-price-cap of trades against current wealth (GM discretion, no debt bookkeeping).

## Decisions

### A. Payment strategy for buying — *the* core mechanic

The buy dialog shows the item, a **suggested price = the catalogue cost** (parsed to
silver via `parseCostSilver`), and an **editable amount**. To cover it, the player
allocates payment from the wealth items they actually own — a payment grid listing
every coin denomination they hold (copper…orichalcum) and every gem, each with its own
qty stepper. The grid computes the running total using the engine's exported
`coinsSilver` / `gemsSilver` (UI *uses* engine helpers; it never computes rates itself).

- Default suggestion: the silver total (all-silver allocation).
- The player may instead pay, e.g., 1 × gold + 2 × emerald + 3 × silver.
- **Buy confirm is disabled unless the allocated total ≥ the amount.** Overpaying is
  allowed (the player may pay 1 × gold for a 15 sp item and let a GM sort the change) —
  this is a UX convenience, not a debt system.
- On confirm: apply the qty delta, then **subtract the allocated coins/gems from
  `wealth`** (never the full purse beyond what was allocated; checked against owned
  counts by the engine helper).

### B. Stepper semantics — one dice, one dose at a time

Keep the existing stepper rhythm; the dialogs are what change:

- **Stepper +1** → buy-dialog for that item (suggest price from `ref.cost` when it
  parses, else amount 0). Confirm = +1 AND deduct payment.
- **Stepper −1** → sell-dialog for that item (suggested sale price = **full catalogue
  cost**, editable). Confirm = −1 AND credit that silver to the wealth purse.
- **Picker "add new"** → buy-dialog (polling the same flow as +1 at qty 1).
- **✕** → when the item has a parseable cost, the sell-dialog (selling *all* remaining
  qty — sees full price); custom/no-cost items keep the plain remove-confirm.
- **Potion dose buttons** are left untouched — that flow is read+edit action, not owned
  quantity (see out-of-scope). Their steppers (if any) go through the same sell rule.

### C. Selling — credit default

Sell default price = the item's catalogue cost (parsed); editable to zero (== destroy /
give away). Credit is added to the wealth purse in **silver**. No allocation grid on the
sell side: paying-in from a mixed purse is the buy-side's many-to-one problem; selling is
a single credit. (Flag for owner: if you want sell credits allocatable too, that's an
easy Phase-B mirror — I left it out of the first pass.)

### D. Thread items

`threadRank` items carry no reliable catalogue price; their trade dialog pre-fills
**amount 0** and stays editable. Buying/selling thread items therefore credits or debits
whatever the player types (or nothing). Consistent with your "editable amount, default 0".

### E. Storage — only inputs, and only where the shape already exists

- `parseCostSilver` is engine work: numbers pass through; `"8 cp"` → 0.8; `"100-175"` →
  midpoint 137.5; `"5,000"` → 5000; unparseable → 0. **Display strings never written
  back**; the accepted *amount* is a session value, not stored.
- The **trade amounts themselves are not persisted** — they are derived suggestions on
  reopen. The wealth delta is persisted (coins/gems are shape-existing inputs). So
  `character.json` shape is unchanged: this is Tier 3 by the CLAUDE.md tiers.

## Guardrail classification

**Tier 3 — free.** No Tier-1 invariant is touched: data still flows down through one
`deriveModel`, events up via existing `dispatch`; the trade modal is view-local UI state
(which item, which allocation) that is **not** a derived game value on the sheet; the
pure engine gains only a parse helper (`parseCostSilver`) and keeps reusing its exported
coin/gem totals; `character.json` and `rules/*.json` shapes and their `schema` tags are
untouched. No taxonomy vocabulary changes ⇒ Tier 2 N/A.

## Phases

### A. Engine & plumbing (data path first, testable standalone)
- `engine/wealth.js`: add `parseCostSilver(cost)` (+ unit tests alongside the existing
  wealth tests): number passthrough · `"N cp"`/`"N sp"` suffix handling · thousands
  separators (`"5,000"`) · ranges (`"100-175"` → midpoint) · non-parseable → 0.
- `ui/ed-app.js`: add `ed-trade` handler that accepts `{ items }` + `{ coins, gems }`
  together, persists both (existing save paths), then runs **one** `deriveModel` so the
  Overview armour/init and the wealth card refresh through the normal cascade.
- **Verify:** parse `"8 cp"`/`"100-175"`/`"5,000"`/numeric; trade → single re-derive;
  nothing persists beyond inputs. Unit tests green.

### B. The trade dialog (`ui/ed-trade-modal`, styled to match `ed-confirm`)
- Modal in the ed-confirm overlay family: Escape-closes, Enter-confirms (confirm
  disabled while allocation < amount for buys), theme-aware light+dark, two weights.
- Buy view: item label + detail line, editable amount (suggested price), payment grid
  (each owned denomination + each gem with a qty stepper), running allocated total via
  `coinsSilver`/`gemsSilver`, confirm disabled until allocated ≥ amount.
- Sell view: same chrome, editable amount only (default full catalogue cost), no grid.
- **Verify:** Escape/Enter, disabled-confirm at shortfall, both themes, zoom/mobile
  fidelity with the UI-GUIDELINES.

### C. Wire the Equipment view
- Qty stepper **+**/**−** and picker **add** route to the dialog; ✕ routes to sell when
  `parseCostSilver` accepts the cost, else plain remove.
- On buy confirm: dispatch items change (existing `bumpQuantity`-style computation stays
  in `item-equip-state.js`) + wealth deduction, in one `ed-trade` dispatch.
- On sell confirm: qty −1 (or remove all) + silver credit.
- Armour **swap** (already a pending confirm) stays untouched — trades and swaps are
  distinct prompts; the sale of a swapped-out armour is not part of this plan.
- **Verify:** all Stepper directions; picker additive path; custom-item remove; armour
  swap unaffected; wealth card totals move in lockstep with trades.

### D. Guardrail pass + final checks
- The CLAUDE.md PR checklist, verbatim:
  - No Tier-1 invariant changed.
  - Overview still fits desktop viewport, no vertical scroll.
  - Derived values still placeholder pills, never fabricated numbers; **trade totals are
    UI-transient and never stored.**
  - Light + dark both work; modals still Escape-closes/Enter-confirms.
  - Taxonomy N/A (no vocabulary change).
  - Relative asset/fetch paths only.
- Full `node --test` suite + manual smoke: buy a priced item → wealth drops by the
  allocation; sell → rises by the sale price; thread-item trade at amount 0; reload → no
  phantom fields in `character.json`.

## Out of scope (explicitly deferred)

- Sell-side allocation grid; quantity-buying (`{ qty: 2 }` in one dialog — steppers are
  the qty path); potion-dose buttons; GM "purse"/debt tracking; trade history/log.

## Assumptions

- `character.json` shape is deliberately **unchanged** (no `costPaid`, no `soldAt`) —
  prices the player accepted are GM-gated session inputs, not canonical facts. Flagging
  this as a conscious choice: a kept ledger would be a new top-level shape (Tier 1).
- Costs that fail to parse (custom items, ranges we misread, e.g. `"100-175"` midpoint
  being a guess) default to amount **0** and remain editable — no fabricated default.
- Selling "all remaining qty" vs "one qty" on ✕: I default ✕ to sell-all (matches remove
  semantics); flag if you want ✕ = sell-one and the stepper handles the rest.

## Issues

1. **Range costs (`"100-175"`)** — midpoint keeps the UI honest without inventing a hard
   price. If you prefer buying costs to floor (100) and selling to floor too, that's a
   one-line `parseCostSilver` tweak in Phase A.
2. **Overpay by even coin** — paying 1 × gold (10 sp) for an 8 sp item overpays. GM
   discretion, no change-dispensing. Only sortie if you want auto-change (grating; I'd
   keep it out).
3. **✕ sells all vs one** (see Assumptions) — USER DECISION below.

## Progress log

- 2026-08-14 — Plan created; **awaiting WDYT**.

## WDYT

1. Range-cost default: midpoint (137.5 sp) **vs** floor (100 sp) for both buy & sell?
2. ✕ keeps its remove-a… no: ✕ **sells all** remaining vs sells **one** at a time?
3. Sell credit in **silver coin** only — or mirror the buy-side allocation grid?
4. Anything read-mode or potion-dose related you want pulled in?