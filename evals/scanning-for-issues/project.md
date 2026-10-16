# Project data

Read by the routine skills (`running-routines` §1). Values only: process lives in the skills, and code conventions live in `AGENTS.md`.

## Language

en: issues, comments, questions, pull request bodies and reports for people are written in this language.

## Tracker

- Tool and channel: Files in the state directory
- Team / project: EV / Eval
- States: backlog Backlog, todo Todo, in progress In Progress, in review In Review, done Done, needs HITL Needs HITL
- Labels: agent-ready `Agent ready`, needs-human `Needs human` (single-select group Fixability), blocked `Blocked`, finder Scanner, types Bug, Improvement
- Tracker–Git integration moves states on pull request events: no

## Branches

- Base: develop. Production: main.
- Routine branch prefix: `routine/` (full name `routine/<issue-key-lowercase>-<slug>`)
- Pull request title: `<type>: <summary> (<KEY>)`
- Pull request template: .github/pull_request_template.md

## Verification

- Commands: AGENTS.md § Verification
- Base branch CI: workflow CI (`.github/workflows/ci.yml`), required check ci-ok
- Gate command (the develop gate's confirmation, minutes not hours): make check

## Protected paths

- `migrations/**`
- `infra/**`

## Caps

- Work-in-progress ceiling: 5 open pull requests with the routine prefix, across app
- Queue cap: 25 agent-ready issues not started
- Needs-human cap: 10 open issues with the needs-human label
- Reminder age: 7 days

## Execution

- Delivery tier: Production
- Worker model: sonnet for priority 3–4; otherwise inherit
- `/simplify` when the branch diff exceeds 150 changed lines

## People

- Reminders go to: Eval Person (u-1)
- Product decisions: Eval Person

## Notes

### Cloud

The eval runs in dry run: nothing is cloned and no tracker or Git host is reached.

### Queue

- Develop gate window: 3 days

### Scanner

- Develop gate window: 8 days
- Areas, by ISO week mod 2: 0 = app/api, 1 = app/lib
- Tools: `make check`
- Skip: `docs/`
- UI QA: none
