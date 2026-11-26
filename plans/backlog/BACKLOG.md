# Feature backlog

Ideas, problems and suggestions captured with `/idea`, waiting to go through
`/new-feature`. One growing file: new items are appended at the bottom, and an
item is ticked (`[x]`) in place when `/new-feature` picks it up, with a link to
its `plans/<slug>/` folder. Nothing is deleted.

Start an item with `/new-feature B-NNN` — the Interrogator reads the blurb as
its opening context and names the feature from the entry: its title becomes the
feature title and its `slug` the `plans/<slug>/` folder. Edit either here any
time before planning. `/build-feature B-NNN` and `/release-feature B-NNN` also
accept the id, and a release appends `· shipped vX.Y.Z` to the items it ships. Flow reference: [docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md).

Entry format:

```markdown
- [ ] **B-NNN — <title>** · <kind: bug | feature | improvement> · <area> · slug `<slug>` · added <YYYY-MM-DD>
  <blurb: 2–5 sentences — what was seen or wanted, why it matters, any direction
  the owner already has in mind>
```

Ticked: `- [x] **B-NNN — <title>** · … · → [plans/<slug>/](../<slug>/) (<YYYY-MM-DD>)`
Shipped: the same line, then ` · shipped vX.Y.Z` (added by `/release-feature`).

The slug is a 2–4 word kebab-case folder name (e.g. `talent-details-modal`).
Older items without one get a slug proposed by `/new-feature`.

---

## Items

- [ ] **B-001 — Unarmed Combat missing short effect** · bug · Warrior discipline / talents · slug `unarmed-short-effect` · added 2026-11-27
  While testing the Fighter Test (Troll) character on dev, the Warrior's Unarmed
  Combat talent, an optional pick at Circle 1, shows no short effect. Other
  talents carry a `shortEffect`, so this one looks incomplete next to them.
  Unarmed Combat needs its short effect added.
- [ ] **B-002 — Optional talent details in the add-talent modal** · improvement · Circle advancement / add optional talent · slug `talent-details-modal` · added 2026-11-27
  When advancing a Circle and using Add to pick an optional talent, the modal
  shows only each talent's name and a short description. There is no way to see
  its full description, the bonuses it provides, or the attribute it works off.
  The owner wants a way to understand what each optional talent does before
  selecting it.
- [ ] **B-003 — Talent info bubbles in the new-discipline modal** · improvement · Add new discipline modal · slug `discipline-talent-info` · added 2026-11-27
  When adding a new discipline, the modal lists the rank 1 talents needed to
  complete the first Circle and the optional talents available for it, but
  there is no way to find out what any of them do. The owner wants an
  informational bubble on each talent, required and optional, that the user can
  click to learn more about it. Closely related to B-002, which is the same need
  in the add-optional-talent modal.
- [x] **B-004 — Notes tab editable outside edit mode** · improvement · Notes tab · added 2026-11-27 · → [plans/update-notes-edit/](../update-notes-edit/) (2026-11-27) · shipped v2.13.0
  Editing normally requires edit mode, but Notes is meant to be an exception,
  the same way History already lets you add or edit events without it. Today the
  Notes tab only lets you add or edit a note in edit mode. The owner wants the
  Add Note button always visible, and small edit and delete icons shown on a
  note when you hover over it, even outside edit mode. Described as a quick fix.

