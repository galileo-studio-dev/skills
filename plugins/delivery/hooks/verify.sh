#!/usr/bin/env bash
# delivery plugin — verification gate, wired twice in hooks.json:
#   SubagentStop (matcher ^delivery:worker$): the Worker cannot finish while
#     the project's verification fails; exit 2 sends the failure back to it.
#   PostToolUse (matcher Agent): when a delivery:worker handoff returns to the
#     Controller, the verification runs again in the project; exit 2 tells the
#     Controller not to accept the slice. This layer holds even where
#     SubagentStop is informational only. A background launch returns no
#     handoff, so there is nothing to gate yet; its Worker still meets the
#     SubagentStop gate.
# The command is the brief's "Verification command: `...`" line when it has
# one, run in the session cwd. The handoff's own command is not trusted: the
# Worker would be choosing its gate. Otherwise the command is detected in the
# nearest project above each file the Worker changed (handoff files_changed,
# else git status), so a slice in one service does not run another's suite.
# A command that cannot start (exit 126/127) is a gate configuration problem,
# reported as such; it does not block, like a project with no command at all.
# Other agents and tools pass through untouched.
set -u
input=$(cat)
field() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null; }
# Text of a message whose content is a string or a list of content blocks.
text='if type=="string" then . else ([.[]? | select(.type=="text") | .text] | join("\n")) end'

event=$(field '.hook_event_name')
case "$event" in
  SubagentStop) [ "$(field '.agent_type')" = "delivery:worker" ] || exit 0 ;;
  PostToolUse)  { [ "$(field '.tool_name')" = "Agent" ] && [ "$(field '.tool_input.subagent_type')" = "delivery:worker" ]; } || exit 0 ;;
esac

cwd=$(field '.cwd'); cd "${cwd:-.}" 2>/dev/null || exit 0; cwd=$(pwd -P)
log() { [ -n "${DELIVERY_LOG:-}" ] && printf '%s verify.sh %s\n' "$(date +%T)" "$1" >> "$DELIVERY_LOG"; }

if [ "$event" = "PostToolUse" ]; then
  handoff=$(field ".tool_response | if type==\"object\" then .content else . end | $text")
  if ! printf '%s' "$handoff" | grep -qE '^[[:space:]]*status:[[:space:]]*"?(verified|blocked)'; then
    log "skip=PostToolUse reason=no-handoff"
    exit 0
  fi
  brief=$(field '.tool_input.prompt')
else
  handoff=$(field '.last_assistant_message'); brief=""
  transcript=$(field '.agent_transcript_path')
  if [ -f "$transcript" ]; then
    [ -z "$handoff" ] && handoff=$(jq -rs "[.[] | select(.type==\"assistant\")] | last | .message.content | $text" "$transcript" 2>/dev/null)
    brief=$(jq -rs "[.[] | select(.type==\"user\")] | first | .message.content | $text" "$transcript" 2>/dev/null)
  fi
fi

detect() {
  local d=$1
  if [ -x "$d/scripts/verify" ]; then echo "scripts/verify"
  elif [ -f "$d/Makefile" ] && grep -qE '^verify:' "$d/Makefile"; then echo "make verify"
  elif [ -f "$d/package.json" ] && jq -e '.scripts.test' "$d/package.json" >/dev/null 2>&1; then
    if [ -f "$d/bun.lock" ] || [ -f "$d/bun.lockb" ]; then echo "bun run test"; else echo "npm test --silent"; fi
  elif [ -f "$d/uv.lock" ] || { [ -f "$d/pyproject.toml" ] && grep -q '^\[tool\.uv' "$d/pyproject.toml"; }; then echo "uv run pytest -q"
  elif [ -f "$d/pyproject.toml" ] || [ -f "$d/pytest.ini" ] || [ -f "$d/setup.cfg" ] || compgen -G "$d/tests/test_*.py" >/dev/null; then
    # A pyenv shim satisfies `command -v pytest` and then exits 127, so probe it.
    if (cd "$d" && pytest --version >/dev/null 2>&1); then echo "pytest -q"; else echo "python3 -m unittest"; fi
  elif [ -f "$d/go.mod" ]; then echo "go test ./..."
  elif [ -f "$d/Cargo.toml" ]; then echo "cargo test -q"
  fi
}

