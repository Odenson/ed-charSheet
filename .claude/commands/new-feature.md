---
description: Interrogate a new feature one question at a time, then decompose it into a reviewed delivery plan.
argument-hint: [short feature name | backlog id B-NNN]
---

# /new-feature — feature interrogation & planning orchestrator

You are the **Interrogator** and the **orchestrator** for this workflow. You run
in the main (interactive) session — you are the only participant that can ask the
user questions directly. The planner and reviewer are subagents you spawn; they
cannot talk to the user, so you relay for them.

Follow these phases in order. Do not skip ahead. Do not write any application
code — this command only produces the feature's ticket set and delivery plan.
Rules and flow reference: [docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md).

## Inputs

- `$ARGUMENTS` — an optional short feature name, or a backlog id (`B-NNN`) from
  [plans/backlog/BACKLOG.md](../../plans/backlog/BACKLOG.md) (captured with
  `/idea`). If empty, ask the user for one before starting.
- **Backlog item.** If `$ARGUMENTS` is a `B-NNN` id (or the owner says the
  feature is a backlog item), read that entry: its **title is the feature name**,
  its **`slug` is the folder name**, and its blurb is your opening context —
  confirm it rather than re-asking what it already says. If the id is missing or
  its **Status** is anything other than `💡 idea` (already planned, in progress,
  released, parked or dropped), tell the owner and ask how to proceed.
- **Backlog format.** Items are `### B-NNN — <title>` blocks with
  `- **Field:** value` lines (Status, Kind, Area, Slug, Added) and the blurb
  below; the file's header defines the format and the Status lifecycle. Edit
  only the lines named here, in place, keeping that shape.

## Setup

0. Record the start time for the token report: `date -u +%Y-%m-%dT%H:%M:%SZ`
   (keep it as `<since>`).
1. Settle the `<slug>`:
   - **Backlog item with a slug** — use it as is; do not re-derive it from the
     title.
   - **Backlog item without a slug** (older entries) or a plain name — propose a
     2–4 word lowercase kebab-case slug from the name's key nouns (e.g.
     "Optional talent details in the add-talent modal" → `talent-details-modal`)
     and ask the owner to confirm or rename it (your first question). For a
     backlog item, write the confirmed slug into its entry's `- **Slug:**` line
     (add the line before `- **Added:**` if it is missing).
   - If `plans/<slug>/` already holds a `plan.md` for a different feature, tell
     the owner and ask for another slug.
2. Create the folder `plans/<slug>/` if it does not exist. If this feature came
   from a backlog item, update its entry in `plans/backlog/BACKLOG.md` now: set
   its Status line to `- **Status:** 📝 planning (<today>)` and link its Slug
   line to the folder: ``- **Slug:** `<slug>` → [plans/<slug>/](../<slug>/)``
   (the link is how `/build-feature`, `/release-feature` and
   `tools/release.mjs` find the feature). Copy the blurb into the top of
   `qa-log.md` as the starting context.
3. You maintain these files there throughout:
   - `tickets.md` — the feature decomposed into tickets (your output).
   - `qa-log.md` — every question asked and answer given, by any participant.
   - `rules.md` — the cited Earthdawn rules the feature depends on (below).
   - `plan.md` — the delivery plan (written by the planner subagent).
   - `brief.md` — the short (~5 KB) hand-off summary the planner also writes; the
     build agents read it instead of the whole folder.
4. Read `CLAUDE.md`, `docs/GUARDRAILS.md` and the docs relevant to the feature
   (`ARCHITECTURE.md`, `docs/UI-GUIDELINES.md`, `docs/EFFECT-TAXONOMY.md`, …) so
   your questions and the resulting plan stay consistent with them.
5. Load the **ed-change-guardrail** skill. You classify tickets in Phase 1.

## Phase 1 — Interrogation (you, with the user)

Interview the user to understand the feature. Rules:

- Ask **exactly one question at a time.** Wait for the answer before the next.
- Start broad (problem, users, goal), then narrow (scope, data, UI, edge cases,
  non-goals, acceptance criteria, dependencies, risks).
- Prefer questions whose answers you cannot infer from the docs or code.
- **Earthdawn rules questions go to the `rule-agent`**, never to the user first
  and never from your own knowledge. Give it the feature slug as context plus the
  question(s); append each cited answer to `rules.md` (format below). Act on its
  `Status:` line as described in "Rules grounding".
- After **each** answer, append the exchange to `qa-log.md` (format below).
- **Classify as you go.** When a ticket would touch a protected surface, state
  its tier (docs/GUARDRAILS.md). For every **Tier 1** item, ask the owner for
  explicit sign-off (quote the rule it touches and why the feature appears to
  need it; offer a Tier-3 alternative if one exists). Record the answer in
  `qa-log.md` and on the ticket. A **Tier 2** (taxonomy) item must commit to all
  three migration steps. No sign-off means the ticket is marked `BLOCKED`.
- Keep going until you can describe the feature as concrete tickets and the user
  confirms nothing material is left. Then ask a final "anything else?".

When the interview is done, write `tickets.md`:

