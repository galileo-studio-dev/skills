#!/usr/bin/env bash
# Tests for the sau plugin hooks with synthetic input. No network, no model.
# The fixture (evals/sau/fixture/) is an invented site; it is copied to a
# temporary git repository so the hooks can match it by its origin remote.
# Needs bash and py or python3.
set -uo pipefail
unset CLAUDE_PROJECT_DIR  # the hooks read it; a real session's value must not leak into the cases
here=$(cd "$(dirname "$0")" && pwd)
H="$here/../../plugins/sau/hooks"
fail=0; pass=0
ok()  { echo "  ok   $1"; pass=$((pass+1)); }
bad() { echo "  FAIL $1"; fail=$((fail+1)); }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
win() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

# decision <hook> <json> -> allow|ask|deny, or "silent"
decision() {
  d=$(printf '%s' "$2" | "$H/$1" 2>/dev/null | grep -o '"permissionDecision":"[a-z]*"' | cut -d'"' -f4)
  echo "${d:-silent}"
}
reason() { printf '%s' "$2" | "$H/$1" 2>/dev/null | grep -o '"permissionDecisionReason":"[^"]*"'; }

setup_site() {  # setup_site <dir>
  cp -R "$here/fixture" "$1"
  git -C "$1" init -q -b dev; git -C "$1" config core.autocrlf false
  git -C "$1" remote add origin https://github.com/fixture-org/fixture-web.git
  git -C "$1" add -A
  git -C "$1" -c user.email=t@example.test -c user.name=t commit -qm base
}
setup_site "$tmp/site"; S=$(win "$tmp/site")
setup_site "$tmp/noterms"; N=$(win "$tmp/noterms"); rm "$tmp/noterms/seo/forbidden-terms.txt"

echo "== sau gate.sh"
bash_in() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$S" "$1"; }
[ "$(decision gate.sh "$(bash_in 'git push -u origin sau/alpha')")" = "ask" ] && ok "asks for git push" || bad "git push should ask"
[ "$(decision gate.sh "$(bash_in 'git diff --stat dev..HEAD')")" = "silent" ] && ok "silent for git diff" || bad "git diff should be silent"
[ "$(decision gate.sh "$(bash_in 'git -C . push --delete origin sau/x')")" = "ask" ] && ok "asks for git -C . push --delete" || bad "git -C push should ask"
[ "$(decision gate.sh "$(bash_in 'cd x && gh pr create --base dev --title t')")" = "ask" ] && ok "asks for gh pr create" || bad "gh pr create should ask"
[ "$(decision gate.sh "$(bash_in 'gh pr merge 5 --squash')")" = "ask" ] && ok "asks for gh pr merge" || bad "gh pr merge should ask"
[ "$(decision gate.sh "$(bash_in 'gh pr ready 5')")" = "ask" ] && ok "asks for gh pr ready" || bad "gh pr ready should ask"
[ "$(decision gate.sh "$(bash_in 'vercel --prod')")" = "ask" ] && ok "asks for vercel --prod" || bad "vercel --prod should ask"
[ "$(decision gate.sh "$(bash_in 'gh pr list')")" = "silent" ] && ok "silent for gh pr list" || bad "gh pr list should be silent"
[ "$(decision gate.sh "$(bash_in 'echo git push')")" = "silent" ] && ok "silent when git push is only an argument" || bad "echo git push should be silent"
asks()   { [ "$(decision gate.sh "$(bash_in "$1")")" = "ask" ] && ok "asks for: $1" || bad "should ask: $1"; }
silent() { [ "$(decision gate.sh "$(bash_in "$1")")" = "silent" ] && ok "silent for: $1" || bad "should be silent: $1"; }
# Quote and backslash splitting of the command word is read like the shell reads it.
asks 'git pu\"\"sh origin'
asks "git pu''sh origin"
asks 'git p\\ush origin'
asks 'g\\h pr create'
asks 'gh -R fixture-org/fixture-web pr merge 5'
asks 'gh --repo Fixture-Org/Fixture-Web pr create'
silent 'gh -R other-org/other-repo pr merge 5'
silent 'gh --repo other-org/other-repo pr create'
asks 'if true; then git push; fi'
asks 'time git push'
asks 'timeout 30 git push'
asks 'nohup git push'
asks 'xargs git push'
asks 'bash -c \"git push\"'
asks "sh -c 'git push'"
asks 'eval \"git push\"'
asks 'powershell -c \"git push\"'
asks 'pwsh -Command \"git push\"'
asks 'cmd /c git push'
asks 'gh api repos/fixture-org/fixture-web/pulls -f title=x'
asks 'gh api -X PUT repos/fixture-org/fixture-web/pulls/5/merge'
asks 'gh api -X POST repos/{owner}/{repo}/issues'
silent 'gh api -X POST repos/other-org/other-repo/issues'
asks 'vercel deploy --target=production'
asks 'vercel --target production'
silent 'gh api repos/o/r/pulls'
silent 'vercel deploy --target preview'
pw_in() { printf '{"tool_name":"PowerShell","cwd":"%s","tool_input":{"command":"%s"}}' "$S" "$1"; }
[ "$(decision gate.sh "$(pw_in 'git push')")" = "ask" ] && ok "asks for git push from the PowerShell tool" || bad "PowerShell git push should ask"
[ "$(decision gate.sh "$(pw_in 'Set-Location x; gh pr merge 5')")" = "ask" ] && ok "asks for gh pr merge after ; in PowerShell" || bad "PowerShell gh pr merge should ask"
[ "$(decision gate.sh "$(pw_in 'git status')")" = "silent" ] && ok "silent for git status from the PowerShell tool" || bad "PowerShell git status should be silent"
step_in() { printf '{"tool_name":"Bash","agent_type":"%s","cwd":"%s","tool_input":{"command":"%s"}}' "$1" "$S" "$2"; }
[ "$(decision gate.sh "$(step_in sau:sau-step 'echo {} > seo/output/alpha/estado.json')")" = "ask" ] && ok "asks when sau-step redirects into estado.json" || bad "sau-step redirect into estado.json should ask"
[ "$(decision gate.sh "$(step_in sau:sau-step 'printf x | tee seo/output/alpha/estado.json')")" = "ask" ] && ok "asks when sau-step tees into estado.json" || bad "sau-step tee estado.json should ask"
[ "$(decision gate.sh "$(step_in sau:sau-step 'cat seo/output/alpha/estado.json')")" = "silent" ] && ok "sau-step may read estado.json" || bad "sau-step reading estado.json should be silent"
[ "$(decision gate.sh "$(step_in '' 'echo {} > seo/output/alpha/estado.json')")" = "silent" ] && ok "the orchestrator may write estado.json from the shell" || bad "orchestrator shell write should be silent"
git -C "$tmp/site" checkout -q -b sau/alpha
reason gate.sh "$(bash_in 'gh pr ready 5')" | grep -q "gate P2" && ok "reason names the missing gate P2 on a work branch" || bad "reason should name gate P2"
mkdir -p "$tmp/site/seo/output/alpha"; printf '{"gates":{"P2":{"at":"x","by":"t"}}}' > "$tmp/site/seo/output/alpha/estado.json"
reason gate.sh "$(bash_in 'gh pr ready 5')" | grep -q "gate P2" && bad "reason should not name P2 once recorded" || ok "no missing-gate note once P2 is recorded"
git -C "$tmp/site" checkout -q dev

