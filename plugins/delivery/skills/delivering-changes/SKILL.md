---
name: delivering-changes
description: Runs the implement, review, and deliver stages of an approved plan through Worker and Reviewer subagents with gates between stages. Use when a plan with slices, or a bounded task, is ready to implement and the person wants the whole loop run — each slice built with TDD, reviewed independently, evidence collected, and a pull request prepared — instead of one agent editing code. Not for exploring a problem or writing the plan.
effort: medium
---

# Delivering Changes

## Overview

This skill runs the Controller role of the company delivery loop (software guide §3.3) for the stages after planning: implement in slices, review, verify, deliver. Workers implement, Reviewers judge, humans approve. Nothing crosses a stage boundary except a brief going down and a handoff coming back; your own context never does. That is what keeps Reviewers independent and your context small.

**Core principle:** One slice at a time, one role at a time, and a gate between every two stages.

## Step 0: Inputs and classification

You need a plan with slices (the `writing-plans` format) or a bounded task, the spec or acceptance criteria, the verification command, and the risk tier (Prototype, Production, Critical).

- **Bounded task** — describable in one sentence, a handful of files: treat it as a single slice.
- **Multi-file work without a plan** — stop. Say so and use `writing-plans` first; this skill does not plan, and the Controller does not spawn Workers to compensate for an ambiguous spec (§3.3).

Confirm with the person before dispatching anything: the slices, the allowed files per slice, the verification command, the tier, and the branch. This is the plan gate (§3.6). When a slice specifies a formula or a scoring rule, run it by hand on the spec's own edge cases before approving: an inconsistency found here costs one line, found in review it costs a cycle.

## Step 1: Preconditions

- Not on `main`: create a branch, or use `using-git-worktrees` when isolation is needed.
- Clean tree: `git status --short` is empty.
- Baseline green: run the verification command once and record the result. A red baseline is reported, not inherited.

## Step 2: Implement a slice

