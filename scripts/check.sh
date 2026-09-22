#!/usr/bin/env bash
# Static checks for the catalog: no network, no model calls. Runs locally and
# in CI (.github/workflows/check.yml). Exit 1 on any failure.
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"; fail=0
ok() { echo "  ok   $1"; }; bad() { echo "  FAIL $1"; fail=1; }

echo "== skills"
for f in skills/*/*/SKILL.md plugins/*/skills/*/SKILL.md; do
  d=$(basename "$(dirname "$f")")
  [ "$(head -1 "$f")" = "---" ] || bad "$f: no frontmatter"
  n=$(awk 'NR>1 && /^name:/{print $2; exit}' "$f"); [ "$n" = "$d" ] || bad "$f: name '$n' does not match directory '$d'"
  grep -q '^description:' "$f" || bad "$f: no description"
  [ "$(grep -c '^## Credits' "$f")" -eq 1 ] || bad "$f: expected exactly one '## Credits' section"
  grep -q '@skills/' "$f" && bad "$f: force-loading @skills/ link"
done
ok "$(ls skills/*/*/SKILL.md plugins/*/skills/*/SKILL.md | wc -l | tr -d ' ') skills: frontmatter, name, description, credits"

echo "== README"
dirs=$({ ls -d skills/*/*/; ls -d plugins/*/skills/*/; } | xargs -n1 basename | sort)
tables=$(sed -n '/^## Skills/,/^## Installation/p' README.md | grep -oE '^\| `[a-z0-9-]+`' | tr -d '|` ' | sort)
map=$(sed -n '/^### Skill map/,/^### Approval/p' README.md | grep -oE '^\| [A-Za-z]+ \| `[a-z0-9-]+`' | grep -oE '`[a-z0-9-]+`' | tr -d '`' | sort)
[ "$dirs" = "$tables" ] && ok "category tables match directories" || { bad "category tables differ from directories"; diff <(echo "$dirs") <(echo "$tables") | sed 's/^/       /'; }
[ "$dirs" = "$map" ] && ok "skill map matches directories" || { bad "skill map differs from directories"; diff <(echo "$dirs") <(echo "$map") | sed 's/^/       /'; }

