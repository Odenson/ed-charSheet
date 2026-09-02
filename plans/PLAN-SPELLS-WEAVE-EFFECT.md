# Plan: Open weaving to 0-thread spells + gate the Effect button

Two small Spells-tab fixes that bring the implemented cast workspace into line
with the **already-signed-off** design contract (PLAN-SPELLS.md §3.1/§3.4):

1. **Weave extra threads onto 0-thread spells.** Design says: *"Extra threads
   are optional adds, for any spell. Even a spell with `threadsToWeave: 0` …
   may have extra threads forged to boost its effects — the `extraThreads`
   options"* (§3.1). The cast panel greys the Weave step whenever
   `threadsToWeave === 0`, so a 0-thread spell with extra-thread options (e.g.
   Chilling Circle) can never weave them. Fix is UI-only; the engine's
   weave/assign machinery already handles 0-required casts.
2. **Show the Effect button only when an effect die is needed.** Design says:
   static (sustained) effects *"fill a readout, not a roll; step
   (instantaneous) effects roll an Effect test"* (§3.4, §6.1 step 4). The panel
   currently renders a button for every effect kind — including `static`
   ("Apply +N") and `none` ("Done"), where there is no die to roll. Fix is
   UI-only; the engine already classifies `effect.kind` as
   `'step' | 'static' | 'none'`.

This file is the plan for owner review. **Implemented 2026-09-02** on `dev` (both
changes + the 1d cast-gate fix, folded in from review); changelog row recorded in
PLAN-SPELLS.md §10.

- **Owner:** repo owner. **Created:** 2026-09-02. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `99def3d`. Suite **725** (`npm test`, import check first);
  still 725 green after implementation.
- **Design reference:** PLAN-SPELLS.md §3.1 (threads/extra threads), §3.4
  (effect archetypes), §6.1 step 2/4 (forge + effect).
- **Note:** the uncommitted autosave fix in `ui/ed-app.js` is unrelated and
  untouched by this plan.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| Open the Weave step to 0-thread spells | ✅ Tier 3 | Restores behavior the signed-off design already promises. UI-only (`ui/ed-spells.js`); no schema, taxonomy, engine, or data change; data still flows down (reads `plan.*` pushed by the engine), events still flow up (existing `ed-roll` dispatch). |
| Gate the Effect button to step-kind effects | ✅ Tier 3 | Authorized by §3.4/§6.1 step 4 ("static fills a readout, not a roll"). UI-only; the derived `effect.kind` already exists — no fabricated number introduced. |
| Auto-apply static/none effects at cast land | ✅ Tier 3 | A UI-flow convenience replacing the now-removed button click; the readout still shows the engine-provided static value (`plan.effect.value`/`label`), never a guessed number. |
| Weave Karma gating (unchanged) | ✅ Tier 3 | `castPlan.canKarma.weaving` stays tied to required threads (`effectiveThreads > 0`); existing test asserts `false` for a 0-thread spell — kept as-is. |

**Tier-1 invariants upheld:** store only inputs (no new persisted state); data
down / events up (all edits flow through the existing `_emit`/`ed-roll`
dispatch, no state mutation in the view); pure DOM-free engine untouched;
theme-aware (reuses existing classes); no new modals (Escape/Enter contract
unaffected); relative fetch paths unchanged.

---

## Change 1 — Weave step enables for 0-thread spells with extra-thread options

**Outcome:** a 0-thread spell that has `extraThreads` options shows an active,
usable Weave step (button, difficulty note, counter) that forges **extra**
threads up to the Circle cap and assigns each to an option — exactly like the
existing extra-thread flow on threaded spells. A 0-thread spell with **no**
options (e.g. Spirit Dart) still shows "No threads to forge".

### 1a. `_castPanel` — the weave-step gate (`ui/ed-spells.js:1081`)

```js
// today
const forge = plan.threadsToWeave > 0;
// becomes
const forge = plan.threadsToWeave > 0 || (plan.extraThreads?.length > 0);
```

- Trigger is **having options**, not `extraThreadCap > 0`: per §3.1, extra
  threads only exist to boost effects via the `extraThreads` options; a thread
  with nothing to assign would be a silent no-op.
- `plan.extraThreadCap` is pushed to cast displays (grid row, `_weaveMax`) but
  is not the gate.

### 1b. Weave counter showing required, not cap, for a 0-required cast (`ui/ed-spells.js:1123`)

