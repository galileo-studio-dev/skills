#!/usr/bin/env bash
# Agentic eval for reviewing-pull-requests. Builds the fixture with the planted
# branch, installs the catalog skills into it, reviews the branch headless, and
# checks the report. Needs: claude, jq, python3, npx (Skills CLI), network.
#
#   run.sh [work-dir]     default: a fresh temp dir; leaves repo/, stream.jsonl, report.md
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
work=${1:-$(mktemp -d)}; fixture="$work/repo"

"$root/evals/fixtures/session-expiry/make.sh" "$fixture" --with-review-branch
( cd "$fixture" && npx -y skills add "$root" --skill '*' -a claude-code -y --copy >/dev/null )

prompt="Read and follow exactly the skill reviewing-pull-requests. Review the branch feature/session-expiry against main in this repository. There is no GitHub access and no PR number; the pull request description follows. You did not implement this change. Do not modify files, do not commit, and do not post anything anywhere. Your final message must be the review report only, exactly as the skill specifies.

Pull request description, as submitted:

$(cat "$here/prompt.md")"

( cd "$fixture" && claude -p "$prompt" \
    --permission-mode acceptEdits \
    --allowedTools "Bash,Read,Grep,Glob,Agent,Skill" \
    --output-format stream-json --verbose > "$work/stream.jsonl" 2> "$work/stderr.log" )
jq -r 'select(.type=="result") | .result' "$work/stream.jsonl" > "$work/report.md"
echo "report: $work/report.md"
"$here/check.sh" "$work"
