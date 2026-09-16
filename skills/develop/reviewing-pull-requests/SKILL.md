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

Give the reviewer, or point it to: the PR number or the base and head; the spec or plan (the PR's *Trazabilidad* section usually names it); and the risk tier when it is not in `docs/00-context.md` or the spec. On Production and Critical tiers expect two approval prompts: the `semgrep` (and `codeql`) scan plan before it runs, and the review text before it is posted. The result is the report in Step 6. Nothing is posted or approved without you.

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

## Red flags

| Thought | Reality |
| --- | --- |
| "CI is green, so the checks pass" | CI may skip suites, run a stale commit, or not exist. Run the baseline. |
| "The PR body says it was tested" | A claim. The *Verificación* table is filled from your commands. |
| "It's a small PR" | Small diffs hide scope creep and swallowed errors as well as large ones. Both reviewers still run. |
| "I know this code; I can skip the subagents" | Your context is the implementer's context. Independent readers find what familiarity hides. |
| "No findings, LGTM" | State the residual risk, or the review is incomplete. |
| "Approve to unblock the team" | Not yours to give. Report readiness; a person approves. |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source; the process follows the company software guide (§9.6 independent review, §10.3 risk tiers, §10.4 PR baseline, §19.1 pull requests) and reuses the reviewer templates vendored in `requesting-code-review` and `subagent-driven-development`.
