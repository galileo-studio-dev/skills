# Evals

Behavioral tests for the company-authored skills. They run Claude Code
headless against a generated fixture, so they cost real tokens and take
minutes; run them by hand before approving a change to the skill they cover.
The static checks that run in CI live in `scripts/check.sh`.

## Fixture

`fixtures/session-expiry/make.sh <dir>` builds a small Python project (two
green `unittest` tests, a spec with four requirements and two constraints, a
two-slice plan). With `--with-review-branch` it adds `feature/session-expiry`
carrying two planted defects: `GetSessionAge` renamed although the spec
forbids it, and a `try/except` in `refresh_session` that swallows the
revocation error. Every eval starts from this fixture; `scripts/check.sh`
uses it to exercise the delivery hooks.

## Evals

| Eval | What it runs | Passes when | Cost |
| --- | --- | --- | --- |
| `reviewing-pull-requests/run.sh` | The skill reviews the planted branch against a PR description that ticks every checklist box | Both defects found, verdict withholds readiness, scope and human-approval items unticked, no approval, repository untouched | ~1–2 min, one agent plus two sub-reviewers |
| `delivering-changes/run.sh` | The `delivery` plugin delivers the two-slice plan through Worker and Reviewer agents, with a bare origin to catch pushes | Two slice commits, tests green, `GetSessionAge` untouched, tree clean, nothing pushed, gates fired on both layers, both roles dispatched, report says `status: verified` | ~4–5 min, about $1.5 on Sonnet |
| `scoping-changes/run.sh` | The same bounded task with and without the skill; `measure.sh` compares both arms | Judged by reading: the with-skill arm should add fewer lines, keep the signature, add fewer tests, and report in fewer words | ~2–3 min, two agents |

Each `run.sh` accepts a work directory as its first argument and leaves the
fixture, the JSON stream, and the report there for inspection. The
`check.sh` scripts can be rerun on a saved work directory. They end with the
run's cost, duration, cache-read share, cost per slice, and a per-agent table
of turns and context × turns from `lib/usage.py`, and write the same numbers
to `metrics.json`. Judge a change to a skill or to the plugin by cost per
verified slice at equal pass rate, not by token counts: an agent loop pays
for context × turns, and cache reads cost a tenth of fresh input.

Prerequisites: `claude` logged in, `jq`, `python3`, and `npx` for the Skills
CLI, which installs the catalog into the fixture at project scope.

## Adding an eval

A skill that changes behavior ships with an eval or a change to one. Keep the
fixture shared, put prompts in files, make `check.sh` deterministic where the
outcome is observable (files, commits, logs) and describe the judgment call
where it is not.
