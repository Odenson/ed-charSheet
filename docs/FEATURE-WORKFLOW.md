# Feature workflow — `/new-feature` and `/build-feature`

Two Claude Code slash commands deliver a feature in order: plan it, then build
it. Adapted from the portable agent-workflow design to this repo's tiers,
`npm test` gate and `plans/` folder. The commands and subagent prompts are the
source of truth for exact behavior; this doc is the map. Claude Code only — the
orchestrators are not ported to OpenCode.

Governing rules: [GUARDRAILS.md](GUARDRAILS.md) (tiers, sign-off, PR checklist),
[CLAUDE.md](../CLAUDE.md). Tooling map: [AI-WORKFLOWS.md](AI-WORKFLOWS.md).

## Overview

| Order | Command | Orchestrator | Purpose | Produces |
|---|---|---|---|---|
| 1 | `/new-feature [name]` | Interrogator | Interview the owner, classify tickets by tier, produce a reviewed plan | `tickets.md`, `qa-log.md`, `plan.md`, `review.md` |
| 2 | `/build-feature [slug]` | Dev Lead | Spec, test-first build, review, doc sync, PR to `main` | `spec.md`, `test-plan.md`, `build-log.md`, code, tests, PR |

All artifacts live in `plans/<slug>/` (kebab-case slug), the shared context for
every participant. The older flat `plans/PLAN-*.md` files are history.

**Orchestrators** run in the main session and are the only participants who can
ask the owner questions, **one at a time**. **Subagents** run non-interactively;
when they need a human decision they end their report with `NEEDS_HUMAN: <q>`,
and the orchestrator asks, appends to `qa-log.md` and re-spawns them.

## Roster

| Agent | Source | Invoked by | Writes |
|---|---|---|---|
| Interrogator | `.claude/commands/new-feature.md` | owner | `tickets.md`, `qa-log.md` |
| `feature-planner` | `.agents/feature-planner.md` | `/new-feature` | `plan.md` |
| `feature-plan-reviewer` | `.agents/feature-plan-reviewer.md` | `/new-feature` | `review.md` (no other files) |
| Dev Lead | `.claude/commands/build-feature.md` | owner | `build-log.md`, `qa-log.md`, PR |
| `feature-designer` | `.agents/feature-designer.md` | `/build-feature` | `spec.md` |
| `feature-tester` | `.agents/feature-tester.md` | `/build-feature` | test files, `test-plan.md` |
| `feature-dev` | `.agents/feature-dev.md` | `/build-feature` | source, data, docs, changelog line, commit |
| `design-agent` | `.agents/design-agent.md` | `/build-feature` | nothing (proposes doc edits; Dev Lead applies) |
| `rule-agent` | `.agents/rule-agent.md` | Interrogator | `docs/RULES-FAQ.md` only |

The five `feature-*` subagents are Claude-only (no `.opencode.yml` fragment).
Edit `.agents/`, then `node tools/sync-agents.mjs`.

## Flow 1 — `/new-feature` (no code, no commits)

1. **Setup** — derive slug, create `plans/<slug>/`, read CLAUDE.md, GUARDRAILS.md
   and relevant docs, load the `ed-change-guardrail` skill.
2. **Interrogation** — one question at a time, broad to narrow, logged to
   `qa-log.md`. Earthdawn rules questions go to `rule-agent`. Each ticket gets a
   tier; each **Tier-1** ticket needs explicit owner sign-off (quote the rule,
   offer a Tier-3 alternative) or is marked `BLOCKED`. Ends with `tickets.md`.
3. **Plan** — `feature-planner` (draft) writes `plan.md` with a guardrail
   classification section and a tier on every item.
4. **Review** — `feature-plan-reviewer`, single pass, writes `review.md`. An
   unsigned Tier-1 item, or a Tier-2 item missing a migration step, is a
   **blocker**.
5. **Revise** — `feature-planner` (revise) fixes each finding or records a
   dispute under `## Review responses`.
