# Project data

Read by the routine skills (`running-routines` §1). Values only: process lives in the skills, and code conventions live in `AGENTS.md`.

## Language

<es | en>: issues, comments, questions, pull request bodies and reports for people are written in this language.

- Issue sections, in this language: <Contexto, Evidencia, Objetivo, Tareas, Criterios de aceptación, Fuera de alcance>

## Tracker

- Tool and channel: <Linear, through its MCP connector only>
- Team / project: <COM> / <Kura compliance>
- States: backlog <Backlog>, todo <Todo>, in progress <In Progress>, in review <In Review>, done <Done>, needs HITL <Needs HITL>
- Labels: agent-ready <Routine fixable>, needs-human <Needs human> (single-select group <Fixability>), blocked <Routine blocked>, finder <Scanner>, types <Bug>, <Improvement>
- Tracker–Git integration moves states on pull request events: <yes | no>

## Branches

- Base: <develop>. Production: <prod>.
- Routine branch prefix: `routine/` (full name `routine/<issue-key-lowercase>-<slug>`)
- Pull request template: <.github/pull_request_template.md>

## Verification

- Commands: <AGENTS.md § Verification and § Cloud sessions>
- Base branch CI: workflow <CI Backend> (`.github/workflows/ci.yml`), required check <ci-ok>
- Gate command (the develop gate's confirmation, minutes not hours): <bun run typecheck && bun run lint>

## Protected paths

- <glob>

## Caps

- Work-in-progress ceiling: <5> open pull requests with the routine prefix, across <repos>
- Queue cap: <25> agent-ready issues not started
- Needs-human cap: <10> open issues with the needs-human label
- Reminder age: <7> days

## Execution

- Delivery tier: <Production>
- Worker model: <sonnet> for priority <3–4>; otherwise inherit
- `/simplify` when the branch diff exceeds <150> changed lines

## People

- Reminders go to: <name> (<tracker user id>)
- Product decisions: <name> (<tracker user id>)

## Surfaces

Optional. Where a person sees each part once it is deployed:

- <web app: https://dev.example.com>

## Notes

### Cloud

<what cloud sessions have and lack>

### Queue

- Develop gate window: <3 days>

### Scanner

- Develop gate window: <8 days>
- Areas, by ISO week mod <n>: <0 = …>
- Tools: <…>
- Skip: <docs/tech-debt/>
- UI QA: <recipe, or none>

### Sweep

- People: <name> (<tracker user id>)
- Develop gate window: <3 days>
- Report document: <Sweep · <person>>, in the tracker project
- Pull request title suffix: < · sweep DD-MM>
- Caps: <none | n items touched per run>
- Only report: <issues the sweep lists but never touches, e.g. those that need an office network>

### Issue

- Before starting: <checks, e.g. the issue has a "For whoever does it" section>
- Tracker comments: <extra comments, e.g. a plan longer than four lines goes to a linked document>
- After merge: <tasks, e.g. regenerate the agent registry>
