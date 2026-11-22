# Q&A log: gen-skill-other

## 2026-11-22 — owner brief (initial request)
Learn-skill modal needs a quick filter by Knowledge / Artisan / Speak Language / Read-Write Language / General. Same quick selection for the "write your own" rows (Knowledge, Artisan, General). A custom General skill needs a name AND an attribute (write or select). Plus: optional custom description for any create-your-own skill, replacing the generic description.

## 2026-11-22 — asked by interrogator
**Q:** Custom attribute + description must be stored on the skill entry, changing the stored shape `{name, rank, tier}` (Tier 1). Sign off?
**A:** (Owner declined the question and redirected.) Asked how custom skills resolve their description/attribute today. Answer given: name-only storage; `makeSkillRef` strips the `(…)` and uses the generic template entry.

## 2026-11-22 — owner redirect
**A:** New approach: user-created skills go in their own rules file, shared between characters. Creating a new Knowledge, Artisan or General skill (with description and association) makes it a normal catalog skill that can be picked like any other. Mark them as user-created; keeping them in a separate file distinguishes core rulebook skills from custom. (Supersedes the Tier 1 schema sign-off: character shape unchanged.)

## 2026-11-22 — asked by interrogator
**Q:** "Association to a talent": attribute, talent, or both?
**A:** Attribute.

## 2026-11-22 — asked by interrogator
**Q:** Reusable catalog entry, or per-character subject?
**A:** Catalog entry: creating adds a named skill to the shared custom file; it appears in the picker for every character, tagged Custom.

## 2026-11-22 — asked by interrogator
**Q:** Persistence of the shared file?
**A:** Mirror custom items: new `/save-skills` worker route, `data/custom-skills.json`, CI fold into `rules/custom-skills.json`. Worker redeploy needed (owner does it).

## 2026-11-22 — asked by interrogator
**Q:** Fate of the Knowledge (…)/Artisan (…) quick text rows?
**A:** Keep them (generic description) and add a "Create custom skill" action per section (Knowledge, Artisan, General): form with name, attribute, optional description.

## 2026-11-22 — asked by interrogator
**Q:** Attribute for custom Knowledge/Artisan?
**A:** Default prefilled from the generic entry, editable (same as General).

## 2026-11-22 — asked by interrogator
**Q:** Tier of a custom skill?
**A:** Knowledge/Artisan fixed Novice; the General form asks Novice or Journeyman.

## 2026-11-22 — asked by interrogator
**Q:** Edit/delete of custom skills?
**A:** Out of scope; create only (follow-up).

## 2026-11-22 — asked by interrogator
**Q:** Where do the filter chips and Create actions go?
**A:** Both pickers (edit-mode learn picker and Adept creation picker): chips All / Knowledge / Artisan / Speak Language / Read/Write Language / General, plus a Custom-only chip.

## 2026-11-22 — asked by interrogator
**Q:** Anything else?
**A:** Creating custom skills must be toggled by a homebrew rule; set it on for now.
**Classification (interrogator):** Implement as a boolean `set` target in the homebrew registry (precedent `advancement.optionalTable`), new rule shipped `enabled: true`. Adding a registry target is code + doc, not a change to the ed-homebrew/3 file shape, so Tier 3. (A new top-level lever like `knackParents` would change the schema shape: Tier 1, avoided.)
