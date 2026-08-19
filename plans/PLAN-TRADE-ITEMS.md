# Plan: Buy & Sell (edit-mode trade on the Equipment tab)

**Status:** Approved — owner sign-off complete (all WDYT resolved).
**Owner:** Gary
**Created:** 2026-08-14
**Baseline:** `dev`/`main` @ **v1.12.0** — the potions + item-quantity + type-scale work shipped (release commit `6e92391` on `main`, synced into `dev`). This plan layers on top of that release; `qty`, `bumpQuantity`, and the `consumable` marker are already present.
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

- Cost of an item: `rules/items.json` → `ref.cost` (a number in **silver**, always
  a single value — schema `ed-items/3`; a range or cp string was collapsed to the
  silver number at migration, per PLAN-STRUCTURED-COST-WEIGHT.md). Display formatting
  lives in `ui/ed-equipment.js costText`.
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
full catalogue cost). Custom / unparseable-cost items go through the **same dialogs at a
default amount of 0** (editable) — buy and sell symmetric; the plain remove-confirm is
retired for owned items.

Out (explicitly kept out, flag if you want them in):
- Read-mode purchase affordances (edit mode only).
- Buy/sell **quantities** beyond 1 (stepper semantics, see Decision B).
- **Thread items**: prices entered as an editable amount (default **0**), as requested.
- An inventory "purse" — trade hands wealth in/out, nothing else.
- Auto-price-cap of trades against current wealth (GM discretion, no debt bookkeeping).

## Decisions

### A. Payment strategy for buying — *the* core mechanic

