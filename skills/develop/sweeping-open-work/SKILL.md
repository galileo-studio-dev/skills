---
name: sweeping-open-work
description: Sweep mode of an unattended routine — for one person, reads their report document, runs the develop gate, collects red develop, red or conflicting pull requests, answered questions, stalled in-progress issues and branches left without a pull request, recovers what an agent may (fixes the pull request, or continues the issue with `working-an-issue` up to a draft pull request with CI green and a clean independent review), and rewrites the report after every item. Use as the skill a scheduled sweep routine runs ("run sweeping-open-work for <person>; project data at <path>"). Never merges and never starts todo or backlog work. Has a dry run that only prints its decisions.
---

# Sweeping Open Work

## Overview

Work gets left half-done: a pull request turns red or conflicts with the base, a question gets its answer, an issue in progress stalls, a branch never gets its pull request. A sweep finds that work for one person, recovers what an agent may, and keeps one report document per person in the tracker, so the person looks in one place even after skipping a day. The rules of `running-routines` hold throughout.

**Core principle:** recover, never start. The sweep finishes work already begun and keeps the report true after every item; new work goes to the tracker for an executor.

## Steps

1. **For whom.** Read the project data (`running-routines` §1). The sweep runs for one person: the one the payload names, otherwise the one the prompt names. Their issues are the ones assigned to the tracker user id `### Sweep` lists for them; names match case-insensitively, and a unique first name suffices. With no person, or one `### Sweep` does not list, touch nothing, say so in the final message and stop.
2. **Open the report.** One tracker document per person, titled as `### Sweep` says and written in the project language. Find it and read it whole: it is the memory of earlier runs (what was open, and since when). With two, use the newest and say so in the header; with none, create it.
   - If its header says another sweep is in progress and that sweep started less than 6 hours ago, stop. An older one was cut off: its claims no longer count (step 5).
   - Otherwise set the header to `In progress since <UTC time>, session <link>` (the session link of `running-routines` §4), read the document again, and go on only if the header is yours: when two sweeps start together, the last writer wins.
   - From here on, rewrite the document after every item, not only at the end: if the session dies, the report must still be true.

   A sweep that stops in steps 1–2 runs no gate and touches nothing.
3. **Develop gate** (`running-routines` §2), with the window from `### Sweep`. Red develop belongs to nobody, so every sweep handles it; a develop issue the sweep files is assigned to the person.
4. **Collect**, in this order:
   1. **Red develop:** the open `[BUG] develop red: <repo>` issue of each red repository, found or filed by the gate.
   2. **Pull requests** open with a red CI or conflicts with the base. Find an issue's pull requests by the link on the issue and by its key in their title or body, not by branch name.
   3. **Answered questions:** issues in needs HITL with an answer (`running-routines` §5).
   4. **Issues in progress** that are stalled (in the last 24 hours: no unclosed claim, no commit on their branches, no comment except this person's sweeps') or taken (step 5). One with a person's recent activity is live: leave it out.
   5. **Branches without an open pull request**, not merged into the base, with commits in the last 7 days, cloud session branches included. The key comes from the branch name or its commits. Skip a branch whose issue is in progress or was collected above.

   Kinds 2–5 are for the person's issues. An issue is one item together with its pull requests and branches: the first kind that collects it decides. Never collect an issue in todo or backlog, or its pull requests and branches: they are the executor's. The develop issue of kind 1 is the one exception. The same kinds for issues assigned to someone else or to nobody, and branches with no key whose last commit is not the person's, go to From others, untouched.
