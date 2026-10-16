#!/usr/bin/env bash
# Dry-run eval for sweeping-open-work: one headless run per scenario, no network
# beyond the model. Needs: claude, jq, npx (Skills CLI).
#   run.sh [work-dir]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
work=${1:-$(mktemp -d)}
for s in "$here"/scenarios/*/; do
  name=$(basename "$s"); dir="$work/$name"; mkdir -p "$dir/state"
  cp "$here/project.md" "$dir/"; cp "$s"/sweep.json "$s"/develop.json "$s"/issues.json "$s"/pulls.json "$s"/branches.json "$dir/state/"
  git -C "$dir" init -q
  ( cd "$dir" && npx -y skills add "$root" --skill '*' -a claude-code -y --copy >/dev/null )
  ( cd "$dir" && claude -p "$(cat "$here/prompt.md")" --allowedTools "Read,Glob,Grep,Skill" \
      --output-format stream-json --verbose > "$dir/stream.jsonl" 2> "$dir/stderr.log" )
  jq -r 'select(.type=="result") | .result' "$dir/stream.jsonl" > "$dir/result.txt"
  awk '/^```/{if(f)exit; f=1; next} f' "$dir/result.txt" > "$dir/out.json"; [ -s "$dir/out.json" ] || cp "$dir/result.txt" "$dir/out.json"
done
"$here/check.sh" "$work"
