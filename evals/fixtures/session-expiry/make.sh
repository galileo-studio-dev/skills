#!/usr/bin/env bash
# Generates the session-expiry fixture: a small Python project with two green
# tests, a spec, and a two-slice plan. Every eval starts from it.
#
#   make.sh <target-dir>                        base project on main
#   make.sh <target-dir> --with-review-branch   also feature/session-expiry with
#                                               two planted defects: a forbidden
#                                               rename and a swallowed exception
set -euo pipefail
target=${1:?usage: make.sh <target-dir> [--with-review-branch]}
with_branch=false; [ "${2:-}" = "--with-review-branch" ] && with_branch=true

mkdir -p "$target"; cd "$target"
git init -q; git config user.email eval@example.com; git config user.name eval
mkdir -p auth tests docs/specs docs/plans
printf '__pycache__/\n*.pyc\n.claude/\n.agents/\n.delivery/\nskills-lock.json\n' > .gitignore
: > auth/__init__.py; : > tests/__init__.py

cat > README.md <<'EOF'
# sessions

Small auth helpers. Run tests with `python3 -m unittest`.
EOF

cat > auth/errors.py <<'EOF'
class SessionInvalid(Exception):
    pass
EOF

cat > auth/session.py <<'EOF'
from dataclasses import dataclass
from datetime import datetime

from auth.errors import SessionInvalid


@dataclass
class Session:
    id: str
    user_id: str | None
    revoked: bool = False
    expires_at: datetime | None = None
    created_at: datetime | None = None


def validate_session(session: Session) -> Session:
    if session.user_id is None:
        raise SessionInvalid(f"session {session.id} has no user")
    if session.revoked:
        raise SessionInvalid(f"session {session.id} is revoked")
    return session


def refresh_session(session: Session) -> Session:
    if session.revoked:
        raise SessionInvalid(f"session {session.id} is revoked")
    return session


def GetSessionAge(session, now):
    # legacy name, still called by the mobile client
    return (now - session.created_at).total_seconds()
EOF

cat > tests/test_session.py <<'EOF'
import unittest

from auth.errors import SessionInvalid
from auth.session import Session, validate_session


def make_session(**kw):
    base = dict(id="s1", user_id="u1")
    base.update(kw)
    return Session(**base)


class ValidateSessionTests(unittest.TestCase):
    def test_valid_session_passes(self):
        self.assertEqual(validate_session(make_session()).id, "s1")

    def test_revoked_session_rejected(self):
        with self.assertRaises(SessionInvalid):
            validate_session(make_session(revoked=True))
EOF

cat > docs/specs/session-expiry.md <<'EOF'
# Spec: session expiry

Tier: Prototype (internal experiment, no external users, no sensitive data).

## Requirements
- R1. `validate_session` rejects a session whose `expires_at` is in the past with `SessionInvalid`.
- R2. `refresh_session` rejects a session whose `expires_at` is in the past with `SessionInvalid`.
- R3. A session with `expires_at=None` never expires, in both functions.
- R4. Tests cover, for each function, an expired session and a not-yet-expired session.

## Constraints
- `GetSessionAge` is a public name called by the mobile client; it must not change.
- Compare against `datetime.now()` (naive local time), which is the module's existing convention.
EOF

cat > docs/plans/session-expiry-plan.md <<'EOF'
# Plan: session expiry

Spec: docs/specs/session-expiry.md. Verification command: `python3 -m unittest`. Branch: `feature/session-expiry`.

## Slice 1: expiry check in `validate_session`
- Files: `auth/session.py`, `tests/test_session.py`
- Failing test first: `test_validate_rejects_expired_session` (expired → `SessionInvalid`), plus `test_validate_accepts_unexpired_session`.
- Change: in `validate_session`, after the revoked check, raise `SessionInvalid(f"session {session.id} has expired")` when `expires_at` is not None and is before `datetime.now()`.
- Done when: `python3 -m unittest` passes with the two new tests.

## Slice 2: expiry check in `refresh_session`
- Files: `auth/session.py`, `tests/test_session.py`
- Failing test first: `test_refresh_rejects_expired_session`, plus `test_refresh_accepts_unexpired_session`.
- Change: the same check in `refresh_session`, after its revoked check. Do not extract a shared helper unless both checks are identical and a third caller exists.
- Done when: `python3 -m unittest` passes with the two new tests.

## Out of scope
- `GetSessionAge`, timezone handling, logging.
EOF

python3 -m unittest >/dev/null 2>&1
git add -A; git commit -qm "fixture: session helpers, spec and plan"; git branch -M main

if $with_branch; then
  git checkout -q -b feature/session-expiry
  # Planted: expiry check done in validate_session (fine), refresh_session
  # wrapped in a try/except that swallows the revocation error (regression,
  # and R2 not implemented), GetSessionAge renamed (forbidden by the spec).
  python3 - <<'PY'
import pathlib
p = pathlib.Path("auth/session.py"); s = p.read_text()
s = s.replace(
    '        raise SessionInvalid(f"session {session.id} is revoked")\n    return session\n\n\ndef refresh_session',
    '        raise SessionInvalid(f"session {session.id} is revoked")\n'
    '    if session.expires_at is not None and session.expires_at < datetime.now():\n'
    '        raise SessionInvalid(f"session {session.id} has expired")\n    return session\n\n\ndef refresh_session', 1)
s = s.replace(
    'def refresh_session(session: Session) -> Session:\n    if session.revoked:\n        raise SessionInvalid(f"session {session.id} is revoked")\n    return session',
    'def refresh_session(session: Session) -> Session:\n    try:\n        if session.revoked:\n            raise SessionInvalid(f"session {session.id} is revoked")\n    except Exception:\n        return session\n    return session', 1)
s = s.replace('def GetSessionAge(session, now):\n    # legacy name, still called by the mobile client\n', 'def get_session_age(session, now):\n', 1)
p.write_text(s)
PY
  cat >> tests/test_session.py <<'EOF'

    def test_expired_session_rejected(self):
        from datetime import datetime, timedelta
        with self.assertRaises(SessionInvalid):
            validate_session(make_session(expires_at=datetime.now() - timedelta(minutes=1)))

    def test_unexpired_session_passes(self):
        from datetime import datetime, timedelta
        self.assertEqual(validate_session(make_session(expires_at=datetime.now() + timedelta(minutes=1))).id, "s1")
EOF
  python3 -m unittest >/dev/null 2>&1
  git add -A; git commit -qm "feat: session expiry check"; git checkout -q main
fi

echo "fixture ready at $target (branches: $(git branch --format='%(refname:short)' | tr '\n' ' '))"
