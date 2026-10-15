#!/usr/bin/env bash
# Dry-run eval for working-the-queue: one headless run per scenario, no network
# beyond the model. Needs: claude, jq, npx (Skills CLI).
#   run.sh [work-dir]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
work=${1:-$(mktemp -d)}
for s in "$here"/scenarios/*/; do
  name=$(basename "$s"); dir="$work/$name"; mkdir -p "$dir/state"
  cp "$here/project.md" "$dir/"; cp "$s"/develop.json "$s"/pulls.json "$s"/issues.json "$dir/state/"
  git -C "$dir" init -q
  ( cd "$dir" && npx -y skills add "$root" --skill '*' -a claude-code -y --copy >/dev/null )
  ( cd "$dir" && claude -p "$(cat "$here/prompt.md")" --allowedTools "Read,Glob,Grep,Skill" \
      --output-format stream-json --verbose > "$dir/stream.jsonl" 2> "$dir/stderr.log" )
  jq -r 'select(.type=="result") | .result' "$dir/stream.jsonl" \
    | awk '/^```json/{f=1;next} /^```/{f=0} f' > "$dir/out.json"
done
"$here/check.sh" "$work"
