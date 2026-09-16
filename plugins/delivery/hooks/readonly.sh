#!/usr/bin/env bash
# delivery plugin — Reviewer Bash guard, wired as a PreToolUse hook on Bash
# for the whole session and scoped here to the delivery:reviewer agent. The
# Reviewer reads, runs checks, and reports; it does not change the working
# tree or the history. Commands that would are denied with a reason, so the
# Reviewer reports instead.
set -u
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.agent_type // empty' 2>/dev/null)" = "delivery:reviewer" ] || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

sp='[[:space:]]+'
pattern="(^|[;&|][[:space:]]*)(git${sp}(add|commit|push|checkout|switch|restore|reset|merge|rebase|stash|cherry-pick|clean|branch${sp}-[dD])|gh${sp}pr${sp}(review|merge|create|checkout|edit|close)|rm${sp}-[a-zA-Z]*r|sed${sp}-i)"

if printf '%s' "$cmd" | grep -qE "$pattern"; then
  reason="delivery reviewer: the Reviewer does not change the working tree or history. Report the change you would make as a finding; the Controller dispatches a Worker."
  jq -cn --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
fi
exit 0
