#!/usr/bin/env python3
"""sau plugin hooks: one stdlib-only entry point behind three bash wrappers.

Usage: sau_hooks.py gate | forbidden | no-account-copies   (hook JSON on stdin)
Spec: plugins/sau/docs/states-and-gates.md section 6. Answers use the
hookSpecificOutput format; no output means "no opinion".
"""
import glob
import json
import os
import re
import shlex
import subprocess
import sys

SAU_SKILLS = (
    "site-brief-builder", "keyword-fanout-map", "seo-content-writer",
    "motion-director", "onpage-optimizer", "internal-link-architect",
    "ai-visibility-checker",
)
MARKERS = ("[PRIVADO]", "[OBJETIVO]")
MAX_DEPTH = 4  # a profile's .sau directory sits at most this many levels under the git root


def answer(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}, separators=(",", ":")))


def git(cwd, *args):
    try:
        r = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def existing_dir(path):
    d = os.path.dirname(os.path.abspath(path))
    while d and not os.path.isdir(d):
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return d


def norm(p):
    return os.path.normcase(os.path.realpath(p))


def find_profiles(cwd):
    """Every <dir>/.sau/site.json under the session's git root; .sau at most MAX_DEPTH levels down."""
    root = git(cwd, "rev-parse", "--show-toplevel") or cwd
    root = os.path.abspath(root)
    found = []
    for dirpath, dirnames, _ in os.walk(root):
        depth = 0 if dirpath == root else len(os.path.relpath(dirpath, root).split(os.sep))
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules") and depth < MAX_DEPTH]
        if os.path.basename(dirpath) == ".sau":
            f = os.path.join(dirpath, "site.json")
            if os.path.isfile(f):
                try:
                    with open(f, encoding="utf-8") as fh:
                        found.append((os.path.dirname(dirpath), json.load(fh)))
                except Exception:
                    pass
    return found


def repo_slug(url):
    m = re.search(r"(?:^|[:/])([^/:]+)/([^/]+?)(?:\.git)?/?$", url or "")
    return (m.group(1) + "/" + m.group(2)).lower() if m else ""


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


# ---------------------------------------------------------------- gate

SEP = re.compile(r"^[;&|()<>]+$")


def command_segments(cmd):
    cmd = cmd.replace("\n", " ; ").replace("`", " ; ").replace("$(", " ( ")
    try:
        lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        toks = list(lex)
    except ValueError:
        toks = re.split(r"\s+|(?=[;&|])", cmd)
    segs, cur = [], []
    for t in toks:
        if SEP.match(t):
            if cur:
                segs.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur:
        segs.append(cur)
    return segs


WRAPPERS = ("sudo", "env", "command", "npx", "pnpm", "bunx", "dlx", "exec")


def classify(seg):
    """Return (kind, args) for a held command, else None."""
    i = 0
    while i < len(seg) and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", seg[i]) or seg[i] in WRAPPERS):
        i += 1
    seg = seg[i:]
    if not seg:
        return None
    prog = re.sub(r"\.(exe|cmd)$", "", os.path.basename(seg[0]).lower())
    rest = seg[1:]
    if prog == "git":
        j = 0
        while j < len(rest) and rest[j].startswith("-"):
            j += 2 if rest[j] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
        if j < len(rest) and rest[j] == "push":
            return "git push", rest[j + 1:]
    elif prog == "gh":
        pos = [a for a in rest if not a.startswith("-")]
        if len(pos) >= 2 and pos[0] == "pr" and pos[1] in ("create", "ready", "merge", "close"):
            return "gh pr " + pos[1], rest
    elif prog == "vercel":
        pos = [a for a in rest if not a.startswith("-")]
        if "--prod" in rest or "--production" in rest or (pos and pos[0] == "promote"):
            return "vercel production deploy", rest
    return None


def flag_value(args, *names):
    for k, a in enumerate(args):
        for n in names:
            if a == n and k + 1 < len(args):
                return args[k + 1]
            if a.startswith(n + "="):
                return a.split("=", 1)[1]
    return ""


def has_gate(files, gate, slug=None):
    for f in files:
        g = load_json(f).get("gates", {})
        if slug is None:
            if gate in g or any(gate in s for s in g.get("seeds", {}).values()):
                return True
        else:
            if os.path.basename(os.path.dirname(f)) == slug and gate in g:
                return True
            if gate in g.get("seeds", {}).get(slug, {}):
                return True
    return False


