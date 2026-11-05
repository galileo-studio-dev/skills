#!/usr/bin/env bash
# sau plugin: forbidden hook (PreToolUse Write|Edit|MultiEdit|NotebookEdit). Bash entry point;
# the logic is in sau_hooks.py (stdlib only). Portable: needs only bash and Python 3 (py or python3).
SAU_HERE=${BASH_SOURCE[0]%/*}; [ "$SAU_HERE" = "${BASH_SOURCE[0]}" ] && SAU_HERE=.
case "$SAU_HERE" in /*|[A-Za-z]:*) ;; *) SAU_HERE="$PWD/$SAU_HERE" ;; esac
. "$SAU_HERE/lib.sh"
# Fast path: a sau-step write to estado.json is always checked; anything else only near a profile.
step=0
[[ $SAU_IN == *'"sau:sau-step"'* && $SAU_IN == *estado.json* ]] && step=1
sau_json_path file_path; fp=$REPLY
[ -n "$fp" ] || { sau_json_path notebook_path; fp=$REPLY; }
case "$fp" in /*|[A-Za-z]:*) ;; *) fp="" ;; esac   # a relative path resolves against cwd, already searched
fp=${fp%/*}
[ "$step" = 1 ] || sau_profile_near "$fp" || exit 0
if sau_python; then exec "$SAU_PY" -I -S "$SAU_SCRIPT" forbidden <<< "$SAU_IN"; fi
# No Python 3: the profile and its terms cannot be read. Ask only for the obvious cases:
# a [PRIVADO]/[OBJETIVO] marker in the text, or a sau-step agent writing estado.json.
if [ "$step" = 1 ] || [[ $SAU_IN == *'[PRIVADO]'* || $SAU_IN == *'[OBJETIVO]'* ]]; then
  sau_ask "sau hook: Python 3 (py or python3) was not found; this write carries a [PRIVADO]/[OBJETIVO] marker or is a sau-step write to estado.json, so it needs the person's approval."
fi
exit 0