echo "== plugins"
for f in .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json plugins/*/hooks/hooks.json; do
  jq -e . "$f" >/dev/null 2>&1 && ok "$f is valid JSON" || bad "$f: invalid JSON"
done
for src in $(jq -r '.plugins[].source' .claude-plugin/marketplace.json); do
  [ -f "$src/.claude-plugin/plugin.json" ] && ok "marketplace source $src exists" || bad "marketplace source $src has no plugin.json"
done
for h in plugins/*/hooks/*.sh; do [ -x "$h" ] && ok "$h is executable" || bad "$h is not executable"; done

echo "== delivery agents"
body() { awk 'f{print} /^---$/{c++; if(c==2) f=1}' "$1"; }
[ "$(body plugins/delivery/agents/worker.md)" = "$(body plugins/delivery/agents/worker-high.md)" ] && ok "worker and worker-high share one body" || bad "worker-high body drifted from worker"
for a in plugins/delivery/agents/*.md; do grep -q '^effort: ' "$a" && ok "$(basename "$a") pins effort" || bad "$(basename "$a"): no effort pinned"; done
grep -q '^effort: ' plugins/delivery/skills/delivering-changes/SKILL.md && ok "delivering-changes pins effort" || bad "delivering-changes: no effort pinned"

echo "== delivery hooks"
H=plugins/delivery/hooks; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
evals/fixtures/session-expiry/make.sh "$tmp/green" >/dev/null
cp -R "$tmp/green" "$tmp/red"; printf '\n    def test_red(self):\n        self.assertTrue(False)\n' >> "$tmp/red/tests/test_session.py"
decision() { printf '%s' "$2" | "$H/$1" | jq -r '.hookSpecificOutput.permissionDecision // "silent"' 2>/dev/null; }
verify() { printf '%s' "$1" | "$H/verify.sh" >/dev/null 2>&1; echo $?; }
# hook inputs built with jq: nested escaped quotes inside $(...) get re-split by bash
# mk <event> <agent_type> <tool> <subagent_type> <cwd> [handoff] [brief]: a PostToolUse
# carries the handoff as the Agent result's text content, a SubagentStop as last_assistant_message.
mk() { jq -cn --arg e "$1" --arg a "$2" --arg t "$3" --arg s "$4" --arg c "$5" --arg h "${6-}" --arg p "${7-}" \
  '{hook_event_name:$e, agent_type:$a, tool_name:$t, tool_input:{subagent_type:$s, prompt:$p}, cwd:$c}
   + if $e == "PostToolUse" then {tool_response:{status:"completed", content:[{type:"text", text:$h}]}} else {last_assistant_message:$h} end'; }
handoff() { printf 'task: s1\nstatus: verified\nfiles_changed:\n'; for f in "$@"; do printf '  - %s\n' "$f"; done; printf 'tests:\n  - command: "true"\n'; }
ctx() { printf '%s' "$1" | "$H/verify.sh" 2>/dev/null | jq -r '.hookSpecificOutput.additionalContext // empty'; }
red_worker_stop=$(mk SubagentStop delivery:worker '' '' "$tmp/red")
green_worker_stop=$(mk SubagentStop delivery:worker '' '' "$tmp/green")
red_reviewer_stop=$(mk SubagentStop delivery:reviewer '' '' "$tmp/red")
red_worker_handoff=$(mk PostToolUse '' Agent delivery:worker "$tmp/red" "$(handoff tests/test_session.py)")
red_other_tool=$(mk PostToolUse '' Bash '' "$tmp/red")
green_worker_handoff=$(mk PostToolUse '' Agent delivery:worker "$tmp/green" "$(handoff auth/session.py)")
red_background_launch=$(jq -cn --arg c "$tmp/red" '{hook_event_name:"PostToolUse", tool_name:"Agent", tool_input:{subagent_type:"delivery:worker", run_in_background:true}, tool_response:{isAsync:true, status:"async_launched", agentId:"a1", prompt:"status: verified"}, cwd:$c}')
missing_cmd_brief='Slice: s1
Verification command: `no-such-verify-cmd -q`'
# monorepo: two projects in one git repo, only svc-b is green
mono=$tmp/mono; mkdir -p "$mono/services/svc-a/scripts" "$mono/services/svc-b/scripts" "$mono/web" "$tmp/bin"; git -C "$mono" init -q
printf '#!/bin/sh\nexit 1\n' > "$mono/services/svc-a/scripts/verify"; printf '#!/bin/sh\nexit 0\n' > "$mono/services/svc-b/scripts/verify"
chmod +x "$mono"/services/*/scripts/verify; touch "$mono/services/svc-a/a.py" "$mono/services/svc-b/b.py"
# runner detection: uv and bun projects, with stand-ins for the real tools on PATH
mkdir -p "$tmp/uvproj" "$tmp/bunproj"; touch "$tmp/uvproj/uv.lock" "$tmp/uvproj/pyproject.toml" "$tmp/bunproj/bun.lock"
echo '{"scripts":{"test":"bun test"}}' > "$tmp/bunproj/package.json"
for b in uv bun; do printf '#!/bin/sh\necho "%s $*" >> "%s/ran"\n' "$b" "$tmp" > "$tmp/bin/$b"; chmod +x "$tmp/bin/$b"; done
[ "$(decision gate.sh '{"tool_input":{"command":"git push -u origin x"}}')" = "ask" ] && ok "gate asks for git push" || bad "gate: git push should ask"
[ "$(decision gate.sh '{"tool_input":{"command":"cd infra && terraform apply tfplan"}}')" = "ask" ] && ok "gate asks for terraform apply" || bad "gate: terraform apply should ask"
[ -z "$(decision gate.sh '{"tool_input":{"command":"git diff --stat main..HEAD"}}')" ] && ok "gate silent for git diff" || bad "gate: git diff should be silent"
[ "$(decision readonly.sh '{"agent_type":"delivery:reviewer","tool_input":{"command":"git commit -m x"}}')" = "deny" ] && ok "readonly denies the reviewer a commit" || bad "readonly: reviewer commit should be denied"
[ "$(decision readonly.sh '{"agent_type":"delivery:reviewer","tool_input":{"command":"sed -i s/a/b/ f.py"}}')" = "deny" ] && ok "readonly denies the reviewer sed -i" || bad "readonly: reviewer sed -i should be denied"
[ -z "$(decision readonly.sh '{"agent_type":"delivery:reviewer","tool_input":{"command":"git diff BASE..HEAD"}}')" ] && ok "readonly allows the reviewer git diff" || bad "readonly: reviewer git diff should pass"
[ -z "$(decision readonly.sh '{"agent_type":"delivery:worker","tool_input":{"command":"git commit -m x"}}')" ] && ok "readonly ignores the worker" || bad "readonly: worker should be ignored"
[ -z "$(decision readonly.sh '{"agent_type":"delivery:reviewer","tool_input":{"command":"rm -rf /tmp/gal-red && git archive HEAD | tar -x -C /tmp/gal-red"}}')" ] && ok "readonly allows rm -rf on a temp dir" || bad "readonly: rm -rf /tmp/... should pass"
[ "$(decision readonly.sh '{"agent_type":"delivery:reviewer","tool_input":{"command":"rm -rf ./build"}}')" = "deny" ] && ok "readonly denies rm -rf inside the tree" || bad "readonly: rm -rf ./build should be denied"
[ "$(verify "$red_worker_stop")" = "2" ] && ok "verify blocks a red worker" || bad "verify: red worker should exit 2"
[ "$(verify "$green_worker_stop")" = "0" ] && ok "verify allows a green worker" || bad "verify: green worker should exit 0"
[ "$(verify "$red_reviewer_stop")" = "0" ] && ok "verify ignores the reviewer" || bad "verify: reviewer should exit 0"
[ "$(verify "$red_worker_handoff")" = "2" ] && ok "verify flags a red handoff to the controller" || bad "verify: red handoff should exit 2"
[ "$(verify "$red_other_tool")" = "0" ] && ok "verify ignores other tools" || bad "verify: other tools should exit 0"
[ "$(ctx "$green_worker_handoff" | grep -c passed)" = "1" ] && ok "verify reports a green handoff to the controller" || bad "verify: green handoff should emit additionalContext"
[ "$(verify "$red_background_launch")" = "0" ] && [ -z "$(printf '%s' "$red_background_launch" | "$H/verify.sh" 2>&1)" ] && ok "verify skips a background launch (no handoff yet)" || bad "verify: background launch should pass silently"
[ "$(verify "$(mk PostToolUse '' Agent delivery:worker "$mono" "$(handoff services/svc-b/b.py)")")" = "0" ] && ok "verify runs only the changed project's command" || bad "verify: svc-b change should not run svc-a"
[ "$(verify "$(mk PostToolUse '' Agent delivery:worker "$mono" "$(handoff services/svc-a/a.py)")")" = "2" ] && ok "verify blocks a red changed project" || bad "verify: svc-a change should exit 2"
[ "$(verify "$(mk SubagentStop delivery:worker '' '' "$mono" "$(handoff services/svc-b/b.py services/svc-a/a.py)")")" = "2" ] && ok "verify runs every changed project" || bad "verify: a change in svc-a and svc-b should exit 2"
( cd "$mono/services/svc-a" && touch new.py )
[ "$(verify "$(mk SubagentStop delivery:worker '' '' "$mono")")" = "2" ] && ok "verify falls back to git status for changed files" || bad "verify: untracked svc-a file should exit 2"
[ "$(verify "$(mk SubagentStop delivery:worker '' '' "$mono" "$(handoff web/app.tsx)")")" = "0" ] && ok "verify passes a project with no command" || bad "verify: web/ has no command and should exit 0"
rm -f "$tmp/ran"; PATH="$tmp/bin:$PATH" verify "$(mk PostToolUse '' Agent delivery:worker "$tmp/uvproj" "$(handoff pyproject.toml)")" >/dev/null
[ "$(cat "$tmp/ran" 2>/dev/null)" = "uv run pytest -q" ] && ok "verify uses uv run pytest in a uv project" || bad "verify: uv project ran '$(cat "$tmp/ran" 2>/dev/null)'"
rm -f "$tmp/ran"; PATH="$tmp/bin:$PATH" verify "$(mk PostToolUse '' Agent delivery:worker "$tmp/bunproj" "$(handoff package.json)")" >/dev/null
[ "$(cat "$tmp/ran" 2>/dev/null)" = "bun run test" ] && ok "verify uses bun run test in a bun project" || bad "verify: bun project ran '$(cat "$tmp/ran" 2>/dev/null)'"
missing_cmd=$(mk PostToolUse '' Agent delivery:worker "$tmp/red" "$(handoff auth/session.py)" "$missing_cmd_brief")
[ "$(verify "$missing_cmd")" = "0" ] && [ "$(ctx "$missing_cmd" | grep -c 'configuration error')" = "1" ] && ok "verify reports exit 127 as a configuration error, not red" || bad "verify: a missing command should exit 0 with a configuration error"
printf '%s\n' "$(jq -cn --arg b "$missing_cmd_brief" '{type:"user", message:{role:"user", content:$b}}')" > "$tmp/agent.jsonl"
[ "$(verify "$(mk SubagentStop delivery:worker '' '' "$tmp/red" | jq -c --arg t "$tmp/agent.jsonl" '. + {agent_transcript_path:$t}')")" = "0" ] && ok "verify runs the brief's declared command at the stop gate" || bad "verify: the stop gate should run the brief's command"

echo; [ $fail -eq 0 ] && echo "check: PASS" || { echo "check: FAIL"; exit 1; }
