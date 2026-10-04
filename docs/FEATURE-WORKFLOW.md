# Feature workflow — `/new-feature`, `/build-feature`, `/release-feature`

Three Claude Code slash commands deliver a feature in order: plan it, build it,
then (after the owner has tested it) release it. Adapted from the portable agent-workflow design to this repo's tiers,
`npm test` gate and `plans/` folder. The commands and subagent prompts are the
source of truth for exact behavior; this doc is the map. Claude Code only — the
orchestrators are not ported to OpenCode.

Governing rules: [GUARDRAILS.md](GUARDRAILS.md) (tiers, sign-off, PR checklist),
[CLAUDE.md](../CLAUDE.md). Tooling map: [AI-WORKFLOWS.md](AI-WORKFLOWS.md).

## Overview

| Order | Command | Orchestrator | Purpose | Produces |
|---|---|---|---|---|
| 1 | `/new-feature [name]` | Interrogator | Interview the owner, classify tickets by tier, produce a reviewed plan | `tickets.md`, `qa-log.md`, `plan.md`, `review.md`, `token-usage.md` |
| 2 | `/build-feature [slug]` | Dev Lead | Spec, test-first build, review, doc sync, push to `dev` | `spec.md`, `test-plan.md`, `build-log.md`, code, tests, commit on `dev`, `token-usage.md` |
| 3 | `/release-feature [slug]` | Release Manager | After the owner has tested: finalize the changelog, release PR, squash-merge, sync `dev` | changelog entry, plans `shipped: vX.Y.Z`, merged release PR, `token-usage.md` |

All artifacts live in `plans/<slug>/` (kebab-case slug), the shared context for
every participant. The older flat `plans/PLAN-*.md` files are history.

**Orchestrators** run in the main session and are the only participants who can
ask the owner questions, **one at a time**. **Subagents** run non-interactively;
when they need a human decision they end their report with `NEEDS_HUMAN: <q>`,
and the orchestrator asks, appends to `qa-log.md` and re-spawns them. When they
need an Earthdawn rules ruling they end with `NEEDS_RULES: <q>` instead; the
orchestrator gets it from `rule-agent` (subagents cannot spawn agents).

## Roster

| Agent | Source | Invoked by | Writes |
|---|---|---|---|
| Interrogator | `.claude/commands/new-feature.md` | owner | `tickets.md`, `qa-log.md` |
| `feature-planner` | `.agents/feature-planner.md` | `/new-feature` | `plan.md` |
| `feature-plan-reviewer` | `.agents/feature-plan-reviewer.md` | `/new-feature` | `review.md` (no other files) |
| Dev Lead | `.claude/commands/build-feature.md` | owner | `build-log.md`, `qa-log.md` |
| `feature-designer` | `.agents/feature-designer.md` | `/build-feature` | `spec.md` |
| `feature-tester` | `.agents/feature-tester.md` | `/build-feature` | test files, `test-plan.md` |
| `feature-dev` | `.agents/feature-dev.md` | `/build-feature` | source, data, docs, changelog line, commit |
| `design-agent` | `.agents/design-agent.md` | `/build-feature` | nothing (proposes doc edits; Dev Lead applies) |
| `rule-agent` | `.agents/rule-agent.md` | Interrogator (rules sweep), either orchestrator on `NEEDS_RULES` | `docs/RULES-FAQ.md` only |

The five `feature-*` subagents are Claude-only (no `.opencode.yml` fragment).
Edit `.agents/`, then `node tools/sync-agents.mjs`.

## Flow 1 — `/new-feature` (no code, no commits)

1. **Setup** — derive slug, create `plans/<slug>/`, read CLAUDE.md, GUARDRAILS.md
   and relevant docs, load the `ed-change-guardrail` skill.
2. **Interrogation** — one question at a time, broad to narrow, logged to
   `qa-log.md`. Earthdawn rules questions go to `rule-agent`, never to the owner
   first. Each ticket gets a tier; each **Tier-1** ticket needs explicit owner
   sign-off (quote the rule, offer a Tier-3 alternative) or is marked `BLOCKED`.
   Ends with `tickets.md`.
   **Rules grounding:** before tickets are final, the Interrogator lists every
   Earthdawn rule the feature depends on (including values tests will assert),
   batches them to `rule-agent`, and records the answers in `rules.md`.
   `NOT-COVERED`, `CONFLICT` and `APP-DIFFERS` results go to the owner, and the
   answer is recorded as a house rule or homebrew entry (`Decision:` on the FAQ
   entry). Planning does not start with an unresolved rule.
3. **Plan** — `feature-planner` (draft) writes `plan.md` with a guardrail
   classification section, a rules-dependencies section, and a tier and rule
   ids on every item.
