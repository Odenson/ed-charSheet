# Build log: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Run 1 — 2026-11-20 (since 2026-11-20T09:58:45Z)

**Alignment (Phase 0): PASS.**
- Guardrails: I1-I8 Tier 3; I9 UI-GUIDELINES §7 line is Tier 1 with owner sign-off recorded (qa-log 2026-11-20T09:21:00Z). No Tier 2.
- Rules: none (rules.md has no dependencies).
- Open questions: none material (portal approach is a build-time decision, recorded below). review.md F1-F5 all addressed in plan.md.
- Tree: only `plans/ui-kit-modal-migration-2/` untracked (planning files, committed with the feature). Branch `dev`.

## Phase 1 — Spec
`spec.md` written by designer. Plan corrections found: (F1) `ModalController.focusInitial` focuses the enabled primary before `initialFocus`, so `ed-confirm` gets a `focusCancel` option (autofocus on Cancel) in addition to `cancelLabel`; (I1) `ed-save-key` stays light DOM (Safari/iCloud autofill) via `light: true` + `scopeCss()`, conflict/settings move into shadow roots; (I7) `ed-combat.js:331-337` keydown covers only step audit and Clear-log confirm, whole listener removed; baseline `button-style` entries are inline `margin-left:auto` styles, moved to CSS. Owner decision recorded: custom-item prompt confirm label "Close". Conflict footer order follows kit contract (extra before Cancel).

## Phase 2 — Tests
Tester wrote ui/kit/dirty.test.js, ui/kit/scope-css.test.js, updated tools/check-ui-kit.test.js (see test-plan.md). Snapshot taken before dev run.

## Phase 3 — Build (dev)
- Kit: `ui/kit/dirty.js`, `ui/kit/scope-css.js` (new, pure); `modal.js` gains `cancelLabel`/`focusCancel` and `ensureLightStyles()`; `ed-confirm` gains `cancelLabel`/`focusCancel`.
- Migrated to the kit (baseline entry lowered/removed with each): changelog, homebrew, character-picker, settings (own shadow root, layer 2200), conflict (own shadow root, layer 2200, footer [Take theirs] [Cancel] [Keep mine]), save-key (light DOM, `light: true` + `ensureLightStyles()`, real submit button via `form` attr), add-legend, edit-meta (dirty guard), day-reset (heal tone; dirty hook dismisses embedded roll), custom-item (list/form in one frame; dirty hook as back-one-step; prompt confirm label "Close" per owner), notes (4 controllers, discard prompts), overview (info/lightbox/Karma Ritual, inline margin moved to CSS), combat (step audit; document keydown removed).
- Docs: UI-GUIDELINES §7 bullet + footnote (Tier 1, signed off), MODALS.md, UI-CONSISTENCY-REVIEW status lines, GITHUB-SERVERLESS-SAVE wording; changelog `improved` entry.
- Gate: `npm test` green (1471 pass, 0 fail); baseline is exactly the three non-modal entries. No tester test touched. No dispute.
