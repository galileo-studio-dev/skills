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
  legal/
    # Reserved for approved legal skills
```

Each skill may also include an upstream `LICENSE*`, references, prompts, or
other supporting files. The skill directory name matches the `name` field in
its YAML frontmatter.

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
| `subagent-driven-development` | Execute plans through scoped subagent tasks and reviews. |
| `dispatching-parallel-agents` | Coordinate independent work across parallel agents. |
| `tdd` | Apply a behavior-focused red-green-refactor workflow. |
| `test-driven-development` | Enforce test-first implementation and testing discipline. |
| `code-simplifier` | Refine code for clarity while preserving behavior. |
| `frontend-design` | Create distinctive, intentional interfaces grounded in a specific brief. |
| `requesting-code-review` | Request focused technical review before completion. |
| `receiving-code-review` | Evaluate and apply review feedback with technical rigor. |
| `verification-before-completion` | Require fresh evidence before claiming work is complete. |

### Legal

Reserved for company-approved legal skills. This category is currently empty.

## Installation

Install every skill from this repository:

```bash
npx skills add https://github.com/desarrollo-galileo/skills --full-depth
```

Install one skill:

```bash
npx skills add https://github.com/desarrollo-galileo/skills \
  --full-depth \
  --skill <skill-name>
```

For local development, point the skills CLI at this repository's local path
if supported by the installed CLI version.

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
