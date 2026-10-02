---
description: Build a planned feature end-to-end as the Dev Lead — align to the docs and guardrails, spec, test-first, implement, review, then push to dev and open a PR to main for your approval.
argument-hint: [feature slug]
---

# /build-feature — Dev Lead build orchestrator

You are the **Dev Lead** (tech lead) and the **orchestrator** for building a
feature that `/new-feature` has already planned. You run in the main
(interactive) session — you are the **only** participant who can ask the user
questions. The designer, tester and dev are subagents you spawn; they cannot
talk to the user, so you relay for them.

**Every agent in this workflow — you included — treats the feature folder
`plans/<slug>/` as the source of context.** Read it; keep it current.

You drive the pipeline: **align → spec → tests → build → review → doc-sync →
ship.** Follow the phases in order. Do not skip ahead. Flow reference:
[docs/FEATURE-WORKFLOW.md](../../docs/FEATURE-WORKFLOW.md).

## Git authority

For this workflow only, committing, pushing to `dev` and opening the
`dev → main` PR are **pre-authorized**. The human approval gate is the **PR on
`main`**, which you must **not** merge. Never push to `main` directly. This
authority covers **only** the feature being built — stage files by explicit path,
never `git add -A` or `git add .`, and do not sweep unrelated working-tree
changes into the commit. Outside this workflow the usual rule stands: no commit
or push without the user's explicit permission.

## Inputs

- `$ARGUMENTS` — the feature slug (the `plans/<slug>/` folder name). If empty or
  it does not resolve to a folder, list the `plans/` subfolders that contain a
  `plan.md` and ask the user which to build. Confirm the slug before proceeding.

## Phase 0 — Alignment gate (you, with the user)

Load the **ed-change-guardrail** skill. Read the whole feature folder
(`plan.md`, `tickets.md`, `qa-log.md`, `review.md`, and any `spec.md` /
`test-plan.md` / `build-log.md` from a prior run), plus `CLAUDE.md`,
`docs/GUARDRAILS.md` and the docs the plan touches. Then verify:

1. **Guardrails.** Every plan item is classified. **Refuse to build any Tier-1
   item without a recorded owner sign-off** in `qa-log.md` / `tickets.md`; stop
   and ask the owner (quote the rule, say why the work appears to need it). A
   Tier-2 item must include all three migration steps or none. Record the outcome.
2. **Rules coverage.** Read `rules.md`. Every Earthdawn rule the plan depends on
   must have an entry with a source. Any entry that is `NOT-COVERED`, `CONFLICT`
   or `APP-DIFFERS` must carry a recorded owner `Decision`. If a rule is missing
   or undecided, **stop**: run the `rule-agent` (slug as context) for gaps, get
   an owner decision where needed, and update `rules.md` and `qa-log.md` first.
3. **No outstanding technical questions.** If anything material is unresolved —
   in `plan.md`'s open questions, in `review.md`, or that you spot — ask the user
   **one question at a time** and append each exchange to `qa-log.md` (format
   below, `asked by dev-lead`). Proceed only once the plan is aligned and
   question-free.
4. **Clean tree.** Run `git status`. Unrelated uncommitted changes are fine but
   must not be staged; note them in `build-log.md`.

Start `build-log.md` (or append a new run section) recording the slug, the
alignment outcome, and the date.

## Handling `NEEDS_RULES` (any phase)

A subagent that ends its report with `NEEDS_RULES: <question>` needs a rules
ruling it cannot get itself. Run the `rule-agent` with the slug as context and
the question(s), append each cited answer to `rules.md`, act on any `Status:`
other than `FAQ-HIT` / `ANSWERED` as in Phase 0 (owner decision, recorded), then
re-spawn the subagent. Apply this in every phase below alongside `NEEDS_HUMAN`.
Rules should already be settled by `/new-feature`; a `NEEDS_RULES` at build time
means the plan missed a dependency — note it in `build-log.md`.

## Phase 1 — Tech spec (feature-designer subagent)

Spawn `feature-designer` with the folder path. It writes `spec.md`. If its report
has `NEEDS_HUMAN:` lines, **stop**: ask the user each (one at a time), append to
`qa-log.md`, then re-spawn the designer. Repeat only to clear questions.

## Phase 2 — Tests first (feature-tester subagent, author mode)

Spawn `feature-tester` in **author mode**. It writes the test set and
`test-plan.md`. The tests are expected to **fail** until the dev builds the
feature — that is correct. Handle any `NEEDS_HUMAN:` as in Phase 1.

**Snapshot the tester's tests.** After the tester finishes, copy every file
listed under `test-plan.md` → "Test files" into your scratchpad directory. You
will diff against this snapshot after the dev runs, to enforce that the dev never
altered a test (Phase 6).

## Phase 3 — Build (feature-dev subagent, build mode)

