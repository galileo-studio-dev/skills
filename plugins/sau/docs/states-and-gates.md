# SAU states and gates

Specification shared by the `running-sau` orchestrator, the `sau-step` agent and the plugin hooks. Decision record: `docs/adr/0003-sau-plugin.md`. Profile format: `plugins/sau/profile.schema.json`.

Terms:

- **Profile:** `<dir>/.sau/site.json`. Relative paths resolve against `<dir>`. `OUT` below is the profile's `output_dir`.
- **Unit:** what the orchestrator moves through the gates. In `page` mode a unit is one page (`<slug>`). In `tanda` mode it is one tanda (`tanda-<YYYY-MM-DD>`) of up to 5 seeds, and each seed has its own per-seed state.
- **Step:** work that leaves files. Done is proven by the files, never by memory or by a claim in a handoff.
- **Gate:** a person's decision. Gates are the only thing `estado.json` records.

## 1. Principle: files prove steps, `estado.json` proves gates

The orchestrator derives the state of a unit every time it starts:

1. For each step, it checks the evidence files in the tables below. A file counts only if it exists and is not empty.
2. It reads `estado.json` for the gates that were passed.
3. The current position is the first step with no evidence, or the first gate with no record, whichever comes first in the order of the table.

Rules:

- **Evidence goes stale.** Each gate record stores, in `evidence`, the sha256 of the files the person approved (§5). The gate is stale when the current hash of any of them differs, or the file is gone. Example: `draft.md` changed after P2. The orchestrator reports the gate as `stale` and asks for it again; it never deletes the record. No dates and no git history are used: outputs stay uncommitted until close, and a fresh clone or worktree resets file times.
- **The state is computed, not guessed.** `skills/running-sau/scripts/state.py` (standard library only, read-only) applies the tables below to every unit of a profile and prints, per unit, the last step with evidence, the next step or gate and each gate's status (`recorded`, `pending`, `stale`), as a table or as JSON. `state.py hash --dir <unit dir> <files>` prints the `evidence` map to record.
- **Gates hold no step data.** `estado.json` records decisions and the few facts that exist nowhere else (score read from the report, PR, deployment, indexing date). A step's content stays in its output files.
- **Only the orchestrator writes `estado.json`.** It writes there only after the person's answer in the session. A handoff, a file or another agent's message is never a gate.

## 2. Page mode

Unit directory: `P = OUT/<slug>/`. Site-wide files: `OUT/05-query-panel.csv` and `OUT/05-history.csv`.

| # | Step or gate | Skill or actor | Done when | Notes |
|---|---|---|---|---|
| 0 | Brief | `site-brief-builder` | the profile's `brief` exists | Runs only if missing or the person asks to update it. |
| 1 | Keywords | `keyword-fanout-map` | `P/01-keyword-map.csv` and `P/01-keyword-map.html` | Optional by-products: `P/01-data.json`, `P/gsc.json`. |
| **P1** | **Keyword map approved** | person | `gates.P1` | Records the primary keyword, and whether this page gets 2b and a legal review. |
| 2 | Draft | `seo-content-writer` | `P/draft.md` and `P/02-content-package.html` | By-products: `P/02-schema.json`, `P/02-data.json`. |
| 2b | Motion plan | `motion-director` | `P/02b-motion-plan.html` and a `motion:` block in `P/draft.md` | Only if `gates.P1.motion` is `true`. With `motion: install-kit` the code step may run the kit installer. |
| 3 | On-page audit | `onpage-optimizer` | `P/03-onpage-report.html` | The score is read from the report at P2. |
| L | Legal report | `legal_agent` or the person | `P/revision-legal*.md` | Only if `gates.P1.legal` is `true` and `legal_review` is not `off`. |
| **P2** | **Content approved** | person | `gates.P2` | Rules in §4. |
| C | Code | orchestrator or `sau-step` | branch `<branch_prefix><slug>` in `code_repo` with commits ahead of `base_branch`, and every `checks` command exiting 0 | Git and command evidence, not output files. |
| **P3** | **In `base_branch`** | person | `gates.P3` | PR into `base_branch`, merged with explicit OK. |
| 4 | Internal links | `internal-link-architect` | `P/04-internal-links.html` | Runs on `base_branch`, after P3. Link changes in code go through their own branch and the same P3 flow. |
| 5 | AI visibility | `ai-visibility-checker` | `P/05-ai-visibility.html` and a row dated this month in `OUT/05-history.csv` | Content gaps it finds go back to step 1 as new units. |
| **P4** | **Published** | person + deploy | `gates.P4` | Rules in §4. |
| **Close** | **Closed** | orchestrator | `gates.close` | Rules in §4. |

