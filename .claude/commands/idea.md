---
description: Capture a feature idea, problem or suggestion as a backlog item for a later /new-feature run.
argument-hint: [the idea, in your own words]
---

# /idea — capture a backlog item

You are a **scribe**, not an interrogator. The owner talks through something
they noticed in the app or a feature they want; you turn it into one short
backlog entry in [plans/backlog/BACKLOG.md](../../plans/backlog/BACKLOG.md) that
can later seed `/new-feature`. Design, rules, tiers and tickets all belong to
`/new-feature` — not here.

## Rules

- **Don't interview.** Do not ask about scope, edge cases, rules, acceptance
  criteria or implementation. If `$ARGUMENTS` (or the owner's message) already
  says what the idea is, write the entry straight away.
- Ask **at most one** question, and only when you genuinely cannot tell what
  the idea is (e.g. `/idea` with nothing after it → "What's the idea?").
- If the owner wants to talk it through, listen and reflect it back briefly; do
  not steer it toward a design. Write the entry once they're done.
- No code, no plan files, no rule-agent, no guardrail classification. You may
  glance at the app/code only to name the area correctly.
- One idea per entry. If the owner gives several, write several entries.
- Never commit or push.

## Writing the entry

1. Read `plans/backlog/BACKLOG.md`. Next id = highest `B-NNN` + 1 (start at
   `B-001`), zero-padded to three digits.
2. If an item that is not yet released or dropped already covers the same idea, tell the owner and offer to
   add to that item's blurb instead of creating a duplicate.
3. Append to the bottom of `## Items` a `### B-NNN — <title>` block in exactly
   the format the file's "Entry format" section shows (one `- **Field:** value`
   line per field, a blank line, then the blurb; a blank line before the next
   `###`):
   - **status** — `💡 idea (<today>)`.
   - **title** — short noun phrase usable as a `/new-feature` name.
   - **slug** — the future `plans/<slug>/` folder name: 2–4 words, lowercase
     kebab-case, built from the title's key nouns (e.g. "Optional talent
     details in the add-talent modal" → `talent-details-modal`). It must not
     match an existing `plans/` folder or another item's slug.
   - **kind** — `bug` (something wrong now), `feature` (new capability) or
     `improvement` (make an existing thing better).
   - **area** — the tab/screen/subsystem in the owner's words (e.g. Combat tab,
     Spells, save, homebrew).
   - **added** — today's date.
   - **blurb** — 2–5 sentences in plain language: what was seen or wanted, why
     it matters, and any direction the owner already stated. Keep the owner's
     intent; don't invent requirements or solutions they didn't mention.
4. Reply with the entry as written and one line: start it with
   `/new-feature B-NNN`. Mention that the title and slug can be edited in the
   backlog before then.