The buy dialog shows the item, a **suggested price = the catalogue cost** (via
`costSilver` — the catalogue's `ref.cost` is already a silver number), and an
**editable amount**. To cover it, the player
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

**Gem valuation (owner-confirmed):** gems trade at **full face `valueSilver`** on both
sides — the grids use `gemsSilver` as-is (a 100 sp gem counts 100 sp when spent or
received). The engine's `GEM_RESALE` (0.75) stays a **wealth-card display concern only**
(the "if you liquidated your gems" total); it is *not* applied to trade allocation. A
future reader should not "reconcile" the divergence — it is deliberate.

### B. Stepper semantics — one item, one unit at a time

Keep the existing stepper rhythm; the dialogs are what change:

- **Stepper +1** → buy-dialog for that item (suggest price from `ref.cost` when it
  parses, else amount 0). Confirm = +1 AND deduct payment.
- **Stepper −1** and **✕** → the same sell-dialog for that item (suggested sale price =
  **full catalogue cost**, editable). Confirm removes **one** unit (row auto-deletes
  when qty reaches 0) and credits the proceeds. ✕ is one-at-a-time, not remove-all
  (owner confirmed, WDYT #2).
- **Picker "add new"** → buy-dialog (same flow as +1 at qty 1).
- **Custom / unparseable-cost items go through the SAME dialogs, defaulting to amount 0
  (owner-confirmed).** Every picker-add / **+** opens the buy-dialog (amount 0, editable —
  pay if you want, or add free at 0); every **−** / **✕** opens the sell-dialog (amount 0,
  editable). This supersedes the earlier "custom keeps the plain remove-confirm" — buy and
  sell stay symmetric, and the one dialog path covers priced and custom items alike. The
  plain remove-confirm is retired for owned items (a 0-amount sell is a give-away).
- **Potion dose buttons** are left untouched — that flow is read+edit action, not owned
  quantity (see out-of-scope). Their steppers (if any) go through the same sell rule.

### C. Selling — mirrors buying (receive grid)

Sell opens the same dialog chrome in receive-mode: suggested amount = the **full**
catalogue cost (parsed, owner-confirmed — buy and sell suggest the same price, so churn
is loss-free; editable down), and an **allocation grid lets the player choose how the
proceeds land** — which coins **and gems** they take back, default all-silver (owner
confirmed, WDYT #3). Confirm requires the grid to sum **exactly** to the final amount —
over-crediting would mint silver, so equality is enforced (unlike buy's ≥, where the
player may overpay with an even coin). "Deduct only the final amount" holds on both sides:
edit the amount down and only that much is credited; 0 = destroy / give away (owner
confirmed). No change-dispensing; if the player wants 137.5 sp as gold, the grid's
13 gold + the copper remainder handles it.

**Receiving proceeds as a gem (owner-confirmed: coins + gems).** Coins are fungible —
the grid just increments the count for a denomination. A **gem** is not: to take proceeds
as a gem the player must define it, so the receive grid embeds the wealth card's existing
**add-gem sub-form** (`name`, `valueSilver`, `qty`) — "a gem you were paid in." The
running received total counts it at `valueSilver × qty` (via `gemsSilver`), and a matching
`{ name, valueSilver, qty }` record is appended to `wealth.gems` on confirm (or merged
into an existing identical gem). The exactly-equals-amount rule still applies (copper
tops up any remainder). The buy grid, by contrast, only *spends* gems the player already
owns (steppers over owned gems), never invents one.

### C.5 Copper representation — no fractional silver anywhere

Only whole coins exist, so any fractional silver surfacing from a trade must be
denominated in copper — **10 copper = 1 silver** (owner confirmed, WDYT #1). The
dialog's amount field accepts silver at **copper granularity** (multiples of 0.1 sp);
`costSilver` results are honored at the same step (a catalogue `ref.cost` is already
silver — `0.8` = exactly a copper count, `137.5` → 1,375 cp, `5000` → 5,000).
A result that would land under a whole copper rounds **up** to the nearest copper —
never a fabricated cheaper price.

### D. Thread items

`threadRank` items carry no reliable catalogue price; their trade dialog pre-fills
**amount 0** and stays editable. Buying/selling thread items therefore credits or debits
whatever the player types (or nothing). Consistent with your "editable amount, default 0"
(owner confirmed). **Revised 2026-08-15 (review):** when a thread item *does* carry a
parseable `ref.cost` (e.g. the Orc Stinger, `4650`), default to that parsed amount and
fall back to 0 when absent/unparseable — the same rule as every other item, so the
special case is retired. Thread rows are qty-unique: buy adds the row (`threadRank` 0,
no `qty`), sell removes it — Phase C wiring must be thread-aware (`bumpQuantity` is a
no-op for threads).

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
- `costSilver` is pure engine: a number passes through (the catalogue's `ref.cost`
  is already silver), anything else → 0 (never fabricated). No display strings are
  ever written back. (The old `parseCostSilver` string parser, and the `"8 cp"` /
  range / thousand-separator forms, were removed in PLAN-STRUCTURED-COST-WEIGHT.md.)

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
pure engine gains only a `costSilver` helper (schema `ed-items/3`; the catalog
already stores silver numbers) and keeps reusing its exported coin/gem totals; `character.json` and `rules/*.json` shapes and their `schema` tags are
untouched. No taxonomy vocabulary changes ⇒ Tier 2 N/A.

## Phases

### A. Engine & plumbing (data path first, testable standalone)
- `engine/wealth.js`: ~~add `parseCostSilver(cost)`…~~ — **superseded.** The string
  forms that helper parsed (`"8 cp"`, `"5,000"`, `"100-175"` ranges) were removed
  when `rules/items.json` became `ed-items/3` (PLAN-STRUCTURED-COST-WEIGHT.md);
  catalogue costs are now stored silver numbers and `parseCostSilver` is the
  pass-through `costSilver` (number → itself, else 0, never fabricated).
- `ui/ed-app.js`: add `ed-trade` handler that accepts `{ items }` + `{ coins, gems }`
  together, persists both (existing save paths), then runs **one** `deriveModel` so the
  Overview armour/init and the wealth card refresh through the normal cascade.
- **Verify:** trade → single re-derive; nothing persists beyond inputs. Unit tests green.

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
- Qty stepper **+**/**−**, picker **add**, and **✕** all route to the trade dialog —
  buy for **+**/add, sell for **−**/✕. A custom / unparseable-cost item opens the same
  dialog at amount 0 (no more plain-remove branch for owned items).
- On buy confirm: dispatch items change (existing `bumpQuantity`-style computation stays
  in `item-equip-state.js`) + wealth deduction, in one `ed-trade` dispatch.
- On sell confirm: qty −1 (or remove row at 0) + credit the exact received quantity.
- Armour **swap** (already a pending confirm) stays untouched — trades and swaps are
  distinct prompts; the sale of a swapped-out armour is not part of this plan.
- **Verify:** all Stepper directions; picker additive path; custom-item buy/sell at
  amount 0 (dialog, not plain remove); receive-proceeds-as-gem appends a `wealth.gems`
  record; armour swap unaffected; wealth card totals move in lockstep with trades.

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
- Costs that fail to resolve (custom items, stale strings we no longer read, anything
  non-numeric) default to amount **0** via `costSilver` and remain editable — no
  fabricated default. (Ranges such as `"100-175"` were collapsed to a stored silver
  midpoint at the `ed-items/3` migration — PLAN-STRUCTURED-COST-WEIGHT.md — so they
  are numbers now, no longer "a guess at parse time".)
- ✕ sells **one** unit at a time, same dialog as stepper −1; the row is removed only
  when quantity reaches 0 (owner confirmed WDYT #2).

## Issues

1. **Range costs (`"100-175"`)** — midpoint (137.5 sp) was the default suggestion for
   both buy and sell (owner answer #1, "represent 0.5 silver as copper"). **Resolved:**
   the ranges no longer exist at runtime — the `ed-items/3` migration stored the
   midpoint (137.5) as the catalogue cost itself, so `costSilver` passes it through
   unchanged; no parse-time guess remains.
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
8. **Gem valuation:** full face `valueSilver` on both buy and sell (grids use `gemsSilver`
   unchanged); `GEM_RESALE` 0.75 is a wealth-card display concern only, never applied to
   trades. ✓ (2026-08-14)
9. **Sell proceeds may be taken as gems**, not coins only — the receive grid embeds the
   add-gem sub-form (`name`, `valueSilver`, `qty`) and appends the gem to `wealth.gems`;
   the buy grid only spends already-owned gems. ✓ (2026-08-14)
10. **Sell default price = full catalogue cost** (100% of parsed `ref.cost`), editable
    down; buy and sell suggest the same price. ✓ (2026-08-14)
11. **Custom / unparseable-cost items use the same buy/sell dialogs at amount 0**
    (editable); the plain remove-confirm is retired for owned items. Buy and sell stay
    symmetric. ✓ (2026-08-14)
12. **Thread-item trade default = `costSilver(ref.cost)` (always a number now)** — same
     rule as all items (Orc Stinger 4650 sp pre-fills 4650, Band of the Elements pre-fills
     0). Thread rows buy/sell as whole-row add/remove (qty-unique). ✓ (2026-08-15)

## Progress log

- 2026-08-14 — Plan created; WDYT #1–3 & thread/sell/buy confirmed.
- 2026-08-14 — Storage ledger resolved: **no ledger** (owner). Plan fully signed off.
- 2026-08-14 — Review pass (post-v1.12.0): baseline rebased to the shipped v1.12.0;
  gem valuation pinned to full face (GEM_RESALE display-only); sell proceeds may be taken
  as gems (receive grid gains the add-gem sub-form); sell default = full cost; custom/
  unparseable items go through the dialogs at amount 0 (plain-remove retired, buy/sell
  symmetric); `parseCostSilver` fractional-copper path (`"8 cp"` → 8 cp) called out for a
  dedicated Phase A test. Decisions #8–#11 recorded. Implementation not started.
- 2026-08-15 — Code review (post thread-weapons commit): plan references verified against
  the code (wealth.js exports, equipment edit-dispatch paths, ed-confirm family, item-
  equip-state helpers, cost formats in items.json). Two adjustments adopted: thread-item
  trade default = parsed `ref.cost` else 0 (Decision D revised, #12); thread rows are
  qty-unique so Phase C wiring is thread-aware. Ready to begin Phase A.
- 2026-08-16 — Phase C bugfix + price flexibility: `_tradeItem` returns the merged catalog
  entry WITH its `name` (the catalog keys by name, so a pick on an unowned item previously
  carried no `itemName` and the confirm silently bailed). Amount is freely editable for buy
  and sell; editing it re-seeds the default all-silver allocation against the new price
  (sell: the credit can sum exactly; buy: it just needs to cover), so trading at any price
  — not just the catalogue value — is one dial, not a hand-fiddled grid.

## WDYT

All items resolved. Plan approved — begin Phase A when ready.