echo "== sau forbidden.sh"
priv=$(grep -m1 '\[PRIVADO\]' "$here/fixture/seo/site-brief.md")
w_in() { printf '{"tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s","content":"%s"}}' "$1" "$2" "$3"; }
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'Intro\nBuy the ZorbaFlex today\nEnd')")" = "deny" ] && ok "denies a forbidden term (case-insensitive)" || bad "zorbaflex should be denied"
reason forbidden.sh "$(w_in "$S" "$S/src/new.md" 'Intro\nBuy the zorbaflex today')" | grep -q "line 2" && ok "reason carries the line number" || bad "reason should carry line 2"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" "Intro\\n$priv")")" = "deny" ] && ok "denies a [PRIVADO] line" || bad "[PRIVADO] should be denied"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" '[OBJETIVO] reach 100 visits')")" = "deny" ] && ok "denies an [OBJETIVO] line" || bad "[OBJETIVO] should be denied"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'A clean paragraph about gardening.')")" = "silent" ] && ok "lets clean text through" || bad "clean text should pass"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/docs/notes.md" 'zorbaflex outside scan_paths')")" = "silent" ] && ok "ignores paths outside scan_paths" || bad "outside src should be ignored"
printf '{"tool_name":"Edit","cwd":"%s","tool_input":{"file_path":"%s","old_string":"a","new_string":"zorbaflex"}}' "$S" "$S/src/page.md" > "$tmp/edit.json"
[ "$(decision forbidden.sh "$(cat "$tmp/edit.json")")" = "deny" ] && ok "denies a forbidden term in an Edit" || bad "Edit should be denied"
printf '{"tool_name":"MultiEdit","cwd":"%s","tool_input":{"file_path":"%s","edits":[{"old_string":"a","new_string":"ok"},{"old_string":"b","new_string":"zorbaflex"}]}}' "$S" "$S/src/page.md" > "$tmp/multi.json"
[ "$(decision forbidden.sh "$(cat "$tmp/multi.json")")" = "deny" ] && ok "denies a forbidden term in a MultiEdit" || bad "MultiEdit should be denied"
[ "$(decision forbidden.sh "$(w_in "$N" "$N/src/new.md" 'clean text')")" = "ask" ] && ok "asks when forbidden_terms_file is missing" || bad "missing terms file should ask"
[ "$(decision forbidden.sh "$(w_in "$N" "$N/docs/new.md" 'clean text')")" = "silent" ] && ok "missing terms file is silent outside scan_paths" || bad "missing terms file outside src should be silent"
git -C "$tmp/site" remote set-url origin https://github.com/other-org/other-repo.git
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'zorbaflex')")" = "silent" ] && ok "silent for a repository that is not the profile's code_repo" || bad "unknown repository should be silent"
git -C "$tmp/site" remote set-url origin git@github.com:Fixture-Org/fixture-web.git
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'zorbaflex')")" = "deny" ] && ok "matches an ssh remote, case-insensitively" || bad "ssh remote should match"