The owner's in-test read: the counter should always read against the spell's
**required** count, so a 0-thread spell shows **"0/0"** until a thread is
woven, then **"1/0"** for each extra forged. The required count stays the
denominator regardless:

```js
// today (before this change)
<span class="threads" title="Threads woven / required">${prog.threadsWoven}/${plan.threadsToWeave}</span>
// becomes — one template, denominator always the required count
<span class="threads" title=${plan.threadsToWeave > 0 ? 'Threads woven / required' : 'Threads woven / required (0)'}>
  ${prog.threadsWoven}/${plan.threadsToWeave}</span>
```

`prog.threadsWoven` is still capped at `_weaveMax(plan)` (`threadsToWeave +
extraThreadCap`, `ed-spells.js:928`) by `_rollWeave`, so it can never exceed the
extra-thread cap — the "1/0" can't run past the Circle cap. Threaded spells
render unchanged.

### 1c. Weave machinery needs no changes; Cast does (review finding folded in)

- `_rollWeave` (`:930-942`) caps at `_weaveMax`, sets `_reqThreads =
  plan.threadsToWeave` (= 0), and `_weaveOptions = plan.extraThreads`.
- `_onRoll` weave branch (`:370-395`): `isExtra = threadsWoven >= _reqThreads`
  is **true on the first weave** (0 ≥ 0), so it requires a successful weave,
  then auto-assigns a single option, opens the pick row for multiple options, or
  counts un-assigned otherwise. Correct at 0 required.

### 1d. Cast must wait for a pending extra-thread pick (review finding, folded in)

Review found a **pre-existing gap** this change makes easy to hit: a pending
extra-thread assignment does **not** block Cast. Weave disables itself while a
pick is pending (`?disabled=${weaveMaxed || prog.pendingPick}`, `:1125`), but
Cast is gated only on required threads — button `?disabled=${prog.castDone ||
!threadsMet}` (`:1132`) and `_rollCast` guards only `castDone`/`threadsWoven`
(`:979-981`). A player who weaves an extra thread and skips the pick can then
cast with the pending option unassigned, silently dropping its benefit — and
for a **0-thread multi-option spell** (the new Chilling Circle case)
`threadsMet` is true from the start, so the gap is one weave + one cast away.

Fix — gate Cast on `pendingPick` exactly like Weave:

- **UI** — Cast button `?disabled=${prog.castDone || !threadsMet || prog.pendingPick}`
  (with the pick row already on-screen); the Cast stepnote reads **"Assign the
  extra thread first"** while a pick is pending.
- **Handler** — `_rollCast` early-returns on `this._prog.pendingPick` (mirrors
  `_rollWeave:932`), so the guard holds even if a stray Cast event arrives.

### 1e. A forged thread is a pre-condition of the cast (owner rule)

> **Rule:** *any **successful** Thread Weaving roll — required **or** extra, on
> **any** spell, including a `threadsToWeave: 0` spell — forges a thread that is
> a **pre-condition** of that cast. From the moment the thread is forged the
> caster is **pre-conditional**: the Cast roll must carry and consume the
> cast's woven threads (exactly as a required thread powers the cast), even when
> the spell lists zero required. The pre-conditional state holds **from the
> successful weave until the cast lands**, and it blocks **only the Cast step**
> — it does not block switching spell, cast type, or other actions.*
>
> *A **failed** weave forges no thread and establishes no pre-condition.*

The subtlety this codifies: `threadsToWeave: 0` means "nothing required *up
front*" **not** "never a pre-condition." Once the caster rolls any thread, a
thread of this cast exists and casting must be aware of it. **The forged-thread
count is `threadsWoven`** — every successful weave increments it, required or
extra, so the counter *is* the pre-condition. The step gate should therefore be
"the cast must not outrun its forged threads," not merely "required count met":

