#!/usr/bin/env bash
# sau plugin: no-account-copies hook (PreToolUse Skill). Bash entry point; the logic is in
# sau_hooks.py (stdlib only). Portable: needs only bash and Python 3 (py or python3).
SAU_HERE=${BASH_SOURCE[0]%/*}; [ "$SAU_HERE" = "${BASH_SOURCE[0]}" ] && SAU_HERE=.
case "$SAU_HERE" in /*|[A-Za-z]:*) ;; *) SAU_HERE="$PWD/$SAU_HERE" ;; esac
. "$SAU_HERE/lib.sh"
sau_json_str skill; name=$REPLY
[ -n "$name" ] || { sau_json_str name; name=$REPLY; }
bare=${name##*:}
# Fast path: only the seven skills, or a name from the account's skill set, are checked.
case "$bare" in
  site-brief-builder|keyword-fanout-map|seo-content-writer|motion-director|onpage-optimizer|internal-link-architect|ai-visibility-checker)
    [ "$name" = "sau:$bare" ] && exit 0 ;;
  *) [[ $name == anthropic-skills:* ]] || exit 0 ;;
esac
if sau_python; then exec "$SAU_PY" -I -S "$SAU_SCRIPT" no-account-copies <<< "$SAU_IN"; fi
# No Python 3: ask only when the skill is one of the seven under a name other than sau:<skill>.
case "$bare" in
  site-brief-builder|keyword-fanout-map|seo-content-writer|motion-director|onpage-optimizer|internal-link-architect|ai-visibility-checker)
    sau_ask "sau hook: Python 3 (py or python3) was not found; '$name' is not the plugin's copy. Load 'sau:$bare' instead." ;;
esac
exit 0