echo "== sau forbidden.sh: estado.json"
est() { printf '{"tool_name":"Write","agent_type":"%s","cwd":"%s","tool_input":{"file_path":"%s","content":"{}"}}' "$1" "$S" "$S/seo/output/alpha/estado.json"; }
[ "$(decision forbidden.sh "$(est sau:sau-step)")" = "deny" ] && ok "denies sau:sau-step writing estado.json" || bad "sau-step estado.json should be denied"
[ "$(decision forbidden.sh "$(est '')")" = "silent" ] && ok "the orchestrator may write estado.json" || bad "orchestrator estado.json should pass"

echo "== sau no-account-copies.sh"
sk() { printf '{"tool_name":"Skill","tool_input":{"skill":"%s"}}' "$1"; }
[ "$(decision no-account-copies.sh "$(sk anthropic-skills:keyword-fanout-map)")" = "deny" ] && ok "denies anthropic-skills:keyword-fanout-map" || bad "account copy should be denied"
[ "$(decision no-account-copies.sh "$(sk keyword-fanout-map)")" = "deny" ] && ok "denies the bare name keyword-fanout-map" || bad "bare name should be denied"
reason no-account-copies.sh "$(sk keyword-fanout-map)" | grep -q "sau:keyword-fanout-map" && ok "reason redirects to sau:keyword-fanout-map" || bad "reason should name sau:<skill>"
[ "$(decision no-account-copies.sh "$(sk sau:keyword-fanout-map)")" = "silent" ] && ok "lets sau:keyword-fanout-map through" || bad "sau: name should pass"
[ "$(decision no-account-copies.sh "$(sk grill-me)")" = "silent" ] && ok "ignores other skills" || bad "other skills should pass"
n=0; for s in site-brief-builder keyword-fanout-map seo-content-writer motion-director onpage-optimizer internal-link-architect ai-visibility-checker; do
  [ "$(decision no-account-copies.sh "$(sk "$s")")" = "deny" ] && [ "$(decision no-account-copies.sh "$(sk "anthropic-skills:$s")")" = "deny" ] && [ "$(decision no-account-copies.sh "$(sk "sau:$s")")" = "silent" ] && n=$((n+1))
done
[ "$n" = "7" ] && ok "all seven skills: bare and account names denied, sau: allowed" || bad "only $n of 7 skills behave"

echo "== sau forbidden.sh: NotebookEdit"
nb_in() { printf '{"tool_name":"NotebookEdit","cwd":"%s","tool_input":{"notebook_path":"%s","new_source":"%s"}}' "$S" "$S/src/nb.ipynb" "$1"; }
[ "$(decision forbidden.sh "$(nb_in 'print(\"zorbaflex\")')")" = "deny" ] && ok "denies a forbidden term in a NotebookEdit new_source" || bad "NotebookEdit should be denied"
[ "$(decision forbidden.sh "$(nb_in 'print(1)')")" = "silent" ] && ok "lets a clean NotebookEdit through" || bad "clean NotebookEdit should pass"

