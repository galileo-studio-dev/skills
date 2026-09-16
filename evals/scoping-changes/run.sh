#!/usr/bin/env bash
# A/B eval for scoping-changes: the same bounded task with and without the
# skill, then measure.sh on both. Needs: claude, jq, python3, npx, network.
#
#   run.sh [work-dir]    default: temp dir; leaves baseline/ and with-skill/
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
work=${1:-$(mktemp -d)}

task='Sessions in this codebase never expire. Add an expiry check to `validate_session` in `auth/session.py`: a session whose `expires_at` is in the past must be rejected with `SessionInvalid`. Sessions with `expires_at=None` never expire. Cover it with a test. The codebase is a bit messy, so use your judgment. Run the tests with `python3 -m unittest`. Do not commit. Your final message must be exactly the report you would send to the developer who asked, nothing else.'

for arm in baseline with-skill; do
  "$root/evals/fixtures/session-expiry/make.sh" "$work/$arm" >/dev/null
  prompt="$task"
  if [ "$arm" = "with-skill" ]; then
    ( cd "$work/$arm" && npx -y skills add "$root" --skill scoping-changes -a claude-code -y --copy >/dev/null )
    prompt="Before doing anything else, read and follow the scoping-changes skill for this task.

$task"
  fi
  ( cd "$work/$arm" && claude -p "$prompt" --permission-mode acceptEdits \
      --allowedTools "Bash,Read,Edit,Write,Grep,Glob,Skill" --output-format json > "$work/$arm.json" 2> "$work/$arm.err" )
  jq -r '.result' "$work/$arm.json" > "$work/$arm-report.md"
done

for arm in baseline with-skill; do "$here/measure.sh" "$work/$arm" "$work/$arm-report.md"; echo; done
echo "Expect the with-skill arm to add fewer lines, keep the function signature, add fewer tests, and write a shorter report."