Steps 4 and 5 may run before or after P4. The unit closes only when both have evidence and P4 is recorded.

**Branches.** Page outputs and `estado.json` are committed by the orchestrator on `<branch_prefix><slug>` of `content_repo`; for a single-repository site that is the same branch as the code.

**Pull request of the outputs.** When `content_repo` differs from `code_repo`, the orchestrator also pushes the outputs branch of `content_repo` (`<branch_prefix><slug>`) and opens a PR into `base_branch`. In page mode this happens at close; when both are the same repository, the outputs travel in the code PR at P3. Always with the person's OK, through `gate.sh`. At close, the orchestrator reminds the person to merge it, with explicit OK.

**Legacy layout.** Pages made before the plugin may have their outputs directly in `OUT/` instead of `OUT/<slug>/`. The orchestrator shows such a unit as slug `(root)` in `estado`, read-only, and never writes a new unit there.

## 3. Tanda mode

Unit directory: `T = OUT/tanda-<YYYY-MM-DD>/`. Seed directory: `S = T/<slug>/`. Maximum 5 seeds. No new tanda opens while another is not closed.

| # | Step or gate | Actor | Done when | Notes |
|---|---|---|---|---|
| 0 | Brief | `site-brief-builder` | the profile's `brief` exists | As in page mode. |
| 1 | Shared keyword run | `keyword-fanout-map`, once for all seeds | `T/01-keyword-map.csv` and `T/01-keyword-map.html` | Crossed with the profile's `existing_pages`. |
| R | Reparto | orchestrator | `T/00-reparto.csv` | Format below. `T/00-reparto.md` is the readable version shown to the person. |
| **P1** | **Reparto approved** | person | `gates.P1` | Nothing is dispatched before it. |
| 2 | Draft, per seed | `sau-step` | `S/draft.md` and `S/02-content-package.html` | |
| 2b | Motion plan, per seed | `sau-step` | `S/02b-motion-plan.html` (also accepted: `T/motion/<slug>-02b-motion-plan.html`, the layout of tandas made before the plugin) | Only if the seed's `motion` column is `si`. |
| 3 | On-page audit, per seed | `sau-step` | `S/03-onpage-report.html` | |
| L | Legal report, per seed | orchestrator, dispatching `legal_agent` once `S/draft.md` exists (or the person, without one) | `S/revision-legal*.md` | Only if the seed's `legal` column is `si` and `legal_review` is not `off`. |
| C | Code, per seed | `sau-step` | branch `<branch_prefix><slug>` in its worktree of `code_repo`, `checks` green | The orchestrator pushes it and opens a draft PR (§6). |
| D | Delivery | orchestrator | `T/entrega.md` | One row per seed: keyword, preview link, PR, on-page score, legal (if any), warnings. A seed that failed appears as `fallida` with the reason. |
| **P2** | **Seed approved**, per seed | person | `gates.seeds.<slug>.P2` | Verdict `aprobada`, `cambiar` or `descartada`. `cambiar` sends only that seed back to step 2 or 3. |
| **P3** | **Seed in `base_branch`**, per approved seed | person | `gates.seeds.<slug>.P3` | Merged one at a time, in reparto order. Conflicts in `tanda.shared_files` keep the lines of both pages. |
| 4 | Internal links, once | `internal-link-architect` on `base_branch` | `T/04-internal-links.html` | After every approved seed is in `base_branch`. Its code goes in its own PR, through P2 and P3 like a seed. |
| 5 | AI visibility, once | `ai-visibility-checker` | `T/05-ai-visibility.html` and a row dated this month in `OUT/05-history.csv` | Uses the site-wide `OUT/05-query-panel.csv`. |
| **P4** | **Published**, once | person + deploy | `gates.P4` | One release for the whole tanda. |
| **Close** | **Closed** | orchestrator | `gates.close` | Discarded seeds: their PR closed and branch deleted only with the person's OK. |

