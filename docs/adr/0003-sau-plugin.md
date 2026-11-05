# ADR 0003: SAU plugin — a site-agnostic SEO process with file-derived state and enforced gates

Status: proposed. Date: 2026-11-05.

## Context

SAU (SEO Auto Upgrade) is the process the company uses to improve its own websites' pages for search and AI answers. Today it is seven skills — `site-brief-builder`, `keyword-fanout-map`, `seo-content-writer`, `motion-director`, `onpage-optimizer`, `internal-link-architect`, `ai-visibility-checker` — kept inside one website repository and chained by prose: a project instructions file, a roadmap file, and a protocol for batches of up to five seed keywords (a *tanda*). Running it on two sites exposed five problems:

- **Hard-coded paths.** The skills name the folder they live in and the folder their outputs go to, so a second site needs edited copies.
- **Split repositories.** On one site the code lives in a different repository from the SEO data. The process works around it with exceptions written in prose.
- **Advisory gates.** The keyword approval, the legal review, the OK before a pull request, the definition of "published", and keeping brief-only material (lines marked `[PRIVADO]` or `[OBJETIVO]`) out of the code all depend on the agent remembering a paragraph.
- **Broken links on Windows.** The `.claude/skills` symlinks that exposed the skills to Claude Code do not resolve on the team's Windows machines.
- **Stale account copies.** Older uploads of the same skills in the Claude account (`anthropic-skills:<name>`) can load instead of the repository's version; a rule file asks the agent not to use them, and nothing stops it.

The `delivery` plugin (ADR 0001) solved the same shape of problem for software delivery: an orchestrating skill, role subagents, and hooks that hold the gates regardless of prompt quality.

## Decision

Add a `sau` plugin to the catalog, scoped to SAU only. The post-publication review process (SAR: change tracking, the 15-day performance review, page refresh) stays outside; the plugin ends by saying when SAR takes over.

