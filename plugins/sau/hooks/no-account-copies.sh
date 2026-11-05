#!/usr/bin/env bash
# sau plugin: no-account-copies hook (PreToolUse Skill). Bash entry point; the logic is in
# sau_hooks.py (stdlib only). Runs py or python3, whichever works: there is no
# jq on the team's Windows machines, and no python3 either.
here=$(cd "$(dirname "$0")" && pwd)
script="$here/sau_hooks.py"; command -v cygpath >/dev/null 2>&1 && script=$(cygpath -w "$script")
for p in py python3; do
  if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    exec "$p" "$script" no-account-copies
  fi
done
# No Python 3: ask only when the skill is one of the seven under a name other than sau:<skill>.
in=$(cat)
name=$(printf '%s' "$in" | grep -Eo '"(skill|name)"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')
bare=${name##*:}
case "$bare" in
  site-brief-builder|keyword-fanout-map|seo-content-writer|motion-director|onpage-optimizer|internal-link-architect|ai-visibility-checker)
    if [ "$name" != "sau:$bare" ]; then
      printf '%s\n' "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"ask\",\"permissionDecisionReason\":\"sau hook: Python 3 (py or python3) was not found; '$name' is not the plugin's copy. Load 'sau:$bare' instead.\"}}"
    fi ;;
esac
exit 0