6. **Report** — ticket list with tiers, blocked items, finding counts, open
   questions; `plan.md` is sent to the owner.

## Flow 2 — `/build-feature` (build and PR)

| Phase | Who | What |
|---|---|---|
| 0. Alignment | Dev Lead + owner | Read folder; **refuse any Tier-1 item without recorded sign-off**; clear open questions; note unrelated tree changes |
| 1. Spec | `feature-designer` | `spec.md`: guardrail alignment, data, modules, UI/dispatch behavior, edge cases, testability, changelog line |
| 2. Tests first | `feature-tester` (author) | `node:test` `*.test.js` files + `test-plan.md`; expected to fail. Dev Lead snapshots them |
| 3. Build | `feature-dev` (build) | Implement to spec; all tester tests plus `npm test` green; commit |
| 3b. Adjudication | `feature-tester` (adjudicate) | Only on `NEEDS_TESTER`; one cycle |
| 4. Review | Dev Lead (+ `feature-dev` revise, once) | Spec, golden rule, tiers, UI rules, quality, real gate status |
| 5. Doc sync | `design-agent`, applied by Dev Lead | Doc edits go in the commit; Tier-1/2 doc edits only if signed off, else listed in the PR |
| 6. Ship | Dev Lead | Test-snapshot diff, gate green, finalize commit, push `dev`, PR `dev → main`, **do not merge** |

### Signals

| Signal | From | Orchestrator response |
|---|---|---|
| `NEEDS_HUMAN: <q>` | any subagent | Ask the owner, log in `qa-log.md`, re-spawn |
| `NEEDS_TESTER: <test>::<case> — <problem>` | `feature-dev` | Phase 3b, one cycle |
| `TESTER_UPDATED: <what/why>` | `feature-tester` | Re-snapshot tests; dev finishes |
| `TESTER_REJECTED: <why>` | `feature-tester` | Dev makes the code satisfy the test |

### Gate and UI verification

The gate is `npm test` (`node --test`; `pretest` runs `tools/check-imports.mjs`).
There is no browser test harness and agents never open the preview: UI changes
are verified by the owner, from the manual checklist the Dev Lead puts in the
PR (what to look at, light and dark mode, mobile fold, Overview viewport fit).

## Rules of the road

- **Bounded loops.** One plan review pass, one tester adjudication, one Dev Lead
  revision. If still unresolved, stop and report.
- **Test integrity.** `feature-dev` never edits, skips or weakens the tester's
  tests; the Dev Lead diffs against the snapshot before shipping.
- **Git.** Only inside `/build-feature`: `feature-dev` commits, only the Dev Lead
  pushes to `dev` and opens the PR, stage by explicit path (never `git add -A`),
  scoped to the feature. PR-only to `main`; the owner approves and merges.
  `/new-feature` never commits.
- **Changelog.** User-visible features add one line to `data/changelog.json`
  `unreleased.changes`; the release entry is cut by hand at promotion.
- **Guardrails.** Subagents load `ed-change-guardrail` before touching a
  protected surface, so the first-edit hook does not stall a build.

## Feature folder

| File | Written by | Phase |
|---|---|---|
| `tickets.md` | Interrogator | `/new-feature` 2 |
| `qa-log.md` | any orchestrator (append-only) | throughout |
| `plan.md` | `feature-planner` | `/new-feature` 3, 5 |
| `review.md` | `feature-plan-reviewer` | `/new-feature` 4 |
| `spec.md` | `feature-designer` | `/build-feature` 1 |
| `test-plan.md` | `feature-tester` | `/build-feature` 2, 3b |
| `build-log.md` | Dev Lead, `feature-dev` | `/build-feature` 0–6 |

`qa-log.md` entry format:

```markdown
## <ISO datetime> — asked by <interrogator|planner|reviewer|dev-lead|designer|tester|dev>
**Q:** <question>
**A:** <answer>
```
