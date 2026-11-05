#!/usr/bin/env bash
# Tests for the sau plugin hooks with synthetic input. No network, no model.
# The fixture (evals/sau/fixture/) is an invented site; it is copied to a
# temporary git repository so the hooks can match it by its origin remote.
# Needs bash and py or python3. No jq.
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
asks 'gh -R o/r pr merge 5'
asks 'gh --repo o/r pr create'
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
asks 'gh api repos/o/r/pulls -f title=x'
asks 'gh api -X PUT repos/o/r/pulls/5/merge'
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
fake="$tmp/nopy"; mkdir -p "$fake"
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

echo; echo "sau hooks: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "sau hooks: PASS" || { echo "sau hooks: FAIL"; exit 1; }
