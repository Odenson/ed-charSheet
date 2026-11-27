# Build log: Talent info bubbles (talent-info-bubbles)

## Run 1 — 2026-11-27 (since 2026-11-26T23:49:48Z)

### Alignment (Phase 0)
- **Guardrails:** I1-I7 all Tier 3 (tickets.md, plan.md "Guardrail classification"). No Tier-1 or Tier-2 item; no sign-off needed.
- **Rules coverage:** rules.md records no Earthdawn rule computed or asserted (display of rules/talents.json text only). Nothing to settle.
- **Open questions:** one non-blocking (bubble placement in `.lrow` pickers); the plan settles it as left of the name, matching the owner's "match the Disciplines tab" answer (qa-log 23:27). No question needed.
- **Review:** F1-F3 accepted and folded into plan.md.
- **Tree:** uncommitted `plans/backlog/BACKLOG.md` (B-002/B-003 status lines from /new-feature) and untracked `plans/talent-info-bubbles/` (the planning folder). Both belong to this feature and go in the feature commit.
- **Outcome:** aligned. plan.md `status: building`; B-002 and B-003 set to 🔨 building.

## Run 2 — 2026-11-27 (feature-dev, build mode)

### Changes
- **I1 `store.js`:** `pickerTalent(name, circle, required)` closure in `deriveModel`; used for `disciplines[].optionSlots[].learnable` (slot Circle), `addableDisciplines[].optionPool.items` (Circle 1), new `addableDisciplines[].grantItems` (Circle 1, `required: true`; `grants` stays `string[]`), and `creation.talents.option.candidates` (Circle 1). Unknown name gives null brief/action/attribute/detail.
- **I2:** `talentDetail` key `notes` renamed `effects`; `_talentModal` shows an "Effects" `h4` + `ul.meffects` instead of the karma-tinted `.mnote` lines (`.mnote` kept for grant sources).
- **I3 `ui/ed-disciplines.js`:** `_talentInfo` state, `_talentInfoCtl` (kind `info`), `_openTalentInfo` (stopPropagation + preventDefault, picker state untouched), `_talentBubble`; `_talentModal(t, ctl, layer)`; stacked detail rendered after the `_modal` block at layer 2100.
- **I4/I6:** `.lrow` wrapper with the bubble beside `.lopt` in `_learnModal` and `_creationOptionModal` (autofocus unchanged).
- **I5:** Start modal grants iterate `grantItems` with a filled bubble; options wrapped in `.startoptrow` with the bubble outside the `<label>`; "No option for now" gets a `.tspacer`.
- **I7:** UI-GUIDELINES §4 dated note; MODALS.md §5 stacked-detail paragraph. Changelog `added` line in `unreleased.changes`.
- Note: the spec's `slots[]` is the real `optionSlots[]` key (tester note); no code impact.

### Gate
- `store-talent-picker-detail.test.js`: 10/10 pass.
- `npm test` (pretest lint + check-ui-kit): 2608 pass, 0 fail.

### Disputes
- None.

### Dev Lead review (Phase 4) — commit 9fd4be2
- Spec/acceptance: I1-I7 implemented as planned; `grants` still `string[]`, `grantItems` added beside it; `detail.notes` → `detail.effects` with no remaining reader.
- Golden rule: the view reads model fields only (no catalog lookup in `ui/`), no new dispatch, engine untouched, nothing stored.
- Tier: all Tier 3; styles use `--fs-*` tokens and theme vars (`h4` eyebrow style reused, `.tname`, `.lrow` existing); `tinfo` as `<button>` matches `_talentRow`.
- Modals: second kit controller (kind `info`, layer 2100) rendered after `_modal`; bubble outside the radio `<label>`; click stops propagation.
- Gate reported green (2608 pass). Tests unchanged vs snapshot (checked at ship).
- **Outcome:** clean — no revision needed.

### Doc sync (Phase 5)
- design-agent (scoped): **no edits needed**; UI-GUIDELINES §4 and MODALS.md §5 (written by the dev) match the code; ARCHITECTURE.md unaffected; no `detail.notes` mention left in docs. No Tier-1/2 proposals.
- Not applied (optional, cosmetic): add the stacked 2100 detail to the MODALS.md §5 host/layer table row; the paragraph below the table already covers it.

### Ship (Phase 6)
- Tests: `store-talent-picker-detail.test.js` identical to the tester's snapshot.
- Gate: `npm test` 2608 pass, 0 fail. Local `dev` not behind `origin/dev`.
- plan.md `status: implemented`, `shipped: unreleased`; B-002 and B-003 → 🧪 testing. BACKLOG.md carried the /new-feature status edits too (all B-002/B-003, this feature).

### Owner handoff — GUARDRAILS.md PR checklist
- [x] Classified every change: all Tier 3 (store view-model fields, new modal/picker content, docs).
- [x] No Tier-1 change (no schema/version tag, no stored field, UI contract honoured via ui/kit); no Tier-2 taxonomy change.
- [x] Data down / events up: view reads model only; no new dispatch; engine untouched and DOM-free.
- [x] Only inputs stored: `grantItems`, picker `detail`, `detail.effects` are derived.
- [x] Theme: new styles use `--fs-*` tokens and theme vars; `check-ui-kit` passes.
- [x] Modals: kit controller, kind `info`, layer 2100; Escape/Enter/focus via MODALS.md contract.
- [x] Docs updated: UI-GUIDELINES §4, MODALS.md §5, changelog `unreleased`.
- [x] `npm test` green.
- [ ] Manual UI verification by owner (below).
- Deferred Tier-1/2 doc edits: none.

### Manual UI verification checklist
See plan.md "Manual verification" M1-M4 (repeated in full in the final report).