4. **Review** — `feature-plan-reviewer`, single pass, writes `review.md`. An
   unsigned Tier-1 item, a Tier-2 item missing a migration step, or a rules
   claim with no cited `rules.md` entry (or built on an undecided
   `NOT-COVERED`/`CONFLICT`/`APP-DIFFERS`) is a **blocker**.
5. **Revise** — `feature-planner` (revise) fixes each finding or records a
   dispute under `## Review responses`.
6. **Report** — ticket list with tiers, blocked items, finding counts, open
   questions; `plan.md` is sent to the owner.

## Flow 2 — `/build-feature` (build and push to `dev`)

| Phase | Who | What |
|---|---|---|
| 0. Alignment | Dev Lead + owner | Read folder; **refuse any Tier-1 item without recorded sign-off**; **verify `rules.md` covers every rule dependency, each undecided gap having an owner `Decision`**; clear open questions; note unrelated tree changes |
| 1. Spec | `feature-designer` | `spec.md`: guardrail alignment, data, modules, UI/dispatch behavior, rules table (cited), edge cases, testability, changelog line |
| 2. Tests first | `feature-tester` (author) | `node:test` `*.test.js` files + `test-plan.md`; expected rules values only from `rules.md`; expected to fail. Dev Lead snapshots them |
| 3. Build | `feature-dev` (build) | Implement to spec; all tester tests plus `npm test` green; commit |
| 3b. Adjudication | `feature-tester` (adjudicate) | Only on `NEEDS_TESTER`; one cycle |
| 4. Review | Dev Lead (+ `feature-dev` revise, once) | Spec, golden rule, tiers, UI rules, quality, real gate status |
| 5. Doc sync | `design-agent`, applied by Dev Lead | Doc edits go in the commit; Tier-1/2 doc edits only if signed off, else listed in `build-log.md` |
| 6. Ship | Dev Lead | Test-snapshot diff, gate green, finalize commit, push `dev`, owner handoff (checklists) in `build-log.md`. **No PR**; `/release-feature` opens it |

### Signals

| Signal | From | Orchestrator response |
|---|---|---|
| `NEEDS_HUMAN: <q>` | any subagent | Ask the owner, log in `qa-log.md`, re-spawn |
| `NEEDS_RULES: <q>` | any subagent | Run `rule-agent` (slug as context), append the cited answer to `rules.md`, get an owner decision for `NOT-COVERED`/`CONFLICT`/`APP-DIFFERS`, re-spawn |
| `NEEDS_TESTER: <test>::<case> — <problem>` | `feature-dev` | Phase 3b, one cycle |
| `TESTER_UPDATED: <what/why>` | `feature-tester` | Re-snapshot tests; dev finishes |
| `TESTER_REJECTED: <why>` | `feature-tester` | Dev makes the code satisfy the test |

### Gate and UI verification

The gate is `npm test` (`node --test`; `pretest` runs `tools/check-imports.mjs`).
There is no browser test harness and agents never open the preview: UI changes
are verified by the owner on `dev`, from the manual checklist the Dev Lead puts in
`build-log.md` and, in full, in the final message under "UI test requirements" (what to look at, light and dark mode, mobile fold, Overview viewport fit).

## Rules of the road

- **Bounded loops.** One plan review pass, one tester adjudication, one Dev Lead
  revision. If still unresolved, stop and report.
- **Test integrity.** `feature-dev` never edits, skips or weakens the tester's
  tests; the Dev Lead diffs against the snapshot before shipping.
- **Git.** The shared permission baseline (`.claude/settings.json`) allows
  `git add`, `git commit` and `git push origin dev`, so a `/build-feature` run
  proceeds without prompts; `git merge`/`pull` and `gh pr create`/`merge` still
  ask. Only inside `/build-feature`: `feature-dev` commits, only the Dev Lead
  pushes to `dev`; stage by explicit path (never `git add -A`), scoped to the
  feature. No PR at build time; the release PR is `/release-feature`'s.
  `/new-feature` never commits.
- **Changelog.** User-visible features add one line to `data/changelog.json`
  `unreleased.changes`; `/release-feature` turns them into the release entry.
- **Guardrails.** Subagents load `ed-change-guardrail` before touching a
  protected surface, so the first-edit hook does not stall a build.

## Flow 3 — `/release-feature [slug]` (release)

Run by the product owner **after** they have finished testing. The slug is
optional: **with a slug** that feature is the release headline (its plan must be
`implemented` + `shipped: unreleased`); **without** one it is a full release.
Either way everything unreleased on `dev` ships, because a squash of `dev`
cannot carve out one feature. There are no subagents; file logic is in
`tools/release.mjs` (tested by `tools/release.test.js`), the rest is git/gh.

