#!/usr/bin/env python3
"""Minimal YAML frontmatter check for SKILL.md, agent and command files.

Standard library only (no PyYAML). It accepts the subset the catalog uses:
top-level `key: value` lines, nested blocks under a key with no value, and
block scalars (| or >). It fails on what makes a real YAML parser drop the
whole frontmatter: an unquoted value containing ": " or " #", a value that
starts with a reserved indicator, a broken quoted string, or a line that is
not a key. Usage: frontmatter.py FILE...   Exit 1 on any problem.
"""
import re
import sys

KEY = re.compile(r"^([A-Za-z0-9_.-]+):(?:[ \t]+(.*))?$")
DQ = re.compile(r'^"(?:[^"\\]|\\.)*"$')
SQ = re.compile(r"^'(?:[^']|'')*'$")


def scalar_problem(val):
    if val.startswith('"'):
        return None if DQ.match(val) else "broken double-quoted string"
    if val.startswith("'"):
        return None if SQ.match(val) else "broken single-quoted string"
    if val.startswith("[") or val.startswith("{"):
        return None if val.endswith(("]", "}")) else "unclosed flow collection"
    if val in ("|", ">", "|-", ">-", "|+", ">+"):
        return None
    if val[0] in "@`%&*!|>" or val.startswith(("? ", "- ")):
        return "unquoted value starts with a reserved character %r" % val[0]
    if ": " in val or val.endswith(":"):
        return "unquoted value contains ': ' (quote the whole value)"
    if " #" in val:
        return "unquoted value contains ' #' (YAML reads the rest as a comment)"
    return None


def check(path):
    problems = []
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    if not text.startswith("---\n"):
        return ["no frontmatter"]
    end = text.find("\n---\n", 3)
    if end < 0:
        return ["frontmatter is not closed with ---"]
    open_key, block = False, False
    for n, line in enumerate(text[4:end].split("\n"), 2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line[0] in " \t":
            if not open_key:
                problems.append("line %d: indented line without a parent key" % n)
            elif not block:
                inner = line.strip()
                if inner.startswith("- "):
                    inner_val = inner[2:].strip()
                    p = scalar_problem(inner_val) if inner_val and not KEY.match(inner_val) else None
                else:
                    m = KEY.match(inner)
                    if not m:
                        problems.append("line %d: nested line is not 'key: value' or '- item'" % n)
                        continue
                    p = scalar_problem(m.group(2).strip()) if m.group(2) else None
                if p:
                    problems.append("line %d: %s" % (n, p))
            continue
        m = KEY.match(line)
        if not m:
            problems.append("line %d: not a 'key: value' line" % n)
            open_key, block = False, False
            continue
        val = (m.group(2) or "").strip()
        open_key = val == "" or val in ("|", ">", "|-", ">-", "|+", ">+")
        block = val.startswith(("|", ">"))
        if val:
            p = scalar_problem(val)
            if p:
                problems.append("line %d (%s): %s" % (n, m.group(1), p))
    return problems


def main(files):
    failed = 0
    for f in files:
        for p in check(f):
            print("%s: %s" % (f, p))
            failed = 1
    return failed


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