Record `BASE=$(git rev-parse HEAD)`. Dispatch a `worker` subagent (the `delivery` plugin's agent) with this brief and nothing else. On Prototype tier pass `model: sonnet` in the dispatch; on Production and Critical tiers let it inherit the session's model.

```text
Slice: <id and one-line goal>
Acceptance criteria: <from the plan>
Allowed files: <explicit list>
Constraints: <what must not change; public names; contracts>
Expected failing test: <name and what it asserts>
Verification command: `<exact command>`
Output: the handoff YAML from your instructions
```

When the handoff returns:

- `status` must be `verified` or `blocked`. Anything else goes back.
- `files_changed` must be within the allowed files. Check `git status --short` yourself; the handoff is a claim.
- Run the verification command yourself. The Worker's stop gate already ran it, and the handoff gate re-runs it when the Worker returns and tells you it passed; you confirm. The gates run the brief's backticked command in the session directory; without one they detect the runner in the project of each changed file. A gate that reports a configuration error did not verify anything. A Worker launched in the background meets the handoff gate only through its stop gate, so run the verification yourself when its notification arrives.
- **Scope escape** (files outside the brief, unrequested changes): don't accept the slice. Restore the extra files, or re-dispatch with a narrower brief, or ask the person if the plan was wrong.
- **`blocked`**: read the reason. A missing input is yours to supply; a plan flaw is the person's decision. Don't fix it by widening the Worker's scope silently.

Then commit the slice: `git add <files_changed> && git commit -m "<slice id>: <goal>"`.

## Step 3: Review the slice

Dispatch a `reviewer` subagent with: the spec or acceptance criteria, the plan slice, `BASE_SHA`/`HEAD_SHA`, the Worker's handoff, the declared risks, and the tier. Nothing else.

- **Critical or Important findings**: dispatch a `worker-high` (the same Worker at high effort) with a fix brief (the findings, file and line, allowed files), commit, and re-dispatch the `reviewer` on the delta only.
- **Two fix cycles without a clean verdict**: stop and ask the person. This is the architecture or security gate (§3.6), not a reason for a third attempt.
- **Minor**: record under `remaining_risks`; don't spend a cycle on them.

Never fix a finding yourself. The Controller that edits code has become a Worker reviewing its own work.

## Step 4: Next slice

Repeat Steps 2 and 3 for each slice. Run Workers in parallel only when the plan says the slices are independent, they touch different files, each has its own test, and the contracts between them are already defined (§3.7). Two Workers never share a file, and a Reviewer never runs while a Worker is editing: reviews run the verification command on the tree they see, so a concurrent edit turns their evidence into noise.

## Step 5: Deliver

1. For more than one slice, dispatch a final `reviewer` over the whole range with the focus on integration between slices.
2. Run the full verification yourself (`verification-before-completion`).
3. Use `finishing-a-development-branch`: present its options; pushing, opening the pull request, merging, or discarding waits for the person's choice. The plugin's gate prompts for those commands in any case.
4. Fill the pull request template from the handoffs: *Cambios* from `scope` and `files_changed`, *Verificación* from `tests` and `evidence`, *Riesgos y operación* from `remaining_risks`, and *Trazabilidad* from the plan and spec.

## Report

The final message is the aggregated handoff, then where the work is:

```yaml
task: <plan or task name>
status: verified | blocked
slices:
  - id: <slice>
    status: verified
    review: <verdict line>
files_changed: [...]
tests: [...]
decisions: [...]
evidence: [...]
remaining_risks: [...]
```

followed by the branch, the pull request URL if one was opened, and the open questions for the person.

## Gates

| Between | Gate | Enforced by |
| --- | --- | --- |
| Plan → implement | Person confirms slices, files, command, tier | You, in Step 0 |
| Worker finishing → handoff | Verification passes | Worker stop hook (`verify.sh` on `SubagentStop`) |
| Handoff → commit | Verification re-run; files within scope | Handoff hook (`verify.sh` on the Worker's `Agent` result) and you, in Step 2 |
| Commit → next slice | No Critical or Important findings | Reviewer verdict |
| Deliver → push, PR, merge | Person chooses | `finishing-a-development-branch` and the Bash gate (`gate.sh`) |

## Cost policy

An agent loop pays for context × turns, and cache reads cost a tenth of fresh input, so the rules are about context size, turn count, and cache stability:

- Every role runs at `medium` effort, pinned in the agents and in this skill; only the fix cycle runs a `worker-high`. Measured on SWE-bench Pro, `medium` keeps default accuracy at 13–31% fewer tokens, and re-running only failures at higher effort keeps the pass rate at about half the cost.
- Workers run on Sonnet for Prototype work and inherit the session's model otherwise; the Reviewer inherits. Never change model or effort in the middle of a slice: it re-bills the whole cached context.
- Briefs carry line ranges when the plan has them; handoffs stay under about 2,000 tokens; reviews return the verdict and Important findings in full and Minor findings as one line each. Everything the Controller receives is re-read on each of its later turns.
- Judge any change to this loop by cost per verified slice at equal pass rate (`evals/lib/usage.py`), not by token counts.

## Without the plugin

The skill also runs with generic subagents, but four things degrade: the Worker's stop gate, the Reviewer's read-only guard, the approval prompt for outward commands, and the effort pins. Compensate by running the verification command after every handoff, by stating in the reviewer brief that it must not edit, and by never running push, PR, deploy, or state-changing commands without asking.

## Red flags

| Thought | Reality |
| --- | --- |
| "The handoff says verified" | A claim. Check the diff and run the command. |
| "Too small a slice to review" | Small slices are cheap to review and expensive to debug later. |
| "I'll fix the reviewer's finding myself" | Then the fix has no independent review. Dispatch a Worker. |
| "The spec is ambiguous; more Workers will sort it out" | §3.3: stop and ask. Agents don't resolve ambiguity, they multiply it. |
| "Push now, the PR can be fixed later" | The push is the person's decision; the gate asks for a reason. |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog, as the orchestrator of the `delivery` plugin. No upstream source; the roles, gates, parallelism rules, and handoff format follow §3 of the company software guide, and the loop reuses `writing-plans`, `using-git-worktrees`, `reviewing-pull-requests`, `verification-before-completion`, and `finishing-a-development-branch`.
