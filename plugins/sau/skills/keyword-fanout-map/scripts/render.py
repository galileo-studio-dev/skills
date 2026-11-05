#!/usr/bin/env python3
"""
Fill a dashboard template from a data.json. Standard library only.

Usage:
    python3 scripts/render.py <template.html.template> <data.json> <output.html>

Why a script instead of writing the HTML directly: these dashboards contain long
tables (an internal-link plan can run to 40+ rows). Generating rows by hand is
where layout drift, broken markup and typos come from. The skill produces data,
this produces HTML, so every run is byte-identical in structure.

data.json shape:
{
  "tokens": { "KW_TOTAL": 42, "PRIMARY_KEYWORD": "ai seo tools" },
  "rows": {
    "KEYWORD_ROW": [ { "ROW_KEYWORD": "...", "ROW_VOLUME": 1200 }, ... ],
    "FANOUT_ROW": [ { "ROW_QUESTION": "..." } ]
  },
  "raw": ["SCHEMA_JSON", "DRAFT_HTML"]
}

Rules:
- A repeatable block whose row list is missing or empty is deleted entirely.
- Values are HTML-escaped unless the token is listed in "raw".
- Any token left unfilled becomes "no data" and is reported on stderr, so a
  dashboard never ships with a visible {{TOKEN}} and never shows a made-up number.
"""

import html
import json
import re
import sys
from pathlib import Path

TOKEN_RE = re.compile(r"\{\{([A-Z0-9_]+)\}\}")
MISSING = "no data"


def block_re(name):
    return re.compile(
        r"[ \t]*<!--\s*BEGIN\s+" + re.escape(name) + r"\s*-->(.*?)[ \t]*<!--\s*END\s+"
        + re.escape(name) + r"\s*-->\n?",
        re.DOTALL,
    )


def find_block_names(template):
    return list(dict.fromkeys(re.findall(r"<!--\s*BEGIN\s+([A-Z0-9_]+)\s*-->", template)))


def fill(text, values, raw_tokens):
    def sub(match):
        key = match.group(1)
        if key not in values:
            return match.group(0)  # leave for the caller to resolve
        val = values[key]
        val = "" if val is None else str(val)
        return val if key in raw_tokens else html.escape(val, quote=True)
    return TOKEN_RE.sub(sub, text)


def render(template, data):
    tokens = {str(k): v for k, v in (data.get("tokens") or {}).items()}
    rows = data.get("rows") or {}
    raw = set(data.get("raw") or [])

    out = template

    # 1. Expand repeatable blocks first, so row tokens cannot collide with globals.
    for name in find_block_names(out):
        pattern = block_re(name)
        match = pattern.search(out)
        if not match:
            continue
        inner = match.group(1)
        row_list = rows.get(name) or []
        if not row_list:
            out = pattern.sub("", out)
            continue
        rendered = []
        for row in row_list:
            row_vals = {str(k): v for k, v in row.items()}
            chunk = fill(inner, row_vals, raw)
            # Row-level tokens with no value in this row fall back to blank, not "no data",
            # because an empty cell reads better than a repeated "no data" down a column.
            chunk = TOKEN_RE.sub(lambda m: "" if m.group(1).startswith("ROW_") else m.group(0), chunk)
            rendered.append(chunk)
        out = pattern.sub(lambda _m: "".join(rendered), out, count=1)

    # 2. Global tokens.
    out = fill(out, tokens, raw)

    # 3. Anything still unfilled becomes an honest placeholder, and is reported.
    leftovers = sorted(set(TOKEN_RE.findall(out)))
    if leftovers:
        print(
            "warning: no value supplied for %d token(s), wrote %r instead:\n  %s"
            % (len(leftovers), MISSING, ", ".join(leftovers)),
            file=sys.stderr,
        )
        out = TOKEN_RE.sub(MISSING, out)

    return out


def main(argv):
    if len(argv) != 4:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    template_path, data_path, out_path = Path(argv[1]), Path(argv[2]), Path(argv[3])
    for p in (template_path, data_path):
        if not p.exists():
            print(f"error: {p} not found", file=sys.stderr)
            return 1

    template = template_path.read_text(encoding="utf-8")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    result = render(template, data)
    out_path.write_text(result, encoding="utf-8")

    rows = data.get("rows") or {}
    counts = ", ".join(f"{k}={len(v or [])}" for k, v in rows.items()) or "no repeatable rows"
    print(f"wrote {out_path} ({len(result):,} bytes; {counts})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