**Where a tanda's files are read.** A tanda's outputs live on one branch of `content_repo`, `<branch_prefix><site>-tanda-<YYYY-MM-DD>`, in one worktree of it (see `git worktree list`). While that worktree exists, `T` resolves inside it, not in the main checkout; after the branch is merged, `T` resolves in the main checkout. The orchestrator creates each seed's worktree of `code_repo` on `<branch_prefix><slug>` from `origin/<base_branch>` before dispatching the seed, and it alone commits in `content_repo`.

**Pull request of the outputs (tanda).** After delivery (D), the orchestrator pushes the tanda's outputs branch and opens a PR from it into `base_branch` of `content_repo`: always with the person's OK, through `gate.sh`, and as a PR of its own, apart from the seeds' code PRs. At close, it reminds the person to merge it, with explicit OK.

Optional files a seed may leave: `S/pendiente-compartido.md` (changes the seed needed outside its own files, for the orchestrator to handle). The orchestrator surfaces it in `entrega.md`.

### `00-reparto.csv`

Header, in this order. The first seven columns are the existing format; the last two are new and optional.

```csv
semilla,slug,tipo,archivo,keyword_principal,secundarias,excluidas,motion,legal
```

| Column | Values |
|---|---|
| `semilla` | 1–5, the merge order |
| `slug` | `[a-z0-9-]+`, unique in the tanda |
| `tipo` | `nueva` or `actualizar` |
| `archivo` | the seed's content file in `code_repo`, inside one of `tanda.content_dirs` |
| `keyword_principal` | one keyword |
| `secundarias`, `excluidas` | keywords separated by `;`. `excluidas` holds the other seeds' and the existing pages' keywords: the seed may not use them |
| `motion`, `legal` | `si` or `no`. A missing column or an empty cell means `no` |

No two seeds share a primary keyword or an intent. If they do, the orchestrator merges or changes one before P1.

## 4. Gate rules

| Gate | Preconditions the orchestrator checks | What the person decides | Fields recorded |
|---|---|---|---|
| P1 | page: step 1 evidence. tanda: steps 1 and R evidence, ≤ 5 seeds, no shared primary keyword. | Approve the map or the reparto, and choose motion and legal per page or seed. | `motion`, `legal` (page mode); `seeds` (tanda: list of slugs) |
| P2 | Steps 2, 3 (and 2b, L when requested) have evidence. On-page score ≥ `onpage_min`. With `legal_review: blocking` and a requested review: the report exists. Tanda: the seed is in `entrega.md` with its review evidence: the preview link when `preview` is `url` (default); with `preview: none`, the draft plus the local check of `local_preview_cmd` when it is set. | Approve the content (page mode: the draft; tanda and any site whose flow reviews a preview: the preview). | `onpage_score`, `legal` (`not-requested`, `attached: <file>`, or `missing` when informative), `verdict` (tanda) |
| P3 | P2 recorded and not stale. Every `checks` command exits 0 in the branch, run in this session. Before content reaches `base_branch`, a last pass that nothing the brief forbids remains. | OK to open the PR as ready and to merge it. | `pr`, `merged_commit`, `checks` (commands that passed) |
| P4 | P3 recorded. Release `base_branch` → `production_branch` merged only after the person says to publish, and only after reviewing what else the release carries. With `publish_check: deployment` (default), the production deployment of that commit is `READY`; with `publish_check: manual`, the person confirms the release is live. Either way, the page and its redirects answer on `https://<domain>`. | Publish. | `release_pr`, `deployment`, `live_urls`, `indexing_requested` (date, when `request_indexing`) |
| Close | P4 recorded; steps 4 and 5 have evidence. | Nothing new: the orchestrator records it and reports. | `notes_shown` |