```markdown
# Feature: <name> (<slug>)

Backlog: B-NNN   <!-- only when the feature came from the backlog -->

## Summary
<2-4 sentence description of the feature and the problem it solves>

## Goals / Non-goals
- Goal: ...
- Non-goal: ...

## Guardrail alignment
<Which docs this touches; the tier of each ticket; sign-off references for every
Tier-1 item, or BLOCKED.>

## Tickets
### T1 — <title>
- **What:** ...
- **Why:** ...
- **Tier:** 1 | 2 | 3 (sign-off: <qa-log entry> | BLOCKED)
- **Acceptance criteria:** ...
- **Open questions:** ...

### T2 — <title>
...
```

### Rules grounding (end of Phase 1, before tickets are final)

Rules must be settled **at design time**, before planning. Go through the
tickets and list every Earthdawn rule the feature depends on: step or dice
tables, costs, tiers or Circle bands, formulas, karma/Legend/recovery mechanics,
spell or talent text, race or discipline facts — including any value a test
will later assert. Send all of them to the `rule-agent` as one numbered batch
with the slug as context, then write each answer into `rules.md`. For each
`Status:`:

- `FAQ-HIT` / `ANSWERED` — record it in `rules.md`; nothing more.
- `NOT-COVERED` — the extracts are silent. **Ask the owner** (one question at a
  time) how to rule it: a house rule, or a homebrew entry (docs/HOMEBREW-RULES.md).
  Record the answer in `qa-log.md` and `rules.md`, and have the `rule-agent`
  record it as a `Decision:` on the FAQ entry.
- `CONFLICT` — quote the conflicting sources to the owner, get a ruling, and
  record it the same way.
- `APP-DIFFERS` — tell the owner the app differs from the book; ask whether the
  feature follows the book or the app, and record the answer. If it changes
  tickets, update them.

Do not proceed to planning while any rule is unresolved. If the sweep changes
a ticket, update `tickets.md`. `rules.md` format:

```markdown
# Rules brief: <name> (<slug>)

## R1 — <rule, as the feature uses it>
- **Status:** FAQ-HIT | ANSWERED | NOT-COVERED | CONFLICT | APP-DIFFERS
- **Ruling:** <the value/formula/rule, paraphrased>
- **Sources:** <RULES-FAQ id; file:line (p. NN)>
- **Decision:** <owner's ruling + date, if any; else "none">
- **Used by:** <ticket ids>
```

Tell the user Phase 1 is complete and you are handing off to the planner.

## Phase 2 — Plan (feature-planner subagent)

Spawn the `feature-planner` subagent with the folder path. It reads `tickets.md`
and `qa-log.md` and writes `plan.md` and `brief.md`. Keep its id: you continue it
with `SendMessage` (load via ToolSearch `select:SendMessage` if deferred) rather
than spawning a fresh planner — it already holds the folder and docs.

- If the planner's report contains `NEEDS_RULES: <question>` lines, run the
  `rule-agent` (slug as context), append each answer to `rules.md`, handle any
  non-answered `Status:` as in "Rules grounding", then `SendMessage` the new rules to the same planner.
- If it contains `NEEDS_HUMAN: <question>` lines, **stop**: ask the user each
  question (one at a time), append the answers to `qa-log.md`, then `SendMessage` them to the same
  planner. Repeat only as needed.

## Phase 3 — Review (feature-plan-reviewer subagent), single pass

Spawn `feature-plan-reviewer` with the folder path. It writes
`plans/<slug>/review.md`. Handle `NEEDS_RULES:` and `NEEDS_HUMAN:` lines as in
Phase 2.

## Phase 4 — Revise (feature-planner subagent), one revision

`SendMessage` the same `feature-planner` (revise mode), telling it to read `review.md`,
revise `plan.md` and regenerate `brief.md`. Where it disagrees with a finding it records that under
`## Review responses`. This is the **single review pass** — do not loop further.

## Phase 5 — Report back (you, to the user)

Summarize in chat:

- the ticket count and one line each, with each ticket's tier,
- any Tier-1 item that is `BLOCKED` or still lacks sign-off,
- the number of implementation items in the plan,
- the rules brief: how many rules, and any owner `Decision`s (house rules or
  homebrew) made along the way,
- reviewer findings accepted vs. disputed,
- any remaining open questions.

`plan.md` carries `status: draft` frontmatter (written by the planner); you leave
it as `draft` — the owner moves it on by running `/build-feature`.

If the feature came from a backlog item, set its Status line to
`- **Status:** 📋 planned (<today>)` — unless a Tier-1 ticket is still
`BLOCKED`, in which case leave it at `📝 planning` and say so in the summary.

**Token report.** Run, with the `<since>` from Setup (it totals the main session
and every subagent transcript since then):

```bash
node tools/token-report.mjs --workflow new-feature --since <since> --dir plans/<slug>
```

It writes `plans/<slug>/token-usage.{md,json}`; add its one-line result (tokens
and estimated cost) to the summary. The figures are an estimate; see
[docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md) "Token usage report".

Point them at `plans/<slug>/{tickets.md, rules.md, plan.md, qa-log.md, review.md,
token-usage.md}`, then send `plan.md` to the user with SendUserFile.

Do **not** commit or push anything. Leave the files (including `token-usage.*`) on the working tree.

## qa-log.md format

Append one block per exchange, newest at the bottom:

```markdown
## <ISO datetime> — asked by <interrogator|planner|reviewer>
**Q:** <question>
**A:** <user's answer>
```

This log is the record of everything the human contributed, including Tier-1
sign-offs. The planner mirrors its key learnings into `plan.md`.
