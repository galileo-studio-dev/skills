---
name: working-an-issue
description: Works one tracker issue from check to a draft pull request — confirms it is free and still needed, claims it, branches, delivers the code with `delivering-changes`, verifies, opens the pull request and updates the tracker, or asks or gives up the way `running-routines` §5 says. Use for "do <issue key>" in an interactive session and for each issue a routine takes. Not for choosing which issues to do (`working-the-queue`) or for planning multi-issue work.
---

# Working an Issue

## Overview

The tracker side of one issue. The code itself is `delivering-changes`'s job; this skill decides whether to start, keeps the tracker true, and ends at a draft pull request. It reads the project data (`running-routines` §1) for every value.

**Core principle:** an issue ends in exactly one place: a draft pull request, a question in needs HITL, or a blocker with needs-human. Never half-done and silent.

## 1. Check

- Read the issue, its comments and related issues. Compare them with Git: `git log origin/<base> --grep <KEY>` and open pull requests that name the key. The last comment can be stale.
- Already done on the base branch: in a routine, comment that and skip; interactively, tell the person.
- An open pull request for the key, or a branch `routine/<key-lowercase>*` on origin with commits in the last 24 hours: in a routine the issue is taken, so skip it and say so; interactively, continue on that branch. An older routine branch (for example one left behind by a question in needs HITL): continue on it.
- Re-check the rubric (`running-routines` §3) against what you now know. If it fails, go to §7 now.

## 2. Claim

As `running-routines` §4 says. Interactively, also make sure the issue has an assignee: if it has none, ask the person who does it.

## 3. Branch

From `origin/<base>`:
- in a routine, `routine/<key-lowercase>-<short-slug>` in each repository the change needs;
- interactively, the tracker's suggested branch name if the project uses it.

## 4. Deliver the code

Run `delivering-changes` with:

- **Spec:** the issue's acceptance criteria.
- **Plan:** one slice when the change fits one pass; otherwise the parts the issue lists.
- **Verification command:** from the project data's Verification.
- **Tier and worker model:** from the project data's Execution, passed as a per-dispatch `model` when it differs from inherit. Never change the model in the middle of a slice. This overrides `delivering-changes`' rule that Production and Critical tiers inherit; `worker-high` and the Reviewer always inherit.
- **Worker briefs:** add the line `Constraints: follow the ponytail skill (.claude/skills/ponytail/SKILL.md, full level) except its Output section.` A worker cannot load skills itself.
- **Gates:** in a routine nobody is there, so this skill replaces every person gate of `delivering-changes`: the acceptance criteria are the plan gate; §5–§6 here replace its delivery step (push and pull request); anything it would ask the person (a plan flaw, two fix cycles without a clean verdict) goes to §7 as a question or a blocker; deferred findings go under the pull request's risks, not into the tracker. Its "Without the plugin" verification re-runs stay. Interactively, its gates apply as written.

Before the final review, when `git diff --shortstat origin/<base>...HEAD` exceeds the project data's threshold, run `/simplify` and include its changes in that review.

## 5. Verify, commit, push

- **Verify** as the project data's Verification says: the fast command after each handoff, and the full command once per branch, right before the pull request. Never reuse a build or cache from before your last source change.
- **Commit** with the repository's own convention (`AGENTS.md`), naming the key; this overrides `delivering-changes`' slice commit format. **Push** the branch: never the base or production branch, and never with force.

## 6. Pull request and tracker

- Open a **draft** pull request into the base branch, titled `<type>: <summary> (<KEY>)`. Fill the project's pull request template in the project language with:
  - the tracker link;
  - what changed and why;
  - each command run and its result;
  - what you could not verify;
  - the risks.

  A change across repositories gets one pull request per repository, linked to each other.
- **Tracker:** comment with the pull request link. Move the issue to in review only if no tracker–Git integration does it. Edit your claim to say what happened.

## 7. Ask, or give up

As `running-routines` §5 says. Interactively, ask the person in the chat, one decision per question, instead of moving the issue to needs HITL. The structural-blocker labels apply in both cases.

## Report

Return the key, the pull request links, and the end state (pull request / question / blocked) with one line why. In a routine, `working-the-queue` collects it.

## Red flags

| Thought | Reality |
| --- | --- |
| "The branch exists but looks abandoned; I'll take it over" | In a routine it is taken. Skip it and say so |
| "Close enough to the criteria" | The criteria are the spec: meet them, or ask |
| "I'll fix this other thing I noticed" | Not this issue. Note it under the pull request's risks |
| "The pull request is ready, so I'll mark it ready for review" | It stays a draft; a person promotes and merges it |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source. Adapted from Piro's `do-issue` (Pablo García Bolívar) for the tracker steps, and from the Kura fixer routine for the pull request rules. Decisions: `docs/adr/0002-routines-contract.md`.