Reminders the orchestrator gives, not gates:

- Before opening a unit, when `sar_register` is `true` and the page has an open SAR follow-up: warn, and do not open the unit without the person's explicit OK, except for a serious error (a page is not changed again while its review is pending).
- After every push to a branch with a preview, before P3 and at P4: each item of `publish_notes`.
- At P3, when `sar_register` is `true`: register the change in SAR with `change-tracker` when its PR opens; the 15-day review is not dated until P4.
- At P4, when `sar_register` is `true`: give SAR the production date (`change-tracker`), so the 15-day review gets its date; until then the record stays pending publication.
- At P4, when `request_indexing` is `true`: list every published or changed URL in `locale` and each of `alternate_locales`, for the person to request indexing; record the date. The 15-day review counts from when the search engine shows the new title, not from the deployment. After 7 days, check that Google shows the new title; if it does not, request indexing again. With `sar_register`, SAR does this.
- At close: each item of `close_notes`, and, when `sar_register` is `true`, that SAR (`performance-review`) takes over the page.

Published means a production deployment in `READY` with the commit (with `publish_check: manual`, the person's confirmation instead) and the URLs answering. A merge into `base_branch` or `production_branch` is not publishing.

**Previews.** When a preview asks for a login the orchestrator cannot pass, or `preview` is `none`, it checks the same commit locally with `local_preview_cmd` on a free port (status, title, H1 and redirects) and then stops only the process it started, by its port or PID, never every process of that runtime.

**Actions for the person.** Whenever a gate or a reminder needs the person to do something, the orchestrator gives a direct link or a command ready to paste, with branches, numbers and URLs already filled in.

**Commit author.** When the profile sets `git_author_email`, every SAU commit uses it: the orchestrator's in `code_repo` and `content_repo`, and `sau-step`'s.

`legal_review: informative` never blocks any gate. The report is shown when it exists, and its absence is recorded as `missing`.

## 5. `estado.json`

Page mode: `OUT/<slug>/estado.json`. Tanda mode: `T/estado.json`. UTF-8, two-space indent. Every gate record has `at` (ISO 8601 with offset), `by` (who approved, as the person wrote it or as the session identifies them) and optionally `note`. Unknown keys are kept on rewrite.

`evidence` maps each approved file, by its path relative to the unit directory (`P` or `T`, with `/`), to the sha256 of its content with CRLF read as LF, so a line-ending conversion alone never makes a gate stale. It is written from the output of `state.py hash`, never by hand:

| Gate | `evidence` holds |
|---|---|
| P1 | page: `01-keyword-map.csv`. tanda: `00-reparto.csv` |
| P2 | page: `draft.md`, `03-onpage-report.html`, and `02b-motion-plan.html` and the legal report when they exist. tanda: the same files of the seed (`<slug>/draft.md`, …) |
| P3, P4, close | nothing: they rest on git and deployment facts, and they require the earlier gates not to be stale |

A record without `evidence` (written before this format) is read as recorded and never stale; `state.py` shows it as `evidence: none`.

Page mode:

```json
{
  "schema_version": 1,
  "site": "example",
  "mode": "page",
  "unit": "pricing",
  "gates": {
    "P1": { "at": "2026-11-05T10:12:00+01:00", "by": "owner", "keyword": "pricing software", "motion": true, "legal": false, "evidence": { "01-keyword-map.csv": "<sha256>" } },
    "P2": { "at": "2026-11-06T09:40:00+01:00", "by": "owner", "onpage_score": 94, "legal": "not-requested", "evidence": { "draft.md": "<sha256>", "03-onpage-report.html": "<sha256>", "02b-motion-plan.html": "<sha256>" } },
    "P3": { "at": "2026-11-06T12:05:00+01:00", "by": "owner", "pr": "https://github.com/example-org/example-web/pull/42", "merged_commit": "abc1234", "checks": ["npm run lint", "npm run build"] },
    "P4": { "at": "2026-11-10T17:30:00+01:00", "by": "owner", "release_pr": "https://github.com/example-org/example-web/pull/45", "deployment": "READY", "live_urls": ["https://www.example.com/es/pricing", "https://www.example.com/en/pricing"], "indexing_requested": "2026-11-10" },
    "close": { "at": "2026-11-10T17:45:00+01:00", "by": "orchestrator", "notes_shown": true }
  }
}
```

Tanda mode: P1, P4 and close are tanda-level; P2 and P3 are per seed.

```json
{
  "schema_version": 1,
  "site": "example",
  "mode": "tanda",
  "unit": "tanda-2026-11-05",
  "gates": {
    "P1": { "at": "2026-11-05T11:00:00+01:00", "by": "owner", "seeds": ["alpha", "beta", "gamma"], "evidence": { "00-reparto.csv": "<sha256>" } },
    "seeds": {
      "alpha": {
        "P2": { "at": "2026-11-07T10:00:00+01:00", "by": "owner", "verdict": "aprobada", "onpage_score": 92, "legal": "attached: alpha/revision-legal.md", "evidence": { "alpha/draft.md": "<sha256>", "alpha/03-onpage-report.html": "<sha256>", "alpha/revision-legal.md": "<sha256>" } },
        "P3": { "at": "2026-11-07T12:00:00+01:00", "by": "owner", "pr": "https://github.com/example-org/example-web/pull/50", "merged_commit": "def5678", "checks": ["npm run build"] }
      },
      "beta": {
        "P2": { "at": "2026-11-07T10:05:00+01:00", "by": "owner", "verdict": "descartada" }
      }
    }
  }
}
```

A seed with `verdict: descartada` is out of the tanda. A seed with `verdict: cambiar` gets its P2 record replaced when it is approved later; the earlier verdict moves to `history` (an array on the seed) so nothing the person decided is lost.

## 6. Enforcement: what each hook holds

The gates above are the orchestrator's job. The hooks hold the part that must not depend on the agent remembering. Hook scripts are bash entry points, run as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<hook>.sh"` so a plugin path with spaces works, that run a stdlib-only Python 3 script, found as `py` or `python3` (some Windows machines have neither `jq` nor `python3`). Without Python 3 each script falls back to a minimal text check that asks, rather than staying silent, on the commands and markers it holds. Without Python 3, `gate.sh`'s text check also asks only near a site profile.

`gate.sh` asks only when the command's target repository is the `code_repo` or `content_repo` of a site profile found from `CLAUDE_PROJECT_DIR`, the session directory or the target directory. The target repository is the session directory (following `cd`/`pushd`/`Set-Location` in the command), `git -C <dir>`, `gh -R/--repo`, the `repos/<owner>/<repo>` endpoint of `gh api`, or the URL or remote named in `git push`; for `vercel` it is the session directory. It is compared as owner/repo, https or ssh, case-insensitively. With no profile it stays silent. When a profile is found but the target repository cannot be determined (an unresolvable `cd` or `-C`, no readable remote), it asks.

The missing-gate note is given only for profiles whose repository is the target. P3 is looked up for the unit of the current branch (`HEAD:<production_branch>`, `<x>:<production_branch>` and `refs/heads/<production_branch>` count as a release). A branch `<branch_prefix><site>-tanda-<YYYY-MM-DD>` is the unit `tanda-<YYYY-MM-DD>`, and its gate is looked up in that tanda's own `estado.json`.

When a `.sau/site.json` that would be read cannot be parsed, `gate.sh` (for a held command) and `forbidden.sh` (for any file-tool write) ask, naming the file and the parse error. `forbidden.sh` also asks when the file is in the repository of a profile (or, outside git, inside its directory) but that repository's `origin` cannot be read.

`forbidden.sh` is declared with `"onFailure": "block"` (Claude Code v2.1.295 or later): if it cannot start, crashes or times out, the write is blocked. An internal error inside the script answers `ask`.

Known limit: git aliases stored in the configuration (`git config alias.p push`, then `git p`) are not detected; only `git -c alias.<x>=push <x>` is.

| Hook | Event and matcher | Holds | Answer |
|---|---|---|---|
| `gate.sh` | PreToolUse `Bash\|PowerShell`, every agent | `git push`, `gh pr create`, `gh pr ready`, `gh pr merge`, `gh pr close` (also with `-R`/`--repo`), `git push --delete`, `gh api` calls that write (a method other than `GET`, or a body with `-f`/`-F`/`--input`), deploy-to-production commands (`vercel --prod`, `vercel deploy --prod`, `vercel --target production`, `vercel promote`), plus `gh pr edit --base`, `gh release create`, `vercel alias` (except `ls`), `vercel rollback`, `gh api -XPOST`/`--method=POST`, `git -c alias.<x>=push <x>`; package runners `npx`, `bunx`, `pnpm dlx`, `yarn dlx` (and `vercel@<version>`); and a command echoed into a shell (`echo … | sh`, `bash`, `pwsh`). Found after shell keywords and wrappers (`if … then`, `time`, `timeout`, `nohup`, `xargs`, `env`, `sudo`) and inside `bash -c`, `sh -c`, `eval`, `powershell -c`/`pwsh -Command` and `cmd /c` | `ask`. When the target branch is `<branch_prefix><slug>` and no gate record has the gate that action needs (P2 before a non-draft `gh pr create`, `gh pr ready` or `gh pr merge`; P3 before a release into `production_branch`), the reason says which gate is missing. Gate records are the `estado.json` files of every profile found, in its own checkout and in every worktree that `git worktree list` shows. It still asks; it never decides for the person. |
| `gate.sh` (second rule) | same | A `sau:sau-step` agent whose command writes or redirects into an `estado.json` (`>`, `>>`, `tee`, `cp`, `mv`, `sed -i`, `Set-Content`, `Out-File`, an interpreter given the file) | `ask`: only the orchestrator records gates. |
| `forbidden.sh` | PreToolUse `Write\|Edit\|MultiEdit\|NotebookEdit` | A write under a profile's `scan_paths` in a checkout or worktree whose `origin` is that profile's `code_repo`: content (`content`, `new_string`, every `edits[].new_string`, or a notebook cell's `new_source`) with a line from `forbidden_terms_file`, or a line carrying `[PRIVADO]` or `[OBJETIVO]` | `deny` with the matched line number and marker or term. `ask` when `forbidden_terms_file` is declared but missing. Silent outside `scan_paths` and for unknown repositories. |
| `forbidden.sh` (second rule) | same | A `sau:sau-step` agent writing any `estado.json` | `deny`: only the orchestrator records gates. |
| `no-account-copies.sh` | PreToolUse `Skill` | Loading one of the seven SAU skills under any name other than `sau:<skill>` (for example `anthropic-skills:keyword-fanout-map` or the bare name) | `deny`, with the reason naming `sau:<skill>`. |

Profiles are found from two places, in this order: `CLAUDE_PROJECT_DIR` and the session directory (and, for `gate.sh`, the target directory). Each contributes its git root and, when it is inside a worktree, the main checkout (`git rev-parse --git-common-dir`), so a seed worktree with no `.sau` of its own still finds the site's profile. Under each git root, every `.sau/site.json` whose `.sau` directory is at most three levels down counts. `.git`, `.claude`, `node_modules`, `.venv`, `venv`, `.next`, `dist`, `build`, `out`, `.cache`, `.turbo`, `coverage`, `AppData`, `target` and `__pycache__` are skipped, so a stale copy under `.claude/worktrees/` is never read. Outside a git repository only `<dir>/.sau/site.json` is read. Each script exits without starting Python when there is nothing to check. Python is found once per session and cached in a temporary file named after the session id. When two profiles have the same `site`, the first one found wins: the one under `CLAUDE_PROJECT_DIR`. `forbidden.sh` matches a written file to a profile by `git remote get-url origin` of the file's repository against `code_repo`, so it also covers seed worktrees.

Not enforced by hooks, checked by the orchestrator: the on-page threshold, the legal report under `blocking`, `checks` before P3, and that a `sau-step` agent wrote only inside its allowed paths (`git status` of its worktree and its seed directory against the brief). Limit of `forbidden.sh`: it sees only the file tools, so writes made from the shell or by a script are not reviewed by it; the last pass before P3 (nothing the brief forbids remains in the diff) covers them.

## 7. `sau-step` agent contract

`sau-step` runs one unit of work in isolation: one seed of a tanda (steps 2 → 2b → 3 → C), or one step of a page when the orchestrator wants it out of the main context (by default, the code step C). At most 3 agents run at once, `legal_agent` dispatches included. It never talks to the person, never pushes, never opens or changes a PR, never writes `estado.json`, and never touches another seed's directory.

It runs with `isolation: worktree`: its working directory is a throwaway worktree of the session's repository, so a stray relative write cannot land in the orchestrator's checkout. Its real work happens only in the absolute paths of the brief (`out_dir` and `code_worktree`).

A seed with `tipo: actualizar` whose audit needs live DataForSEO data (`onpage-optimizer` on a published URL) is audited in the main session: `sau-step` returns `blocked` with that reason, and the orchestrator runs step 3 itself.

Legal review is not one of its steps: a subagent cannot dispatch another subagent, so the orchestrator dispatches `legal_agent` itself once the seed's draft exists (§3, step L).

### Input (the brief, and nothing else)

```yaml
profile: <absolute path to .sau/site.json>
mode: page | tanda
unit: <slug> | tanda-<YYYY-MM-DD>
slug: <slug>
steps: [2, 2b, 3, C]              # in order; 2b only when requested at P1
reparto_row: { ... }              # tanda: the seed's row of 00-reparto.csv, as key/value
brief: <absolute path to the site brief>
keyword_map: <absolute path to the 01-keyword-map.csv the seed works from>
out_dir: <absolute path>          # page: OUT/<slug>/  tanda: T/<slug>/
code_worktree: <absolute path>    # its own worktree of code_repo, already on the branch
branch: <branch_prefix><slug>
allowed_code_paths:               # its content file (plus, in page mode with install-kit, the kit's target paths)
  - <archivo>
append_only: [<shared files>]     # tanda.shared_files: it may only add its own lines
onpage_min: <int>
motion: install-kit | plan-only
checks: [<commands>]
git_author_email: <email or null>  # the orchestrator uses it for its own commits too
answers: <what the person already said for questions the skills would ask; may be empty>
fix: <only on a re-run after P2 = cambiar: the person's requested changes>
```

### Output (the handoff)

```yaml
unit: tanda-2026-11-05
slug: alpha
status: done | blocked | failed
steps:
  - step: "2"
    files: [alpha/draft.md, alpha/02-content-package.html]
  - step: "3"
    files: [alpha/03-onpage-report.html]
    onpage_score: 92
code:
  branch: sau/alpha
  head: <sha>
  files_changed: [<paths in code_repo>]
  checks: [{command: "npm run build", exit: 0}]
hypotheses_used: [<brief lines marked [HIPÓTESIS] that the text relies on>]
open_questions: [<questions a skill would have asked the person and that the brief's answers did not cover>]
pending_shared: <path to pendiente-compartido.md, or none>
reason: <required when blocked or failed>
```

The orchestrator treats the handoff as a claim: it re-checks the evidence files, re-runs `checks` before P3, compares `files_changed` and `git status` with `allowed_code_paths`, and reads the score from the report. A seed that fails does not stop the tanda; it goes into `entrega.md` as `fallida` with `reason`.
