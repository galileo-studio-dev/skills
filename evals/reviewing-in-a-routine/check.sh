#!/usr/bin/env bash
# Checks a reviewing-pull-requests «In a routine» dry-run eval.  check.sh <work-dir>
# Each key of expect.json must match the output exactly.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd); work=${1:?usage: check.sh <work-dir>}; fail=0
ok() { echo "  ok   $1"; }; bad() { echo "  FAIL $1"; fail=1; }
for s in "$here"/scenarios/*/; do
  name=$(basename "$s"); out="$work/$name/out.json"; exp="$s/expect.json"
  jq -e . "$out" >/dev/null 2>&1 || { bad "$name: no JSON block"; continue; }
  for k in $(jq -r 'keys[]' "$exp"); do
    jq -e --arg k "$k" 'has($k)' "$out" >/dev/null || { bad "$name: $k missing from the output"; continue; }
    want=$(jq -cS --arg k "$k" '.[$k]' "$exp"); got=$(jq -cS --arg k "$k" '.[$k]' "$out")
    [ "$want" = "$got" ] && ok "$name: $k" || bad "$name: $k want $want got $got"
  done
done
for s in "$here"/scenarios/*/; do
  name=$(basename "$s")
  [ -f "$work/$name/stream.jsonl" ] || continue
  echo; echo "cost and context, $name (evals/lib/usage.py):"
  python3 "$here/../lib/usage.py" "$work/$name/stream.jsonl" --out "$work/$name/metrics.json" | sed 's/^/  /' || bad "$name: usage.py could not read the stream"
done
echo; [ $fail -eq 0 ] && echo "reviewing-pull-requests (in a routine) eval: PASS" || { echo "reviewing-pull-requests (in a routine) eval: FAIL"; exit 1; }