echo "== sau profile search"
# A stale profile copy under .claude/worktrees with the same site and a harmless terms file.
mkdir -p "$tmp/site/.claude/worktrees/x/.sau"
sed 's#"seo/forbidden-terms.txt"#"terms.txt"#' "$here/fixture/.sau/site.json" > "$tmp/site/.claude/worktrees/x/.sau/site.json"
echo otherterm > "$tmp/site/.claude/worktrees/x/terms.txt"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'zorbaflex')")" = "deny" ] && ok "a stale .claude/worktrees/x/.sau does not win" || bad "stale .claude profile should not win"
# A worktree with no .sau of its own finds the main checkout's profile.
git -C "$tmp/site" worktree add -q -b sau/beta "$tmp/wt-beta" dev; rm -rf "$tmp/wt-beta/.sau"; WB=$(win "$tmp/wt-beta")
[ "$(decision forbidden.sh "$(w_in "$WB" "$WB/src/new.md" 'zorbaflex')")" = "deny" ] && ok "a worktree without .sau finds the main repository's profile" || bad "worktree without .sau should find the main profile"
# Same site in cwd and in CLAUDE_PROJECT_DIR: the project directory's profile wins.
git -C "$tmp/site" worktree add -q -b sau/old "$tmp/wt-old" dev; WO=$(win "$tmp/wt-old")
sed 's#"seo/forbidden-terms.txt"#"seo/old-terms.txt"#' "$here/fixture/.sau/site.json" > "$tmp/wt-old/.sau/site.json"
echo oldterm > "$tmp/wt-old/seo/old-terms.txt"
[ "$(decision forbidden.sh "$(w_in "$WO" "$WO/src/new.md" 'oldterm')")" = "deny" ] && ok "without CLAUDE_PROJECT_DIR the cwd profile applies" || bad "cwd profile should apply without CLAUDE_PROJECT_DIR"
[ "$(CLAUDE_PROJECT_DIR="$S" decision forbidden.sh "$(w_in "$WO" "$WO/src/new.md" 'oldterm')")" = "silent" ] && ok "same site: the CLAUDE_PROJECT_DIR profile wins over cwd's" || bad "CLAUDE_PROJECT_DIR profile should win"
[ "$(CLAUDE_PROJECT_DIR="$S" decision forbidden.sh "$(w_in "$WO" "$WO/src/new.md" 'zorbaflex')")" = "deny" ] && ok "the winning profile's terms apply in the worktree" || bad "project profile terms should apply"

echo "== sau gate.sh: gate records across profiles and worktrees"
wb_in() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$WB" "$1"; }
reason gate.sh "$(wb_in 'gh pr ready 7')" | grep -q "gate P2" && ok "worktree on sau/beta: P2 missing is named" || bad "worktree should name missing P2"
mkdir -p "$tmp/site/seo/output/beta"; printf '{"gates":{"P2":{"at":"x","by":"t"}}}' > "$tmp/site/seo/output/beta/estado.json"
reason gate.sh "$(wb_in 'gh pr ready 7')" | grep -q "gate P2" && bad "P2 in the main checkout should count" || ok "P2 recorded in the main checkout counts from the worktree"
git -C "$tmp/site" worktree add -q -b sau/gamma "$tmp/wt-gamma" dev; WG=$(win "$tmp/wt-gamma")
mkdir -p "$tmp/wt-old/seo/output/gamma"; printf '{"gates":{"P2":{"at":"x","by":"t"}}}' > "$tmp/wt-old/seo/output/gamma/estado.json"
wg_in() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$WG" "$1"; }
reason gate.sh "$(wg_in 'gh pr ready 7')" | grep -q "gate P2" && bad "P2 in another worktree should count" || ok "P2 recorded in another worktree (git worktree list) counts"
mkdir -p "$tmp/site/sub/.sau"; printf '{"site":"second","output_dir":"out","branch_prefix":"sau/"}' > "$tmp/site/sub/.sau/site.json"
git -C "$tmp/site" worktree add -q -b sau/delta "$tmp/wt-delta" dev; WD=$(win "$tmp/wt-delta")
mkdir -p "$tmp/site/sub/out/delta"; printf '{"gates":{"P2":{"at":"x","by":"t"}}}' > "$tmp/site/sub/out/delta/estado.json"
wd_in() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$WD" "$1"; }
reason gate.sh "$(wd_in 'gh pr ready 7')" | grep -q "gate P2" && bad "records of every profile should be joined" || ok "P2 recorded under a second profile counts for every profile"

