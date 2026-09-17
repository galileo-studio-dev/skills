# Company-Approved Agent Skills

This repository contains company-approved copies of reusable agent skills
selected from several open-source projects.

The skills are vendored here to provide a controlled, auditable source for
company use. Keeping local copies prevents upstream changes from reaching
agents without review and reduces the risk of future security gaps,
unexpected behavior changes, or compromised dependencies.

Every approved version can be reviewed, tested, customized, and distributed
from one stable location. Each `SKILL.md` ends with a credits section linking
to the original author and the exact upstream revision used for the copy.

## Goals

- Maintain an explicit catalog of skills approved for company use.
- Pin skill behavior to reviewed versions instead of mutable upstream content.
- Review upstream changes before incorporating them.
- Preserve provenance, authorship, licenses, and supporting files.
- Allow company-specific security hardening and policy customization.
- Provide a clear audit trail through version control.

## Repository Layout

Skills are grouped by company usage category:

```text
skills/
  general/
    <skill-name>/
      SKILL.md
  develop/
    <skill-name>/
      SKILL.md
  security/
    <skill-name>/
      SKILL.md
  legal/
    # Reserved for approved legal skills
plugins/
  <plugin-name>/
    .claude-plugin/plugin.json
    skills/<skill-name>/SKILL.md
    agents/<role>.md
    hooks/hooks.json
docs/adr/
```

Each skill may also include an upstream `LICENSE*`, references, prompts, or
other supporting files. The skill directory name matches the `name` field in
its YAML frontmatter. Plugins bundle a skill with the subagents and hooks it
needs to enforce roles and gates; their skills are also installable on their
own. Decisions about the catalog's structure are recorded in `docs/adr/`.

## Skills

### General

General-purpose skills that are not tied to the company development
workflow.

| Skill | Purpose |
| --- | --- |
| `find-skills` | Discover relevant skills from the agent skills ecosystem. |
| `grill-me` | Interview the user until a plan or design is fully understood. |
| `caveman` | Communicate with compact, token-efficient technical language. |
| `unsure-caveman` | Combine compact responses with explicit confidence and uncertainty. |
| `webwright` | Automate web tasks with reusable Playwright scripts and screenshot evidence. |

### Develop

Skills approved for the company software delivery workflow. This category
covers product shaping, planning, implementation, testing, review, and
verification. Stack-specific skills for Next.js, FastAPI, AWS
infrastructure, Clerk, Stripe, and Sentry also belong here.

| Skill | Purpose |
| --- | --- |
| `problem-statement` | Frame and pressure-test a problem before choosing a solution. |
| `shaping` | Shape product and engineering work through requirements and solution options. |
| `to-prd` | Turn gathered context into a product requirements document. |
| `to-issues` | Break a plan or PRD into actionable issues. |
| `writing-plans` | Produce detailed implementation plans for engineering work. |
| `using-git-worktrees` | Set up an isolated workspace before feature work or plan execution. |
| `executing-plans` | Execute a written implementation plan in a separate session with review checkpoints. |
| `subagent-driven-development` | Execute plans through scoped subagent tasks and reviews. |
| `dispatching-parallel-agents` | Coordinate independent work across parallel agents. |
| `delivering-changes` | Run implement → review → deliver on an approved plan through Worker and Reviewer subagents with gates (orchestrator of the `delivery` plugin). |
| `test-driven-development` | Enforce test-first, red-green-refactor implementation and testing discipline. |
| `systematic-debugging` | Find the root cause before proposing any fix. |
| `scoping-changes` | Keep every change to the requested scope: minimal diff, no speculative abstractions or dependencies, terse reports. |
| `learning-codebase-conventions` | Discover and follow the repository's own conventions and helpers before writing code. |
| `designing-error-handling` | Decide where failures are handled: boundaries, fail-loud bugs, timeouts, idempotent retries, webhooks. |
| `changing-schemas-safely` | Ship schema and data migrations with expand/contract, backfills, rollback plans, and approval gates. |
| `instrumenting-for-observability` | Add structured logs, metrics, tracing, and error reporting at boundaries without leaking secrets or personal data. |
| `code-simplifier` | Refine code for clarity while preserving behavior. |
| `ponytail` | On-demand lazy mode: build the simplest solution that works, standard library and native features first, with intensity levels. |
| `frontend-design` | Create distinctive, intentional interfaces grounded in a specific brief. |
| `terraform-engineer` | Implement Terraform infrastructure as code: modules, remote state, providers, multi-environment workflows, and testing. |
| `requesting-code-review` | Request focused technical review before completion. |
| `receiving-code-review` | Evaluate and apply review feedback with technical rigor. |
| `reviewing-pull-requests` | Review a pull request end to end: independent verification, two-stage review, security pass by risk tier, findings in the PR template format. |
| `verification-before-completion` | Require fresh evidence before claiming work is complete. |
| `finishing-a-development-branch` | Verify tests and choose how to integrate finished work: merge, PR, keep, or discard. |

