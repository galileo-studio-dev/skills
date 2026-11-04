---
name: reviewing-pull-requests
description: Reviews a pull request or branch end to end and reports findings in the company's pull request format. Use when asked to review a PR, a branch, or a commit range; when acting as the Reviewer for work implemented by another person or agent; and before a human decides on a merge. Also use when a review needs verification evidence, a security pass sized to the risk tier, or a review comment posted to GitHub.
---

# Reviewing Pull Requests

## Overview

A pull request review answers one question for the person who will approve the merge: what would break, and what is missing, if this merged now? Reading the diff cannot answer it alone. The review runs the checks itself, gets an independent reading of spec and code, adds a security pass sized to the risk, and reports in the shape the pull request template already uses, so the approver can compare claim against evidence line by line.

**Core principle:** Evidence over claims, findings over impressions, and a human makes the merge decision. The reviewer never approves.

## How to invoke

- Slash command: `/reviewing-pull-requests 123` for a pull request number, or `/reviewing-pull-requests feature/x against main` for a branch or range.
- In prose: "review PR #123", "review this branch before I merge it".
- Automatically, when a request matches the description above.

Give the reviewer, or point it to: the PR number or the base and head; the spec or plan (the PR's *Trazabilidad* section usually names it); and the risk tier when it is not in `docs/00-context.md` or the spec. On Production and Critical tiers expect two approval prompts: the `semgrep` (and `codeql`) scan plan before it runs, and the review text before it is posted. The result is the report in Step 6. Nothing is posted or approved without you. A routine fired by a pull request event follows [In a routine](#in-a-routine) instead, which replaces those two prompts.

## Step 0: Confirm you are independent

If you implemented any part of this change in this session, stop and hand the review to a fresh session or subagent with this skill and the inputs below. An implementer reviewing their own work is the first antipattern the company guide names (§16.5).

## Step 1: Load the pull request

With a PR number:

```bash
gh pr view <n> --json number,title,body,url,baseRefName,headRefName,files,commits
gh pr checks <n>                 # CI state: informational, not evidence
gh pr checkout <n>               # in an isolated worktree if the tree is dirty
git fetch -q origin <baseRefName>
BASE_SHA=$(git merge-base origin/<baseRefName> HEAD); HEAD_SHA=$(git rev-parse HEAD)
```

With a branch or range and no GitHub access: `BASE_SHA=$(git merge-base <base> <head>)`, `HEAD_SHA=$(git rev-parse <head>)`, and take the PR description from the person.

From the PR body, using the template's sections, collect the issue or requirement and the spec or plan (*Trazabilidad*), the declared scope (*Incluido / Fuera de alcance*), the claimed verification (*Verificación*), and the declared risks and rollback (*Riesgos y operación*). Read the spec and plan themselves; the body's summary of them is a claim.

**Risk tier.** Take it from `docs/00-context.md` or the spec. Otherwise: *Prototype* for experiments with no external users or sensitive data, *Production* for anything customers or real processes use, *Critical* for financial, legal, health, security, or availability impact. When unsure, ask; when the answer would not change the review, assume Production.

## Step 2: Verify independently

Run the universal PR baseline on `HEAD_SHA` yourself and keep each command with its exit status and summary line:

- format, lint, typecheck (when the stack has it), tests, build
- secrets: at minimum `git diff $BASE_SHA..$HEAD_SHA | grep -nEi '(api[_-]?key|secret|token|passw|BEGIN [A-Z ]*PRIVATE KEY)'`; run the repository's scanner (gitleaks, trufflehog) when one exists
- dependencies: `git diff --name-only $BASE_SHA..$HEAD_SHA | grep -E 'package(-lock)?\.json|pnpm-lock|yarn\.lock|pyproject|poetry\.lock|requirements|go\.(mod|sum)|Cargo'`, and for each new dependency, its justification in the PR
- data: schema or model changes have a migration, and the migration has a downgrade

Follow `verification-before-completion`: a green CI badge and the *Verificación* table are claims until you have run the commands. Evidence older than the last commit is stale; say so.

## Step 3: Two-stage review by subagents

Give each reviewer exactly what §9.6 of the guide requires: spec, plan, diff range, your test results, and the declared risks. Nothing from your session history.

1. **Spec compliance.** Dispatch a `general-purpose` subagent with the template in `subagent-driven-development/spec-reviewer-prompt.md`: the full spec or requirements as *What Was Requested*, the PR body as *What Implementer Claims They Built*, and the range. Missing requirements and unrequested extras are both findings.
2. **Code quality.** Dispatch the reviewer from `requesting-code-review` (template `code-reviewer.md`) with `DESCRIPTION`, `PLAN_OR_REQUIREMENTS`, `BASE_SHA`, `HEAD_SHA`. That template already checks the company lenses: scope (`scoping-changes`), conventions (`learning-codebase-conventions`), failure handling (`designing-error-handling`), data changes (`changing-schemas-safely`), observability (`instrumenting-for-observability`).

Run both even when the first comes back clean; they look for different things.

## Step 4: Security pass by tier

| Tier | Pass |
| --- | --- |
| Prototype | Step 2 secrets and dependency checks; `owasp-security` guidance applied to any change touching authentication, authorization, input handling, data access, or LLM prompts |
| Production | Prototype pass, plus `semgrep` in "important only" mode over the changed files; the scan plan needs the person's approval before it runs |
| Critical | Production pass, plus `codeql` on the affected language (approval required) and a second, human reviewer named in the report |

Security findings are Critical unless the person who owns the risk downgrades them in writing.

## Step 5: Consolidate

Merge the findings from Steps 2 to 4, drop duplicates, and classify each as Critical (bugs, security, data loss, broken or missing requirements), Important (architecture, error handling, test gaps, undeclared scope), or Minor (style, naming, documentation). Write each in the guide's format: severity, file and line, problem, impact, suggested fix. Findings about the spec or plan themselves are reported as such, not blamed on the implementation.

If there are no findings, say so explicitly and name the residual risk. "No findings" without residual risk is an incomplete review.

## Step 6: Report

Write the report in the language of the pull request template (Spanish in company repositories) with exactly these sections, in this order. Tick a checklist item only when your own evidence supports it; the last item is never yours to tick.

```markdown
## Veredicto
Listo para merge tras aprobación humana | Listo con correcciones | No listo. Una línea de motivo.

## Bloqueantes
- Hallazgos Critical, o "Ninguno".

## Hallazgos
| Severidad | Archivo:línea | Problema | Impacto | Arreglo sugerido |
| --- | --- | --- | --- | --- |

## Checklist de la plantilla
- [ ] Cumple la spec y los criterios de aceptación. Evidencia: paso 3.1.
- [ ] El diff está limitado al alcance declarado. Evidencia: paso 3.2.
- [ ] Formato, lint, tipos, tests y build aplicables pasan. Evidencia: paso 2.
- [ ] Seguridad y privacidad fueron revisadas. Evidencia: paso 4, tier.
- [ ] Documentación y contratos están actualizados. Evidencia: paso 3.2.
- [ ] La evidencia fue generada después del último cambio. Evidencia: paso 2 frente al último commit.
- [ ] No quedan hallazgos bloqueantes. Evidencia: paso 5.
- [ ] Existe aprobación humana para merge y producción. Pendiente: la da una persona.

## Verificación
| Comando | Resultado |
| --- | --- |

## Riesgos restantes
- Riesgo residual, estado del rollback, y lo que quien aprueba debe sopesar.

## Fuera de alcance
- Lo observado y deliberadamente no reportado como hallazgo.
```

Blockers first: the approver may read nothing else. Keep each *Verificación* row to one line: command, exit status, summary.

## Step 7: Deliver, and only then post

Show the report in the conversation. Posting it to GitHub writes outside the repository, so it needs the person's approval of the exact text:

```bash
gh pr review <n> --comment --body-file review.md
```

Never `--approve`: the template reserves approval for a human. Use `--request-changes` only when the person asks for it. Don't comment on lines you did not read in full.

## In a routine

A routine fired by a pull request event runs this skill with nobody present. The session starts with a `<github-trigger-context>` message giving the event, repository, pull request number, head and base branches, and head SHA. Follow `running-routines` §1 (project data), §7 (never) and §8 (report), and these changes to the steps above. Every step not named here runs as written.

**R0. Opt in and decide.** Read the project data. Without a `### Review` note, stop and report "review not enabled". Check, in this order, and skip at the first that applies (a skip writes nothing):

1. The base is not the project's base branch: `not the base branch`.
2. The author's account type is `Bot`: `bot author`.
3. A review of the head SHA exists: a review whose `commit_id` is the head SHA, or whose header names it: `already reviewed`.
4. Every changed file is documentation (`*.md` or under `docs/`) and none matches a protected path: `documentation only`.
5. The event does not call for a review:
   - `pull_request.opened` on a draft: `draft`. Events on a draft pull request do not fire a routine (checked 2026-11-04), so every draft, executor drafts included, is reviewed when it is marked ready (`ready_for_review`). This check only guards against that behaviour changing.
   - `pull_request.labeled` while the pull request's labels lack the re-review label from `### Review`: `not the re-review label`. The trigger context does not name the label that was added, so read the current labels.

**R1. Load (replaces the Step 1 commands).** GitHub's GraphQL API is not available in cloud sessions, so `gh pr view`, `gh pr checks`, `gh pr checkout` and `gh pr review` fail. Use REST and git:

```bash
gh api repos/<o>/<r>/pulls/<n>                         # title, body, draft, base, head, labels, user
gh api 'repos/<o>/<r>/pulls/<n>/files?per_page=100'     # changed files and line counts
gh api repos/<o>/<r>/pulls/<n>/reviews                 # earlier reviews and their commit_id
git -C <repo> fetch https://github.com/<o>/<r> refs/pull/<n>/head && git -C <repo> checkout --detach FETCH_HEAD
git -C <repo> fetch origin <base>; BASE_SHA=$(git -C <repo> merge-base origin/<base> HEAD)
```

When the routine has several repositories, the pull request's head is not checked out for you, so fetch it as above. `gh api` reaches only the routine's source repositories.

**R2. Verify (replaces the Step 2 baseline).**
- Run the fast command from `AGENTS.md` § Verification for each area the diff touches, plus Step 2's secrets and dependency checks.
- Take the slow suites from the pull request's CI on the head SHA (`gh api repos/<o>/<r>/commits/<sha>/check-runs`). Wait up to 15 minutes for the required check named in `## Verification`, in the background, because a foreground command stops at 10 minutes.
- In *Verificación*, a CI row reads `CI: <run url>` with its conclusion, or `CI pendiente`. Never list a CI result as a command you ran.

**R3. Subagents (Step 3).** Run both reviewers with the model that the review-subagents line of `## Execution` gives. That is opus when the diff touches a protected path or exceeds the line threshold, and sonnet otherwise.

**R4. Security (replaces the approval in Step 4).** When the diff touches a protected path, run `semgrep` without asking, with this fixed plan; otherwise run the Prototype pass. The `semgrep.dev` registry is not reachable from cloud sessions, so the rules come from GitHub:

```bash
python3 -m venv "$SCRATCH/sg" && "$SCRATCH/sg/bin/pip" install -q semgrep
git clone -q --depth 1 https://github.com/semgrep/semgrep-rules "$SCRATCH/sr"
"$SCRATCH/sg/bin/semgrep" scan --metrics=off --json --config "$SCRATCH/sr/<folder>" <changed files>   # one --config per folder in ### Review
```

Say in *Verificación* which pass ran. The Critical tier's `codeql` and second human reviewer are out of a routine's reach: say so under *Riesgos restantes*.

**R5. Report (Step 6).** Use the same sections, in the project language, after one header line: `Review automática · <head SHA> · <session link>`. On a re-review, also say what changed since the last reviewed commit.

**R6. Post (replaces Step 7).** Post one comment-type review through REST, without asking. ADR 0002 decision 12 allows exactly this.

```bash
gh api -X POST repos/<o>/<r>/pulls/<n>/reviews -f event=COMMENT -F body=@review.md
```

- Never `APPROVE` or `REQUEST_CHANGES`, and no line comments. Write nothing else to the Git host or the tracker: no labels, no issue comments, no pushes.
- Never write the mention that fires a routine.
- The session appends its own «Generated by Claude Code» footer; add nothing after it.
- Send no push notification: nothing is held, so §8 does not apply.
- Final message: the review's URL and verdict, or the reason for skipping.

**Dry run.** When the prompt says "dry run" and names a state directory, read these files instead of GitHub. Decide R0, R3 and R4, write nothing, and print exactly one fenced `json` block.

| File | Shape |
| --- | --- |
| `trigger.json` | `{"event": "pull_request.opened"\|"pull_request.ready_for_review"\|"pull_request.labeled", "repo", "number", "head_sha"}` |
| `pull.json` | `{"draft": true\|false, "head": "<branch>", "base": "<branch>", "author_type": "User"\|"Bot", "labels": ["<name>"], "changed_lines": <int>}` |
| `files.json` | `["<path>"]`: the changed files |
| `reviews.json` | `[{"commit_id", "header": "<first line of the body>"}]`: earlier reviews |

Output:

```json
{"action": "review", "reason": null, "semgrep": false, "subagent_model": "sonnet"}
```

- `action` is `review`, `skip` or `stop`.
- `reason` is null for `review`, `review not enabled` for `stop`, and the first R0 reason that applies for `skip`.
- When `action` is not `review`, `semgrep` is false and `subagent_model` is null.

## Red flags

| Thought | Reality |
| --- | --- |
| "CI is green, so the checks pass" | CI may skip suites, run a stale commit, or not exist. Run the baseline. |
| "The PR body says it was tested" | A claim. The *Verificación* table is filled from your commands. |
| "It's a small PR" | Small diffs hide scope creep and swallowed errors as well as large ones. Both reviewers still run. |
| "I know this code; I can skip the subagents" | Your context is the implementer's context. Independent readers find what familiarity hides. |
| "No findings, LGTM" | State the residual risk, or the review is incomplete. |
| "Approve to unblock the team" | Not yours to give. Report readiness; a person approves. |
| "A routine found a Critical, so it should request changes" | A routine only comments (R6). The verdict line already blocks; the person decides |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source; the process follows the company software guide (§9.6 independent review, §10.3 risk tiers, §10.4 PR baseline, §19.1 pull requests) and reuses the reviewer templates vendored in `requesting-code-review` and `subagent-driven-development`.
