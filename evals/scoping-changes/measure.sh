#!/usr/bin/env bash
# Measures one arm of the scoping-changes eval.  measure.sh <repo-dir> <report-file>
set -uo pipefail
repo=${1:?usage: measure.sh <repo-dir> <report-file>}; report=${2:?}
cd "$repo" || exit 1
echo "== $(basename "$repo")"
echo "files changed:"; git status --short | sed 's/^/  /'
echo "lines added/removed per file:"; git diff --numstat | sed 's/^/  /'
echo "untracked files: $(git ls-files --others --exclude-standard | wc -l | tr -d ' ')"
echo "test functions: $(grep -c 'def test_' tests/test_session.py) (fixture had 2)"
echo "validate_session signature: $(grep -m1 'def validate_session' auth/session.py)"
echo "lines touching refresh_session/GetSessionAge: $(git diff -U0 -- auth/session.py | grep -cE '^[-+].*(refresh_session|GetSessionAge)')"
echo "new imports: $(git diff -U0 -- auth/session.py | grep -E '^\+(from|import) ' | tr '\n' ';')"
echo "tests: $(python3 -m unittest 2>&1 | tail -1)"
echo "report: $(wc -w < "$report" | tr -d ' ') words, $(wc -l < "$report" | tr -d ' ') lines"