5. **Before touching** an item, in this order:
   - **Taken?** As `running-routines` §4 says for a sweep: the issue is taken when another agent session holds an unclosed claim from the last 24 hours, or its routine branch has commits from the last 24 hours by another session (this person's sweeps do not count), unless it is in needs HITL with an answer. A claim by a cut-off sweep for this person (step 2) does not count. Taken: In flight, untouched.
   - **Eligible?** Not when the issue has the needs-human or blocked label, when what is left fails the rubric (`running-routines` §3: a protected path, more than one pull request, something the cloud lacks), or when `### Sweep` says to only report it. Ineligible: For you, with what it lacks, untouched.
   - **Claim** it with one comment (`running-routines` §4, mode `sweep for <person>`). An issue in review stays in review: the claim is the comment only. It is also `working-an-issue`'s claim: never add a second. When done with the item, edit it to `Done: <what you did>`.
6. **Act** on each item, in collection order (within a kind, the previous report's For tomorrow items first, then oldest issue first):
   - **Red develop** (`fix-develop`): fix an agent-ready develop issue first, with `working-an-issue`. One labelled needs-human goes to For you, with the gate's push notification. While a repository's base is red, touch nothing else there: its other items go to For tomorrow.
   - **Red or conflicting pull request** (`fix-pr`): fix it on its own branch. Merge the base into it (never rebase or force) and fix what its change broke. Never open another pull request. If the issue left in review, move it back once CI is green, unless a tracker–Git integration does it (`running-routines` §6).
   - **Answered question or stalled issue** (`continue`): continue it with `working-an-issue` from where it is, on its branch and pull request when they exist. Its §1 still applies except the taken check, and its §2 claim is step 5's. Complete what it lacks (below) first; `### Issue` before-starting checks do not stop an issue already started. Stop at a draft pull request with CI green and a clean independent review (`working-an-issue`'s end).
   - **Branches** (kind 5) are never touched: they go to For you, for the person to open a pull request, keep or delete them.
   - Every pull request the sweep touches gets the title suffix from `### Sweep` with today's UTC date, added or updated at the end of its title.
   - A decision that belongs to a person: a question (`running-routines` §5), then the next item.
   - An issue it touches that lacks something (acceptance criteria, related issues, a section `### Issue` asks for): add it, marked as an agent proposal, without deleting anyone's text, and say so in the `Done` edit. When the gap needs a product decision, ask instead.
   - **New work** found on the way: search the tracker first, then file it in the backlog state with one fixability label (agent-ready or needs-human, `running-routines` §3), assigned to the person. Never start it.
   - Never merge, approve or force-push (`running-routines` §7). A push that fails because the branch moved goes to the report.
   - **Caps:** only the ones in `### Sweep`; `none` means go on until the list or the session ends. Items left when a cap is reached go to For tomorrow.
7. **Report:** the whole document, rewritten each time, in the project language.
   - **Header:** the person, the run's date and time, the session link, the base state of each repository.
   - **For you:** one row per open item: key or branch, what it is, what happened today (marked as today when it changed), since when it is open (copied from the previous report; today for a new item), and what the person must do: merge, answer, decide, or check on the deployed base (`## Surfaces` says where). Touched items join it once their work ends; items from the previous report stay while they are open.
   - **In flight:** what the sweep left because another session holds it.
   - **From others:** other people's items, each with what it lacks.
   - **For tomorrow:** what the run did not reach; the next sweep works these items first within their kind (step 6).

   Resolved items (merged or done) leave the list. With nothing open, say "nothing to collect".
8. **Finish.** Set the header to `Finished at <UTC time>`. The final message is three lines: how many items the sweep touched, how many wait for the person, and the document link.

## Dry run

When the prompt says "dry run" and names a state directory, read the state from these files instead of CI, Git hosting and the tracker. Write no document, claim nothing, touch nothing, and print exactly one fenced `json` block.

| File | Shape |
| --- | --- |
| `sweep.json` | `{"person": "<name>" or null, "now": "<UTC time>", "document": null or {"status": "in progress"\|"finished", "session", "since": "<UTC time>"}}`. `person`: who the payload or prompt names. `document`: the report's header (`since`: when that sweep started); null when there is no document |
| `develop.json` | `{"<repo>": {"ci": {"head_sha", "run_head_sha" or null, "conclusion" or null}, "merged_prs": [{"number", "required_check": "success"\|"failure"\|"missing"}], "gate_command": "pass"\|"fail"\|null, "fixable": true\|false\|null}}` |
| `issues.json` | `[{"key", "title", "state", "assignee": "person"\|"other"\|null, "created", "labels", "description", "comments": [{"author": "person"\|"agent", "at", "body"}], "claimed_by_other", "routine_branch", "activity_24h"}]`. `state`: a state name from the project data. `assignee`: `"person"` is the sweep's person. `claimed_by_other`: another agent session holds an unclosed claim from the last 24 hours (cut-off sweeps excluded). `routine_branch`: a `routine/<key>*` branch has commits from the last 24 hours by another session (this person's sweeps do not count). `activity_24h`: a comment, or a commit on any of its branches, in the last 24 hours, not counting this person's sweeps |
| `pulls.json` | `[{"repo", "number", "key" or null, "head", "ci": "success"\|"failure"\|"pending", "conflicts": true\|false}]`: open pull requests. `key`: the issue the pull request names |
| `branches.json` | `[{"repo", "branch", "key" or null, "author": "person"\|"other"}]`: branches not merged into the base, with commits in the last 7 days and no open pull request. `author` (only when `key` is null): who made the last commit |

Output:

```json
{"stop": null,
 "touch": [{"key": "KEY", "action": "fix-develop|fix-pr|continue"}],
 "report": {"for_you": ["ITEM"], "in_flight": ["ITEM"], "from_others": ["ITEM"], "for_tomorrow": ["ITEM"]}}
```

- `stop` is `null`, `"no person"` or `"another sweep running"`. When it is set, `touch` and every report list are empty: a stopped run evaluates nothing.
- An item is named by its issue key. A develop issue the gate would file is `NEW-DEVELOP-<repo>`; a kind-5 branch is `<repo>:<branch>`.
- `touch` lists the items the run would claim and work, in the order step 6 works them. `action` is `fix-develop` for a develop issue, `fix-pr` for a red or conflicting pull request, `continue` for an answered question or a stalled issue.
- `for_you`: the person's items left for the person: ineligible items, a needs-human develop issue, the person's kind-5 branches.
- `in_flight`: the person's items, and develop issues, that are taken.
- `from_others`: items of issues assigned to someone else or to nobody, and branches with no key whose last commit is not the person's.
- `for_tomorrow`: the person's items that pass step 5 but wait: their repository's base is red, or a cap ran out.
- Every collected item appears in exactly one of `touch`, `for_you`, `in_flight`, `from_others` or `for_tomorrow`. Uncollected ones appear nowhere: todo and backlog issues, live in-progress issues, green pull requests, and the pull requests and branches of an issue already collected. The dry run prints the classification before any work; in a real run, touched items join For you once their work ends.

## Red flags

| Thought | Reality |
| --- | --- |
| "This todo issue is quick; I'll start it" | Todo and backlog are the executor's. The sweep recovers, it never starts |
| "The pull request is green and reviewed; I'll merge it" | Agents never merge. It goes to For you |
| "Another session claimed it, but it looks abandoned" | Taken for 24 hours: In flight, untouched |
| "I'll update the report at the end" | After every item: a session that dies must leave it true |
| "The branch moved; I'll force-push" | Never force. Report it |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source. Generalized from Piro's nightly sweep (`piro-ip-monorepo`: `.claude/routines/barrido.md`, GAL-1497, by Pablo García Bolívar); its project specifics live in the project data's `### Sweep` notes. Decisions: `docs/adr/0002-routines-contract.md`.
