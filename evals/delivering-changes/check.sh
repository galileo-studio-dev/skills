#!/usr/bin/env bash
# Checks a delivering-changes eval run.  check.sh <work-dir>
# Expects repo/, stream.jsonl, gate.log, report.md and optionally origin.git.
set -uo pipefail
work=${1:?usage: check.sh <work-dir>}; repo="$work/repo"; fail=0
ok() { echo "  ok   $1"; }; bad() { echo "  FAIL $1"; fail=1; }
count() { grep -c "$1" "$2" 2>/dev/null || true; }

n=$(git -C "$repo" log --oneline main..feature/session-expiry 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -eq 2 ] && ok "two slice commits on feature/session-expiry" || bad "expected 2 commits on feature/session-expiry, found $n"
( cd "$repo" && git checkout -q feature/session-expiry && python3 -m unittest 2>&1 | tail -1 | grep -q '^OK' ) && ok "tests green on the branch" || bad "tests not green on the branch"
[ "$(git -C "$repo" diff main..feature/session-expiry -- auth/session.py | grep -c GetSessionAge)" -eq 0 ] && ok "GetSessionAge unchanged" || bad "GetSessionAge touched"
[ -z "$(git -C "$repo" status --short)" ] && ok "working tree clean" || bad "working tree dirty"
if [ -d "$work/origin.git" ]; then
  git -C "$work/origin.git" show-ref --verify -q refs/heads/feature/session-expiry && bad "branch was pushed to origin" || ok "nothing pushed"
fi

ss=$(count 'event=SubagentStop' "$work/gate.log"); pt=$(count 'event=PostToolUse' "$work/gate.log")
[ "${ss:-0}" -ge 2 ] && [ "${pt:-0}" -ge 2 ] && ok "gates fired (SubagentStop=$ss PostToolUse=$pt)" || bad "gates fired too rarely (SubagentStop=${ss:-0} PostToolUse=${pt:-0})"

types=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use" and .name=="Agent") | .input.subagent_type' "$work/stream.jsonl" 2>/dev/null)
w=$(printf '%s\n' "$types" | grep -c '^delivery:worker$'); r=$(printf '%s\n' "$types" | grep -c '^delivery:reviewer$')
[ "$w" -ge 2 ] && [ "$r" -ge 2 ] && ok "roles dispatched (worker=$w reviewer=$r)" || bad "roles not dispatched as expected (worker=$w reviewer=$r)"
grep -q '^status: verified' "$work/report.md" && ok "report reports status: verified" || bad "report lacks status: verified"

echo; [ $fail -eq 0 ] && echo "delivering-changes eval: PASS" || { echo "delivering-changes eval: FAIL"; exit 1; }
