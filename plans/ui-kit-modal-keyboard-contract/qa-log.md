# Q&A log: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

Source: [docs/UI-CONSISTENCY-REVIEW.md](../../docs/UI-CONSISTENCY-REVIEW.md) (U1 kit plan, findings K/M/V, decisions D1–D8).

## 2026-11-18T11:52:00Z — asked by interrogator
**Q:** How much of the UI consistency review should this one feature cover? Options: (a) all modals now — kit + check script + every modal migrated, Enter = OK / Escape = Cancel in all modals incl. read-only, shared modal/button styles; pickers (K7), inline fields (K10) and non-modal cleanups (V5–V8) become a second feature; (b) the whole review at once; (c) kit + pilot only (ed-confirm, roll modal).
**A:** (a) All modals now. Pickers (K7), inline fields (K10) and the non-modal cleanups (V5–V8) are a separate, later feature.

## 2026-11-18T11:53:00Z — asked by interrogator
**Q:** **Tier-1 sign-off (D1).** UI-GUIDELINES §7 says: "Read-only modals (like the current roll and ability modals) have no primary action, so Enter is a no-op there." Making Enter = OK means Enter *closes* read-only modals (info modals, the roll result with only an OK button). Do you sign off on changing §7 to "Read-only modals: Enter closes (it is their OK)"? Tier-3 alternative offered: keep Enter as a true no-op in read-only modals (the kit swallows it so it no longer re-clicks the trigger behind).
**A:** **Yes — signed off (owner, 2026-11-18).** Amend UI-GUIDELINES §7 so Enter closes read-only modals everywhere, including the roll modal's OK view.

## 2026-11-18T11:54:00Z — asked by interrogator
**Q:** (D2) In modals whose main field is a textarea (Notes add/edit note and event, the long Edit-character-details fields), Enter types a newline. What should save from the keyboard: Ctrl/⌘+Enter, or Tab to Save only?
**A:** **Ctrl/⌘+Enter saves**, with a small "Ctrl+Enter saves" hint; Enter keeps typing a newline; the modal focuses the textarea on open.

## 2026-11-18T11:55:00Z — asked by interrogator
**Q:** (D3) With unsaved edits, which modals should ask "Discard unsaved changes?" on Escape / ✕ / backdrop: free-text modals only, every modal with edits, or never?
**A:** **Free-text modals ask:** Notes note/event, custom-item form, Edit character details, plus the custom-items list as today. Short numeric/choice modals (Add Legend, Settings, Trade, Take damage, Karma Ritual) close without asking.

## 2026-11-18T11:56:00Z — asked by interrogator
**Q:** (D5) Footer convention for the shared modal frame: input/confirm modals [Cancel] [Primary] with read-only modals ✕ only, or read-only modals also get a visible [OK] button?
**A:** **Input/confirm modals: [Cancel] [Primary]**, right-aligned, primary last — adds Cancel to Take damage and Karma Ritual; the Spells cast modal's "Close" becomes "Cancel". **Read-only modals: ✕ only**, no footer button (Spells info loses its Close button).

## 2026-11-18T11:57:00Z — asked by interrogator
**Q:** (V4) Should the shared frame show a keyboard hint: on input modals, nowhere, or on every modal?
**A:** **On input/confirm modals only:** a small muted footer hint "Enter = OK · Esc = Cancel" ("Ctrl+Enter saves · Esc = Cancel" for textarea modals). Read-only modals show none; the Combat step audit's "Escape closes" hint goes.

## 2026-11-18T11:58:00Z — asked by interrogator
**Q:** (V2) buttonCss unifies primary-button shape. Should colour keep tab tones (amber default, spell, karma, day-reset green) or become amber everywhere?
**A:** **Keep tab tones:** one shape for every primary button; colour from a tone modifier — amber by default, spell colour on Spells, karma where Karma is spent (Commit, Learn spell), green for day-reset healing. Only the shape changes visibly.

## 2026-11-18T11:59:00Z — asked by interrogator
**Q:** (D8) Where does the "all modals use ui/kit/" rule live: MODALS.md + GUARDRAILS PR checklist (Tier 3), or also as a locked Tier-1 rule in UI-GUIDELINES §7? (tools/check-ui-kit.mjs enforces it either way.)
**A:** **MODALS.md + the GUARDRAILS.md PR checklist.** UI-GUIDELINES gets only the signed-off §7 Enter change. Tier 3.

## 2026-11-18T12:01:00Z — asked by interrogator
**Q:** Delivery: one /build-feature run migrating every modal, or two features tested separately?
**A:** **Two builds.** This slug: the kit + check script + the high-severity modals — `ed-confirm`, `ed-roll-modal`, Spells (info, learn, cast), the Equipment item modal, `ed-trade-modal`, `ed-damage-modal`, and the Disciplines modals. A second slug, planned after this one, migrates the rest (Overview info / Karma Ritual / lightbox, `ed-add-legend`, `ed-edit-meta`, Notes, the Combat step audit, `ed-custom-item`, `ed-day-reset`, `ed-character-picker`, `ed-settings`, `ed-save-key`, `ed-conflict`, `ed-changelog`, `ed-homebrew`) and empties the baseline allowlist.

## 2026-11-18T12:02:00Z — asked by interrogator
**Q:** Anything else this first build must include or must not change? Proposed defaults: picker modals with no primary button (Disciplines Learn a skill / Learn a knack, Half-Magic, Add a talent option) keep Enter as "activate the focused option" and do nothing in the search box until the later picker feature; the Equipment add-item combobox keeps its own keys; the owner verifies the UI on dev from a manual checklist.
**A:** **Nothing else** — use the defaults.

## 2026-11-18T13:40:00Z — asked by planner
**Q:** Roll modal OK button under D5. D1 names the roll result view (OK only) as a read-only modal, and D5 says read-only modals get ✕ only, with no footer button. Remove the OK button from the roll result view and the Knockdown result (✕, backdrop, Escape and Enter close it), or keep a visible OK as an exception? Apply and the chooser views gain Cancel under D5 either way. Planner default: remove OK.
**A:** **Keep OK as an exception.** The roll modal's result view (and the Knockdown result) keeps its visible **OK** button; Enter = OK closes it. Every other read-only modal is ✕ only (D5). Apply and the dice/aim choosers get [Cancel] [Primary].

## 2026-11-18T13:42:00Z — asked by planner
**Q:** §7 sign-off scope. The recorded sign-off (D1) covers "Read-only modals: Enter closes", and D8 says UI-GUIDELINES gets only that §7 change. T5 also proposed two more §7 lines: "Escape closes only the top modal" and "Ctrl/⌘+Enter saves in textarea modals". Sign off putting those in §7 in this build? Planner default: §7 gets only the D1 sentence; both rules go in MODALS.md.
**A:** **Only the D1 line now.** UI-GUIDELINES §7 gets only "Read-only modals: Enter closes (it is their OK)". "Escape closes only the top modal" and Ctrl/⌘+Enter are documented in MODALS.md; Ctrl/⌘+Enter joins §7 in the second feature, when textarea modals use it (that feature asks for its own sign-off).
