# Build log: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Run 1 — 2026-11-19 (start 2026-11-18T19:59:06Z)

### Phase 0 — Alignment (dev-lead)

- **Guardrails.** Every plan item I1–I12 is classified. Tier-1 items (I6 roll OK
  view Enter closes, I9/I10/I11 read-only Enter closes, I12 UI-GUIDELINES §7 D1
  sentence) all carry the recorded owner sign-off: qa-log 2026-11-18T11:53 (D1),
  scope confirmed at 13:40 (roll OK exception) and 13:42 (§7 gets only the D1
  sentence). No Tier-2 item (no taxonomy, `rules/*.json`, schema or engine
  change). No item is blocked. **Pass.**
- **Rules coverage.** `rules.md` records no Earthdawn rule dependency; only
  preserved app behaviours (Strain once, Karma once, Knockdown hand-off). No
  `NOT-COVERED` / `CONFLICT` / `APP-DIFFERS` entries. **Pass.**
- **Open questions.** `plan.md` "Open questions" lists no open owner question;
  the remaining design details are designer-resolvable. `review.md` has no
  blockers and all 11 findings are recorded as fixed in the plan. **Pass.**
- **Tree.** `git status`: untracked `docs/UI-CONSISTENCY-REVIEW.md` (I12 updates
  it and stages it by explicit path — part of this feature) and this feature
  folder. No other uncommitted changes.
- **CLAUDE.md:51.** Not a protected surface under GUARDRAILS.md; the one-word
  path change (`ui/modal-controller.js` → `ui/kit/`) is applied at doc sync.

`plan.md` status set to `building`.

### Phase 1 — Spec (feature-designer)

`spec.md` written. No `NEEDS_HUMAN` / `NEEDS_RULES`. Key decisions: router
returns `'close' | 'confirm' | 'block' | 'pass'` (15 ordered rules R1–R15);
Ctrl/⌘+Enter outside a textarea = plain Enter; `onClose(reason)` with
`'cancel' | 'confirm'`; per-controller `data-modal` marker; magic variant via
`data-variant`; rule-4 extension counts `--fs-*` redefinitions (trade starts at
5); final baseline 16 entries. Departures noted: Equipment add-item Escape on the
host element (not `.addbar`); framed roll views use kit classes only (embedded
markup unchanged); Tab from outside the top modal pulls focus back in.

### Phase 2 — Tests (feature-tester, author mode)

New: `ui/kit/modal-stack.test.js`, `ui/kit/modal-controller.test.js`,
`tools/check-ui-kit.test.js`. Changed: `tools/check-imports.test.js` (walker
descends into `ui/kit`; Windows-safe guard source test). `npm test`: 1299 pass,
5 fail — all expected (missing feature modules). Snapshot taken for Phase 6.

### Phase 3 — Build (feature-dev)

Implemented I1–I12 per spec.md. `npm test`: 1458 pass, 0 fail (pretest import check
and UI-kit check both green).

- **Kit:** `ui/kit/modal-stack.js`, `modal-controller.js` (moved with `git mv`),
  `modal.js`, `button-css.js`. `tools/check-ui-kit.mjs` + `tools/ui-kit-baseline.json`
  (16 entries), `package.json` pretest + `lint:ui-kit`. `check-imports` walks
  `ui/kit/` and uses the `pathToFileURL` guard.
- **Hosts migrated:** `ed-confirm`, `ed-roll-modal`, `ed-damage-modal`,
  `ed-trade-modal`, `ed-equipment` (item modal), `ed-spells` (info, learn, cast),
  `ed-disciplines` (nine modals). `updated()` charge logic, commits' charge logic and
  `_toggleKarma` untouched; embedded roll markup unchanged.
- **Docs:** UI-GUIDELINES §7 (D1 sentence + sign-off note only), MODALS.md rewrite,
  GUARDRAILS PR checklist, ARCHITECTURE §8, CLAUDE.md:51, UI-CONSISTENCY-REVIEW
  status table, changelog `improved` line.
- **Deviation:** the roll modal calls `opened(null)` in `firstUpdated()` and then
  `refocus()` once `updateComplete` resolves, because the first render has no dialog
  until `updated()` rolls (otherwise initial focus would find nothing). No change to
  `updated()`.
- No disputes raised.

### Owner manual checklist (copied from plan.md, verify on dev)

- Every migrated modal in light and dark and at mobile width: confirm (swap, drink,
  discard, switch character, Notes delete, Combat clear), roll (OK, Apply, set-dice,
  aim), Take damage (Overview and Combat), trade (buy, sell), Equipment item (read,
  edit, magic), Spells info/learn/cast, every Disciplines modal.
- Stacked Escape closes only the top: Equipment item -> Remove -> sell; item ->
  Equipped -> swap; Spells learn -> Roll Patterncraft -> roll.
