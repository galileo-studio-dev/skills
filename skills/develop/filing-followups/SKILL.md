---
name: filing-followups
description: Turns the deferred findings of work that is already finished into tracker issues an engineer can pick up cold. Use after delivering a change whose review left Minor findings, or whose plan explicitly deferred scope, and when asked to file remaining risks as tickets or to stop losing follow-ups in pull request descriptions. Not for breaking a plan or a spec into work before implementing it, which is `to-issues`.
---

# Filing Follow-ups

## Overview

A review that classifies findings produces three outcomes: fixed now, stops the work, or deferred. The first two are handled by the loop; the third usually dies as prose in a pull request description, where nobody reads it again. This skill gives the deferred set a home, with enough provenance that an engineer who was not there can act on it weeks later.

**Core principle:** File only what a review already decided to defer. Never look for new findings here — the decision was made upstream, and this is bookkeeping.

## What is fileable

| Source | Fileable | Why |
| --- | --- | --- |
| A review's **Minor** findings with a `file:line` and a concrete fix | Yes | Already judged not worth a cycle, already specific enough to act on |
| Scope the plan or the spec **explicitly deferred** (an *Out of scope* or *Fuera de alcance* entry that is real work, not a non-goal) | Yes | A decision was taken to not do it; a ticket is where that belongs |
| `remaining_risks` entries that name a concrete change | Yes | Same, when they are actionable rather than cautionary |
| A review's **Critical** or **Important** findings | **Never** | They get a fix cycle or they stop the work. Filing one is shipping a known defect with paperwork |
| Anything you noticed while filing | **Never** | Out of this skill's scope by construction. If it matters, it belongs to a review |
| "Improve test coverage", "consider refactoring", "add more docs" | **Never** | No file, no fix, no acceptance criterion: it is a feeling, not an issue |
| A flaw in the plan or the spec | **No — tell the person** | A ticket hides a decision that is theirs to take |

## The cap

At most **five** issues per delivery. If the deferred set is larger, the work had a scoping problem, not a follow-up problem: file the five that carry real risk, leave the rest in the pull request description as prose, and say in one line that you did and why. A loop that files ten tickets a run has converted a tracker into a log.

## Where to file

Use the tracker the repository's own contract names, not your preference:

- A project whose `CLAUDE.md`, `AGENTS.md` or docs name an issue tracker and a channel — for example "issues through the Linear MCP, never `gh` for tickets" — is settled: use that, with the team, project and labels it specifies.
- Otherwise `gh issue create --label follow-up`.
- If the named tracker is unreachable, do **not** silently fall back to another one and do not drop the list. Report the issues you would have filed, in the pull request description, and say the tracker was unavailable.

## Deduplicate before writing

Every issue carries a stable key as the last line of its body:

```text
followup-key: <project-or-package>:<path>:<short-slug>
```

Search open issues for that exact key before creating anything. A re-run of the same work must find its own earlier tickets and skip them, and a fix that landed in a later slice must not be filed at all — check the current tree before filing, not the review that observed it.

## Issue shape

Title: the surface, then the deferred finding in one line — the way the repository titles its other issues.

```markdown
Deferred from `<branch>` (<commit range>), slice <id>. Classified Minor in review.

**Finding.** `<path>:<line>` — what is wrong, in one or two sentences.

**Impact.** What it costs, and why it was safe to leave: the condition under which it stops being safe is the part worth writing.

**Suggested fix.** What the reviewer proposed, or the smallest change that would close it.

**Provenance.** Pull request <link>. Reviewer verdict: "<the verdict line>".

followup-key: <project>:<path>:<slug>
```

Leave it unassigned, in the backlog state. An issue filed into someone's active sprint is a reassignment, not a follow-up.

## Approval

Filing writes to a tracker other people read, and it is not idempotent. Show the person the list — title and one line each — and wait for their answer before creating anything. "Approved the delivery" is not approval to file; ask for this separately, once, for the whole batch.

## Red flags

| Thought | Reality |
| --- | --- |
| "This is Important, but I'll file it so we can ship" | That is shipping a known defect with paperwork. Fix it or stop the work |
| "I'll file one for each Minor finding" | Five is the cap. Beyond it, the scoping was wrong |
| "While filing I noticed another thing" | Not this skill's job. It belongs to a review |
| "I'll file it to be safe" | An issue nobody will act on costs triage attention from everyone who reads the tracker |
| "The plan was wrong, I'll file that" | Tell the person. A ticket buries a decision that is theirs |
| "A re-run will just update the old ones" | Only if you searched the key first. Otherwise you filed duplicates |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source; the fileable/not-fileable split follows the severity classes in `reviewing-pull-requests` and the company software guide (§9.6 review format, §10.4 "riesgos restantes están escritos").