# Nearest directory at or above $1 with a verification command, not above the
# enclosing git root (or the session cwd outside git).
project_root() {
  local d=$1 limit
  while [ ! -d "$d" ]; do d=$(dirname "$d"); done
  d=$(cd "$d" && pwd -P)
  limit=$(git -C "$d" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
  while :; do
    [ -n "$(detect "$d")" ] && { echo "$d"; return; }
    { [ "$d" = "$limit" ] || [ "$d" = "/" ]; } && return
    d=$(dirname "$d")
  done
}

declared=$(printf '%s\n' "$brief" | grep -m1 'Verification command:' | sed -n 's/.*Verification command:[^`]*`\([^`]*\)`.*/\1/p')

jobs=""   # lines of "<dir>\t<command>"
if [ -n "$declared" ]; then
  jobs=$cwd$'\t'$declared
else
  files=$(printf '%s\n' "$handoff" | awk '
    /^files_changed:/ { f = 1; next }
    f && /^[^[:space:]-]/ { f = 0 }
    f && /^[[:space:]]*-[[:space:]]/ { sub(/^[[:space:]]*-[[:space:]]*/, ""); gsub(/^["'\'']|["'\'']$/, ""); print }')
  paths=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in /*) p=$f ;; *) p=$cwd/$f ;; esac
    { [ -e "$p" ] || [ -d "$(dirname "$p")" ]; } && paths=$paths$p$'\n'
  done <<< "$files"
  if [ -z "$paths" ] && top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null); then
    paths=$(git -C "$cwd" status --porcelain --untracked-files=all | cut -c4- | sed 's/.* -> //' | sed "s|^|$top/|")
  fi
  [ -z "$paths" ] && paths=$cwd/.
  roots=$(while IFS= read -r p; do [ -n "$p" ] && project_root "$(dirname "$p")"; done <<< "$paths" | sort -u)
  while IFS= read -r r; do
    [ -n "$r" ] && jobs=$jobs$r$'\t'$(detect "$r")$'\n'
  done <<< "$roots"
fi

if [ -z "$jobs" ]; then
  log "event=${event:-manual} cwd=$cwd cmd=none"
  echo "delivery gate: no verification command found near the changed files (a \"Verification command: \`...\`\" line in the brief, scripts/verify, make verify, bun/npm test, uv run pytest, pytest/unittest, go test, cargo test); nothing to gate." >&2
  exit 0
fi

passed=""; config=""; failed=""
while IFS=$'\t' read -r dir cmd; do
  [ -z "$dir" ] && continue
  log "event=${event:-manual} cwd=$dir cmd=$cmd"
  out=$(cd "$dir" && bash -c "$cmd" 2>&1); status=$?
  case "$status" in
    0) passed="${passed:+$passed; }\`$cmd\` in $dir" ;;
    126|127) config="$config$(printf 'delivery gate: configuration error: `%s` in %s could not start (exit %s, command not found or not executable). This is not a red tree, and the gate did not verify the slice: run the verification yourself, and declare a working command in the brief ("Verification command: `...`") or in an executable scripts/verify.\n%s' "$cmd" "$dir" "$status" "$(printf '%s\n' "$out" | tail -10)")"$'\n' ;;
    *) failed="$failed$(printf '`%s` in %s exited %s.\n%s' "$cmd" "$dir" "$status" "$(printf '%s\n' "$out" | tail -40)")"$'\n' ;;
  esac
done <<< "$jobs"

if [ -n "$failed" ]; then
  {
    if [ "$event" = "PostToolUse" ]; then
      echo "delivery gate: the Worker handoff left the tree red. Do not accept or commit this slice. Dispatch a fix brief to a worker, or restore the files, and re-run the verification."
    else
      echo "delivery gate: verification failed. Fix the cause before finishing. Do not skip, weaken, or delete tests. If you cannot reach green, save a patch, restore the tree, and report status: blocked."
    fi
    printf '%s%s' "$failed" "$config"
  } >&2
  exit 2
fi

msg=${passed:+delivery gate: verification passed after the Worker handoff ($passed).$'\n'}$config
if [ "$event" = "PostToolUse" ]; then
  # Say so on the handoff, so the Controller sees the gate ran instead of
  # inferring it from silence.
  jq -cn --arg c "${msg%$'\n'}" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
elif [ -n "$config" ]; then
  printf '%s' "$config" >&2
fi
exit 0
