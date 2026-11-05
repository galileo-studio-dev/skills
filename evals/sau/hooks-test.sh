#!/usr/bin/env bash
# Tests for the sau plugin hooks with synthetic input. No network, no model.
# The fixture (evals/sau/fixture/) is an invented site; it is copied to a
# temporary git repository so the hooks can match it by its origin remote.
# Needs bash and py or python3. No jq.
set -uo pipefail
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

echo; echo "sau hooks: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "sau hooks: PASS" || { echo "sau hooks: FAIL"; exit 1; }
