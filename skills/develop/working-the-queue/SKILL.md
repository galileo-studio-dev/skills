---
name: working-the-queue
description: Execute mode of an unattended routine — runs the develop gate, counts free work-in-progress slots, takes the agent-ready issues in order and works each one with `working-an-issue`, then reports the queue. Use as the skill a scheduled executor routine runs ("run working-the-queue; project data at <paths>"), or with a list of issue keys a person chose. Has a dry run that only prints its decisions.
---

# Working the Queue

## Overview

One session works a batch of issues, one after another. Subagents cannot start subagents, so this session is `delivering-changes`'s Controller for every issue. The heavy work runs in fresh worker and reviewer subagents, and the session keeps only their handoffs. The volume comes from the work-in-progress ceiling, not from the schedule.

**Core principle:** never open more pull requests than people review. A merged pull request frees a slot; nothing else does.

## Steps

0. Read the project data and run the develop gate (`running-routines` §1–2) with the window from `### Queue`.
1. **Slots** = the work-in-progress ceiling minus the open pull requests whose head starts with the routine branch prefix, in every repository the caps name. Drafts count.
2. **Queue:** issues with the agent-ready label, without the blocked label, in the backlog or todo state, plus needs-HITL issues with an answer (`running-routines` §5). If the person gave keys, the queue is those keys, still filtered. Order:
   1. the develop issue from the gate;
   2. answered needs-HITL issues;
   3. priority;
   4. oldest first.
3. **Stop:**
   - with no slots and no develop issue to fix, report "<n> routine pull requests waiting for review" and the queue line, and stop;
   - with an empty queue, report "nothing to do" and stop.
4. Only now read each repository's `AGENTS.md`, and set up only the repositories an issue you take touches.
5. **Take** up to the number of slots. The develop issue takes one even when there are none. Work each issue with `working-an-issue`, one at a time, finishing one before the next. Skip an issue that is taken (`running-routines` §4) and say so; it does not use a slot.
6. **Report:**
   - pull requests opened;
   - questions asked (needs HITL);
   - issues blocked (needs-human);
   - issues skipped, and why;
   - the line `queue <n>/<cap>, oldest <KEY> (<days> days)`.

## Dry run

When the prompt says "dry run" and names a state directory, read the state from these files instead of CI, Git hosting and the tracker. Touch nothing and print exactly one fenced `json` block.

| File | Shape |
| --- | --- |
| `develop.json` | `{"<repo>": {"ci": {"head_sha", "run_head_sha" or null, "conclusion" or null}, "merged_prs": [{"number", "required_check": "success"\|"failure"\|"missing"}], "fast_checks": "pass"\|"fail"\|null, "fixable": true\|false\|null}}` |
| `pulls.json` | `[{"repo", "number", "head", "state"}]` |
| `issues.json` | `[{"key", "title", "priority", "created", "state", "labels", "description", "comments": [{"author": "person"\|"agent", "at", "body"}], "routine_branch", "claimed_by_other"}]` |

Output:

```json
{"gate": {"<repo>": "green|red-fixable|red-human"},
 "slots": 0,
 "take": ["KEY"],
 "skip": [{"key": "KEY", "reason": "..."}],
 "actions": [{"key": "KEY", "action": "work|ask|block", "why": "..."}],
 "stop": null}
```

`stop` is `null`, `"nothing to do"` or `"no slots"`. A develop issue the gate would file is named `NEW-DEVELOP-<repo>`. `actions` gives the outcome of `working-an-issue` §1 for every queued issue that is not skipped, so a dry run also shows the ask-or-block decision.

## Red flags

| Thought | Reality |
| --- | --- |
| "No slots, but this one is quick" | The ceiling exists because review is the bottleneck. Only the develop fix may exceed it |
| "I'll keep the last issue's details in mind for the next one" | Each issue starts from its own handoffs; carry nothing across |
| "The queue is long; I'll take more" | Slots, not queue length, set the volume |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source. Generalized from the Kura fixer routine (2026-10); the work-in-progress ceiling and the queue cap come from its shaping. Decisions: `docs/adr/0002-routines-contract.md`.
