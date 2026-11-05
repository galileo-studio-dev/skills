#!/usr/bin/env bash
# sau plugin: forbidden hook (PreToolUse Write|Edit|MultiEdit|NotebookEdit). Bash entry point;
# the logic is in sau_hooks.py (stdlib only). Runs py or python3, whichever works: there is no
# jq on the team's Windows machines, and no python3 either.
here=$(cd "$(dirname "$0")" && pwd)
script="$here/sau_hooks.py"; command -v cygpath >/dev/null 2>&1 && script=$(cygpath -w "$script")
for p in py python3; do
  if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    exec "$p" "$script" forbidden
  fi
done
# No Python 3: the profile and its terms cannot be read. Ask only for the obvious cases:
# a [PRIVADO]/[OBJETIVO] marker in the text, or a sau-step agent writing estado.json.
in=$(cat)
if printf '%s' "$in" | grep -Eq '\[(PRIVADO|OBJETIVO)\]' \
   || { printf '%s' "$in" | grep -q '"agent_type" *: *"sau:sau-step"' && printf '%s' "$in" | grep -q 'estado\.json'; }; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"sau hook: Python 3 (py or python3) was not found; this write carries a [PRIVADO]/[OBJETIVO] marker or is a sau-step write to estado.json, so it needs the person'"'"'s approval."}}'
fi
exit 0
