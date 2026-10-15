---
name: scanning-for-issues
description: Find mode of an unattended routine — runs the develop gate, enforces the needs-human and queue caps, reminds about stale needs-human issues, scans what changed plus one rotating area for problems with a real cost (and the UI through a mocked end-to-end harness when the project has one), deduplicates by fingerprint, and files at most the free slots. Use as the skill a scheduled finder routine runs ("run scanning-for-issues with the project data at <paths>"). Never writes code. Has a dry run that only prints its decisions.
---

# Scanning for Issues

## Overview

A finder fills the tracker for executors and people without flooding it. Caps keep the attention budget, and fingerprints keep a finding from being filed twice. A finding that does not fit is not stored anywhere: the next scan finds it again.

**Core principle:** file only what a person or an executor can act on, and never more than the free slots.

## Steps

0. Read the project data and run the develop gate (`running-routines` §1–2) with the window from `### Scanner`. In a red repository, skip the checks that would only repeat the failure.
1. **Count**, without reading descriptions:
   - `nh`: open issues with the needs-human label, whoever filed them;
   - `queue`: agent-ready issues without the blocked label, in the backlog or todo state.
2. **Remind.** For each open needs-human issue with no assignee, labelled needs-human for longer than the reminder age: assign it to the reminders person and add one comment, in the project language and with the session link (`running-routines` §4), saying how long it has waited and why it needs a person (mention it if the fixer gave up). Never touch an issue that has an assignee: the assignment is the record.
3. **Slots:** `nh_free` = the needs-human cap minus `nh`; `fix_free` = the queue cap minus `queue`. If both are 0 or less, report "caps full" with both counts and stop without scanning.
4. **Scope:**
   - the files changed on the base branch within the window (`git log origin/<base> --since=<window> --name-only --format= | sort -u`, skipping deleted files);
   - plus the area at index `$((10#$(date -u +%V) % <n>))`, where `<n>` is the number of areas in `### Scanner`, numbered from 0 in the order it lists them (`10#` avoids octal errors in weeks 08 and 09).

   Keep only findings inside the scope. Repository tools may run on the whole repository.
5. **Scan the scope** for problems with a real cost:
   - security weaknesses (`security`);
   - data integrity or tenant isolation gaps (`data-integrity`);
   - swallowed errors at I/O boundaries (`error-handling`);
   - layer violations (`layering`);
   - duplicated logic (`duplication`);
   - dead code (`dead-code`);
   - missing tests on critical paths (`test-gap`);
   - type-safety holes (`type-safety`);
   - N+1 or unbounded queries (`performance`);
   - oversized modules (`complexity`).

   Use the tools `### Scanner` lists and install nothing. Skip what its skip list names.
6. **UI QA**, only if `### Scanner` describes a harness. Run the end-to-end suite: a test that fails twice is a finding, and one that passes on the rerun is flaky (report it). Visit the routes the recipe names, in the viewports it names, with realistic and empty data. Look for page-level overflow (`overflow`), clipped or overlapping text and unreachable controls (`layout`), text not in the project language (`text`), broken empty states (`empty-state`), broken error states (`error-state`) and console errors (`console`). Drop anything caused only by incomplete mock data.
7. **Fingerprint** each finding, with no dots (replace `.` with `-`: trackers autolink domain-like text):
   - tech debt: `<category>:<repo>/<path without extension>:<symbol>`, with `<category>` the slug from step 5;
   - UI: `qa-<kind>:<route>:<viewport>`, with `<kind>` the slug from step 6;
   - failing end-to-end test: `qa-e2e:<spec without extension>:<test title in kebab-case>`.

   For each finding, search the tracker, including completed, canceled and archived issues, for `Huella: <fingerprint>`. Compare the last line of every result exactly, after stripping markdown link syntax. Also search open issues by path and symbol.
   If any match is an open or canceled issue, drop the finding (canceled means the team decided not to fix it). Otherwise, if a match is a completed issue, keep it as a regression and link the old issue. An open issue on the same path and symbol counts as an open match.
