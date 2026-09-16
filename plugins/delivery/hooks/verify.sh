#!/usr/bin/env bash
# delivery plugin — verification gate, wired twice in hooks.json:
#   SubagentStop (matcher ^delivery:worker$): the Worker cannot finish while
#     the project's verification fails; exit 2 sends the failure back to it.
#   PostToolUse (matcher Agent): when a delivery:worker handoff returns to the
#     Controller, the verification runs again in the project; exit 2 tells the
#     Controller not to accept the slice. This layer holds even where
#     SubagentStop is informational only.
# Other agents and tools pass through untouched.
set -u
input=$(cat)
field() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null; }

event=$(field '.hook_event_name')
case "$event" in
  SubagentStop) [ "$(field '.agent_type')" = "delivery:worker" ] || exit 0 ;;
  PostToolUse)  { [ "$(field '.tool_name')" = "Agent" ] && [ "$(field '.tool_input.subagent_type')" = "delivery:worker" ]; } || exit 0 ;;
esac

cwd=$(field '.cwd'); cd "${cwd:-.}" 2>/dev/null || exit 0

cmd=""
if [ -x scripts/verify ]; then cmd="scripts/verify"
elif [ -f Makefile ] && grep -qE '^verify:' Makefile; then cmd="make verify"
elif [ -f package.json ] && jq -e '.scripts.test' package.json >/dev/null 2>&1; then cmd="npm test --silent"
elif [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f setup.cfg ] || compgen -G 'tests/test_*.py' >/dev/null; then
  if command -v pytest >/dev/null 2>&1; then cmd="pytest -q"; else cmd="python3 -m unittest"; fi
elif [ -f go.mod ]; then cmd="go test ./..."
elif [ -f Cargo.toml ]; then cmd="cargo test -q"
fi

[ -n "${DELIVERY_LOG:-}" ] && printf '%s verify.sh event=%s cwd=%s cmd=%s\n' "$(date +%T)" "${event:-manual}" "$PWD" "${cmd:-none}" >> "$DELIVERY_LOG"

if [ -z "$cmd" ]; then
  echo "delivery gate: no verification command found (scripts/verify, make verify, npm test, pytest/unittest, go test, cargo test); nothing to gate." >&2
  exit 0
fi

out=$($cmd 2>&1); status=$?
if [ "$status" -eq 0 ]; then
  # Say so on the handoff, so the Controller sees the gate ran instead of
  # inferring it from silence.
  [ "$event" = "PostToolUse" ] && jq -cn --arg c "delivery gate: verification passed after the Worker handoff (\`$cmd\`)." '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
  exit 0
fi

{
  if [ "$event" = "PostToolUse" ]; then
    printf 'delivery gate: the Worker handoff left the tree red: `%s` exited %s. Do not accept or commit this slice. Dispatch a fix brief to a worker, or restore the files, and re-run the verification.\n' "$cmd" "$status"
  else
    printf 'delivery gate: `%s` failed with exit %s. Fix the cause before finishing. Do not skip, weaken, or delete tests. If you cannot reach green, save a patch, restore the tree, and report status: blocked.\n' "$cmd" "$status"
  fi
  printf '%s\n' "$out" | tail -40
} >&2
exit 2
