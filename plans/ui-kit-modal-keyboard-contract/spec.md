# Tech Spec: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Overview
A small in-repo kit under `ui/kit/` owns the modal keyboard and focus contract:
- a pure stack and key router (`modal-stack.js`);
- a `ModalController` with **one** capture-phase `document` key listener that acts on the top modal only, plus a held-key latch (`modal-controller.js`, moved from `ui/`);
- a Lit frame (`modal.js`) and button styles (`button-css.js`).

`tools/check-ui-kit.mjs` runs in `pretest`. It enforces the kit against a two-way ratchet baseline. Items I5–I11 migrate the seven high-severity hosts, and I12 syncs the docs. Plan items, owner decisions and sequencing are in `plan.md`. This spec settles the design details the plan left open and adds no new scope.

## Guardrail alignment
- **Tiers** are as in plan.md "Guardrail classification". Re-checked against GUARDRAILS.md with the ed-change-guardrail skill.
  - **Tier 1, signed off:** read-only Enter closes (I6 roll OK view, I9, I10 info, I11 info) and the UI-GUIDELINES §7 D1 sentence (I12). Sign-off is qa-log 2026-11-18T11:53 (D1), scoped by 13:40 (roll OK kept) and 13:42 (§7 gets only the D1 line).
  - **Everything else is Tier 3.** There is no Tier-2 item.
- **No new Tier-1 item.** Nothing below changes the §6a picker, §8 conflict, §8a Settings, the armour-swap rule, Strain-on-roll text ("N Strain on roll." stays), two weights or theme.
- **Data-down / dispatch-up holds.**
  - The kit never dispatches game events and never touches character state.
  - Hosts pass `onConfirm`/`onClose` callbacks.
  - `ed-confirm` and `ed-trade-modal` still only dispatch `confirm`/`close`.
- **The engine is untouched.**
  - `modal-stack.js` is pure: no DOM, no `lit`.
  - `modal-controller.js` touches the DOM only inside methods and in the guarded listener registration.
- **No stored values. No placeholder pills affected.**

## Design

### Data / types
None. No character data, schema, rules or taxonomy change.

The only new data file is `tools/ui-kit-baseline.json`, which is tooling (shape below).

### Modules & functions

#### `ui/kit/modal-stack.js` (new, pure; tests `ui/kit/modal-stack.test.js`)

| Export | Contract |
|---|---|
| `KINDS` | `Object.freeze(['input','confirm','info','picker'])` |
| `createModalStack()` | Returns `{ push(e), remove(e), top(), size(), entries(), has(e), clear() }`.<ul><li>`push` moves an entry that is already present to the top (idempotent).</li><li>`remove` is a no-op when the entry is absent.</li><li>`top()` returns `null` when the stack is empty.</li><li>`entries()` returns a copy, bottom to top.</li></ul> |
| `routeKey(facts)` | Returns `'close' \| 'confirm' \| 'block' \| 'pass'`.<ul><li>**Four strings (settled).** `'block'` means swallow with no action.</li><li>Every result except `'pass'` means the caller calls `preventDefault()` + `stopPropagation()`.</li><li>Missing booleans read as `false`, and a missing or unknown `kind` reads as `null`.</li></ul> |
| `footerHint({ hasTextarea = false } = {})` | Returns exactly `'Enter = OK · Esc = Cancel'`, or `'Ctrl+Enter saves · Esc = Cancel'` when `hasTextarea` is set (`·` is U+00B7). |

**`facts` fields (exact names):**
- `key`, `ctrlKey`, `metaKey`, `shiftKey`, `altKey`, `isComposing`, `defaultPrevented`, `repeat`;
- `latched`;
- `targetTag` (lower-case tag name), `targetType` (lower-case `type`), `targetRole`, `targetEnterLocal`;
- `targetIsPrimary`, `targetInTop`, `targetInForeignDialog`;
- `stackEmpty`, `kind` (top entry's kind or `null`), `canConfirm` (top entry's; `false` when empty).

**Routing: ordered, first match wins.** Plan rules 1–14 map to R1–R7 and R9–R15. R8 is the F11 legacy row. R6 adds the textarea carve-out.

| # | Condition | Result |
|---|---|---|
| R1 | `key` is neither `'Enter'` nor `'Escape'` | pass |
| R2 | `isComposing` | pass |
| R3 | `latched` | block |
| R4 | `stackEmpty` | pass |
| R5 | `targetInForeignDialog` | pass |
| R6 | `repeat`, **unless** it is a plain Enter (no Ctrl/⌘) with `targetTag==='textarea' && targetInTop`, which falls through so a held Enter keeps typing newlines (D2) | block |
| R7 | `defaultPrevented` | pass |
| R8 | `kind == null` (a legacy controller with no `kind`, F11) | Escape → close; Enter → pass |
| R9 | `!targetInTop` (stray focus behind the backdrop or on `<body>`) | <ul><li>Escape → close.</li><li>Enter with any of Ctrl/⌘/Shift/Alt → block.</li><li>Plain Enter: `info` → close; `input`/`confirm` → `canConfirm ? confirm : block`; `picker` → block.</li></ul> |
| R10 | Escape | close |
| R11 | Enter + Shift or Alt | pass |
| R12 | Enter + Ctrl/⌘ and `targetTag==='textarea'` | `canConfirm ? confirm : pass` |
| R13 | Own-control target. Any one of:<ul><li>`targetTag` is `textarea`, `select` or `a`;</li><li>a button-like target (`targetTag==='button'`, `targetRole==='button'`, or `input` with `targetType` `button`/`submit`/`reset`/`image`) that is **not** `targetIsPrimary`;</li><li>`targetEnterLocal`.</li></ul> | pass |
| R14 | `targetIsPrimary` | `(kind==='info' \|\| canConfirm) ? confirm : block` |
| R15 | By kind:<ul><li>`info` → close (D1);</li><li>`input`/`confirm` → `canConfirm ? confirm : pass`;</li><li>`picker` → pass.</li></ul> | as listed |

**Ctrl/⌘+Enter outside a textarea behaves like plain Enter (settled: yes).** Only R12 special-cases it, and R9 still blocks any modified Enter behind the top. Checkboxes and radios are fields, so they reach R15 (F6).

#### `ui/kit/modal-controller.js` (moved with `git mv`; lit-free; tests `ui/kit/modal-controller.test.js`)

Kept unchanged: `currentModality()`, `deepActiveElement(root)`, `returnFocusToTrigger(el, opts)`, and the window capture modality tracker.

**New exports:**

