#!/usr/bin/env bash
# sau plugin: gate hook (PreToolUse Bash). Bash entry point; the logic is in
# sau_hooks.py (stdlib only). Runs py or python3, whichever works: there is no
# jq on the team's Windows machines, and no python3 either.
here=$(cd "$(dirname "$0")" && pwd)
script="$here/sau_hooks.py"; command -v cygpath >/dev/null 2>&1 && script=$(cygpath -w "$script")
for p in py python3; do
  if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    exec "$p" "$script" gate
  fi
done
cat >/dev/null
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"sau hook: Python 3 (py or python3) was not found, so this action could not be checked."}}'
exit 0