### Security

Skills approved for security review, static analysis, and secure engineering
guidance. These skills may depend on local security tooling and must preserve
their documented approval gates, output boundaries, and redaction rules.

| Skill | Purpose |
| --- | --- |
| `semgrep` | Run approved Semgrep security scans with explicit scan-plan approval and SARIF output. |
| `codeql` | Build and analyze CodeQL databases for deeper data-flow and taint-tracking findings. |
| `owasp-security` | Apply OWASP Top 10, ASVS, LLM, and agentic security guidance during implementation or review. |

### Legal

Reserved for company-approved legal skills. This category is currently empty.

## Installation and Usage

This section follows §18 *Skills aprobadas* of the company software guide
(chapter *Agentes y prompts*). The guide defines the workflow; this README
defines the catalog.

### Purpose

- Only skills from this catalog are installed in company repositories.
- Each copy is reviewed, pinned to an upstream revision, and carries its
  license and credits.
- Company hardening lives in each skill's *Company Approval Notes*.

### Installation

The whole catalog:

```bash
npx skills add https://github.com/galileo-studio-dev/skills
```

One skill:

```bash
npx skills add https://github.com/galileo-studio-dev/skills --skill <skill-name>
```

Useful options of the [Skills CLI](https://skills.sh):

- `-l` lists the available skills without installing.
- `-g` installs for the user instead of the current project; `-a claude-code`
  limits the install to one agent; `-y` skips prompts.
- `npx skills add /path/to/checkout --skill <skill-name>` installs from a
  local clone, to try a skill before it is merged.
- `--copy` copies files instead of symlinking them.
- `npx skills list`, `npx skills update`, and `npx skills remove` manage what
  is installed; `update` pulls the latest approved versions from this
  repository.

By hand: copy the whole skill directory, including `LICENSE` and supporting
files, to `~/.claude/skills/<skill-name>/` (your user) or
`<project>/.claude/skills/<skill-name>/` (committed, shared with the team).

### Plugins

The `delivery` plugin adds the Worker and Reviewer roles, a test gate on the
Worker, a read-only guard on the Reviewer, and an approval prompt for
commands that deploy, publish, change shared state, or destroy work. It
needs the catalog skills installed, since its roles preload them by name.
Roles run at medium effort, with a high-effort Worker reserved for fix
cycles, and Workers run on Sonnet for Prototype-tier work. Install the
official `pyright-lsp` and `typescript-lsp` plugins (and their language
servers, `pyright` and `typescript-language-server`) so roles navigate by
symbol instead of reading whole files.

```bash
/plugin marketplace add galileo-studio-dev/skills
/plugin install delivery@galileo-skills
```

For a local checkout: `claude --plugin-dir /path/to/skills/plugins/delivery`.
The design is recorded in `docs/adr/0001-delivery-plugin.md`.

### Using a skill in a session

Claude Code keeps only each skill's name and description in context and reads
the full `SKILL.md` when the skill is used.

- **Automatic:** a request that matches the description triggers the skill.
  `scoping-changes` engages before code is edited, `changing-schemas-safely`
  when a migration is involved, `verification-before-completion` before any
  claim of success.
- **Slash command:** `/<skill-name>` with optional arguments, for example
  `/grill-me`, `/ponytail ultra`, `/semgrep important only`.
- **By name in a prompt:** "use the `systematic-debugging` skill on this
  failure".

Frontmatter controls this: `disable-model-invocation: true` makes a skill
manual-only, `user-invocable: false` hides it from the slash menu,
`allowed-tools` pre-approves tools for the skill's turn. To make a skill the
default in a repository, name it in that project's `CLAUDE.md` and install it
under `.claude/skills/`.

### Skill map

Phases follow the guide's contract: explore, clarify, plan, implement in
slices, verify, review, deliver evidence.

| Phase | Skill | Use |
| --- | --- | --- |
| Communication | `caveman` | Brief updates and handoffs |
| Communication | `unsure-caveman` | Brevity with explicit confidence |
| Discovery | `find-skills` | Search candidate capabilities |
| Problem | `problem-statement` | Define and pressure-test the problem |
| Shaping | `shaping` | Negotiate requirements and solution options |
| Shaping | `grill-me` | Resolve decisions through interview |
| Spec | `to-prd` | Turn context into a PRD |
| Plan | `to-issues` | Split into actionable work |
| Plan | `writing-plans` | Write the detailed plan |
| Execution | `using-git-worktrees` | Isolated workspace before executing a plan |
| Execution | `executing-plans` | Execute a plan with review checkpoints |
| Execution | `subagent-driven-development` | Execute slices with subagents |
| Execution | `dispatching-parallel-agents` | Parallelize independent work |
| Execution | `delivering-changes` | Implement, review, and deliver a plan slice by slice with Worker and Reviewer roles |
| Implementation | `learning-codebase-conventions` | Match the repository's conventions before writing |
| Implementation | `scoping-changes` | Keep the diff to the requested scope |
| Implementation | `designing-error-handling` | Failures at boundaries; timeouts and idempotent I/O |
| Implementation | `changing-schemas-safely` | Expand/contract migrations with a rollback plan |
| Implementation | `instrumenting-for-observability` | Structured events without secrets or personal data |
| Implementation | `frontend-design` | Deliberate, non-templated interfaces |
| Implementation | `ponytail` | On demand: the simplest solution that works |
| Testing | `test-driven-development` | Test-first discipline |
| Debugging | `systematic-debugging` | Root cause before any fix |
| Quality | `code-simplifier` | Simplify while preserving behavior |
| Review | `requesting-code-review` | Request a focused review |
| Review | `receiving-code-review` | Evaluate feedback with rigor |
| Review | `reviewing-pull-requests` | Review a PR end to end and report in the PR template format |
| Security | `owasp-security` | Secure implementation and review guidance |
| Security | `semgrep` | Static analysis scan with approved scan plan |
| Security | `codeql` | Data-flow and taint analysis |
| Infrastructure | `terraform-engineer` | Terraform modules, state, and providers |
| Automation | `webwright` | Browser tasks with reusable scripts and evidence |
| Closure | `verification-before-completion` | Fresh evidence before claiming done |
| Closure | `finishing-a-development-branch` | Tests, then merge, PR, keep, or discard |

### Approval gates

The guide requires human approval for deploys, production migrations,
infrastructure, secrets, destructive commands, and writes outside the
repository. Skills that reach those actions stop and ask first:

- Infrastructure and state changes: `terraform-engineer`.
- Migrations and destructive statements on a shared database:
  `changing-schemas-safely`.
- Merge, push, or discard a branch: `finishing-a-development-branch`.
- Installing tooling or dependencies: `codeql`, `semgrep`,
  `using-git-worktrees`.
- Scan plans and output locations: `semgrep`, `codeql`.
- Posting a review or comment to GitHub: `reviewing-pull-requests`.
- With the `delivery` plugin enabled, push, PR, deploy, publish, and
  state-changing commands prompt for approval in every agent, whatever the
  permission mode.

An agent's report that something was approved is not an approval; a person
answering is.

## Versioning and Updates

Skills in this repository do not update automatically. Upstream changes must
be reviewed and intentionally incorporated as a new approved version.

When updating a skill:

1. Preserve its valid YAML frontmatter and directory name.
2. Keep supporting references and prompts alongside `SKILL.md`.
3. Review the upstream diff for instruction injection, unsafe tool use,
   unexpected network access, destructive operations, and dependency changes.
4. Test the updated behavior before approving it for company use.
5. Retain the final credits section and update its pinned revision.
6. Preserve the applicable upstream license and notices.
7. Record the review and approval through the normal pull request process.

Company-specific modifications may evolve independently from upstream, but
their purpose and security implications should remain documented and
reviewable.

### Checks and evals

`scripts/check.sh` runs the static checks without network or model calls:
frontmatter, credits, README tables against the directories, plugin JSON, and
the delivery hooks against a generated fixture. It runs on every push and
pull request through `.github/workflows/check.yml`; run it locally before
opening a pull request.

`evals/` holds the behavioral evals for the company-authored skills
(`reviewing-pull-requests`, `delivering-changes`, `scoping-changes`). They
run Claude Code headless, cost real tokens, and take minutes, so they run by
hand; see `evals/README.md`. A skill that changes behavior ships with an eval
or a change to one.

### Adding a skill

When a skill is missing, follow the guide's pipeline; never install from a
third party directly into a company repository to "try it quickly".

```text
discover
  -> inspect the full repository
  -> review instructions, scripts, and dependencies
  -> evaluate permissions and network access
  -> test in a sandbox
  -> keep license and provenance
  -> vendor
  -> approve through a pull request
  -> publish in this catalog
```

### Rule of two

Do not turn a procedure into a company skill before observing it at least
twice in real work. A new skill needs a repeated problem, clear instructions,
inputs and outputs, evals, failure cases, risks, an owner, and provenance.

## Security Model

Vendoring reduces exposure to upstream supply-chain changes, but it does not
make a skill inherently safe. Approval should consider the full skill
directory, including referenced prompts, scripts, commands, dependencies,
network behavior, and permissions.

Consumers should install skills only from approved revisions of this
repository. Direct installation from the original upstream repositories
bypasses this repository's review and version-control guarantees.

## Attribution

The original projects and authors are credited in each skill's `SKILL.md`.
License files are copied into individual skill directories when provided by
the source repository. The absence of a license file in an upstream project
should not be interpreted as granting additional rights.