- Held keys: Escape on a two-modal stack closes only the top; Enter on a dice button
  opens exactly one roll; Enter held on roll OK or Cancel closes once, no reopen;
  Strain charged once, no duplicate Discord report.
- Roll: OK focused on open and Enter closes (also Knockdown result); Apply/set-dice/aim
  show [Cancel][Primary] and hint; aim Roll only once a target is entered; focus
  inside the result after a chooser commits; Karma charges once; optional-mod
  checkbox Enter does not close.
- Day-reset embedded roll: its X and OK return to stats; Heal applies; Escape dismisses
  then closes day-reset.
- Take damage: Enter at 0 does nothing, >0 applies; Cancel closes; Knockdown hand-off
  focus inside the roll (Overview and Combat).
- Trade: Enter in Amount confirms only when valid; gem-row Enter only adds the gem;
  coin +/- work by keyboard.
- Equipment: Enter closes item modal without re-clicking the tile; edit mode does not
  focus Equipped/Remove; add-item combobox arrows/Enter, Escape from input, Done and
  after a row click, outside click closes.
- Spells: Enter on a spell row only selects; Enter in silver field confirms only when
  allowed; learn draft survives Escape on the roll above; Enter in cast target
  confirms; cast -> roll focus inside roll; info Enter closes.
- Disciplines: Half-Magic default option focused; skill/knack search focused and Enter
  does nothing; Train focuses Train when allowed else fee field; Enter in fee fields
  does nothing; info Enter closes; Circle tooltip and requirement row unchanged.
- Legacy modals still behave: Settings Enter saves (field, switches, radios), Escape
  discards; Notes Escape, and its delete confirm closes alone; Combat confirms;
  Overview info / Karma Ritual / Add Legend close on Escape; the Section 6a picker
  Enter confirms the focused row and "Load a different character?" -> Continue opens it
  with the first row focused.
- Focus returns to the trigger with no ring after a pointer open; ring kept after a
  keyboard open. Overview still fits the viewport.
- Deliberate visible changes: larger modal titles, one button shape, Take damage has
  Cancel, Spells cast says Cancel and info has no Close, trade text slightly smaller,
  "+ Learn spell" new shape, roll Apply/choosers gain Cancel (OK stays), aim Roll is
  amber, Spells/Equipment/Disciplines/trade dialogs cap at 85vh and scroll, learn
  footer shows a disabled "Learn spell" before a spell is picked.

### Phase 4 — Dev Lead review (dev-lead)

Reviewed commit 22b35b4 (`git show`), spec.md and the tester's tests. **Clean — no
revision needed.**
- Gate: `npm test` 1458 / 1458 pass (pretest import + UI-kit checks included).
- Test guarantee: the four tester files are byte-identical to the Phase-2 snapshot.
- Router/controller match spec R1–R15; kit is lit-free and dispatches nothing
  (golden rule); `onClose(reason)` lets `ed-confirm` dispatch only `confirm` on OK.
- Roll modal: `updated()` Strain/Karma charge logic and chooser commits untouched
  (diff touches render only, plus first-focus in `firstUpdated`).
- Tier 1: UI-GUIDELINES §7 changed by the signed-off D1 sentence + note only.
- Accepted dev deviations: roll first focus via `opened(null)` in `firstUpdated`
  + `updateComplete.then(refocus)`; `.mfoot` wrapper div in `modal.js`.

### Phase 5 — Doc sync (design-agent)

Applied (Tier 3): `docs/FEATURE-WORKFLOW.md:99` and `docs/AI-WORKFLOWS.md:130` now
list `tools/check-ui-kit.mjs` in `pretest`. Deferred Tier-1/2 edits: **none**.
Note (no change proposed): UI-GUIDELINES §7's "Every modal/overlay follows the same
keyboard contract" is not yet true for legacy modals; MODALS.md §10 lists them and
the second feature migrates them. `docs/TAXONOMY-AUDIT.md` mentions of
`ui/modal-controller.js` are dated records and left as is.

### Phase 6 — Owner handoff

**GUARDRAILS PR checklist**
- [x] No Tier-1 invariant changed — only the owner-signed-off §7 D1 sentence
      (qa-log 11:53; scope 13:42); roll OK exception signed 13:40.
- [ ] Overview fits viewport — no Overview layout change; **owner to confirm on dev**.
- [x] Derived values still placeholder pills — no derived-value change.
- [ ] Light + dark; modals Escape-close / Enter-confirm — kit uses `light-dark()` /
      host vars; **owner to verify visually**.
- [x] Taxonomy change — N/A (no Tier-2).
- [x] Asset/fetch paths relative — no new fetches.
- [x] Modals use `ui/kit/`; UI-kit check passes (migrated hosts; legacy in baseline).

**Manual UI verification** — see "Owner manual checklist" earlier in this log
(light + dark, mobile 340px fold, Overview fit, stacked Escape, held keys, roll
modal, day-reset embedded roll, damage, trade, equipment, spells, disciplines,
legacy smoke pass).