echo "== sau hooks.json: command from a path with spaces"
PY=py; command -v py >/dev/null 2>&1 || PY=python3
root="$tmp/plugin root with spaces"; mkdir -p "$root"; cp -R "$H" "$root/hooks"
cmds=$("$PY" -c "import json,sys; [print(h['matcher'] + chr(9) + x['command']) for h in json.load(open(sys.argv[1]))['hooks']['PreToolUse'] for x in h['hooks']]" "$(win "$H/hooks.json")")
for form in "$(win "$root")" "$root"; do
  run_cmd() {  # run_cmd <script name> <json>: run the hooks.json command with the variable replaced
    c=$(printf '%s\n' "$cmds" | grep "/$1" | head -n1); c=${c#*$'	'}; c=${c//'${CLAUDE_PLUGIN_ROOT}'/$form}
    printf '%s' "$2" | bash -c "$c" 2>/dev/null | grep -o '"permissionDecision":"[a-z]*"' | cut -d'"' -f4
  }
  [ "$(run_cmd gate.sh "$(bash_in 'git push')")" = "ask" ] && ok "gate.sh runs from '$form'" || bad "gate.sh from a path with spaces ($form)"
  [ "$(run_cmd forbidden.sh "$(w_in "$S" "$S/src/new.md" 'zorbaflex')")" = "deny" ] && ok "forbidden.sh runs from '$form'" || bad "forbidden.sh from a path with spaces ($form)"
  [ "$(run_cmd no-account-copies.sh "$(sk keyword-fanout-map)")" = "deny" ] && ok "no-account-copies.sh runs from '$form'" || bad "no-account-copies.sh from a path with spaces ($form)"
done
printf '%s\n' "$cmds" | grep -q "^Bash|PowerShell"$'	' && ok "gate matcher is Bash|PowerShell" || bad "gate matcher should be Bash|PowerShell"
printf '%s\n' "$cmds" | grep -q "^Write|Edit|MultiEdit|NotebookEdit"$'	' && ok "forbidden matcher includes NotebookEdit" || bad "forbidden matcher should include NotebookEdit"

echo "== sau hooks without Python"
fake="$tmp/nopy"; mkdir -p "$fake"; if command -v cygpath >/dev/null 2>&1; then fake=$(cygpath -u "$fake"); fi  # POSIX form: a C:/ path breaks the colon-separated PATH
for p in py python3; do printf '#!/bin/sh\nexit 1\n' > "$fake/$p"; chmod +x "$fake/$p"; done
nopy() { d=$(printf '%s' "$2" | PATH="$fake:$PATH" "$H/$1" 2>/dev/null | grep -o '"permissionDecision":"[a-z]*"' | cut -d'"' -f4); echo "${d:-silent}"; }
[ "$(nopy gate.sh "$(bash_in 'git push')")" = "ask" ] && ok "no Python: gate asks for git push" || bad "no Python: git push should ask"
[ "$(nopy gate.sh "$(bash_in 'gh pr create')")" = "ask" ] && ok "no Python: gate asks for gh pr" || bad "no Python: gh pr should ask"
[ "$(nopy gate.sh "$(bash_in 'git diff')")" = "silent" ] && ok "no Python: gate is silent for git diff" || bad "no Python: git diff should be silent"
[ "$(nopy forbidden.sh "$(w_in "$S" "$S/src/new.md" '[PRIVADO] secret')")" = "ask" ] && ok "no Python: forbidden asks for a [PRIVADO] line" || bad "no Python: [PRIVADO] should ask"
[ "$(nopy forbidden.sh "$(w_in "$S" "$S/src/new.md" 'clean text')")" = "silent" ] && ok "no Python: forbidden is silent for clean text" || bad "no Python: clean text should be silent"
[ "$(nopy no-account-copies.sh "$(sk anthropic-skills:keyword-fanout-map)")" = "ask" ] && ok "no Python: asks for an account copy of a SAU skill" || bad "no Python: account copy should ask"
[ "$(nopy no-account-copies.sh "$(sk sau:keyword-fanout-map)")" = "silent" ] && ok "no Python: sau:<skill> passes" || bad "no Python: sau: name should pass"
[ "$(nopy no-account-copies.sh "$(sk grill-me)")" = "silent" ] && ok "no Python: other skills pass" || bad "no Python: other skills should pass"

echo "== sau gate.sh: only in the repositories of a site profile"
mkdir -p "$tmp/plain"; git -C "$tmp/plain" init -q -b dev
git -C "$tmp/plain" remote add origin https://github.com/other-org/other-repo.git; P=$(win "$tmp/plain")
in_dir() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$1" "$2"; }
gd() { decision gate.sh "$(in_dir "$1" "$2")"; }
[ "$(gd "$P" 'git push origin dev')" = "silent" ] && ok "silent for git push in a repository with no profile" || bad "push outside a SAU repo should be silent"
[ "$(gd "$P" 'gh pr merge 5')" = "silent" ] && ok "silent for gh pr merge in a repository with no profile" || bad "gh pr merge outside a SAU repo should be silent"
[ "$(gd "$P" 'vercel --prod')" = "silent" ] && ok "silent for vercel --prod in a repository with no profile" || bad "vercel outside a SAU repo should be silent"
[ "$(gd "$S" 'git push origin sau/alpha')" = "ask" ] && ok "asks for git push in code_repo" || bad "push in code_repo should ask"
[ "$(gd "$S" 'git push https://github.com/other-org/other-repo.git dev')" = "silent" ] && ok "silent for a push to another repository's URL" || bad "push to another URL should be silent"
[ "$(gd "$P" "git -C '$S' push")" = "ask" ] && ok "asks for git -C <code_repo> push from another repository" || bad "git -C code_repo push should ask"
[ "$(gd "$P" "cd '$S' && git push")" = "ask" ] && ok "asks for cd <code_repo> && git push" || bad "cd code_repo && push should ask"
[ "$(gd "$S" "cd '$P' && git push")" = "silent" ] && ok "silent for cd <other repo> && git push" || bad "cd other && push should be silent"
[ "$(gd "$S" 'cd $HOME/x && git push')" = "ask" ] && ok "asks when a cd cannot be resolved (profile found)" || bad "unresolved cd should ask"
[ "$(CLAUDE_PROJECT_DIR="$S" gd "$P" 'gh -R fixture-org/fixture-web pr merge 5')" = "ask" ] && ok "asks for gh -R <code_repo> from another repository (CLAUDE_PROJECT_DIR)" || bad "gh -R code_repo should ask"
[ "$(CLAUDE_PROJECT_DIR="$S" gd "$P" 'gh pr ready 5')" = "silent" ] && ok "no question and no gate note when the session repository is not the profile's" || bad "gh pr ready in another repo should be silent"
reason gate.sh "$(in_dir "$S" 'git push')" | grep -q "fixture-org/fixture-web" && ok "reason names the target repository" || bad "reason should name the repository"

echo "== sau gate.sh: more held commands (each asks in code_repo, none outside)"
held_cmds=('npx vercel@latest --prod' 'pnpm dlx vercel --prod' 'bunx vercel --prod' 'yarn dlx vercel --prod' 'npx -y vercel@39.1.0 deploy --prod'
  'gh api -XPOST repos/fixture-org/fixture-web/issues' 'gh api --method=POST repos/fixture-org/fixture-web/issues'
  'git -c alias.x=push x' 'vercel alias set a.vercel.app www.fixture-site.test' 'vercel promote dpl_123' 'vercel rollback dpl_123'
  'gh release create v1.0.0' 'gh pr edit 5 --base main' 'echo git push | sh' 'echo git push | bash' "printf 'git push' | pwsh")
for c in "${held_cmds[@]}"; do
  [ "$(gd "$S" "$c")" = "ask" ] && ok "asks for: $c" || bad "should ask: $c"
done
n=0; for c in "${held_cmds[@]}"; do [ "$(gd "$P" "$c")" = "silent" ] && n=$((n+1)); done
[ "$n" = "${#held_cmds[@]}" ] && ok "none of the ${#held_cmds[@]} asks outside a SAU repository" || bad "only $n of ${#held_cmds[@]} are silent outside a SAU repository"
split_cmds=('git pu\"\"sh origin' "git pu''sh origin" 'git p\\ush origin' 'g\\h pr create')
n=0; for c in "${split_cmds[@]}"; do [ "$(gd "$P" "$c")" = "silent" ] && n=$((n+1)); done
[ "$n" = "${#split_cmds[@]}" ] && ok "quote-split push and gh are silent outside a SAU repository" || bad "only $n of ${#split_cmds[@]} split commands are silent outside a SAU repository"
for c in 'gh pr edit 5 --title t' 'vercel alias ls' 'gh release list' 'gh api -XGET repos/fixture-org/fixture-web/pulls' 'echo git push > notes.txt' 'npx vercel@latest dev'; do
  [ "$(gd "$S" "$c")" = "silent" ] && ok "silent for: $c" || bad "should be silent: $c"
done

echo "== sau gate.sh: missing-gate note"
git -C "$tmp/site" checkout -q sau/alpha
mkdir -p "$tmp/site/seo/output/other"; printf '{"gates":{"P3":{"at":"x","by":"t"}}}' > "$tmp/site/seo/output/other/estado.json"
reason gate.sh "$(in_dir "$S" 'git push origin HEAD:main')" | grep -q "gate P3 is not recorded for unit 'alpha'" && ok "HEAD:<production_branch> names P3 for the unit, ignoring another unit's P3" || bad "HEAD:main should name P3 for alpha"
reason gate.sh "$(in_dir "$S" 'git push origin sau/alpha:refs/heads/main')" | grep -q "gate P3" && ok "x:refs/heads/<production_branch> names P3" || bad "refspec x:main should name P3"
reason gate.sh "$(in_dir "$S" 'git push origin sau/alpha:sau/alpha')" | grep -q "gate P3" && bad "a push to the work branch should not name P3" || ok "no P3 note for a push to the work branch"
printf '{"gates":{"P2":{"at":"x","by":"t"},"P3":{"at":"x","by":"t"}}}' > "$tmp/site/seo/output/alpha/estado.json"
reason gate.sh "$(in_dir "$S" 'git push origin HEAD:main')" | grep -q "gate P3" && bad "P3 of alpha should satisfy the note" || ok "no P3 note once the unit's P3 is recorded"
git -C "$tmp/site" checkout -q -b sau/fixture-tanda-2026-11-05 dev
reason gate.sh "$(in_dir "$S" 'gh pr ready 5')" | grep -q "unit 'tanda-2026-11-05'" && ok "a tanda branch is the unit tanda-<date>: P2 missing is named" || bad "tanda branch should name its unit"
mkdir -p "$tmp/site/seo/output/tanda-2026-11-05"; printf '{"gates":{"seeds":{"alpha":{"P2":{"at":"x","by":"t"}}}}}' > "$tmp/site/seo/output/tanda-2026-11-05/estado.json"
reason gate.sh "$(in_dir "$S" 'gh pr ready 5')" | grep -q "gate P2" && bad "a seed P2 in the tanda record should count" || ok "P2 found in the tanda's own record"
git -C "$tmp/site" checkout -q dev

echo "== sau hooks: unreadable profile, unknown origin"
setup_site "$tmp/broken"; B=$(win "$tmp/broken"); printf '{"site": "fixture", ' > "$tmp/broken/.sau/site.json"
[ "$(gd "$B" 'git push')" = "ask" ] && ok "gate asks when the profile is unreadable" || bad "unreadable profile: gate should ask"
reason gate.sh "$(in_dir "$B" 'git push')" | grep -q "cannot be read" && ok "gate reason says the profile cannot be read" || bad "gate reason should say unreadable"
[ "$(gd "$B" 'git status')" = "silent" ] && ok "gate stays silent for a command it does not hold" || bad "git status should stay silent"
[ "$(decision forbidden.sh "$(w_in "$B" "$B/src/new.md" 'clean text')")" = "ask" ] && ok "forbidden asks when the profile is unreadable" || bad "unreadable profile: forbidden should ask"
reason forbidden.sh "$(w_in "$B" "$B/src/new.md" 'clean text')" | grep -q "cannot be read" && ok "forbidden reason says the profile cannot be read" || bad "forbidden reason should say unreadable"
setup_site "$tmp/noorigin"; O=$(win "$tmp/noorigin"); git -C "$tmp/noorigin" remote remove origin
[ "$(gd "$O" 'git push')" = "ask" ] && ok "gate asks when the profile's repository has no readable origin" || bad "no origin: gate should ask"
reason gate.sh "$(in_dir "$O" 'git push')" | grep -q "unknown" && ok "gate reason says the target repository is unknown" || bad "gate reason should say unknown"
[ "$(decision forbidden.sh "$(w_in "$O" "$O/src/new.md" 'clean text')")" = "ask" ] && ok "forbidden asks when the profile's repository has no readable origin" || bad "no origin: forbidden should ask"
reason forbidden.sh "$(w_in "$O" "$O/src/new.md" 'clean text')" | grep -q "origin" && ok "forbidden reason names the origin" || bad "forbidden reason should name origin"
[ "$(decision forbidden.sh "$(w_in "$S" "$P/src/new.md" 'zorbaflex')")" = "silent" ] && ok "a write into another repository (origin known) stays silent" || bad "write into another repo should be silent"

echo "== sau hooks: where profiles are searched"
mkdir -p "$tmp/site/dist/x/.sau"; printf '{broken' > "$tmp/site/dist/x/.sau/site.json"
[ "$(decision forbidden.sh "$(w_in "$S" "$S/src/new.md" 'clean text')")" = "silent" ] && ok "a profile under dist/ is not read" || bad "dist/ should be skipped"
rm -rf "$tmp/site/dist"
mkdir -p "$tmp/nogit/deep/.sau"; printf '{broken' > "$tmp/nogit/deep/.sau/site.json"; NG=$(win "$tmp/nogit")
[ "$(decision forbidden.sh "$(w_in "$NG" "$NG/a.md" 'zorbaflex')")" = "silent" ] && ok "outside git only <cwd>/.sau is read, no walk" || bad "outside git should not walk"
[ "$(gd "$NG" 'git push')" = "silent" ] && ok "gate outside git with no <cwd>/.sau is silent" || bad "gate outside git should be silent"
cp "$here/fixture/.sau/site.json" "$tmp/nogit/deep/.sau/site.json"; ND=$(win "$tmp/nogit/deep")
[ "$(decision forbidden.sh "$(w_in "$ND" "$ND/src/a.md" 'clean')")" = "ask" ] && ok "outside git, a <cwd>/.sau profile with no origin asks" || bad "profile outside git should ask"
[ "$(decision forbidden.sh "$(w_in "$P" "$P/src/a.md" 'zorbaflex')")" = "silent" ] && ok "fast path: no profile near, silent" || bad "no profile should be silent"

echo "== sau forbidden.sh: scan_paths normalisation"
setup_site "$tmp/wk"; K=$(win "$tmp/wk")
sed -i 's#"scan_paths": \["src/"\]#"scan_paths": ["./.well-known/"]#' "$tmp/wk/.sau/site.json"
[ "$(decision forbidden.sh "$(w_in "$K" "$K/.well-known/security.txt" 'zorbaflex')")" = "deny" ] && ok "scan path ./.well-known/ covers .well-known/" || bad ".well-known should be scanned"
[ "$(decision forbidden.sh "$(w_in "$K" "$K/well-known/x.txt" 'zorbaflex')")" = "silent" ] && ok "scan path .well-known/ does not cover well-known/" || bad "well-known/ should not match .well-known/"

echo "== sau hooks: Python found once per session"
sid="test-session-$$"; cache="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/sau-hooks-python-$sid"; rm -f "$cache"
si() { printf '{"session_id":"%s","tool_name":"Bash","cwd":"%s","tool_input":{"command":"git push"}}' "$sid" "$S"; }
[ "$(decision gate.sh "$(si)")" = "ask" ] && [ -s "$cache" ] && ok "the first call caches the Python executable" || bad "cache file should be written"
[ "$(decision gate.sh "$(si)")" = "ask" ] && ok "a later call uses the cached Python" || bad "cached Python should answer"
printf '/nonexistent/python\nx\nx\n' > "$cache"
[ "$(decision gate.sh "$(si)")" = "ask" ] && ok "a stale cache is detected again" || bad "stale cache should be replaced"
rm -f "$cache"

echo "== sau hooks: cache hardening, hidden profile directories, file's own repository"
sid2="test-planted-$$"; cache2="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/sau-hooks-python-$sid2"
si2() { printf '{"session_id":"%s","tool_name":"Bash","cwd":"%s","tool_input":{"command":"git push"}}' "$sid2" "$S"; }
truebin=$(command -v true)
printf '%s\nx\n%s\n' "$truebin" "$H" > "$cache2"
[ "$(decision gate.sh "$(si2)")" = "ask" ] && ok "a planted non-Python executable in the cache does not silence git push" || bad "planted cache silenced git push"
rm -f "$cache2"
setup_site "$tmp/hid"; HD=$(win "$tmp/hid")
mkdir "$tmp/hid/.algo"; mv "$tmp/hid/.sau" "$tmp/hid/seo" "$tmp/hid/.algo/"
[ "$(decision forbidden.sh "$(w_in "$HD" "$HD/src/a.ts" '[PRIVADO] x')")" = "deny" ] && ok "a profile under a hidden directory (.algo/.sau) is seen by the fast path" || bad "hidden-directory profile missed"
[ "$(gd "$HD" 'git push')" = "ask" ] && ok "gate sees the hidden-directory profile too" || bad "gate should ask with a hidden-directory profile"
[ "$(decision forbidden.sh "$(w_in "$P" "$S/src/a.ts" '[PRIVADO] x')")" = "deny" ] && ok "cwd in another repository: writing [PRIVADO] in the SAU repository is denied" || bad "write from another cwd should be denied"
[ "$(decision forbidden.sh "$(w_in "$P" "$WB/src/a.ts" '[PRIVADO] x')")" = "deny" ] && ok "cwd in another repository: the same holds for a worktree of the SAU repository" || bad "write into a worktree from another cwd should be denied"
[ "$(decision forbidden.sh "$(w_in "$P" "$S/src/not-yet/dir/a.ts" 'clean text')")" = "silent" ] && ok "a clean write into a directory that does not exist yet stays silent" || bad "clean write to a new directory should be silent"
[ "$(nopy gate.sh "$(in_dir "$P" 'git push')")" = "silent" ] && ok "no Python: gate is silent with no profile near" || bad "no Python: push outside a SAU repo should be silent"

echo; echo "sau hooks: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "sau hooks: PASS" || { echo "sau hooks: FAIL"; exit 1; }
