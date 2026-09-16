#!/usr/bin/env bash
# delivery plugin — PreToolUse gate for Bash, active for every agent while the
# plugin is enabled. Commands that deploy, publish, change infrastructure or
# shared state, or destroy work need a person's answer (company guide §16.4).
# The hook answers "ask", so Claude Code prompts even in auto-accept modes.
set -u
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

sp='[[:space:]]+'
pattern="(^|[;&|][[:space:]]*)(git${sp}push|git${sp}reset${sp}--hard|git${sp}clean${sp}-[a-zA-Z]*f|git${sp}branch${sp}-D|gh${sp}pr${sp}(create|merge|review)|gh${sp}release|terraform${sp}(apply|destroy|import|refresh|force-unlock|state${sp}(mv|rm|push))|kubectl${sp}(apply|delete|rollout)|docker${sp}push|(npm|pnpm|yarn)${sp}publish|twine${sp}upload|supabase${sp}db${sp}push)"

if printf '%s' "$cmd" | grep -qE "$pattern"; then
  reason="delivery gate: this command deploys, publishes, changes shared state, or destroys work; it needs the person's explicit approval (guide §16.4)."
  jq -cn --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
fi
exit 0
