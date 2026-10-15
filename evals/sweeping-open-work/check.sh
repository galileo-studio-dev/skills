#!/usr/bin/env bash
# Checks a sweeping-open-work dry-run eval.  check.sh <work-dir>
# `touch` is compared in order (the sweep works items in collection order);
# each report list is compared sorted.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd); work=${1:?usage: check.sh <work-dir>}; fail=0
ok() { echo "  ok   $1"; }; bad() { echo "  FAIL $1"; fail=1; }
for s in "$here"/scenarios/*/; do
  name=$(basename "$s"); out="$work/$name/out.json"; exp="$s/expect.json"
  jq -e . "$out" >/dev/null 2>&1 || { bad "$name: no JSON block"; continue; }
  for k in $(jq -r 'keys[]' "$exp"); do
    jq -e --arg k "$k" 'has($k)' "$out" >/dev/null || { bad "$name: $k missing from the output"; continue; }
    case $k in
      report)
        for r in $(jq -r '.report|keys[]' "$exp"); do
          jq -e --arg r "$r" '(.report|type)=="object" and (.report|has($r))' "$out" >/dev/null || { bad "$name: report.$r missing from the output"; continue; }
          want=$(jq -cS --arg r "$r" '.report[$r]|sort' "$exp"); got=$(jq -cS --arg r "$r" '.report[$r]|if type=="array" then sort else . end' "$out")
          [ "$want" = "$got" ] && ok "$name: report.$r" || bad "$name: report.$r want $want got $got"
        done
        continue;;
      touch) want=$(jq -cS '.touch' "$exp"); got=$(jq -cS 'if (.touch|type)=="array" then [.touch[]|{key,action}] else .touch end' "$out");;
      *)     want=$(jq -cS ".$k" "$exp"); got=$(jq -cS ".$k" "$out");;
    esac
    [ "$want" = "$got" ] && ok "$name: $k" || bad "$name: $k want $want got $got"
  done
done
for s in "$here"/scenarios/*/; do
  name=$(basename "$s")
  [ -f "$work/$name/stream.jsonl" ] || continue
  echo; echo "cost and context, $name (evals/lib/usage.py):"
  python3 "$here/../lib/usage.py" "$work/$name/stream.jsonl" --out "$work/$name/metrics.json" | sed 's/^/  /' || bad "$name: usage.py could not read the stream"
done
echo; [ $fail -eq 0 ] && echo "sweeping-open-work eval: PASS" || { echo "sweeping-open-work eval: FAIL"; exit 1; }