8. **Rank and file.**
   - Give each finding its fixability with the rubric (`running-routines` §3).
   - Rank each group: security and data first, then failing end-to-end tests and broken flows, then maintenance, then cosmetic.
   - When in doubt about fixability, it is needs-human; never pick a label to get around a cap.
   - File the top `max(0, fix_free)` agent-ready findings and the top `max(0, nh_free)` needs-human findings. Agent-ready findings that do not fit are dropped, never relabeled.
   - Needs-human findings that do not fit are **held**: not filed. If any held finding is security or data, send one push notification for the run: `Needs human full (<nh after filing>/<cap>); held: <title>[, <title>…]`, listing only the held security and data findings.
   - Each issue:
     - **State and title:** backlog; title `[BUG] …` for defects, `[IMPROVEMENT] …` for debt.
     - **Labels:** finder + type + fixability.
     - **Priority:** high for security, data or a failing end-to-end test; low for cosmetic; medium otherwise.
     - **Description** in the project language, with sections: context (where), evidence (command output, or reproduction with the fixture used), goal, tasks (checkboxes), testable acceptance criteria, out of scope.
     - **Last line:** exactly `Huella: <fingerprint>` (a fixed token, never translated).
9. **Rules:** only create issues, plus the reminders of step 2. Never edit, relabel, close or comment on anything else. Never commit, push, branch or open pull requests; leave the repositories clean.
10. **Report:**
    - reminders sent;
    - counts before and after;
    - the scope (window and area);
    - issues filed (key, title, fixability, fingerprint);
    - held findings;
    - agent-ready findings dropped for lack of a slot (count);
    - duplicates dropped, with the matching key;
    - flaky tests;
    - anything that could not run.

## Dry run

When the prompt says "dry run" and names a state directory, read the state from these files instead of the tracker and the repository. Skip steps 0, 2 and 4–6, touch nothing and print exactly one fenced `json` block.

| File | Shape |
| --- | --- |
| `counts.json` | `{"nh": <int>, "queue": <int>}` |
| `findings.json` | `[{"fingerprint", "title", "category", "class": "security"\|"data"\|"e2e"\|"flow"\|"maintenance"\|"cosmetic", "fixability": "agent-ready"\|"needs-human"}]` |
| `existing.json` | `[{"key", "state": "open"\|"canceled"\|"completed", "last_line"}]` |

Compare `last_line` with `Huella: <fingerprint>` after stripping markdown link syntax (`[text](url)` → `text`).

Output:

```json
{"stop": null, "file": ["fingerprint"], "hold": ["fingerprint"], "drop": ["fingerprint"], "regressions": ["fingerprint"], "notify": false}
```

`stop` is `null` or `"caps full"`. `file` lists the fingerprints the run would file, including regressions; `regressions` lists the subset of `file` that matched a completed issue; `hold` lists needs-human findings not filed because the needs-human slots ran out; `drop` lists duplicates of open or canceled issues and agent-ready findings with no slot; `notify` is true when any held finding has class `security` or `data`. Unless `stop` is set, every finding appears in exactly one of `file`, `hold` or `drop`. When `stop` is `"caps full"`, `file`, `hold`, `drop` and `regressions` are empty and `notify` is false: a stopped run evaluates nothing. The dry run also skips step 8's push notification: `notify` is printed, not sent.

## Red flags

| Thought | Reality |
| --- | --- |
| "The cap is full, but this one matters" | Hold it and notify. The cap is the attention budget |
| "This finding is borderline; the agent-ready label gets it filed" | When in doubt, it is needs-human. Never pick a label to get around a cap |
| "I'll fix this tiny thing while I'm here" | A finder never writes code |
| "The title differs, so it's not a duplicate" | Fingerprints decide, not titles |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source. Generalized from the Kura scanner routine (2026-10): fingerprint dedupe, caps, hold-and-notify, an incremental scope with a rotating area. Decisions: `docs/adr/0002-routines-contract.md`.
