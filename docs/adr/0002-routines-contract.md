# ADR 0002: One contract for agent routines

Status: accepted for Kura, proposed for Piro. Date: 2026-10-15.

## Context

Two repositories run unattended Claude Code routines with diverging setups:

- **Piro** (`piro-ip-monorepo`): a `factory/` process and per-ticket routine sessions fired by a dispatcher, plus a nightly sweep. Agents auto-merge levels 0–1, and a `Needs HITL` state carries questions.
- **Kura** (`compliance-backend` + `compliance-frontend`): a weekly finder (scanner) and a weekday executor (fixer), with work-in-progress caps and cost controls. It produces draft PRs only.

Each copied the catalog and rewrote its data in place, so fixes did not travel.

## Decision

1. **Ownership.** The contract and the generic skills live in this catalog. Carlos Figueredo owns them; Pablo García Bolívar is a required reviewer (CODEOWNERS). Each repository decides its own adoption.
2. **Language.** Skills are in English. Each repository's project data declares the language of everything a person reads.
3. **Project data.** Each repository has one project data file with fixed headings. `AGENTS.md` points to it in one line. Skills read it on demand: routine-only data does not belong in `AGENTS.md`, which every session loads.
4. **Prompts.** A routine's prompt is one line naming a mode skill and the data files. There is no per-repository routine instruction file.
5. **Agent-ready work is a label.** It is the stored result of the rubric (single-select group: agent-ready | needs-human), set at triage. Executors take only labelled issues.
6. **A question is a state, not a label.** Questions move an issue to `Needs HITL` and keep it agent-ready. Structural blockers add `blocked` + needs-human. Only needs-human counts toward the cap.
7. **One implementation loop.** `working-an-issue` does the tracker side and calls `delivering-changes` for the code.
8. **Execution is a scheduled batch session.** No routine-fire token lives in any agent environment. Subagents cannot start subagents, so the session is the Controller for each issue in turn.
9. **Every run starts with the develop gate.** Kura's CI gains `push: develop` for it once compliance-backend #136 and compliance-frontend #132 merge; until then the gate falls back to merged pull requests' checks.
10. **Agents never merge, in any repository.** This reverses Piro's 2026-10-13 auto-merge of levels 0–1, so it is a proposal for Pablo. PR levels shrink to a protected-paths list.
11. **Installation.** Skills are installed with `npx skills` and pinned in `skills-lock.json`.

## Consequences

- A behaviour change is a catalog pull request reviewed by both owners. A value change is a project pull request.
- Piro keeps its process until Pablo accepts each change. The proposal pull request is split one decision per commit.
- The sweep (Piro's barrido) and the dispatcher stay project skills until a generic version exists.
