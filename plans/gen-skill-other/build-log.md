# Build log: gen-skill-other

## Run 1 — 2026-11-23 (since 2026-11-22T21:42:28Z)
- **Alignment:** PASS. All plan items I1-I10 Tier 3 (no Tier-1 item; owner declined the Tier-1 schema change, qa-log). rules.md R1-R3 FAQ-HIT/ANSWERED; R4 NOT-COVERED carries owner Decision (2026-11-22, RULES-FAQ Q045). review.md: 5 findings, all addressed in plan Review responses. Remaining open questions are non-blocking and have defaults in plan.md (no-description fallback text; worker bundling fallback; owner worker redeploy).
- **Tree:** `dev` in sync with origin (0 0). Uncommitted: `docs/RULES-FAQ.md` (Q045 by this feature's rule-agent) and `plans/gen-skill-other/` — both belong to this feature; stage by explicit path.

## Build run 1 — 2026-11-23
- Implemented I1-I10: `engine/validate-skill.js`; `mergeSkillCatalog` + `loadCustomSkills` + `customSkills` model + `skills.allowCustom` in `store.js`; `custom` flag in `skill-options.js`/`creation.js`; `store-custom-skills.js`; worker `/save-skills` (+wrangler var), dev-server route, `sync-local-data.sh`, `.gitignore`; `tools/fold-custom-skills.mjs` + workflow; `rules/custom-skills.json`, `hb-custom-skills` rule; `ui/skill-filter.js`, `ui/custom-skill-state.js`, `ui/ed-custom-skill.js`; chips, per-section Create buttons, Custom badges in `ui/ed-disciplines.js`; ed-app wiring; docs + changelog line.
- Gate: `npm test` green (2386 tests, 0 fail; check-imports and check-ui-kit pass). No tester test touched; no dispute.
- Deviations: `model.customSkills` also carries `coreNames`/`customNames` (data-down props for the form's live duplicate check). Learn picker reads `model.skillOptions` live (not the open-time snapshot) so a created skill appears at once. Worker/dev-server import/read `rules/attributes.json` + `rules/skills.json` (JSON import attributes bundled by wrangler; not run through wrangler here). docs/UI-GUIDELINES.md and docs/TAXONOMY-AUDIT.md not edited.
- UI (chips, Create form, badges) is untested by automation: owner manual check in light and dark.

## Dev Lead review and ship
- **Review:** clean. Diff matches spec; tester's tests unchanged (cmp vs snapshot); core entries returned by reference when no custom file; `custom` added only when true; UI dispatches `ed-create-custom-skill` up, state/validation pure; engine DOM-free; no Tier-1 change. Nit (not fixed): `this._dirty =hasPendingEdits` spacing in ed-app.js Save-all path.
- **Doc sync:** applied D1/D2 to docs/MODALS.md (layer row, §8 list, picker sentence). **Deferred (Tier-1 doc, needs owner sign-off):** docs/UI-GUIDELINES.md §6b (~l.185-190): add category filter chips, Custom tag, and the "Create custom skill" form (gated by `skills.allowCustom`); same for the edit-mode learn picker and the Custom badge on skill rows/modal.
- **Owner ops:** redeploy the Cloudflare worker (new `/save-skills` route; confirm wrangler bundles the JSON imports of rules/attributes.json + rules/skills.json); the fold workflow must also exist on `character-data` for its push trigger.

### PR checklist
- [x] No Tier-1 invariant changed (stored skill `{name, rank, tier}` unchanged; `ed-homebrew/3` shape unchanged)
- [ ] Overview viewport fit — owner to verify (Overview not touched)
- [x] Derived values: no new derived display; custom skill with no description shows existing "not yet recorded" text
- [ ] Light and dark; Escape/Enter — owner to verify
- [x] Modals use ui/kit (`modalFrame`); check-ui-kit part of `npm test` (green, 2386)
- [x] No taxonomy change
- [x] New fetch paths: only the custom-skills data URL, mirroring custom items

### Manual UI checklist
See "UI test requirements" in the final report.
