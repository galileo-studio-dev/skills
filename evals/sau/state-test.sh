#!/usr/bin/env bash
# Tests for plugins/sau/skills/running-sau/scripts/state.py. No network, no model.
# Builds an invented site in a temporary folder (its own fixture, not
# evals/sau/fixture/) with outputs that are never committed, and checks the
# derived state. Needs bash and py or python3. No jq.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
STATE="$here/../../plugins/sau/skills/running-sau/scripts/state.py"
fail=0; pass=0
ok()  { echo "  ok   $1"; pass=$((pass+1)); }
bad() { echo "  FAIL $1"; fail=$((fail+1)); }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
win() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
PY=""; for c in py python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info[0] != 3)' >/dev/null 2>&1; then PY=$c; break; fi
done
[ -n "$PY" ] || { echo "state-test: no Python 3 (py or python3)"; exit 1; }
st()   { "$PY" "$STATE" "$@"; }
# q <json-file> <python expression over r> : prints the value
q() { "$PY" -c 'import json,sys; r=json.load(open(sys.argv[1],encoding="utf-8")); print(eval(sys.argv[2]))' "$1" "$2"; }
unit() { printf '[u for u in r["units"] if u["unit"]=="%s"][0]' "$1"; }

# ---- invented site: one repository, page mode, outputs never committed
site="$tmp/site"; mkdir -p "$site/.sau" "$site/seo/output"
cat > "$site/.sau/site.json" <<'EOF'
{
  "schema_version": 1, "site": "testsite", "domain": "www.testsite.test", "locale": "es-ES",
  "brief": "seo/site-brief.md", "output_dir": "seo/output",
  "code_repo": "test-org/test-web", "content_repo": "test-org/test-web",
  "base_branch": "dev", "production_branch": "main", "branch_prefix": "sau/",
  "mode": "page", "motion": "plan-only", "checks": ["true"], "legal_review": "off", "onpage_min": 90
}
EOF
printf '# Invented brief\n\nNothing real.\n' > "$site/seo/site-brief.md"
git -C "$site" init -q -b dev; git -C "$site" config core.autocrlf false
git -C "$site" add .sau seo/site-brief.md
git -C "$site" -c user.email=t@example.test -c user.name=t commit -qm base   # outputs stay untracked
O="$site/seo/output"
put() { mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
evidence() { st hash --dir "$(win "$1")" "${@:2}"; }   # prints {rel: sha256}
P="$(win "$site/.sau/site.json")"

# page "alpha": step 1 done, P1 just recorded, nothing committed
put "$O/alpha/01-keyword-map.csv" 'keyword,volume
alpha tool,100'
put "$O/alpha/01-keyword-map.html" '<html>map</html>'
ev=$(evidence "$O/alpha" 01-keyword-map.csv)
cat > "$O/alpha/estado.json" <<EOF
{ "schema_version": 1, "site": "testsite", "mode": "page", "unit": "alpha",
  "gates": { "P1": { "at": "2030-01-01T10:00:00+01:00", "by": "owner", "keyword": "alpha tool",
                     "motion": false, "legal": false, "evidence": $ev } } }
EOF

# page "beta": draft and P2 recorded, then the draft changes
put "$O/beta/01-keyword-map.csv" 'keyword
beta'
put "$O/beta/01-keyword-map.html" '<html/>'
put "$O/beta/draft.md" '# Beta draft'
put "$O/beta/02-content-package.html" '<html/>'
put "$O/beta/03-onpage-report.html" '<html>94/100</html>'
ev1=$(evidence "$O/beta" 01-keyword-map.csv); ev2=$(evidence "$O/beta" draft.md 03-onpage-report.html)
cat > "$O/beta/estado.json" <<EOF
{ "schema_version": 1, "site": "testsite", "mode": "page", "unit": "beta",
  "gates": { "P1": { "at": "2030-01-01T10:00:00+01:00", "by": "owner", "motion": false, "legal": false, "evidence": $ev1 },
             "P2": { "at": "2030-01-02T10:00:00+01:00", "by": "owner", "onpage_score": 94, "legal": "not-requested", "evidence": $ev2 } } }
EOF

# page "gamma": half done, P1 recorded with motion, draft written, no motion plan yet
put "$O/gamma/01-keyword-map.csv" 'keyword
gamma'
put "$O/gamma/01-keyword-map.html" '<html/>'
put "$O/gamma/draft.md" '# Gamma'
put "$O/gamma/02-content-package.html" '<html/>'
ev=$(evidence "$O/gamma" 01-keyword-map.csv)
cat > "$O/gamma/estado.json" <<EOF
{ "schema_version": 1, "site": "testsite", "mode": "page", "unit": "gamma",
  "gates": { "P1": { "at": "2030-01-01T10:00:00+01:00", "by": "owner", "motion": true, "legal": false, "evidence": $ev } } }
EOF

# page "delta": only the keyword map, no gate yet
put "$O/delta/01-keyword-map.csv" 'keyword
delta'
put "$O/delta/01-keyword-map.html" '<html/>'

# tanda with 00-reparto.csv: P1 recorded; alpha-s has 2 and 3, beta-s only a draft
T="$O/tanda-2030-01-05"
put "$T/01-keyword-map.csv" 'keyword
seeds'
put "$T/01-keyword-map.html" '<html/>'
cat > "$T/00-reparto.csv" <<'EOF'
semilla,slug,tipo,archivo,keyword_principal,secundarias,excluidas,motion,legal
1,alpha-s,nueva,src/content/pages/alpha-s.md,alpha seed,a;b,beta seed,no,no
2,beta-s,nueva,src/content/pages/beta-s.md,beta seed,c,alpha seed,si,no
EOF
put "$T/alpha-s/draft.md" '# A'
put "$T/alpha-s/02-content-package.html" '<html/>'
put "$T/alpha-s/03-onpage-report.html" '<html/>'
put "$T/beta-s/draft.md" '# B'
ev=$(evidence "$T" 00-reparto.csv)
cat > "$T/estado.json" <<EOF
{ "schema_version": 1, "site": "testsite", "mode": "tanda", "unit": "tanda-2030-01-05",
  "gates": { "P1": { "at": "2030-01-05T10:00:00+01:00", "by": "owner", "seeds": ["alpha-s", "beta-s"], "evidence": $ev } } }
EOF

echo "== sau state.py"
st --profile "$P" --format json > "$tmp/r1.json" 2>"$tmp/err" && ok "state.py runs on the invented site" || { bad "state.py failed: $(cat "$tmp/err")"; }
[ -n "$(git -C "$site" status --short seo/output)" ] && ok "outputs are uncommitted in the fixture" || bad "fixture: outputs should be untracked"
[ "$(q "$tmp/r1.json" "$(unit alpha)['gates']['P1']['status']")" = "recorded" ] && ok "P1 just recorded with uncommitted outputs is not stale" || bad "alpha P1 should be recorded, got $(q "$tmp/r1.json" "$(unit alpha)['gates']['P1']")"
[ "$(q "$tmp/r1.json" "$(unit alpha)['next']")" = "2" ] && ok "after P1 the next step is 2" || bad "alpha next should be 2, got $(q "$tmp/r1.json" "$(unit alpha)['next']")"
[ "$(q "$tmp/r1.json" "$(unit beta)['gates']['P2']['status']")" = "recorded" ] && ok "P2 with unchanged evidence is recorded" || bad "beta P2 should be recorded before the edit"
printf '\nA new paragraph.\n' >> "$O/beta/draft.md"
st --profile "$P" --format json > "$tmp/r2.json"
[ "$(q "$tmp/r2.json" "$(unit beta)['gates']['P2']['status']")" = "stale" ] && ok "draft.md changed after P2: P2 stale" || bad "beta P2 should be stale, got $(q "$tmp/r2.json" "$(unit beta)['gates']['P2']")"
[ "$(q "$tmp/r2.json" "$(unit beta)['gates']['P2']['changed']")" = "['draft.md']" ] && ok "the stale gate names draft.md" || bad "beta P2 changed list: $(q "$tmp/r2.json" "$(unit beta)['gates']['P2'].get('changed')")"
[ "$(q "$tmp/r2.json" "$(unit beta)['next']")" = "P2" ] && ok "a stale P2 is asked again" || bad "beta next should be P2, got $(q "$tmp/r2.json" "$(unit beta)['next']")"
[ "$(q "$tmp/r2.json" "$(unit beta)['gates']['P1']['status']")" = "recorded" ] && ok "P1 stays valid when only the draft changed" || bad "beta P1 should stay recorded"
printf '# Beta draft\r\n' > "$O/beta/draft.md"
st --profile "$P" --format json > "$tmp/r3.json"
[ "$(q "$tmp/r3.json" "$(unit beta)['gates']['P2']['status']")" = "recorded" ] && ok "CRLF line endings alone do not make a gate stale" || bad "beta P2 should be recorded with CRLF-only change"
[ "$(q "$tmp/r1.json" "$(unit gamma)['next']")" = "2b" ] && ok "half-done page with motion: next is 2b" || bad "gamma next should be 2b, got $(q "$tmp/r1.json" "$(unit gamma)['next']")"
[ "$(q "$tmp/r1.json" "$(unit gamma)['last_done']")" = "2" ] && ok "half-done page: last step with evidence is 2" || bad "gamma last_done should be 2"
[ "$(q "$tmp/r1.json" "$(unit delta)['next']")" = "P1" ] && ok "map without a gate: next is P1" || bad "delta next should be P1, got $(q "$tmp/r1.json" "$(unit delta)['next']")"
TU=$(unit tanda-2030-01-05)
[ "$(q "$tmp/r1.json" "$TU['mode']")" = "tanda" ] && ok "tanda unit found from 00-reparto.csv" || bad "tanda unit missing"
[ "$(q "$tmp/r1.json" "[s['slug'] for s in $TU['seeds']]")" = "['alpha-s', 'beta-s']" ] && ok "seeds read from 00-reparto.csv in order" || bad "tanda seeds: $(q "$tmp/r1.json" "[s['slug'] for s in $TU['seeds']]")"
[ "$(q "$tmp/r1.json" "$TU['next']")" = "2 (beta-s)" ] && ok "tanda position is its most behind seed" || bad "tanda next should be '2 (beta-s)', got $(q "$tmp/r1.json" "$TU['next']")"
[ "$(q "$tmp/r1.json" "$TU['seeds'][0]['next']")" = "C" ] && ok "seed with draft and audit: next is C" || bad "alpha-s next should be C, got $(q "$tmp/r1.json" "$TU['seeds'][0]['next']")"
sed -i 's/^2,beta-s,nueva/2,beta-s,actualizar/' "$T/00-reparto.csv"
st --profile "$P" --format json > "$tmp/r4.json"
[ "$(q "$tmp/r4.json" "$TU['gates']['P1']['status']")" = "stale" ] && ok "reparto changed after P1: tanda P1 stale" || bad "tanda P1 should be stale"
[ "$(q "$tmp/r4.json" "$TU['next']")" = "P1" ] && ok "a stale reparto is asked again before any seed" || bad "tanda next should be P1, got $(q "$tmp/r4.json" "$TU['next']")"
st --profile "$P" > "$tmp/table.txt"
grep -q '^| beta | page | ' "$tmp/table.txt" && grep -qF '| P1 (stale) |' "$tmp/table.txt" && ok "table format lists units and stale gates" || bad "table output: $(head -12 "$tmp/table.txt")"
(cd "$site" && st --format json > "$tmp/r5.json") && [ "$(q "$tmp/r5.json" "r['site']")" = "testsite" ] && ok "finds the profile from the git root" || bad "profile discovery from cwd failed"
mkdir -p "$O/broken"; printf '{not json' > "$O/broken/estado.json"; put "$O/broken/01-keyword-map.csv" 'k'
st --profile "$P" --format json > "$tmp/r6.json"
q "$tmp/r6.json" "$(unit broken)['warnings']" | grep -q 'unreadable' && ok "an unreadable estado.json is a warning, not a crash" || bad "broken estado.json should warn"
[ "$(st hash --dir "$(win "$O/alpha")" missing.md >/dev/null 2>&1; echo $?)" = "2" ] && ok "hash refuses a missing evidence file" || bad "hash of a missing file should exit 2"

echo; echo "sau state: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "sau state: PASS" || { echo "sau state: FAIL"; exit 1; }