- For a **threaded** spell the existing gate already does this: `threadsMet =
  threadsWoven >= threadsToWeave` plus `_rollCast`'s `threadsWoven <
  threadsToWeave` return keep Cast from landing before the required threads are
  forged — and a 0-extra spell simply has no further forge step.
- For a **0-thread extra-option** spell (the new Chilling Circle path) the thread
  is forged as an **extra**, so `threadsWoven` is ≥ 1 while `threadsToWeave` is
  0. Under this rule, the woven extra thread cannot be left as a dangling boost:
  **the cast must consume it.** Since `threadsMet` is computed only from required
  count, a 0-required spell becomes immediately castable the moment its first
  (extra) thread lands — which is exactly the "casting is aware, the thread
  powers/spends with the cast" outcome the owner asked for. There is no separate
  "release the thread" step because the thread rides the cast; it is consumed on
  landing and the weave counter resets for the next cast (the existing
  auto-reset / Effect-landing reset).

No code change is required for 1e today: the pre-condition is *satisfied* when
the cast consumes the forged threads (threaded gate) and *trivially* when a
0-required cast consumes its own forged extra (the count is met as soon as it
exists). The rule is normative for future guided/auto-cast work and for any
later "can I abandon a forged thread?" feature — see behavior decision 1.

---

## Change 2 — Effect button only when an effect die is needed

**Outcome:** `step`-kind effects keep the ⚄ Roll button (unchanged). `static`
and `none` effects show **no button** — the step is a readout card carrying the
effect description, and the cast flow resets automatically when the cast lands
(player has nothing to do between cast and effect for a readout; the button was
only acting as the "next cast" reset).

### 2a. Render the button only for `step` (`ui/ed-spells.js:1147-1154`)

```js
// today
<button class="rollbtn" ?disabled=${!prog.castDone} @click=${() => this._doEffect(plan)}>${effectLabel}</button>
// becomes
${plan.effect.kind === 'step' ? html`<button class="rollbtn" ?disabled=${!prog.castDone} @click=${() => this._doEffect(plan)}>⚄ Roll</button>` : ''}
```

The stepnote already carries the description for non-step kinds: the effect
label (`plan.effect.label`) for `static`, "See description" for `none`. The
`effectLabel` variable and its `static`/`none` branches (`:1089`) become
unused and are removed.

### 2b. Auto-apply static/none at cast land (`_onRoll` cast branch + `_rollCast`)

- `_rollCast` (`:979-1010`) stashes the effect kind from `plan.effect` on the
  cast dispatch (`_castEffectKind = plan.effect.kind`).
- `_onRoll` cast branch (`:396-408`), after the success-level write and the
  `ed-spell-activate` fold dispatch, adds:

```js
if (this._castEffectKind && this._castEffectKind !== 'step') {
  const ok = levels >= 1;
  this._prog = { ...this._blankProg(),
    cast: this._prog.cast,                                // keep the success banner
    effect: { total: null,                                // nothing rolled — no rolled-N readout
              outcome: { word: ok ? (this._castEffectKind === 'static' ? 'Applied' : 'Done') : 'No effect', ok } } };
}
```

The effect record carries **no `total`** — there is no die for a static/none
effect, so no `rolled N` is possible and none is fabricated.

This resets `castDone`/`threadsWoven` (Weave + Cast un-grey for the next cast)
while preserving the last-cast result for the success banner. On a **miss** the
readout shows "No effect" and re-casting is immediately available (the roll log
keeps the record) — same reset escape the button used to provide.

### 2c. Effect step greying (skip condition, `ui/ed-spells.js:1147`)

```js
// today
<div class="step ${!prog.castDone ? 'skip' : ''}">
// becomes
<div class="step ${!prog.castDone && !prog.effect ? 'skip' : ''}">
```

Without this, the auto-applied Effect readout would sit greyed forever (after a
cast land, `castDone` has already reset). With it, the readout card is live once
the effect resolves.

### 2d. Simplify `_doEffect` (`:1023-1037`)

The `static`/`none` branch becomes dead (no button renders for those kinds, and
auto-apply covers the reset). Collapse `_doEffect` to the `step` path only; its
`if (!prog.castDone) return;` guard and the `⚄ Roll` dispatch stay as-is — the
Effect roll flow (cast → optionally weave more extras → roll Effect → reset) is
unchanged.

### 2e. Applied readout wording — effect callsite only, never the shared renderer

`_rollRes` (`:1074-1077`) is the **shared** readout for all three steps — Weave,
Cast, and Effect — and prints "rolled N" whenever a roll has a `total`. That
wording is wrong for a static readout (nothing was rolled), so for **non-step**
effects we stop routing through it. **`_rollRes` itself is unchanged** and keeps
serving Weave/Cast (their "rolled N" readouts must not drift).

The change is a **branch at the Effect callsite** in `_castPanel`, not in
`_rollRes`:

```js
// effect step readout (no button for static/none, see 2a)
${prog.effect
  ? (prog.effect.total != null ? this._rollRes(prog.effect)        // step-effect roll: "rolled N"
      : html`<span class="rollres">${prog.effect.outcome?.word ?? ''}</span>`) // static/none: "Applied"/"Done"/"No effect"
  : ''}
