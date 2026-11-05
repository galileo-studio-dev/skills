#!/usr/bin/env bash
# sau plugin: gate hook (PreToolUse Bash|PowerShell). Bash entry point; the logic is in
# sau_hooks.py (stdlib only). Portable: needs only bash and Python 3 (py or python3).
SAU_HERE=${BASH_SOURCE[0]%/*}; [ "$SAU_HERE" = "${BASH_SOURCE[0]}" ] && SAU_HERE=.
case "$SAU_HERE" in /*|[A-Za-z]:*) ;; *) SAU_HERE="$PWD/$SAU_HERE" ;; esac
. "$SAU_HERE/lib.sh"
# Fast path: nothing to hold unless the command could push, call gh, deploy or touch estado.json
# (a wrapped command such as bash -c "git push" or echo git push | sh still contains the word).
sau_json_str command; cmd=$REPLY
# Quotes and backslashes are dropped in a copy before matching, so git pu""sh, git p\ush or g\h pass the
# filter the same way the shell reads them; the command itself is not changed.
c=${cmd//[\"\'\\]/}
shopt -s nocasematch
re='push|vercel|estado\.json|(^|[^a-z0-9_-])gh([^a-z0-9_-]|$)'
[[ $c =~ $re ]] || exit 0
shopt -u nocasematch
if sau_python; then exec "$SAU_PY" -I -S "$SAU_SCRIPT" gate <<< "$SAU_IN"; fi
# No Python 3: a minimal text check, only near a site profile. Ask when the command names a held tool.
sau_profile_near || exit 0
if printf '%s' "$c" | grep -Eiq '\<git\>.*\<push\>|\<gh(\.exe)?\>.*\<(pr|api|release)\>|\<vercel\>'; then
  sau_ask "sau hook: Python 3 (py or python3) was not found; this command looks like a push, pull request, API call, release or deploy near a site profile, so it needs the person's approval."
fi
exit 0