def missing_gate(kind, args, cwd):
    """A sentence naming the missing gate, or '' when unknown or satisfied."""
    profiles = find_profiles(cwd)
    branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    for pdir, prof in profiles:
        prefix = prof.get("branch_prefix", "sau/")
        prod = prof.get("production_branch", "")
        out = os.path.join(pdir, prof.get("output_dir", "."))
        files = glob.glob(os.path.join(out, "*", "estado.json")) + glob.glob(os.path.join(out, "tanda-*", "estado.json"))
        targets_prod = bool(prod) and (kind == "vercel production deploy" or prod in args
                                       or flag_value(args, "--base", "-B") == prod)
        if targets_prod:
            if not has_gate(files, "P3"):
                return "gate P3 is not recorded in any estado.json under %s; a release into %s needs it." % (out, prod)
            continue
        needs_p2 = kind in ("gh pr ready", "gh pr merge") or (
            kind == "gh pr create" and not any(a in ("--draft", "-d") for a in args))
        if needs_p2 and branch.startswith(prefix) and len(branch) > len(prefix):
            slug = branch[len(prefix):]
            if not has_gate(files, "P2", slug):
                return "gate P2 is not recorded for unit '%s' (no gate record under %s); this action needs it." % (slug, out)
    return ""


def hook_gate(data):
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return
    for seg in command_segments(cmd):
        hit = classify(seg)
        if hit:
            kind, args = hit
            reason = "sau gate: '%s' publishes work or changes shared state; it needs the person's explicit approval." % kind
            try:
                extra = missing_gate(kind, args, data.get("cwd") or os.getcwd())
            except Exception:
                extra = ""
            if extra:
                reason += " Also: " + extra
            answer("ask", reason)
            return


# ----------------------------------------------------------- forbidden

def written_text(tool, ti):
    if tool == "Write":
        return ti.get("content") or ""
    if tool == "Edit":
        return ti.get("new_string") or ""
    return "\n".join((e or {}).get("new_string") or "" for e in ti.get("edits") or [])


def under(rel, scan_paths):
    rel = rel.replace("\\", "/").lstrip("./")
    for sp in scan_paths:
        sp = sp.replace("\\", "/").lstrip("./").rstrip("/")
        if sp == "" or rel == sp or rel.startswith(sp + "/"):
            return True
    return False


def hook_forbidden(data):
    tool = data.get("tool_name") or ""
    if tool not in ("Write", "Edit", "MultiEdit"):
        return
    ti = data.get("tool_input") or {}
    path = ti.get("file_path") or ""
    if not path:
        return
    if data.get("agent_type") == "sau:sau-step" and os.path.basename(path).lower() == "estado.json":
        answer("deny", "sau gate: only the orchestrator writes estado.json, after the person's answer. sau-step must not record gates.")
        return
    cwd = data.get("cwd") or os.getcwd()
    profiles = find_profiles(cwd)
    if not profiles:
        return
    path = path if os.path.isabs(path) else os.path.join(cwd, path)
    d = existing_dir(path)
    top = git(d, "rev-parse", "--show-toplevel")
    origin = repo_slug(git(d, "remote", "get-url", "origin"))
    if not top or not origin:
        return
    rel = os.path.relpath(norm(path), norm(top))
    text = written_text(tool, ti)
    for pdir, prof in profiles:
        if repo_slug(prof.get("code_repo", "")) != origin:
            continue
        scan = prof.get("scan_paths", ["src/"])
        if not under(rel, scan):
            continue
        terms = []
        tf = prof.get("forbidden_terms_file")
        if tf:
            tpath = tf if os.path.isabs(tf) else os.path.join(pdir, tf)
            try:
                with open(tpath, encoding="utf-8") as fh:
                    terms = [t.strip() for t in fh if t.strip() and not t.lstrip().startswith("#")]
            except Exception:
                answer("ask", "sau gate: this profile declares a forbidden_terms_file that cannot be read, so the write under %s cannot be checked. Ask the person before writing." % ", ".join(scan))
                return
        for n, line in enumerate(text.splitlines(), 1):
            low = line.lower()
            for m in MARKERS:
                if m.lower() in low:
                    answer("deny", "sau gate: line %d carries the marker %s; private or objective text from the brief must not reach published code. Remove it." % (n, m))
                    return
            for t in terms:
                if t.lower() in low:
                    answer("deny", "sau gate: line %d contains the forbidden term '%s' (forbidden_terms_file). Rewrite without it." % (n, t))
                    return
        return


# ---------------------------------------------------- no-account-copies

def hook_skill(data):
    if data.get("tool_name") not in (None, "Skill"):
        return
    ti = data.get("tool_input") or {}
    name = (ti.get("skill") or ti.get("name") or "").strip()
    bare = name.split(":")[-1]
    if bare in SAU_SKILLS and name != "sau:" + bare:
        answer("deny", "sau gate: '%s' is not the plugin's copy. Load 'sau:%s' instead, so the reviewed version runs." % (name, bare))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        raw = sys.stdin.buffer.read().decode("utf-8", "replace")
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        return 0
    fn = {"gate": hook_gate, "forbidden": hook_forbidden, "no-account-copies": hook_skill}.get(mode)
    if fn:
        fn(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
