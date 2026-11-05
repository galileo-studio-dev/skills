# sau plugin: helpers shared by the three hook entry points (sourced, not run).
# Portable: needs only bash and Python 3 (py or python3). Uses bash builtins only on the
# fast path, so a hook that has nothing to check exits without starting another process.
# shellcheck shell=bash
shopt -s extglob nullglob

IFS= read -r -d '' SAU_IN || true

# sau_json_str <key>: the first string value of "<key>" in the hook input, still JSON-escaped.
sau_json_str() {
  REPLY=""
  local re="\"$1\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\""
  [[ $SAU_IN =~ $re ]] && REPLY=${BASH_REMATCH[1]}
  return 0
}

# sau_json_path <key>: like sau_json_str, for a path: \\ undone and backslashes made forward.
sau_json_path() {
  sau_json_str "$1"
  REPLY=${REPLY//\\\\/\/}
  REPLY=${REPLY//\\\//\/}
}

# sau_profile_near: true when a .sau/site.json exists where sau_hooks.py looks for profiles:
# CLAUDE_PROJECT_DIR and cwd, their parents up to the git root, at most two levels under that
# git root and under the main checkout of a worktree. Outside a git repository, only <dir>/.sau.
sau_profile_near() {
  local base d p root line g main r f
  sau_json_path cwd
  for base in "${CLAUDE_PROJECT_DIR:-}" "$REPLY"; do
    base=${base//\\/\/}
    [ -n "$base" ] && [ -d "$base" ] || continue
    [ -f "$base/.sau/site.json" ] && return 0
    d=$base; root=""
    while :; do
      if [ -e "$d/.git" ]; then root=$d; break; fi
      p=${d%/*}
      { [ -z "$p" ] || [ "$p" = "$d" ]; } && break
      d=$p
    done
    [ -n "$root" ] || continue
    d=$base
    while [ "$d" != "$root" ] && [ -n "$d" ]; do
      [ -f "$d/.sau/site.json" ] && return 0
      p=${d%/*}; [ "$p" = "$d" ] && break; d=$p
    done
    main=""
    if [ -f "$root/.git" ] && IFS= read -r line < "$root/.git"; then
      g=${line#gitdir: }; g=${g%$'\r'}; g=${g//\\/\/}
      case "$g" in /*|[A-Za-z]:*) ;; *) g="$root/$g" ;; esac
      [[ $g == */.git/worktrees/* ]] && main=${g%/.git/worktrees/*}
    fi
    for r in "$root" ${main:+"$main"}; do
      for f in "$r"/.sau/site.json "$r"/!(node_modules)/.sau/site.json "$r"/!(node_modules)/!(node_modules)/.sau/site.json; do
        [ -f "$f" ] && return 0
      done
    done
  done
  return 1
}

# sau_python: sets SAU_PY (a Python 3 executable) and SAU_SCRIPT (sau_hooks.py, in a form that
# Python accepts). Detected once per session and cached in a temporary file named after the
# session id; later calls start Python only once, with no launcher in between.
sau_python() {
  local here=$SAU_HERE cache="" sid p exe s h
  sau_json_str session_id; sid=${REPLY//[^A-Za-z0-9_-]/}
  if [ -n "$sid" ]; then
    cache="${TMPDIR:-/tmp}/sau-hooks-python-$sid"
    if [ -f "$cache" ] && { IFS= read -r exe; IFS= read -r s; IFS= read -r h; } < "$cache" \
       && [ "$h" = "$here" ] && [ -n "$exe" ] && [ -x "$exe" ]; then
      SAU_PY=$exe; SAU_SCRIPT=$s; return 0
    fi
  fi
  for p in py python3; do
    command -v "$p" >/dev/null 2>&1 || continue
    exe=$("$p" -c 'import sys; print(sys.executable if sys.version_info[0] == 3 else "")' 2>/dev/null) || continue
    exe=${exe%$'\r'}
    [ -n "$exe" ] || continue
    s="$here/sau_hooks.py"
    if command -v cygpath >/dev/null 2>&1; then exe=$(cygpath -u "$exe"); s=$(cygpath -w "$s"); fi
    [ -x "$exe" ] || exe=$(command -v "$p")
    SAU_PY=$exe; SAU_SCRIPT=$s
    [ -n "$cache" ] && printf '%s\n%s\n%s\n' "$exe" "$s" "$here" > "$cache" 2>/dev/null
    return 0
  done
  return 1
}

# sau_ask <reason>: print an "ask" answer (reason must not contain double quotes or backslashes).
sau_ask() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$1"
}
