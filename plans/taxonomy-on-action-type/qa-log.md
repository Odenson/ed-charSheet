# QA log: taxonomy-on-action-type

## 2026-10-03 — asked by interrogator
**Q:** (feature brief) What is the feature?
**A:** Death's Head also changes Frighten's action from Standard to Simple; nothing in the app changes a talent's action type. Introduce a taxonomy form so an effect can change a talent's action type, and show it in the UI (action shown as changed) with a hover explaining why.

## 2026-10-03 — asked by interrogator
**Q:** Which surfaces show the changed action?
**A:** Disciplines talent row and talent details modal: colour change plus hover explaining why. Combat attack picker: colour change only (no hover).

## 2026-10-03 — asked by interrogator
**Q:** Effect shape: new type `action-modifier` (operation set, new measure `action`, string value from controlled list, target ability name) vs reuse `test-modifier` with property Action?
**A:** New `action-modifier` type.

## 2026-10-03 — asked by interrogator
**Q:** Colour for a changed action: single `--accent` or direction-aware?
**A:** Use `--accent` (single token, no new tokens).

## 2026-10-03 — asked by interrogator
**Q:** Two active effects set different actions on one talent — which wins?
**A:** Fastest action wins (Free > Simple > Standard); hover lists contributing sources.

## 2026-10-03 — asked by interrogator (rules sweep)
**Q:** (rule-agent) No ordering between action types printed — how should the app rule?
**A:** Already answered by the owner above: fastest wins (Free > Simple > Standard). Recorded as R2 Decision.

## 2026-10-03 — asked by interrogator (open-question pass)
**Q:** Should the action-change fold apply to skills as well as talents?
**A:** Applies equally to skills, same outcome as talents.

## 2026-10-03 — asked by interrogator (open-question pass)
**Q:** Skills get the full UI treatment too (Disciplines skill rows and skill modal: accent + hover; Combat picker colours skill options)?
**A:** Yes, full parity.

## 2026-10-03 — asked by interrogator (open-question pass)
**Q:** Hover wording when several effects change the same action?
**A:** List every source and mark the winner (e.g. "Standard → Free. Free: Spell A (applied). Simple: Death's Head (overridden, slower)").

## 2026-10-03 — asked by interrogator (open-question pass)
**Q:** macOS Safari ignores colour on native `<option>`; the Combat picker would colour only the closed select (when the selected option is changed) there. Acceptable?
**A:** Accept it. No marker, no custom picker.

## 2026-10-03 — asked by reviewer (relayed by interrogator)
**Q:** Native title hover never shows on touch, and the row action cell is hidden at narrow widths — how to handle?
**A:** Accept for now: desktop hover only, no new mobile UI in this feature.
