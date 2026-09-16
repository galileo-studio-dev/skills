---
name: scoping-changes
description: Keeps a change to the scope that was requested. Use when about to write or edit code for any task — a feature, fix, or refactor — before adding a file, function, dependency, abstraction, or comment the task did not ask for; when a diff is growing beyond the request or you are tempted to clean up nearby code; and when reporting finished work.
---

# Scoping Changes

## Overview

Every change has a scope: what the request asked for, at the size it implied. Code outside that scope is not free. Someone has to review it, test it, maintain it, and work out why it is there. Most low-quality generated code is not wrong; it is *more* than was asked: abstractions for one call site, checks for states that cannot happen, dependencies for one function, comments that narrate the line below them, and reports that recap the diff.

**Core principle:** Deliver exactly what was asked, at the scope intended. When you see something better, say so in one sentence; don't do it unasked.

## Step 1: State the scope before editing

Before the first edit, write the scope in two or three lines, in your reply or in the plan:

- **In:** the files and behaviors that change.
- **Out:** adjacent things you noticed and are leaving alone.
- **Done when:** the command or check that proves it.

If the request is ambiguous in a way that changes the scope, ask one question first. If a better approach exists, say so in one sentence and do the task as asked unless told otherwise.

This is the same information the pull request template asks for under *Incluido / Fuera de alcance*; writing it first makes the PR honest by construction.

## Step 2: Keep the diff to the scope

| Temptation | Do instead |
| --- | --- |
| Helper or abstraction for one call site | Inline it. Abstract at the third real call site, when the shape is known. |
| New dependency | Standard library or what is already installed. If something new is truly needed, ask first and say why. |
| Validation or fallback for a state internal code cannot produce | Trust the types and framework guarantees. Validate at boundaries (see `designing-error-handling`). |
| "While I'm here" rename, cleanup, or reformat of untouched code | Leave it. Put it under *Out* if it deserves a follow-up. |
| Config option or flag "for flexibility" | Hard-code the one behavior that was asked for. |
| Comment explaining what the code does; docstring on code you didn't change | Comment only a non-obvious *why*. Leave comments on untouched lines alone. |
| Compatibility shim, re-export, or deprecated alias nobody asked for | Change the call sites directly. |
| Tests for behavior outside the task | Test what changed. |
| Catch, log, and continue "to be safe" | Let it fail, or handle it where recovery is defined. |

## Step 3: Read the diff before reporting

Before claiming the work is done, read the full diff (`git diff`) and ask of each hunk: *would the reviewer ask why this is here?* If the answer is not in the task, remove the hunk.

- No new file whose contents could live in an existing one.
- No new entry in `package.json`, `pyproject.toml`, `requirements*.txt`, or a lockfile without approval.
- No dead code, commented-out code, or `TODO` you introduced.
- Only the lines the task needs change, plus whatever the project's formatter enforces.

## Step 4: Report in this shape

The report is, in order:

1. The outcome, in one to three sentences.
2. Anything the reader must act on: a decision, a command to run, a risk.
3. The verification command and its result.

Files touched are visible in the diff, so don't list them. Don't recap the plan or restate the request.

> Added the `expires_at` check to `validate_session` and a test for expired sessions. `pytest tests/auth` → 42 passed. Out of scope: `refresh_session` has the same gap; say the word and I'll open a follow-up.

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "It's a small extra, it won't hurt" | Every extra hunk is review and maintenance load for someone else. Small extras compound. |
| "The abstraction will be needed later" | Future needs are guesses. At the third call site the right abstraction is obvious; now it isn't. |
| "This makes the code more robust" | Checks for impossible states hide real bugs and mislead readers about what can happen. |
| "I'm already in this file" | Proximity is not scope. Note it under *Out* and move on. |
| "The user will want this" | Then they will ask. Offering it costs one sentence; doing it unasked costs a review. |
| "A helper makes it cleaner" | One call site plus a helper is more code and one more indirection than the inline version. |
| "The library does it better" | A dependency is a permanent supply-chain and upgrade commitment, taken on for one call. |

## Red flags: stop and re-read the scope

- The diff touches a file the task didn't mention.
- You wrote "while I'm here", "for flexibility", "to be safe", or "in case".
- A new `utils`, `helpers`, or `common` file or function.
- `try/except` or `try/catch` around code that cannot fail in practice.
- A comment that restates the line below it.
- A package manifest changed.
- The report is longer than the diff summary.

## When scope should grow

Sometimes the task cannot be done inside the stated scope: the bug lives in a shared function, or the fix needs a migration. Stop, say what you found in two sentences, and ask before widening. Widening with permission is fine; widening silently is the failure this skill prevents.

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source; the guidance draws on Anthropic's published Claude Code and prompting documentation on avoiding over-engineering.