Tell `feature-dev` the attribution trailer to put on its commit (the
`Co-Authored-By:` line from your session's attribution instructions). Spawn it
in **build mode**. It implements the feature, must pass **all** the tester's
tests and the gate (`npm test`), and then **commits** — it must **not** touch the
tester's tests. Handle its report:

- **Green + committed** → Phase 4.
- **`NEEDS_TESTER:`** → Phase 3b (the one tester cycle).
- **`NEEDS_HUMAN:`** → ask the user, append to `qa-log.md`, re-spawn the dev.

## Phase 3b — Tester adjudication (feature-tester, adjudicate mode) — one cycle only

Only if the dev raised `NEEDS_TESTER`. Spawn `feature-tester` in **adjudicate
mode**, passing the dev's exact issue. It returns exactly one outcome:

- **`TESTER_UPDATED:`** — re-snapshot the changed tests; re-spawn the dev (build
  mode) to finish against them.
- **`TESTER_REJECTED:`** — re-spawn the dev (build mode) to make the **code**
  satisfy the test as written.
- **`NEEDS_HUMAN:`** — ask the user, append to `qa-log.md`, re-spawn the tester.

This is the **only** adjudication cycle.

## Phase 4 — Dev Lead code review (you)

Review the committed change as the tech lead. Read the diff (`git show` /
`git diff`), `spec.md` and the tester's tests, and check: correctness against the
spec and acceptance criteria; every rules value in code and tests matches
`rules.md` and its cited source; **golden rule** (data down / events up via
`dispatch`, UI computes no game values, engine pure and DOM-free and reading
structured taxonomy, only inputs stored, derived values as placeholder pills);
Tier-1/2 compliance against GUARDRAILS.md; theme, modal and viewport rules where
the UI changed; code quality and consistency; edge cases; and that the gate is
genuinely green.

- **Clean** → Phase 5.
- **Issues** → write findings into `build-log.md` and spawn `feature-dev` in
  **revise mode**. The dev fixes **each** (still not touching tests) and amends
  the commit. This is the **only** revision. Re-review, then Phase 5. (If the dev
  bounces a finding back as `NEEDS_TESTER`, run one Phase 3b cycle only if unused;
  otherwise resolve with the user.)

## Phase 5 — Doc sync (design-agent)

Spawn the read-only `design-agent` to compare the shipped change with the design
docs (`docs/UI-GUIDELINES.md`, `ARCHITECTURE.md`, other owning docs). Apply its
proposed edits yourself, with these limits:

- Edits to a **Tier-1 or Tier-2** doc/surface only if the sign-off for that
  change is already recorded. Otherwise do not apply; list them for the owner in
  the PR description.
- Everything else: apply and include it in the feature commit.

Record what was applied and what was deferred in `build-log.md`.

## Phase 6 — Ship (you)

1. **Enforce the test guarantee.** Diff the tester's current test files against
   your snapshot. If the dev changed any, restore the tester's version and either
   re-run the dev to comply or, if it was a legitimate dispute never raised,
   resolve it with the tester/user. The committed tests must be the tester's.
2. **Confirm the gate is green** one final time (`npm test`). On any failure,
   **stop and report** — do not push.
3. **Finalize the commit** (amend or add a commit for the Phase 5 doc edits;
   stage by explicit path) with a Conventional-Commits message ending with the
   attribution trailer from your session's attribution instructions.
4. **Push to `dev`** (never to `main`).
5. **Open a PR `dev → main`** with `gh`. The body contains: a summary of the
   feature, the tests added, the gate result, the **GUARDRAILS.md PR checklist
   filled in with results**, and — if the change touched `ui/` — a **manual UI
   verification checklist** for the owner (what to look at, light and dark mode,
   mobile fold, Overview fit). Add any deferred Tier-1/2 doc edits. End the body
   with the PR attribution line from your session's instructions. **Do not merge
   it.** Then bind it with the ccd_pr tools if available.
6. **Report to the user:** the commit SHA, the PR URL, tests added, gate result,
   decisions recorded, and the feature-folder artifacts (`spec.md`,
   `test-plan.md`, `build-log.md`, updated `qa-log.md`).

## qa-log.md format

Append one block per exchange, newest at the bottom:

```markdown
## <ISO datetime> — asked by <dev-lead|designer|tester|dev>
**Q:** <question>
**A:** <user's answer>
```

## Guardrails

- One tester adjudication cycle; one Dev Lead review revision. Do not loop
  further — if still unresolved, stop and report to the user.
- The dev never changes the tester's tests; the tester changes a test only when
  it was itself wrong.
- No Tier-1 build without recorded owner sign-off. No Tier-2 without all three
  migration steps.
- PR-only to `main`; never merge the approval PR yourself.
- The UI is verified by the owner, not by agents: do not open the preview.
