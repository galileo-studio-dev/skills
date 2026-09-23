#!/usr/bin/env bash
# Agentic eval for delivering-changes with the delivery plugin. Builds the
# fixture with a bare origin, installs the catalog skills into it, runs the
# two-slice plan headless, and checks commits, tests, gates, and that nothing
# was pushed. Needs: claude, jq, python3, npx (Skills CLI), network.
#
#   run.sh [work-dir] [model]    default: temp dir, opus (the policy's session model;
#                                 pass sonnet for a cheaper run); leaves repo/, origin.git,
#                                 stream.jsonl, gate.log, report.md
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
work=${1:-$(mktemp -d)}; model=${2:-opus}; fixture="$work/repo"

"$root/evals/fixtures/session-expiry/make.sh" "$fixture"
git clone -q --bare "$fixture" "$work/origin.git"
git -C "$fixture" remote add origin "$work/origin.git"
( cd "$fixture" && npx -y skills add "$root" --skill '*' -a claude-code -y --copy >/dev/null )

prompt='Use the delivering-changes skill to deliver the plan in docs/plans/session-expiry-plan.md (spec: docs/specs/session-expiry.md). Everything in Step 0 is already approved: the two slices as written, the allowed files per slice as listed in the plan, verification command `python3 -m unittest`, tier Prototype, branch `feature/session-expiry` (create it from main). Do not ask questions; nobody can answer in this run. At the delivery step do not push and do not open a pull request: keep the branch as-is. Your final message must be the report the skill specifies.'

( cd "$fixture" && DELIVERY_LOG="$work/gate.log" claude -p "$prompt" \
    --plugin-dir "$root/plugins/delivery" \
    --model "$model" \
    --permission-mode acceptEdits \
    --allowedTools "Bash,Read,Edit,Write,Grep,Glob,Agent,Skill,TodoWrite" \
    --output-format stream-json --verbose > "$work/stream.jsonl" 2> "$work/stderr.log" )
jq -r 'select(.type=="result") | .result' "$work/stream.jsonl" > "$work/report.md"
jq -r 'select(.type=="result") | "turns=\(.num_turns) cost_usd=\(.total_cost_usd) duration_s=\((.duration_ms//0)/1000|floor)"' "$work/stream.jsonl"
"$here/check.sh" "$work"