1. **Site profile.** Each site describes itself in `<dir>/.sau/site.json`, inside its own private repository, validated by `plugins/sau/profile.schema.json`: identity and market (`site`, `domain`, `locale`), paths (`brief`, `output_dir`), repositories (`code_repo`, `content_repo`), branches (`base_branch`, `production_branch`, `branch_prefix`), the default unit of work (`mode: page | tanda`), motion policy (`install-kit | plan-only`), local `checks`, `forbidden_terms_file`, `legal_review: blocking | informative | off` with an optional `legal_agent`, tracker defaults, `publish_notes`, and the on-page threshold `onpage_min`. A new site needs a profile and a brief, nothing in the plugin.
2. **Seven skills, generalized.** The skills move into `plugins/sau/skills/` from their newest versions, with every path read from the profile and every script called through `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/…`. Site data embedded in them (tracker defaults, site names) is removed. Their text stays in Spanish, the language of the sites they serve, for `running-sau`, `sau-step`, `site-brief-builder` and `motion-director`; the other pass-through skills stay in English, as in their source; the manifest, this ADR and the README are in English like the rest of the catalog. Each keeps a `## Credits` section.
3. **Orchestrator `running-sau`.** It reads the profile, derives each unit's state from the files in `output_dir` plus a small `estado.json` that records only the gates passed (when, by whom), proposes one next step, runs it, and stops at each gate: P1 keywords or reparto approved, P2 content approved (on-page score ≥ `onpage_min`, legal report per policy), P3 merged into `base_branch` with explicit OK after the profile's `checks`, P4 published (production deployment `READY`, indexing requested), then close. A status view lists every unit with its step and pending gate. The full table of steps, evidence files and gate rules is `plugins/sau/docs/states-and-gates.md`.
4. **Agent `sau-step`.** One seed of a tanda (draft → on-page → code) in its own worktree, at most three at once, with a fixed brief and handoff. It never pushes, opens pull requests, writes `estado.json`, or talks to the person: those stay with the orchestrator in the main session, where gates can be asked.
5. **Hooks hold what must not depend on memory.** `gate.sh` turns push, pull-request and production-deploy commands into a permission prompt for every agent, naming the missing gate when it can tell. `forbidden.sh` denies file-tool writes (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`) into the code repository's source paths that contain a term from the site's `forbidden_terms_file` or a line marked `[PRIVADO]`/`[OBJETIVO]`, and denies `sau-step` writes to `estado.json`; writes made from the shell are not checked by it and are covered by the last pass before P3. `no-account-copies.sh` denies loading any of the seven skills under a name other than `sau:<skill>`. The hooks are bash entry points running stdlib-only Python 3 (`py` or `python3`), because the Windows machines that run SAU have neither `jq` nor `python3`.

The plugin holds no site data. Briefs, outputs, forbidden terms, competitor lists, tracker projects and people, and deploy-account details live only in each site's private repository, behind the profile's pointers.

## Alternatives

- **Keep the skills in the website repository and fix the paths.** Smallest change; rejected because it keeps one site's repository as the home of a process other sites use, leaves the gates advisory, and does not solve the Windows symlinks or the account copies.
- **One copy of the skills per site.** Simple to reason about per site; rejected because fixes stop travelling, which is the failure ADR 0002 describes for routines.
- **Gates in prose only, inside `running-sau`.** Cheaper than hooks; rejected as the sole mechanism for the same reason as in ADR 0001. The orchestrator still checks the gates; the hooks are the layer that holds when it forgets.
- **State in a database or the tracker.** Richer history; rejected because the output files already prove each step, the tracker is optional per site, and a second source of truth drifts. `estado.json` stores only what no file proves: the person's decisions.
- **Workflow scripts for tandas.** Deterministic parallelism; kept for later, as in ADR 0001. Tandas are small (≤ 5 seeds) and each seed ends at a human gate anyway.

## Consequences

- A new site is a profile and a brief. Sites whose code and content live apart are first-class instead of an exception.
- Gates become visible state: `estado.json` shows who approved what and when, and a step changed after its gate shows the gate as stale.
- Brief-only material gains a hard check at the point it would leak into code, which one of the first two sites did not have before.
- The skills stop being editable in place in the website repository. Changes go through this catalog's review, like every other skill.
- The website repositories need a migration: add their profiles, point the rule file at `sau@galileo-skills`, and remove the old skills folder and symlinks after the plugin is verified. An organization admin has to retire the account copies.
- The catalog's `scripts/check.sh` grows SAU hook tests, and the README gains the seven skills plus `running-sau`.

## Risks

- **Private data in a public repository.** The catalog is public. A copied example, eval fixture or skill default could carry a site name, competitor, brief line or tracker detail. Mitigation: examples use `example.com`; a privacy grep and an independent review run before any pull request; `forbidden.sh` has no built-in terms.
- **On-page score is not machine-readable.** `onpage-optimizer` writes its score into an HTML report filled by hand, so the threshold is checked by the orchestrator reading the report and recording the score at P2, not by a hook.
- **Profile discovery.** Hooks find profiles under the session's git root and match written files by their repository's `origin` remote. A checkout with a different remote, or a session started outside the content repository, is not covered; the hook stays silent rather than blocking unrelated work.
- **Legacy layouts.** Pages made before the plugin may keep outputs at the root of `output_dir`, and the first tanda kept motion plans in a shared folder. State detection accepts both layouts read-only; new units always use the documented layout.
- **Deviation from the batch protocol.** Today a seed agent pushes its branch and opens a draft pull request. In the plugin the orchestrator does it, so every push meets `gate.sh` in a session that can ask. The protocol's lesson "push each branch when its step ends" becomes the orchestrator's job, right after each handoff.
- **Entry point name.** Every plugin component keeps the plugin prefix (`/sau:running-sau`); a bare `/sau` is not possible from a plugin. Two thin command files give short entry points, `/sau:sigue` (next step) and `/sau:estado` (status), both delegating to `running-sau`. Commands are the older format; they were chosen over two extra skills so that the catalog's skill list and README tables stay one entry per real skill.

## Verification plan

- `scripts/check.sh` green: frontmatter, `name` equal to the directory, one `## Credits` per skill, README tables and skill map, valid JSON for the manifest, hooks and `profile.schema.json`, hooks executable.
- Hook tests with synthetic input in `scripts/check.sh`: `gate.sh` asks for `git push` and `gh pr create`, stays silent for `git diff`; `forbidden.sh` denies a fixture term and a `[PRIVADO]` line under `src/`, allows clean text, ignores paths outside `scan_paths`, and denies `sau:sau-step` writing `estado.json`; `no-account-copies.sh` denies `anthropic-skills:keyword-fanout-map` and allows `sau:keyword-fanout-map`.
- `examples/site.example.json` validates against `profile.schema.json`. **Pending (next iteration):** the check in `scripts/check.sh` does not exist yet.
- A grep of `plugins/sau/` finds no site names, competitor names, `[PRIVADO]`/`[OBJETIVO]` lines with content, or tracker data.
- Eval on a fake site (profile, brief, half-finished outputs under `evals/sau/`): the status view reports the right step and pending gate, and the orchestrator stops at P1 without writing anything. **Pending (next iteration):** this eval of the orchestrator with a half-finished fake site is not written yet.
- Real run with `claude --plugin-dir plugins/sau` in a website repository, read-only: a finished page reports the right state, and the most recent tanda is read correctly in `tanda` mode, including its legacy motion layout.
