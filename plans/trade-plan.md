# Plan: Buy & Sell (edit-mode trade on the Equipment tab)

**Status:** Approved — owner sign-off complete (all WDYT resolved).
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
- **If you cannot pay, you cannot add it.** Buy confirm is disabled unless the
  allocated total ≥ the amount — the item only enters `equipment` when the purse
  actually covers it (owner confirmed). Overpaying is allowed (pay 1 × gold for a
  15 sp item and let a GM sort the change) — a UX convenience, not a debt system.
- On confirm: apply the qty delta, then **subtract the allocated coins/gems from
  `wealth`** (never the full purse beyond what was allocated; checked against owned
  counts by the engine helper).

### B. Stepper semantics — one item, one unit at a time

Keep the existing stepper rhythm; the dialogs are what change:

- **Stepper +1** → buy-dialog for that item (suggest price from `ref.cost` when it
  parses, else amount 0). Confirm = +1 AND deduct payment.
- **Stepper −1** and **✕** → the same sell-dialog for that item (suggested sale price =
  **full catalogue cost**, editable). Confirm removes **one** unit (row auto-deletes
  when qty reaches 0) and credits the proceeds. ✕ is one-at-a-time, not remove-all
  (owner confirmed, WDYT #2).
- **Picker "add new"** → buy-dialog (same flow as +1 at qty 1).
- Custom / unparseable-cost items keep the plain remove-confirm.
- **Potion dose buttons** are left untouched — that flow is read+edit action, not owned
  quantity (see out-of-scope). Their steppers (if any) go through the same sell rule.

### C. Selling — mirrors buying (receive grid)

Sell opens the same dialog chrome in receive-mode: suggested amount = the catalogue
cost (parsed), editable; an **allocation grid lets the player choose how the proceeds
land** — which coins and gems they take back, default all-silver (owner confirmed,
WDYT #3). Confirm requires the grid to sum **exactly** to the final amount — over-
crediting would mint silver, so equality is enforced (unlike buy's ≥, where the player
may overpay with an even coin). "Deduct only the final amount" holds on both sides:
edit the amount down and only that much is credited; 0 = destroy / give away (owner
confirmed). No change-dispensing; if the player wants 137.5 sp as gold, the grid's
13 gold + the copper remainder handles it.

### C.5 Copper representation — no fractional silver anywhere

Only whole coins exist, so any fractional silver surfacing from a trade must be
denominated in copper — **10 copper = 1 silver** (owner confirmed, WDYT #1). The
dialog's amount field accepts silver at **copper granularity** (multiples of 0.1 sp);
`parseCostSilver` results are honored at the same step (`"8 cp"` → 0.8 sp → 8 cp =
exactly a copper count; `"100-175"` midpoint 137.5 sp → 1,375 cp; `"5,000"` → 5,000).
A parse that would land under a whole copper rounds **up** to the nearest copper —
never a fabricated cheaper price.

### D. Thread items

`threadRank` items carry no reliable catalogue price; their trade dialog pre-fills
**amount 0** and stays editable. Buying/selling thread items therefore credits or debits
whatever the player types (or nothing). Consistent with your "editable amount, default 0"
(owner confirmed).

### E. Storage — only inputs, and only where the shape already exists

**What a trade actually writes to `data/character.json`:**

A trade edits exactly two already-existing inputs, nothing else:

1. `items` — the row appears (buy) or loses one unit / is removed (sell). Each row is
   exactly today's shape: `{ "name", "equipped", "threadRank"? }`. No new field is
   added to an item.
2. `wealth` — `{ coins: { copper…orichalcum }, gems: [{ name, valueSilver, qty }] }`
   with the allocated coins/gems subtracted (buy) or the credited ones added (sell).
   Same shape as today's hand-edited wealth card.

Decimal-coin care: a credit like `+137.5 sp` is **not** written as `137.5` silver —
it lands as whole coins (13 gold + 7 silver + 5 copper). Whatever the coin counts are
is what persists.

**What is deliberately NOT stored:**

- The negotiated price. `character.json` has no `costPaid`, no `soldAt`, no trade
  ledger. On reload the price suggestion is *derived from the catalogue again* — the
  accepted price was a session fact, not a property of the item.
- `parseCostSilver` is pure engine: numbers pass through, `"8 cp"` → 0.8, `"100-175"`
  → 137.5, `"5,000"` → 5000, unparseable → 0. Display strings are **never written back**.

**Why "shape is unchanged":** the file's top-level keys (`schema`, `items`, `wealth`,
…) and every item/coin/gem record keep the exact `ed-character/1` shapes. A trade is
`items` + `wealth` moving in sync — both already-validated input stores. This keeps the
whole change **Tier 3** under CLAUDE.md: no Tier-1 invariant, schema tag, or taxonomy
touched.

**The one thing that would change shape:** persisting a *ledger* of "bought X for N"
entries would add a new top-level field — a `ed-character/1` shape change = Tier 1,
needs your explicit sign-off. Default plan: **no ledger** (see WDYT).

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
- Sell view: same chrome, editable amount (default full catalogue cost) plus the
  **receive grid** (which coins/gems the proceeds land as); confirm requires grid total
  exactly equal to the amount. Copper handles any sub-silver remainder (C.5).
- **Verify:** Escape/Enter, disabled-confirm at shortfall, both themes, zoom/mobile
  fidelity with the UI-GUIDELINES.

### C. Wire the Equipment view
- Qty stepper **+**/**−** and picker **add** route to the dialog; ✕ routes to sell when
  `parseCostSilver` accepts the cost, else plain remove.
- On buy confirm: dispatch items change (existing `bumpQuantity`-style computation stays
  in `item-equip-state.js`) + wealth deduction, in one `ed-trade` dispatch.
- On sell confirm: qty −1 (or remove row at 0) + credit the exact received quantity.
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

- Quantity-buying (`{ qty: 2 }` in one dialog — steppers are the qty path); potion-dose
  buttons; GM "purse" / debt tracking; trade history/log ledger (see Decision E & WDYT).

## Assumptions

- `character.json` shape is deliberately **unchanged** (no `costPaid`, no `soldAt`, no
  ledger) — prices the player accepted are GM-gated session inputs, not canonical facts.
  A kept ledger would be a new top-level shape (Tier 1) and is **not** in this plan's
  default (see WDYT #4).
- Costs that fail to parse (custom items, ranges we misread, e.g. `"100-175"` midpoint
  being a guess) default to amount **0** and remain editable — no fabricated default.
- ✕ sells **one** unit at a time, same dialog as stepper −1; the row is removed only
  when quantity reaches 0 (owner confirmed WDYT #2).

## Issues

1. **Range costs (`"100-175"`)** — midpoint (137.5 sp) is the default suggestion for
   both buy and sell (owner answer #1, "represent 0.5 silver as copper"). If you want
   flooring instead, it's a one-line `parseCostSilver` tweak in Phase A.
2. **Overpay by even coin** — paying 1 × gold (10 sp) for an 8 sp item overpays (buy:
   allowed; sell: grid must equal the amount). GM discretion, no change-dispensing.
   Only sortie if you want auto-change (grating; keep it out).
3. **Buy can't afford, but wants it anyway** — item stays in the picker, not added.
   The GM can award the coin later and the player buys then. No debt bookkeeping.
4. **Storage / ledger** — see WDYT #4.

## Decisions recorded (owner answers)

1. **Range cost default:** midpoint (137.5 sp) for buy & sell; fractional silver lands
   as copper (0.5 sp = 5 cp). ✓
2. **✕ / stepper −1:** sell-one-at-a-time, same dialog; row removed at qty 0. ✓
3. **Sell:** mirrors buy with a receive allocation grid; credit = exactly the final
   edited amount. ✓
4. **Thread items:** editable amount, default 0. ✓
5. **Buy:** cannot add an item you cannot pay for (confirm gated by coverage). ✓
6. **No read-mode / potion-dose pulls at this stage.** ✓
7. **No trade ledger** — prices are forgotten after the trade; `character.json` holds
   only item rows + resulting coin/gem counts. Storage stays Tier 3. ✓

## Progress log

- 2026-08-14 — Plan created; WDYT #1–3 & thread/sell/buy confirmed.
- 2026-08-14 — Storage ledger resolved: **no ledger** (owner). Plan fully signed off.

## WDYT

All items resolved. Plan approved — begin Phase A when ready.