| Export | Contract |
|---|---|
| `FOCUSABLE` | Today's selector string, exported so tests can key fakes on it. |
| `modalStack` | The one shared `createModalStack()` instance. |
| `handleKeydown(facts, onSwallow?)` | <ol><li>For Enter/Escape when not composing, adds `key` to `held`.</li><li>Fills in `latched = repeat && latchedKeys.has(key)`, plus `stackEmpty`, `kind` and `canConfirm` from `modalStack.top()`.</li><li>Calls `routeKey`.</li><li>If the result is not `'pass'`, calls `onSwallow?.()`, then acts: `close` → `top.requestClose()`; `confirm` → `top.confirm()`.</li><li>Returns the route string.</li></ol> |
| `handleKeyup(key)` | Deletes `key` from both `held` and `latchedKeys`. |
| `releaseAllKeys()` | Clears both sets. Used on window `blur`. |
| `__resetModalKit()` | Test-only: clears the stack and both key sets. |

**DOM wiring.** Registered once at module load, only when `typeof document !== 'undefined'`:
- `document` `keydown` and `keyup` listeners with `{ capture: true }`;
- window `blur` → `releaseAllKeys`.

**The keydown wrapper:**
- **Target.** `path = e.composedPath()` and `target = path[0]`.
- **Innermost dialog.** The first element on `path` that matches `[role="dialog"], [role="alertdialog"], [aria-modal="true"]`.
- **Owner.** The stack entry whose `dialogEl()` is that dialog. From it:
  - `targetInTop`: the owner is `top`;
  - `targetInForeignDialog`: there is a dialog but no owner;
  - no dialog at all means outside the top, not foreign.
- **`targetIsPrimary`:** `target === top.primaryEl()`.
- **`targetEnterLocal`:** some element on `path` below the dialog has `data-enter="local"`. That is the target or an ancestor.
- **Tab** never reaches `handleKeydown`. If `top && !e.isComposing && !targetInForeignDialog`, the wrapper calls `top.trapTab(e, target, targetInTop)`:
  - target outside the top: `preventDefault()` and focus the first tabbable (Shift: the last), or the dialog;
  - otherwise today's wrap logic, using `target` instead of `renderRoot.activeElement`.
- **Everything else:** `handleKeydown(facts, () => { e.preventDefault(); e.stopPropagation(); })`.

**Latch.** `latchHeldKeys()` (internal) copies `held` into `latchedKeys`. It runs in `close()`, in `confirm()` (before `onConfirm`), and in `hostDisconnected()` while open. That covers every close path, including a native click after a passed Enter on Cancel, ✕ or OK.

**`class ModalController`.** `new ModalController(host, opts)` calls `host.addController(this)`.

| Option | Default | Meaning |
|---|---|---|
| `onClose` | — | `(reason) => void`, where `reason` is `'cancel'` or `'confirm'`. It runs **after** the stack entry is removed and focus is restored, both synchronously. |
| `kind` | `null` | One of `KINDS`, or a function returning one. Read at key time and at render time through the getter `ctl.kind`. `null` means legacy (F11). |
| `onConfirm` | `null` | Run by `confirm()` for `input`/`confirm` kinds. |
| `canConfirm` | primary exists and is not `disabled` | A function evaluated per key. `ctl.canConfirm()` always returns `false` unless `ctl.kind` is `input` or `confirm`. |
| `primarySelector` | `'[data-primary]'` | Locates the router primary (the frame stamps it on the primary and on `ack`). |
| `initialFocus` | `null` | A string, a string array (tried in order), or a function returning either. |
| `dialogSelector` | see `dialogEl()` | An explicit override. |
| `isDirty` / `onDiscardPrompt` | `null` | D3 hook. |
| `light` | `false` | The root is `document`, not `host.renderRoot` (portal hosts; second feature). |

