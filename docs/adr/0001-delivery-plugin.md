# ADR 0001: Delivery plugin — roles, stages, and gates as executable units

Status: proposed. Date: 2026-09-16.

## Context

The company software guide defines three roles (Controller, Worker, Reviewer; §3.2), six human gates (§3.6), a seven-stage contract (§16.1), and a handoff format (§3.8). The skills catalog implements the stages as individual skills chained by prose ("REQUIRED SUB-SKILL"), which an agent can skip, and it has no way to restrict what a role may do: the same context that implements a change can review it, a Worker can report success with failing tests, and nothing stops an agent from pushing or applying infrastructure without asking.

## Decision

Add a `delivery` plugin to the catalog with three executable units:

- `skills/delivering-changes` — the Controller's orchestration of implement → review → deliver, one slice and one role at a time, with a gate between stages. It does not plan; it starts from a plan or a bounded task.
- `agents/worker.md` and `agents/reviewer.md` — the roles as subagents: preloaded skills, restricted tools (the Reviewer has no edit tools), inherited model.
- `hooks/hooks.json` — all enforcement, since plugin subagents ignore frontmatter `hooks` by design. `verify.sh` runs the project's verification twice per slice: on `SubagentStop` matched to `^delivery:worker$`, where exit 2 refuses to let the Worker finish red, and on `PostToolUse` for the `Agent` tool, where exit 2 tells the Controller not to accept a red handoff. `readonly.sh` denies tree- and history-changing Bash commands when `agent_type` is `delivery:reviewer`. `gate.sh` turns commands that deploy, publish, change shared state, or destroy work into a permission prompt for every agent, so §16.4's approvals are asked for even in auto-accept modes.

The Worker preloads only the discipline skills that apply to every slice (`learning-codebase-conventions`, `scoping-changes`, `test-driven-development`, `verification-before-completion`); the situational lenses and `systematic-debugging` load on demand. The Controller stays in the main session so human gates can be asked; it is not forked.

Planning stages (explore, specify, plan) are not orchestrated yet. Rule of two: they join the loop after the implement/review/deliver slice has been observed working on real tasks.

## Alternatives

- **Prompt chaining only** (a SKILL.md naming sub-skills per stage). Cheapest; already partly exists. Rejected as the sole mechanism because every gate stays advisory.
- **Workflow scripts** (Claude Code's Workflow tool: `pipeline`/`parallel` with typed handoffs). Deterministic and parallel, but heavier, opt-in per run, and it moves orchestration out of the skill format the catalog reviews. Kept as a later option for batch execution of independent slices.
- **A single agent with all skills.** Simplest; rejected because the guide's first antipattern is the implementer reviewing its own work.

## Consequences

- Roles become enforceable: the Reviewer's tool list and Bash guard, and the Worker's stop hook, hold regardless of prompt quality.
- Cost rises: each slice costs a Worker, a Reviewer, and the Reviewer's two sub-reviewers. Step 0 routes bounded tasks to a single slice; the loop is for multi-file work.
- The plugin depends on the catalog skills being installed (it preloads them by name) and on `jq` for the hooks.
- The catalog gains a `plugins/` directory, a marketplace manifest, and one more skill to keep in the README and the guide's §18 map.

## Risks

- Hook portability: the scripts assume `bash` and `jq`; `verify.sh` auto-detects the test command and allows the stop, with a warning, when it finds none.
- A Worker that cannot reach green could loop against the gate; Claude Code caps repeated blocks, and the Worker is instructed to save a patch, restore the tree, and report `blocked`.
- The documentation describes `SubagentStop` as informational (exit 2 not honored). On Claude Code 2.1.273 it does block, which the probe below shows; the `PostToolUse` handoff gate is the layer that holds if that changes.
- The Reviewer does both review passes itself and has no Agent tool: in the pilot, a Reviewer that dispatched sub-reviewers ended its turn before they returned. This also keeps every review command under the read-only guard.
- Preloaded skills add roughly 700 lines to each Worker's context.
- Verification runs twice per slice; on slow suites, `scripts/verify` should run the fast subset.

## Verification

- Hook scripts tested with synthetic hook input: `gate.sh` answers `ask` for `git push` and `terraform apply` and stays silent for `git diff`; `readonly.sh` denies `git commit` and `sed -i` for the reviewer and ignores other agents; `verify.sh` exits 2 on a red suite, 0 on green, and 0 for agents other than the Worker.
- Probes on Claude Code 2.1.273: frontmatter hooks on plugin agents never fire; `SubagentStop` matchers match the namespaced `agent_type` (`plugin:agent`) and exit 2 blocks the subagent, which continues and stops again with `stop_hook_active: true`; `PreToolUse` input inside a subagent carries `agent_type`; `PostToolUse` on `Agent` carries `tool_input.subagent_type` and its exit 2 message reaches the Controller.
- End-to-end run of `delivering-changes` on a fixture repository with a two-slice plan: two Workers, three Reviewers with six sub-reviews, two commits, six tests green, no push, report in the specified shape; repeated after the hook restructure to confirm the gates fire.
- Pilot on a real ticket (Linear GAL-1179 in `llmops-project`, 2026-09-16): three slices, four Workers (one fix cycle), five Reviewers, 113 tests green, only the five planned files changed, the ticket's acceptance table reproduced, nothing pushed; ~10 minutes, ~$12. Frictions fed back into this revision: the Reviewer no longer dispatches sub-reviewers, `rm -r` on temporary directories is allowed for red-on-base exports, the handoff gate reports a green verification to the Controller, and the skill warns against reviewing while a Worker edits and asks for a by-hand check of formulas at the plan gate.
