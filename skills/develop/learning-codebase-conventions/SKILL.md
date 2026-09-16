---
name: learning-codebase-conventions
description: Discovers and follows the conventions of the codebase being changed. Use before writing or changing code in an existing repository, especially in an area not yet read this session — before creating a file, naming anything, choosing an error-handling or logging idiom, writing a test, or adding a utility. Also use when generated code looks foreign to the codebase or duplicates something that already exists.
---

# Learning Codebase Conventions

## Overview

A codebase already answers most style questions: how things are named, where they live, how errors and logs are handled, how tests are written, which helpers exist. Code that ignores those answers reads as foreign, gets rewritten in review, and duplicates what is already there. Ten minutes of reading before writing removes most of that.

**Core principle:** Match the codebase you are in, not your defaults. Read the neighbors before writing the newcomer.

## When to use

- First edit in a repository, package, or area you have not touched this session.
- Before creating a file, module, component, endpoint, or test.
- Before writing a helper; it probably exists.
- When a reviewer says "we don't do it that way here".

For a one-line change inside a function you have already read, skip the full pass, but still match the surrounding lines.

## The pass

Read, don't skim. Aim for the smallest set of files that answers each question.

1. **Project instructions first.** `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, the README, `docs/adr/` or similar. Then the lint and format configs (`.eslintrc*`, `biome.json`, `ruff.toml`, `pyproject.toml`, `.editorconfig`): they are conventions with teeth.
2. **Two or three siblings.** Open the files closest to what you will write: the nearest module, component, route, model, or test. Note:
   - naming: case, prefixes and suffixes, singular or plural, file names
   - layout: what goes in `__init__.py` or `index.ts`, one thing per file or grouped
   - imports: absolute or relative, ordering, extensions
   - errors: exceptions or result types, custom error classes, where they are caught
   - logging: logger name, structured fields, levels
   - types: strictness, tolerance for `any`/`Any`, validation library
   - comments and docstrings: present or not, what they say
3. **Existing helpers.** Before writing a utility, search for it by name and by concept (formatting dates, retries, pagination, slugs, money) in `utils`, `lib`, `shared`, `common`, `helpers`, and `services`.
4. **Tests.** Open one test next to the code you will touch: framework, file naming, fixtures or factories, mocking policy, how tests are named and structured.
5. **Domain vocabulary.** Use the names the code and docs already use for things: a `Workspace`, not a `Team`, if that is what the model calls it. Check a glossary or `CONTEXT.md` when one exists.
6. **Recent history of the area.** `git log -5 --oneline -- <path>`, then `git show` one commit: this is how the team actually changes this code.

## Record what you found

Before writing code, state the conventions you will follow in three to six lines. This makes them reviewable and stops you drifting back to defaults halfway through.

> Conventions for `apps/api/billing`: modules by feature (`billing/invoices.py`, `billing/tests/test_invoices.py`); errors are `BillingError` subclasses, raised anywhere and caught only in the router; structured logging through `get_logger(__name__)` with `extra=`; pydantic v2 models, no `Any`; tests use the `client` and `invoice_factory` fixtures; no docstrings on private functions. Existing helper for money math: `billing/money.py: quantize()`, which I will reuse.

## Conflicts and gaps

- **The codebase disagrees with your instincts:** follow the codebase. If the convention seems harmful, say so in one sentence and still follow it, unless changing it is the task.
- **The codebase is inconsistent:** follow the most recent, best-tested variant, or the lint config if it decides. Say which you picked.
- **Nothing to imitate (a new area):** borrow from the nearest existing area. Don't import a style from another project.
- **A convention is enforced by a tool:** run the formatter or linter on your change instead of matching by hand.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Writing a `formatDate`, `slugify`, or `retry` that already exists under another name | Search by concept before writing utilities |
| New file in the wrong place because you guessed the layout | Open two siblings first |
| A different error idiom in one function than the rest of the module | Match the module; consistency beats preference |
| Tests in a new style: different runner, mocks where the repo uses fakes | Copy the structure of a neighboring test |
| Renaming existing things to match "better" conventions | Out of scope; see `scoping-changes` |
| Reading only the README | READMEs lag; code and lint configs are the truth |

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source.