| Phase | What |
|---|---|
| 0. Preflight | **Hard stops:** not on `dev`, dirty or ahead/behind `origin/dev`, `dev` missing `origin/main`, `npm test` red, CI red on the `dev` head, nothing unreleased, named slug not implemented + unreleased. |
| 1. Draft + one confirmation | Proposed version (patch if every change is `fixed`, else minor; never major unprompted), summary line, every change, plans to mark shipped, **warnings** (in-flight plans, unreleased lines with no plan, plans with no changelog line), and a reminder if `tools/worker/worker.js` changed (owner redeploys the Cloudflare worker). The owner confirms, edits the version or summary, or cancels. |
| 2. Finalize | `release.mjs apply` moves `unreleased` to a new top release and marks plans `shipped: vX.Y.Z`; `npm test`; commit by explicit path; push `dev`. |
| 3. Release PR | PR `dev → main` with the changelog as the body and the GUARDRAILS checklist; wait for checks; **squash-merge** with the changelog entry as the commit message. |
| 4. Sync | Merge `origin/main` into `dev`, push, verify the trees match. |
| 5. Report | Version, PR, merge commit, plans shipped, deploy run, worker reminder. |

Running the command is the owner's authorization for exactly these git actions
(changelog commit, push `dev`, release PR, squash-merge, sync). Never a direct push
to `main`, never `git add -A`, never force. The shared permission baseline still
prompts for push and merge; the owner approves those prompts. The only files it
edits are `data/changelog.json`, plan `shipped:` lines and the token-usage report.

## Token usage report

Each workflow ends by running `tools/token-report.mjs` with the start time it
recorded in its first step. The tool reads the Claude Code session transcript
(the most recently written one, or `--session <id>`) and the subagent transcripts
beside it, totals every assistant message at or after the start time, and records
one run in the feature folder:

| File | Content |
|---|---|
| `token-usage.json` | one record per workflow run (the source; re-running the same window replaces it) |
| `token-usage.md` | rendered: **total per workflow**, then per run a **by-model (mode)** table and a **by-participant** table (orchestrator and each subagent type, with spawn counts); columns Input, Output, Cache read, Cache write, Total tokens, Est. cost |

Where it lands: `/new-feature` and `/build-feature` write `plans/<slug>/` (the
build commits and pushes it as a follow-up to `dev`; `/new-feature` leaves it on
the tree with the other plan files). `/release-feature` writes `plans/<slug>/`
when given a slug, else `plans/releases/vX.Y.Z/`, and commits and pushes it to
`dev` as the last step. Runs accumulate in the same files, so a feature's folder
shows plan, build and release cost together.

Cost is an **estimate**: tokens per message times the list prices in
`tools/token-pricing.json` (per model; cache writes at 5m/1h rates; fast mode
doubled where it applies). Update that file when rates change; an unlisted model is
counted but not priced and the cost is then flagged as a lower bound. Output
tokens are the larger of the recorded count and a size estimate of what was
written, because transcripts under-record them; hidden thinking is not visible, so
output is a lower bound. A subscription plan bills differently from the API list
price. Tests: `tools/token-report.test.js`.

## Plan status

Every plan — legacy `plans/PLAN-*.md` and workflow `plans/<slug>/plan.md` —
starts with YAML frontmatter that is the authoritative status:

```yaml
---
status: draft | approved | building | implemented | superseded
shipped: v1.23.0 | unreleased      # required when implemented or superseded
supersededBy: PLAN-OTHER           # required when superseded
deferred: ["item left unbuilt"]    # optional
---
```

Lifecycle for workflow plans: the planner writes `status: draft`;
`/build-feature` sets `building` once alignment passes, then `implemented` with
`shipped: unreleased` in the feature commit; at release, `/release-feature` sets
`shipped: vX.Y.Z` on every plan that was `shipped: unreleased` (`design-agent` can
still report stragglers). `status` records what shipped; a plan whose design was
later replaced is `superseded`. Prose banners inside a plan may be historical —
the frontmatter wins. `tools/plans-status.test.js` (in `npm test`) enforces the
fields and that `shipped` names a real changelog release.

## Feature folder

| File | Written by | Phase |
|---|---|---|
| `tickets.md` | Interrogator | `/new-feature` 2 |
| `qa-log.md` | any orchestrator (append-only) | throughout |
| `rules.md` | Interrogator, Dev Lead (from `rule-agent` answers) | `/new-feature` 2; appended on `NEEDS_RULES` |
| `plan.md` | `feature-planner` | `/new-feature` 3, 5 |
| `review.md` | `feature-plan-reviewer` | `/new-feature` 4 |
| `spec.md` | `feature-designer` | `/build-feature` 1 |
| `test-plan.md` | `feature-tester` | `/build-feature` 2, 3b |
| `build-log.md` | Dev Lead, `feature-dev` | `/build-feature` 0–6 |
| `token-usage.md` / `.json` | `tools/token-report.mjs`, run by each orchestrator | end of every workflow |

`qa-log.md` entry format:

```markdown
## <ISO datetime> — asked by <interrogator|planner|reviewer|dev-lead|designer|tester|dev>
**Q:** <question>
**A:** <answer>
```
