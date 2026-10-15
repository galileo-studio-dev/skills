#!/usr/bin/env bash
# Checks a working-the-queue dry-run eval.  check.sh <work-dir>
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd); work=${1:?usage: check.sh <work-dir>}; fail=0
ok() { echo "  ok   $1"; }; bad() { echo "  FAIL $1"; fail=1; }
for s in "$here"/scenarios/*/; do
  name=$(basename "$s"); out="$work/$name/out.json"; exp="$s/expect.json"
  jq -e . "$out" >/dev/null 2>&1 || { bad "$name: no JSON block"; continue; }
  for k in $(jq -r 'keys[]' "$exp"); do
    wanted=$k; [ "$k" = skip_keys ] && wanted=skip
    jq -e --arg k "$wanted" 'has($k)' "$out" >/dev/null || { bad "$name: $k missing from the output"; continue; }
    case $k in
      skip_keys) want=$(jq -cS '.skip_keys|sort' "$exp"); got=$(jq -cS '[(.skip // [])[].key]|sort' "$out");;
      actions)   want=$(jq -cS '.actions' "$exp"); got=$(jq -cS --argjson w "$(jq '.actions|keys' "$exp")" '[.actions[]|select(.key as $k|$w|index($k))]|map({(.key):.action})|add' "$out");;
      *)         want=$(jq -cS ".$k" "$exp"); got=$(jq -cS ".$k" "$out");;
    esac
    [ "$want" = "$got" ] && ok "$name: $k" || bad "$name: $k want $want got $got"
  done
done
for s in "$here"/scenarios/*/; do
  name=$(basename "$s")
  [ -f "$work/$name/stream.jsonl" ] || continue
  echo; echo "cost and context, $name (evals/lib/usage.py):"
  python3 "$here/../lib/usage.py" "$work/$name/stream.jsonl" --out "$work/$name/metrics.json" | sed 's/^/  /'
done
echo; [ $fail -eq 0 ] && echo "working-the-queue eval: PASS" || { echo "working-the-queue eval: FAIL"; exit 1; }
