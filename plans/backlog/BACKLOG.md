# Feature backlog

Ideas, problems and suggestions captured with `/idea`, waiting to go through
`/new-feature`. One growing file: new items are appended at the bottom and
nothing is deleted. Each item carries a **Status** line that the feature
workflow keeps current as the item moves from idea to release.

Start an item with `/new-feature B-NNN` — the Interrogator reads the blurb as
its opening context and names the feature from the entry: its title becomes the
feature title and its `slug` the `plans/<slug>/` folder. Edit either here any
time before planning. `/build-feature B-NNN` and `/release-feature B-NNN` also
accept the id. Flow reference: [docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md).

## Entry format

```markdown
### B-NNN — <title>

- **Status:** 💡 idea (<YYYY-MM-DD>)
- **Kind:** <bug | feature | improvement>
- **Area:** <tab / screen / subsystem>
- **Slug:** `<slug>`
- **Added:** <YYYY-MM-DD>

<blurb: 2–5 sentences — what was seen or wanted, why it matters, any direction
the owner already has in mind>
```

Keep the field lines exactly in this shape (`- **Field:** value`): the workflow
commands and `tools/release.mjs` read and rewrite them.

When `/new-feature` picks an item up it links the slug to its folder:
``- **Slug:** `<slug>` → [plans/<slug>/](../<slug>/)``. That link is how
`/build-feature B-NNN`, `/release-feature B-NNN` and `tools/release.mjs` find
the feature.

The slug is a 2–4 word kebab-case folder name (e.g. `talent-details-modal`).

## Status lifecycle

The Status line is `<emoji> <status> (<date it was set>)`, replaced in place
at each step:

| Status | Set by | Meaning |
|---|---|---|
| `💡 idea` | `/idea` | Captured, not started |
| `📝 planning` | `/new-feature` (setup) | Interview and plan in progress |
| `📋 planned` | `/new-feature` (report) | Plan reviewed, ready to build |
| `🔨 building` | `/build-feature` (alignment) | Spec, tests and implementation underway |
| `🧪 testing` | `/build-feature` (ship) | Pushed to `dev`, waiting for the owner's testing |
| `🚀 released vX.Y.Z` | `/release-feature` (`release.mjs apply`) | Shipped to `main` |
| `⏸️ parked` | owner, by hand | Set aside for now |
| `❌ dropped` | owner, by hand | Will not be done |

---

## Items

### B-001 — Unarmed Combat missing short effect

- **Status:** 🚀 released v2.13.2 (2026-11-26)
- **Kind:** bug
- **Area:** Warrior discipline / talents
- **Slug:** `unarmed-short-effect` → [plans/unarmed-short-effect/](../unarmed-short-effect/)
- **Added:** 2026-11-27

While testing the Fighter Test (Troll) character on dev, the Warrior's Unarmed
Combat talent, an optional pick at Circle 1, shows no short effect. Other
talents carry a `shortEffect`, so this one looks incomplete next to them.
Unarmed Combat needs its short effect added.

### B-002 — Optional talent details in the add-talent modal

- **Status:** 🔨 building (2026-11-27)
- **Kind:** improvement
- **Area:** Circle advancement / add optional talent
- **Slug:** `talent-info-bubbles` → [plans/talent-info-bubbles/](../talent-info-bubbles/)
- **Added:** 2026-11-27

When advancing a Circle and using Add to pick an optional talent, the modal
shows only each talent's name and a short description. There is no way to see
its full description, the bonuses it provides, or the attribute it works off.
The owner wants a way to understand what each optional talent does before
selecting it.

### B-003 — Talent info bubbles in the new-discipline modal

- **Status:** 🔨 building (2026-11-27)
- **Kind:** improvement
- **Area:** Add new discipline modal
- **Slug:** `talent-info-bubbles` → [plans/talent-info-bubbles/](../talent-info-bubbles/)
- **Added:** 2026-11-27

When adding a new discipline, the modal lists the rank 1 talents needed to
complete the first Circle and the optional talents available for it, but
there is no way to find out what any of them do. The owner wants an
informational bubble on each talent, required and optional, that the user can
click to learn more about it. Closely related to B-002, which is the same need
in the add-optional-talent modal.

### B-004 — Notes tab editable outside edit mode

- **Status:** 🚀 released v2.13.0 (2026-11-26)
- **Kind:** improvement
- **Area:** Notes tab
- **Slug:** `update-notes-edit` → [plans/update-notes-edit/](../update-notes-edit/)
- **Added:** 2026-11-27

Editing normally requires edit mode, but Notes is meant to be an exception,
the same way History already lets you add or edit events without it. Today the
Notes tab only lets you add or edit a note in edit mode. The owner wants the
Add Note button always visible, and small edit and delete icons shown on a
note when you hover over it, even outside edit mode. Described as a quick fix.