| Member | Contract |
|---|---|
| `id` | A unique string per instance: `kit-modal-<n>`. The frame stamps it as `data-modal`. |
| `open` (getter) | Whether the modal is open. |
| `dialogEl()` | Looks up, in order:<ol><li>`dialogSelector` if given;</li><li>for a controller constructed with `kind`: **only** `[data-modal="<id>"]`;</li><li>otherwise `'[role="dialog"]'` (today's behaviour).</li></ol> |
| `primaryEl()` | `dialogEl()?.querySelector(primarySelector) ?? null`. |
| `opened(trigger)` | <ul><li>On the first open, records the trigger and `openedByKeyboard`.</li><li>Pushes onto the stack. A re-open moves the entry to the top, and a non-null `trigger` replaces the stored one.</li><li>Calls `focusInitial()` after `host.updateComplete`.</li></ul> |
| `close({ restoreFocus = true, reason = 'cancel' } = {})` | <ul><li>Returns early when not open.</li><li>Otherwise: sets `open` false, removes the stack entry, latches held keys, restores focus (or drops the trigger), then calls `onClose(reason)`.</li><li>It is unguarded, for programmatic closes.</li></ul> |
| `requestClose()` | The user-cancel path (Escape, ✕, backdrop, Cancel). If `isDirty?.()` and `onDiscardPrompt` is set, it calls the prompt and stays open; otherwise it calls `close({ reason: 'cancel' })`. |
| `confirm()` | <ul><li>Returns early when not open.</li><li>Otherwise latches held keys. For `kind==='info'` it calls `close({ reason: 'confirm' })`. Otherwise, if `canConfirm()`, it calls `onConfirm?.()`.</li><li>It never closes an input/confirm modal by itself: the host's `onConfirm` decides.</li></ul> |
| `refocus()` | Re-runs `focusInitial()` after `host.updateComplete` while open (F5). |
| `focusInitial()` | Applies the initial-focus order below. It filters every candidate through `!!el && !el.disabled`. |
| `trapTab(e, target, inTop)` | See the wrapper above. |
| `hostConnected()` | No-op. |
| `hostDisconnected()` | If open: remove the entry, latch, restore focus, set `open` false. No `onClose` is called. |

**Initial-focus order** (`kind != null`):
1. an enabled `[autofocus]` (`querySelectorAll`, first enabled);
2. the enabled primary, for `input`/`confirm` only;
3. `initialFocus`: the first enabled match, selector by selector;
4. for `info`: the enabled primary (the `ack` button) if there is one, otherwise the dialog;
5. the first enabled `FOCUSABLE` inside `.mbody`, which is never the header ✕;
6. the dialog.

A legacy controller (`kind == null`) keeps today's order exactly:
1. `[autofocus]`;
2. `initialFocus`;
3. the first `FOCUSABLE` (✕ allowed);
4. the dialog.

When the dialog itself is focused, set `tabindex="-1"` on it if it has none.

#### `ui/kit/modal.js` (new, Lit; not unit-testable)

`modalCss` composes `buttonCss`, so a framed host includes only `modalCss`. Use `static styles = [modalCss, css`…host…`]`.

The frame and `modalCss` are specified as follows.

`modalFrame(ctl, opts)` renders:

```
.overlay  style="--kit-layer:<layer>"  @click → ctl.requestClose()
  .modal[.scroll]  style="--kit-width:<width>"  role="dialog" aria-modal="true" aria-label=<label>
                   data-modal=<ctl.id> data-variant=<variant|nothing> tabindex="-1" @click → stopPropagation
    .mhead   <span class="mtitle">title</span> titleExtra <button type="button" class="mclose" aria-label="Close">✕</button> (→ requestClose)
    .mbody   body
    footer   (by ctl.kind at render time, see below)
```

**Footer by kind:**
- **`input`/`confirm`:**
  ```
  .mfoot > span.mhint (footerHint({hasTextarea}))
         + span.mbtns > [extra] <button type="button" class="btn" data-cancel>Cancel</button> <primary>
  ```
  The primary is `<button type=${type} form=${form|nothing} class="btn primary <tone-class> <className>" data-primary ?disabled title=${title|nothing}>label</button>`. Its click calls `ctl.confirm()` unless `type==='submit'`, in which case native submit runs.
- **`info` with `ack`:** `.mfoot > span.mbtns > <button type="button" class="btn <className>" data-primary>ack.label</button>` (click → `ctl.confirm()`), with no hint.
- **`info` without `ack`, `picker`, or `null` kind:** no footer.

| Option | Default | Notes |
|---|---|---|
| `title` | — | A string or TemplateResult. |
| `label` | `title` when it is a string | The `aria-label`. Required when `title` is a template. |
| `titleExtra` | — | Rendered after the title (the Spells circle pill). |
| `body` | — | TemplateResult. |
| `layer` | `2000` | The z-index. Today's values are kept per host (table below). |
| `width` | `'26rem'` | Content-box width, as today. |
| `scroll` | `false` | `.modal.scroll { max-height: 85vh; overflow-y: auto }`. |
| `variant` | — | Stamps `data-variant` on the dialog. Hosts style `[data-variant='…']`, which rule 3 does not flag. This is the sanctioned variant hook. |
| `primary` | — | `{ label, tone = 'accent', disabled = false, type = 'button', form, title, className }`. Required for `input`/`confirm`. |
| `extra` | — | Extra footer buttons before Cancel. Unused this build. |
| `ack` | — | `{ label = 'OK', className }`. Info only. Only the roll modal uses it (qa-log 13:40). |
| `hasTextarea` | `false` | Picks the Ctrl+Enter hint. **The hint text cannot be overridden** (V4). |

**Tone classes:** `accent` maps to no extra class (the default amber). `danger`, `spell`, `karma` and `heal` map to the class of the same name.

**`modalCss`** (all sizes are `--fs-*`; weights 400/500 only):

| Selector | Styles |
|---|---|
| `.overlay` | `position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: var(--kit-layer, 2000); padding: 1rem` |
| `.modal` | <ul><li>`background: var(--bg-chip, light-dark(#ffffff,#232833)); color: var(--text, var(--fg, var(--txt, light-dark(#111418,#f0f3f7))))`</li><li>`border: 1px solid var(--border, light-dark(#e2e5ea,#2c313b)); border-radius: 12px`</li><li>`width: var(--kit-width, 26rem); max-width: calc(100% - 2.5rem); padding: 1rem 1.25rem 1.25rem`</li><li>`font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif`</li></ul> |
| `.modal:focus` | `outline: none` |
| `.mhead` | `display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-bottom: .5rem` |
| `.mtitle` | `display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-title); font-weight: 500; min-width: 0` |
| `.mclose` | `margin-left: auto; background: none; border: none; color: var(--muted, light-dark(#5a6472,#93a0b3)); font-size: var(--fs-title); line-height: 1; padding: 0; cursor: pointer` |
| `.mfoot` | `display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px 8px; margin-top: 1rem` |
| `.mhint` | `margin-right: auto; font-size: var(--fs-fine); color: var(--muted, …)` |
| `.mbtns` | `display: flex; gap: 8px; margin-left: auto` |

`.mbtns` keeps Cancel and the primary together. At 340px the hint wraps above them.

#### `ui/kit/button-css.js` (new, Lit `css`)

`buttonCss`:

| Selector | Styles |
|---|---|
| `.btn` | `font: inherit; font-size: var(--fs-body); font-weight: 400; line-height: 1.2; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border, …); background: var(--bg-chip, …); color: <text chain>; cursor: pointer` |
| `.btn.primary` | `font-weight: 500`, plus amber: `border-color` and `color` `var(--accent, light-dark(#7a3e12,#d9944e))`; `background: var(--accent-bg, light-dark(#f6e9dc,#3a2a17))` |
| Tones `.btn.accent`, `.btn.danger`, `.btn.spell`, `.btn.karma`, `.btn.heal` | Declared **after** `.primary` so a tone wins over the default amber. Each sets `border-color` and `color` from `var(--<tone>, fallback)` and `background` from `var(--<tone>-bg, fallback)`. |
| `.btn:disabled` | `opacity: .4; cursor: not-allowed` |

**Tone fallbacks:**

| Tone | `--<tone>` | `--<tone>-bg` |
|---|---|---|
| danger | `light-dark(#c0392b,#e06557)` | `light-dark(#fbe9e7,#3a1f1c)` |
| spell | `light-dark(#5b3fa6,#a99cf0)` | `light-dark(#efeafc,#2b2547)` |
| karma | `light-dark(#3d6b4a,#82c39a)` | `light-dark(#e7f0ea,#223029)` |
| heal | `light-dark(#3d6b4a,#82c39a)` | `light-dark(#e8f2ea,#23362a)` |

No focus-ring rule. The UA ring stays, so `returnFocusToTrigger`'s inline suppression still works.

#### `tools/check-ui-kit.mjs` (new) + `tools/check-ui-kit.test.js` + `tools/ui-kit-baseline.json`

| Export | Contract |
|---|---|
| `RULES` | `['keydown','dialog-role','frame-css','font-size','button-style']`, in fixed order. |
| `countViolations(rel, src)` | Returns `{ keydown, 'dialog-role', 'frame-css', 'font-size', 'button-style' }`. For `rel` starting with `ui/kit/`, every rule except `font-size` returns 0. |
| `analyzeUiKit(modules, baseline)` | `modules` is `[{ rel, src }]` and `baseline` is the JSON object. Returns `{ counts, errors }`:<ul><li>`counts` holds non-zero counts only: `{ [rel]: { [rule]: n } }`;</li><li>`errors` is `[{ file, rule, kind, count, allowed, msg }]`, sorted by file and then by `RULES` order.</li></ul> |
| `listUiSources(root)` | Every `ui/**/*.js` file, recursively, excluding `*.test.js`, as repo-relative POSIX paths. |

**Source pass.** Run a local copy of check-imports' `stripComments` first, then blank `<!-- … -->`. All rules run on the stripped text.

| Rule | Detection |
|---|---|
| `keydown` | `/\b(?:document\|window)\s*\.\s*addEventListener\s*\(\s*(['"\`])(?:keydown\|keyup)\1/g`. `el.addEventListener` and `this.addEventListener` do not match. |
| `dialog-role` | `/(?<!\[\s*)\brole\s*=\s*(['"])(?:alert)?dialog\1/g`. The attribute form only: the selector `'[role="dialog"]'` gives 0. |
| `frame-css` | <ol><li>CSS text is every `css\`` template body (read to the matching backtick, honouring `\` escapes, with each `${…}` blanked, nested braces/strings/templates skipped) plus every `<style>…</style>` body, with `/* */` removed.</li><li>Split it into preludes: the text between the last `{`, `}` or `;` and the next `{`.</li><li>Skip preludes starting with `@`.</li><li>Count **one per prelude** that matches `/(?:^\|[^\w-])\.(?:overlay\|modal\|mhead\|mclose)(?![\w-])\|(?:^\|[^\w-])button\.btn(?![\w-])/`.</li></ol>**Compound and descendant selectors count** (`.modal.magic`, `.modal.magic .mtitle`, `button.btn.danger`, `.mhead .cr`). `.modal-x`, `.mtitle` and `.learnmodal` do not count. Neither does `[data-variant='magic']`, nor an html property binding `.overlay=${…}`. |
| `font-size` | Sum of:<ul><li>`/font-size\s*:(?!\s*var\(--fs-)/g` over the whole stripped source, with no `\s*` backtracking. This covers CSS and inline `style=`.</li><li>**Extension (taken):** `/(?<![\w-])--fs-[\w-]+\s*:/g`, a type-scale token redefinition outside `index.html`.</li></ul> |
| `button-style` | For each `/<button\b/`, scan to the first `>` that is not inside `${…}`, counting nested braces. Count the tag if its text matches `/(?:^\|\s)style\s*=/`. |

**Baseline shape.** A flat JSON object with sorted keys: `{ "ui/<file>.js": { "<rule>": <positive int>, … }, … }`. It holds only rules with a non-zero count.

**Ratchet.** For each file and rule, `allowed = baseline[file]?.[rule] ?? 0`. Messages are exact; `${…}` are the values.

| kind | When | `msg` |
|---|---|---|
| `new-violation` | `count > allowed` and the file has an entry | `` `${file}: ${rule} has ${count}, baseline allows ${allowed} (new violation — use ui/kit/)` `` |
| `no-entry` | `count > 0` and the file has no entry | `` `${file}: ${rule} has ${count} but the file has no baseline entry (new violation — use ui/kit/)` `` |
| `ratchet` | `count < allowed` | `` `${file}: ${rule} has ${count}, baseline allows ${allowed} — lower the baseline to ${count}` ``, with ` (delete the rule)` appended when `count === 0` |
| `stale-entry` | A baseline file that is not in `modules` | `` `remove stale entry for ${file}` `` |
| `bad-entry` | An unknown rule id, a value that is not a positive integer, or an empty `{}` | `` `${file}: bad baseline value for ${rule} (rules: ${RULES.join(', ')}; positive integers only)` `` |

**CLI.**
- It reads `tools/ui-kit-baseline.json` and prints `✓ ui-kit check: <n> files, baseline holds` and exits 0, or prints `✗ ui-kit check: <k> problem(s)` plus one `  <msg>` line per error and exits 1.
- **Main-module guard:** `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(runCli());`.

**Initial baseline (I2).** The prototype of the rules above, run on the current tree in the scratchpad, reproduces the plan's measured table exactly. That includes `ed-equipment.js` frame-css 6 (the `:1076` binding is not CSS) and `modal-controller.js` keydown 2 / dialog-role 0. **One correction:** the `font-size` extension adds the four `--fs-*` declarations at `ed-trade-modal.js:74`, so trade starts at `font-size: 5`, not 1.

| File | keydown | dialog-role | frame-css | font-size | button-style |
|---|---|---|---|---|---|
| ui/ed-add-legend.js | 1 | 1 | 6 | | |
| ui/ed-app.js | | | | | 1 |
| ui/ed-changelog.js | 1 | | 4 | | |
| ui/ed-character-picker.js | 1 | 1 | 2 | | |
| ui/ed-combat.js | 1 | 1 | 4 | | 1 |
| ui/ed-confirm.js | 1 | 1 | 8 | | |
| ui/ed-conflict.js | 1 | 1 | | | |
| ui/ed-custom-item.js | 1 | 2 | 6 | | |
| ui/ed-damage-modal.js | | 1 | 4 | | |
| ui/ed-day-reset.js | 1 | 1 | 7 | | |
| ui/ed-disciplines.js | | 9 | 4 | | |
| ui/ed-edit-meta.js | 1 | 1 | 6 | | |
| ui/ed-equipment.js | 1 | 1 | 6 | | 1 |
| ui/ed-homebrew.js | 1 | | 4 | | |
| ui/ed-notes.js | 1 | 1 | 6 | | |
| ui/ed-overview.js | 1 | | 4 | | 1 |
| ui/ed-roll-modal.js | 1 | | 1 | | |
| ui/ed-save-key.js | 1 | 1 | | | |
| ui/ed-settings.js | 1 | 1 | | | |
| ui/ed-spells.js | 1 | 3 | 9 | 5 | 1 |
| ui/ed-trade-modal.js | 1 | 1 | 7 | **5** | |
| ui/legend-spent-view.js | | | | 2 | |
| ui/modal-controller.js | 2 | | | | |

If the implemented analyzer disagrees with this table, **fix the analyzer, not the baseline**, unless a manual reading proves the analyzer right.

**Ratchet per item:**

| Item | Baseline change |
|---|---|
| I3 | Delete `ui/modal-controller.js`. |
| I5 | Delete `ed-confirm.js`. |
| I6 | Delete `ed-roll-modal.js`. |
| I7 | Delete `ed-damage-modal.js`. |
| I8 | Delete `ed-trade-modal.js`. |
| I9 | Delete `ed-equipment.js`. |
| I10 | `ed-spells.js` becomes `{ "font-size": 5 }`. |
| I11 | Delete `ed-disciplines.js`. |

Final: 16 entries, which are the second-feature files plus `ed-spells.js` font-size 5, `ed-app.js` button-style 1 and `legend-spent-view.js` font-size 2 (F7).

**`package.json`:** `"pretest": "node tools/check-imports.mjs && node tools/check-ui-kit.mjs"`, and add `"lint:ui-kit": "node tools/check-ui-kit.mjs"`.

#### `tools/check-imports.mjs` and `tools/check-imports.test.js` (I3)
- **Both walkers:** change `rel === 'engine' || rel === 'ui'` to `rel === 'engine' || rel === 'ui' || rel === 'ui/kit'` (`check-imports.mjs:303`, `check-imports.test.js:102`).
- **`check-imports.mjs:334` guard:** use the same `pathToFileURL` form as the ui-kit CLI, and import `pathToFileURL`. From then on, `pretest` really runs the import check on Windows. The repo is clean, as the real-repo test shows today.

#### Migrations (I5–I11)
All framed hosts follow the same pattern:
- `static styles = [modalCss, css`…`]`;
- render `modalFrame(ctl, …)` in place of their `.overlay/.modal/.mhead/.mclose` markup;
- delete their frame/button CSS and any `document` keydown listener;
- delete the host's own `.mtitle`, `.actions`/`.mactions` and `button.btn*` rules where the frame now owns them.

Body markup is kept as is.

| Host | Controller | Open / trigger | Frame | Notes |
|---|---|---|---|---|
| **I5 `ed-confirm`** | <ul><li>`kind:'confirm'`</li><li>`onConfirm: () => this._confirm()`</li><li>`canConfirm: () => !this.disabled`</li><li>`initialFocus: '[data-cancel]'`</li><li>`onClose: (r) => r === 'cancel' && this._close()`</li></ul> | `connectedCallback`: `super…; this._ctl.opened(deepActiveElement())` | <ul><li>layer 2100, width `26rem`</li><li>title `heading \|\| 'Are you sure?'`, label `heading \|\| 'Confirm'`</li><li>body `.msg` plus the `.warn`/`.warn.block` line</li><li>primary `{ label: confirmLabel \|\| 'Confirm', tone: tone==='accent' ? 'accent' : 'danger', disabled }`</li></ul> | <ul><li>`_confirm()`: `if (disabled) return; this._ctl.close({ reason:'confirm' }); dispatch('confirm')`. It restores focus first, then dispatches **only** `confirm`.</li><li>Delete the listener (49–60), `firstUpdated` (65–68) and the CSS at 35–44.</li><li>Keep the `:host` vars, `.msg` and `.warn`.</li><li>The public API is unchanged.</li></ul> |
| **I6 `ed-roll-modal`** | <ul><li>`kind: () => this._viewKind()`</li><li>`onConfirm: () => this._onPrimary()`</li><li>`canConfirm: () => !(this._isAim() && !this._aimRolled) \|\| this._aimTargetNum() != null`</li><li>`initialFocus: '.aimlbl input'`</li><li>`onClose: () => this._close()` (dispatches `close` for any reason)</li></ul> | `firstUpdated()`: `if (!this.embedded) this._ctl.opened(null)`. `ed-app` keeps the trigger capture and `_closeRoll`, both unchanged. | <ul><li>layer 3000, width `340px`</li><li>title ``html`${diceIcon} ${this.label}` ``, label `this.label`</li><li>body: today's `.sub` line first, then the view content; the existing hint text moves to a closing `<p class="hint rollhint">`, with `margin: 10px 0 0`</li></ul> | <ul><li>**Views:** see the I6 table below.</li><li>`_viewKind()`: a chooser or an apply view (`apply` set and not `knockdown-result`) is `'input'`; otherwise `'info'`.</li><li>`_onPrimary()`: set-dice chooser → `_commit()`; aim chooser → `_commitAim()`; apply → `_apply()`.</li><li>`_commit` and `_commitAim` call `this._ctl.refocus()` after their state change (F5).</li><li>Delete the listener (105–124), `.overlay` (48), and the now-unused `button.commit` and `button.commit:disabled` rules.</li><li>**Embedded mode** renders today's `.dm` exactly: `.head`/`.x`/`.foot`/`button.ok`/`button.appbtn`, with `_close` dispatching directly (F3). Build it from shared `_resultBody(r)` so the classes stay unchanged.</li><li>The only markup addition in the shared body is `data-enter="local"` on the optional-mod checkboxes. It is inert when embedded.</li><li>Framed buttons carry kit classes only, not `.ok`/`.appbtn`, so the roll's own `button.ok`/`.appbtn` rules style only the embedded panel.</li><li>Do not touch `updated()` (126–160), `_toggleKarma`, the commits' charge logic, or `ed-app.js:2070`.</li></ul> |
| **I7 `ed-damage-modal`** | Keep `onClose` and `initialFocus:'input'`. Add:<ul><li>`kind:'input'`</li><li>`onConfirm: () => this.renderRoot.querySelector('#dmg-form')?.requestSubmit()`</li><li>`canConfirm: () => Number(this._take) > 0`</li></ul> | `show(trigger)`, unchanged | <ul><li>layer 2100, width `26rem`, title `Take damage`</li><li>body: `.mpara`, then `<form id="dmg-form" @submit=…>` around `.hrow` and the hint `.mpara`</li><li>primary `{ label:'Apply', type:'submit', form:'dmg-form', disabled: !(take > 0) }`</li></ul> | <ul><li>Delete `.hfoot`, the "Enter applies · Escape closes" text, and the `.hbtn`/frame CSS.</li><li>Keep `:host{display:contents}`.</li><li>Keep the `_apply` hand-off `close({ restoreFocus: !roll })` (68).</li><li>Cancel comes from the frame (D5).</li></ul> |
| **I8 `ed-trade-modal`** | <ul><li>`kind:'input'`</li><li>`onConfirm: () => this._confirm()`</li><li>`canConfirm: () => this._canConfirm()`</li><li>`initialFocus:'[data-cancel]'`</li><li>`onClose: (r) => r === 'cancel' && this._close()`</li></ul> | At the end of `connectedCallback` (after seeding): `this._ctl.opened(deepActiveElement())` | <ul><li>layer 2150, width `27rem`, `scroll`</li><li>title `${Buy\|Sell} · ${name ?? 'item'}`, label `${Buy\|Sell} ${name ?? ''}`</li><li>primary `{ label: Buy\|Sell, disabled: !can }` (amber)</li></ul> | <ul><li>`_confirm()` builds the detail, calls `close({ reason:'confirm' })`, then dispatches `confirm` (detail unchanged).</li><li>The three gem inputs get `data-enter="local"` and `@keydown=${this._gemKeydown}`: on Enter and `!isComposing`, it calls `preventDefault(); this._addGem()`.</li><li>The Add button and the coin ± buttons pass natively.</li><li>Delete the `:host` `--fs-*` line (74), the CSS at 76–80 (frame, `.mtitle`, and `.mclose` with its raw `font-size: 1.1rem`) and at 105–108 (`.actions`, `button.btn*`), the listener (228–229, 232), and `firstUpdated` (235–241).</li></ul> |
| **I9 Equipment item** | `_modalCtl = new ModalController(this, { kind:'info', onClose: () => { this._modal = null; } })` | Tile (668): `@click=${(e) => this._openItem(it.name, e)}`, where `_openItem` sets `_modal` and calls `opened(e.currentTarget)` | <ul><li>layer 2000, width `30rem`, `scroll`</li><li>title: the star span plus `it.name`, label `it.name`</li><li>`variant: mg ? 'magic' : undefined`</li><li>body: today's chips, text, threads and `.mact`</li></ul> | <ul><li>CSS: replace `.modal.magic` with `[data-variant='magic'] { box-shadow: var(--shadow) }` and `.modal.magic .mtitle` with `[data-variant='magic'] .mtitle { color: var(--arcane) }`. Keep `.mtitle .star`. Delete `.overlay`, `.modal`, `.mhead`, `.mtitle` and `.mclose`.</li><li>Remove item (1013): drop the inline style and add `.mact .del { font-size: var(--fs-body) }`.</li><li>After a full sell (514): `this._modalCtl.close()`.</li><li>Delete `_closeModal` (175–179) and the `blur()` calls at 523, 609, 626 and 737.</li><li>Delete `_onKeydown` (147–150) and its add/remove (163, 168).</li><li>**Add-item picker Escape:** register a host-level `this.addEventListener('keydown', …)` in the constructor (not flagged). When `e.key==='Escape' && this._addOpen && !e.defaultPrevented` and `e.composedPath()[0]` is not the `.combo input`, call `_closePicker()`. This keeps today's "Escape anywhere in the tab closes it". `_pickKeydown` is unchanged.</li><li>On `.res`: `@mousedown=${(e) => e.preventDefault()}` (F8).</li></ul> |
| **I10 Spells info** | `_infoCtl`: `kind:'info'`, `onClose: () => { this._modal = null; }` | `_openDetail(s, e)`: `_modal = s; _infoCtl.opened(e?.currentTarget)`. Caller at 936 passes `e`. | <ul><li>layer 2100, width `30rem`, `scroll`</li><li>title `s.name`</li><li>`titleExtra: html`<span class="crpill">${s.discipline} · Circle ${s.circle}</span>``</li></ul> | <ul><li>Rename `.mhead .cr` to `.crpill`, with the same declarations.</li><li>Remove the footer Close (980) (D5).</li></ul> |
| **I10 Spells learn** | `_learnCtl`:<ul><li>`kind:'input'`</li><li>`canConfirm: () => this._learnCanConfirm()`</li><li>`onConfirm: () => this._confirmLearn()`</li><li>`initialFocus: ['.lrow.on', '.lrow']`</li><li>`onClose: () => { this._learn = null; }`</li></ul> | `_openLearn(e)` → `_learnCtl.opened(e?.currentTarget)`. Caller at 913 passes `e`. | <ul><li>layer 2100, width `48rem`, `scroll`</li><li>title `Learn a spell`</li><li>body: `.learn-wrap`, with `_learnDetail` minus its `.actions`</li><li>primary `{ label: spell ? `Learn ${spell.name}` : 'Learn spell', tone:'karma', disabled: !this._learnCanConfirm() }`</li></ul> | <ul><li>**With no spell selected, the footer still shows Cancel plus a disabled "Learn spell", and the hint (settled).**</li><li>`_confirmLearn` ends with `this._learnCtl.close({ reason:'confirm' })` instead of `_learn = null` (767).</li><li>784, 788 and 878 are handled by the frame.</li><li>Delete the inline style at 879 and the `.learnmodal` rule.</li><li>`.lflag` (212) is kept (V8).</li></ul> |
| **I10 Spells cast** | `_castModalCtl`: add `kind:'input'`, `onConfirm: () => this._castModalConfirm()`, `canConfirm: () => !!this._castModal && (this._castModal.empty \|\| this._castModalValue() != null)`. Drop `initialFocus`. | unchanged (1108) | <ul><li>layer 2100, width `30rem`</li><li>title `Cast ${plan.name}`</li><li>primary `{ label: empty ? 'Cast on nothing' : 'Confirm', tone:'spell', disabled: !valid }`</li></ul> | <ul><li>Close becomes the frame's Cancel (D5).</li><li>Delete the number field's `@keydown` (1289).</li><li>Keep `close({ restoreFocus:false })` (1138) and `close()` (1146).</li><li>Spells overall: delete `_onKey` (276–287, 301) and the CSS at 96–101 (the frame and `.mhead*`; 100 survives as `.crpill`), 107–109 and 113 (`.actions`, `button.btn*`). The tab "＋ Learn spell" takes `buttonCss` `.btn`.</li></ul> |
| **I11 Disciplines** (one `_modalCtl`) | <ul><li>`kind: () => DISC_KIND[this._modal?.type] ?? 'info'`, where `DISC_KIND = { halfmagic:'picker', learn:'picker', 'learn-skill':'picker', 'learn-knack':'picker', advance:'confirm' }`</li><li>`canConfirm: () => this._modal?.type === 'advance' && this._advanceState(this._modal).canTrain`</li><li>`onConfirm: () => this._confirmAdvance()`</li><li>`initialFocus: () => this._modal?.type === 'advance' ? '.silin' : null`</li><li>keep `onClose`</li></ul> | `_openModal`, unchanged | <ul><li>All nine modals: layer 2000, width `30rem`, `scroll`</li><li>title: today's `.mtitle` inner content (icon span plus name), label: today's `aria-label`</li><li>Train: primary `{ label:'Train', disabled: !canTrain, title: canTrain ? '' : 'Not enough Legend or silver' }` (amber)</li></ul> | <ul><li>Extract `_advanceState(m)`, which returns `{ silver, legendOk, silverOk, canTrain, … }`, from `_advanceModal` (901–908) and use it in both places.</li><li>`_confirmAdvance()` runs `_advancePick(m.discipline, s.silver)` when `canTrain`.</li><li>`data-enter="local"` goes on `.silin` 941, 1043 and 1139 and on the `<select>` 1175.</li><li>Keep the `autofocus` targets 833, 994, 1037 and 1133.</li><li>Train's `autofocus` (950) goes away with the frame. Step 2 or step 3 covers it.</li><li>Delete CSS 78–82 (`.mactions`, `.mbtn*`) and 226–230 (frame, `.mtitle`).</li><li>"Close first, then dispatch" is unchanged.</li></ul> |

**I6 roll views:**

| View | Kind | Primary / ack | Tone | Initial focus |
|---|---|---|---|---|
| Set-dice chooser | input | `Roll ✦ ${n}` | karma | primary |
| Aim chooser | input | `Roll`, disabled until a target is entered | accent | the target input while Roll is disabled, then the primary |
| Result + apply (not `knockdown-result`) | input | `_applyLabel()` | accent | primary |
| Result OK, and the Knockdown result | info | `ack {label:'OK'}` | neutral | OK |

**`ui/ed-app.js` (I3):** only the import path changes, to `./kit/modal-controller.js`. The roll mount and `_closeRoll` are unchanged.

#### I12 docs

| File | Edit |
|---|---|
| `docs/UI-GUIDELINES.md` §7 (Tier 1, D1) | <ul><li>Replace "Read-only modals (like the current roll and ability modals) have no primary action, so Enter is a no-op there; wire it as soon as a modal gains an accept action." with "Read-only modals: Enter closes (it is their OK)."</li><li>Then add the paragraph `*§7 amended 2026-11-18 by owner sign-off (ui-kit-modal-keyboard-contract qa-log, D1).*`</li><li>Nothing else in §7 changes.</li></ul> |
| `docs/MODALS.md` (rewrite) | Sections:<ol><li>The UI kit (four files; the "modals use `ui/kit/`" rule; check-ui-kit)</li><li>The contract (Escape closes only the top modal; Enter = OK; Ctrl/⌘+Enter saves in textarea modals; focus in, trap, return; theme)</li><li>Key routing (the R1–R15 table; `data-enter="local"`; checkboxes and radios as fields; held keys and the latch; the transitional foreign-dialog rule and its "click blank space in a legacy modal → `<body>`" gap)</li><li>ModalController (options; methods; close reasons; legacy-neutral default; initial-focus order; dirty guard D3: free-text modals ask, short numeric or choice modals don't; `light`)</li><li>modalFrame (options; the layers and widths table; footers D5 and hint V4, including **the roll-modal OK exception** (qa-log 13:40); the `data-variant` hook)</li><li>buttonCss (shape, tones)</li><li>Hand-offs and known trigger-gone → `<body>` cases (cast → roll, damage → Knockdown, Apply closes, Equipment full sell)</li><li>Separate-component modals (`ed-app` roll restore; Confirm dispatches only `confirm`)</li><li>Why the ring can be suppressed (kept)</li><li>Not yet on the kit (the F9 list from plan I12)</li><li>Checklist (from the review's migrated-modal checklist)</li><li>The UI-kit check (rules, baseline, ratchet messages)</li></ol>There is no `ui/modal-controller.js` reference anywhere. |
| `docs/GUARDRAILS.md` PR checklist | After the light/dark line, add `- [ ] Modals and modal-like UI use ui/kit/; the UI-kit check passes`. |
| `ARCHITECTURE.md` §8 | <ul><li>Replace line 568 with a `kit/` block: `modal-stack.js # pure stack + key router + footer hint`, `modal-controller.js # ModalController: one capture key listener, focus, latch`, `modal.js # modalFrame + modalCss`, `button-css.js # buttonCss`.</li><li>Under `tools/`, add `check-ui-kit.mjs # UI-kit check (pretest)` and `ui-kit-baseline.json # two-way ratchet allowlist`.</li></ul> |
| `CLAUDE.md:51` | Change "— shared `ui/modal-controller.js`" to "— shared kit in `ui/kit/`". The Dev Lead applies it at doc sync (build-log). |
| `docs/UI-CONSISTENCY-REVIEW.md` status table | <ul><li>K1, K2, K4: `✅ FIXED (ui-kit-modal-keyboard-contract)`.</li><li>K3, K6, M1, M2, M3, V1, V2, V3, V4: `🟢 FIXED for this build's modals; rest in feature 2`. K3, K6 and M1 also get ` — not yet on the kit: see [MODALS.md](MODALS.md#not-yet-on-the-kit)`.</li><li>K8: `🟢 DECIDED (D2); kit support shipped`. K9: `🟢 DECIDED (D3); kit hook shipped`.</li><li>U1: `✅ BUILT (D7/D8 decided)`.</li><li>The others are unchanged.</li><li>The file is untracked, so stage it by explicit path.</li></ul> |
| `data/changelog.json` | The entry below. |

### UI / behavior
- **Visible changes** are as listed in plan.md "Owner manual checklist → Visible changes deliberate". In addition:
  - Spells info/learn and Equipment/Disciplines dialogs cap at 85vh and scroll (the trade cap changes from `min(88vh, 44rem)` to 85vh);
  - with no spell picked, the learn footer shows Cancel plus a disabled "Learn spell".
- **Light and dark:** every kit colour is a host variable with a `light-dark()` fallback.
- **Escape** cancels the top modal only. **Enter** follows R1–R15.
- **No Overview layout change.** Modals are fixed overlays.

### Rules
This change implements **no Earthdawn rule**, and no test asserts a rules value. `rules.md` has no entry ids. The behaviours below must stay unchanged; their source is `rules.md` and the UI-GUIDELINES "Other conventions".

| Preserved behaviour | Where it is kept |
|---|---|
| Strain charged once per ordinary roll at open/auto-roll; set-dice and aim charge at commit | `ed-roll-modal` `updated()`, `_commit` and `_commitAim` are untouched. The R6 repeat swallow and the latch stop held-key re-opens. |
| Karma charged once per roll interaction | `_toggleKarma` / `_karmaCharged` are untouched. The Karma toggle passes Enter natively (R13). |
| A hit 5+ over the Wound Threshold hands off to the Knockdown roll | Damage `close({ restoreFocus: !roll })`, then the `ed-roll` dispatch, is unchanged. |

### Edge cases & invariants
- **Only the top entry is ever acted on.** `close()` removes the entry before `onClose` and restores focus synchronously before it, so a follow-on modal (the §6a picker after Continue) keeps its own focus.
- **The Confirm path never fires `close`** (`ed-confirm`, trade): `onClose('confirm')` dispatches nothing.
- **A disabled primary** means `canConfirm` is false. Enter is then a no-op inside the modal and a block behind it. A disabled default submit button also blocks native implicit submission (damage at Take 0).
- **The latch:**
  - it only arms on a kit close or confirm, and only for keys already held;
  - it clears on that key's `keyup` and on window `blur`;
  - an Escape latch never swallows Enter.
- **A legacy dialog on top** (`ed-conflict`, day-reset, Notes) is foreign, so its keys pass (§8). An empty stack also passes (§6a, §8a).
- **Hand-off and removed-element cases** have focus fall to `<body>`, as today: cast → roll, damage → Knockdown, Apply closes, an Equipment full sell. Document them in MODALS.md.
- **The embedded roll** never opens its controller and never pushes a stack entry.
- **Safari pointer opens** may record no trigger, so nothing is restored (an accepted risk, I5).

## Testability notes
- **`ui/kit/modal-stack.test.js`** (`node:test`):
  - one test per row R1–R15;
  - the plan I1 ordering cases: held Escape on a 2-entry stack; Shift+Enter and picker Enter behind the top are blocked; latched with an empty stack is blocked; foreign beats repeat and outside-top; a checkbox in `input` confirms but passes with `targetEnterLocal`;
  - the R6 textarea carve-out;
  - Ctrl+Enter on a non-textarea routes like plain Enter;
  - `createModalStack` (push moves to top; remove; top only);
  - both `footerHint` strings;
  - and a source check that the file has no `from 'lit'` and no `document`/`window` identifier outside comments.
- **`ui/kit/modal-controller.test.js`:**
  - **Setup.** Import the module under node; `document` is undefined, so no listener registers. Call `__resetModalKit()` in `beforeEach`.
  - **Fake host:** `{ addController(c){}, updateComplete: Promise.resolve(true), renderRoot: { querySelector(sel){…}, querySelectorAll(sel){…}, activeElement: null } }`.
  - **Fake trigger:** `{ isConnected: true, style: {}, focus(){ this.n = (this.n ?? 0) + 1 }, addEventListener(){}, removeEventListener(){} }`.
  - **Fake dialog** for focus tests: `renderRoot.querySelector` returns it for `` `[data-modal="${ctl.id}"]` ``. Its `querySelector`/`querySelectorAll` read a `selector → [fakeEl]` map, keyed on the exact strings the controller uses (`'[autofocus]'`, `'[data-primary]'`, `initialFocus` values, `'.mbody'`, then `FOCUSABLE` on the body fake). Each `fakeEl` has `{ disabled, focus(), hasAttribute(), setAttribute() }`.
  - **Driving it.** Call `handleKeydown(facts)`, `handleKeyup(key)` and `releaseAllKeys()` with plain facts. `await host.updateComplete` plus one microtask before checking focus.
  - **Cover:**
    - push/re-open moves to top;
    - two stacked controllers with Escape top-only, twice;
    - a hand-off leaves the new modal on top;
    - inside `onClose`, the trigger is already focused and the stack no longer holds the controller;
    - `hostDisconnected` removes the entry without `onClose`;
    - with a dirty modal, Escape and `requestClose` call `onDiscardPrompt`, and `close()` is unguarded;
    - the reasons: `requestClose` gives `'cancel'`; info `confirm()` gives `'confirm'`; input `confirm()` calls `onConfirm`, not `onClose`;
    - a no-kind controller: Enter passes and Escape closes; legacy focus order;
    - the `kind` function is re-read per key;
    - the latch: a routed close while Enter is held, then repeat → block with an empty stack; `keyup` → pass; an Escape latch leaves an Enter repeat on `pass`; a native-click path (Enter `pass` on Cancel, then `requestClose()`) also latches;
    - `refocus()` re-applies the order;
    - the new focus order steps 1–6.
- **`tools/check-ui-kit.test.js`:**
  - one fixture per rule;
  - the gotcha fixtures: `.overlay=${x}` in html gives 0; `font-size: var(--fs-body)` gives 0; `<button @click=${() => go()} style="color:red">` gives 1; `'[role="dialog"]'` gives 0;
  - also `.modal.magic` 1, `[data-variant='magic']` 0, `.modal-x`/`.mtitle` 0, `@media{ .overlay{} }` 1, `--fs-body: .9rem` 1, `el.addEventListener('keydown')` 0, and a `ui/kit/` file counting only `font-size`;
  - every ratchet kind and its message (regex on "new violation", "no baseline entry", "lower the baseline to N", "remove stale entry for ui/gone.js");
  - and **the real repo passes** (`listUiSources(ROOT)` plus the baseline).
- **`tools/check-imports.test.js`:** the real-repo walker includes `ui/kit/`.
- **Not unit-testable** (Lit or DOM): `modal.js`, `button-css.js`, every I5–I11 migration, capture-phase swallowing, Tab trap and focus visuals. These go to the owner's manual checklist in plan.md, which the Dev Lead copies to `build-log.md`.

## Changelog entry
`{"type": "improved", "text": "Modals now share one keyboard contract: Enter = OK, Escape closes only the top dialog, and focus stays inside and returns to the button that opened it. Applies to the roll, confirm, trade, Take damage, Spells, Equipment item and Disciplines modals, which now share one look."}`

## Out of scope
Mirrors the plan's non-goals:
- migrating the second-feature modals (the "Not yet on the kit" list);
- picker keyboard navigation (K7) and inline fields (K10);
- V5–V8, including colour tokens on `:root` and the five `ed-spells.js` font literals;
- Ctrl/⌘+Enter in UI-GUIDELINES §7 (second feature, with its own sign-off);
- migrating any textarea modal, or using `isDirty`/`light` for real;
- carrying the original trigger through the cast → roll and damage → Knockdown hand-offs, and restoring focus after Apply closes;
- any engine, data, `rules/*.json`, taxonomy or schema change.