```

Weave and Cast keep calling `this._rollRes(prog.weave)` / `(prog.cast)`
unchanged; only the Effect cell ever shows `outcome.word`.

---

## Behavior decisions (flagged for sign-off)

1. **Option-gated weaving.** A 0-thread spell is weavable **iff it has
   `extraThreads` options** (Chilling Circle: yes → weave enabled; Spirit Dart:
   no → "No threads to forge"). Alternative considered — gating on
   `extraThreadCap > 0` — would offer meaningless no-op threads on option-less
   spells; rejected.
2. **Weave Karma unchanged.** `canKarma.weaving` stays tied to required threads,
   so a 0-thread cast does not pause to offer Karma on the (there-are-no-required)
   weave. Karma on Cast/Effect is unaffected. (Only if the owner wants Karma on
   extra-only weaves would the engine's `castPlan.canKarma.weaving` need a
   follow-up; flagged, not planned.)
3. **Auto-reset on cast land** (2b) replaces the removed button's reset role for
   static/none spells. Step-effect spells keep the post-cast "weave more extras,
   then roll Effect" window unchanged.
4. **Cast gated on pending pick** (1d) — mirrors the existing Weave gate; both
   apply to any spell, threaded or not. This is a correctness fix the new
   0-thread multi-option path made trivially reachable, not a new restriction.
5. **Any successful weave is a pre-condition of the cast** (1e, owner rule). A
   forged thread — required **or** extra, `threadsToWeave: 0` or not — is a
   pre-condition; the Cast must carry/consume the cast's woven threads. The
   pre-conditional state blocks only the Cast step until it lands; a failed
   weave forges nothing. This is the normative reading to carry into guided
   auto-cast and any future "abandon a forged thread" feature.

---

## Verification

- `npm test` → 725 existing tests stay green. No engine/data/taxonomy change, so
  `engine/spells.test.js` (incl. `canKarma.weaving === false` for 0-thread at
  `spells.test.js:203`) is untouched. No UI unit tests exist for `ed-spells`.
- Manual, in browser (dev server):
  - **Chilling Circle** (0 threads, 3 options): Weave step active, counter
    "0/0" → "1/0" per extra (capped at the Circle cap in the numerator, never
    past it), pick row on multiple options; **Cast disabled ("Assign the
    extra thread first") until the pick is made**; Effect step shows no button,
    description only, auto-"Done" on cast land; success banner persists;
    Weave + Cast un-grey for the next cast.
  - **Spirit Dart** (0 threads, no options): still "No threads to forge"; Effect
    ⚄ Roll button kept (step-kind effect).
  - **Soul Armor** (1-thread threaded baseline): weave/counter/flow unchanged;
    static Effect → no button, "Applied" readout on cast land.
  - **Astral Spear** (step-kind): full Effect roll flow unchanged, boosts fold
    into the Effect step as today.
  - Light + dark mode: no new classes, existing theme tokens reused.

### Follow-up — UI flow regression coverage (deferred, accepted risk)

Verification above is manual-only: the repo has **no DOM/component harness** (the
`ui/*.test.js` files test extracted pure logic, not Lit components), and this
change tightens the cast step-state machine (Weave/extra-pick → Cast → auto-reset
Effect). That is a residual regression risk for these paths. Accepted for now;
parked follow-up — **when/if a harness is available** (browser/component runner),
add minimal flow tests for: a 0-thread multi-option spell (weave → pick → cast
blocked while pending → auto-applied static/none effect), and the step-effect
path (weave → cast → effect roll resets). If no harness ever lands, an
alternative is extracting the cast-flow reducer into `engine/spells.js` (pure,
per the golden rule) so the transitions get `node --test` coverage.

## Files

- `ui/ed-spells.js` — the only file changed (1a/1b/2a/2b/2c/2d/2e).

On approval: implement, run `npm test`, and record this plan as a Phase row in
PLAN-SPELLS.md's §10 changelog (the hunks are implementations of already-signed
§3.1/§3.4 behavior, not new design).