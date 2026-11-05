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
MAX_DEPTH = 4  # a profile's .sau directory sits at most this many levels under a search root
SKIP_DIRS = (".git", ".claude", "node_modules")


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


# ------------------------------------------------------------ profiles

def main_repo_root(cwd):
    """The main checkout of the repository cwd belongs to (not the git root when cwd is in a worktree)."""
    common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if not common:
        return ""
    common = os.path.abspath(common)
    return os.path.dirname(common) if os.path.basename(common) == ".git" else ""


def search_roots(cwd):
    """Where profiles are searched, most authoritative first: CLAUDE_PROJECT_DIR, then cwd.

    Each base contributes its git root and, inside a worktree, the main checkout.
    """
    roots = []
    for base in (os.environ.get("CLAUDE_PROJECT_DIR") or "", cwd):
        if not base or not os.path.isdir(base):
            continue
        for r in (git(base, "rev-parse", "--show-toplevel") or base, main_repo_root(base)):
            if r and norm(r) not in [norm(x) for x in roots]:
                roots.append(os.path.abspath(r))
    return roots


def walk_profiles(root):
    found = []
    for dirpath, dirnames, _ in os.walk(root):
        depth = 0 if dirpath == root else len(os.path.relpath(dirpath, root).split(os.sep))
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and depth < MAX_DEPTH]
        if os.path.basename(dirpath) == ".sau":
            f = os.path.join(dirpath, "site.json")
            if os.path.isfile(f):
                try:
                    with open(f, encoding="utf-8") as fh:
                        prof = json.load(fh)
                    if isinstance(prof, dict):
                        found.append((os.path.dirname(dirpath), prof))
                except Exception:
                    pass
    return found


def find_profiles(cwd):
    """Every <dir>/.sau/site.json under the search roots, .sau at most MAX_DEPTH levels down.

    .git, .claude and node_modules are skipped. When two profiles share a `site`,
    the one found first wins, so the project directory's profile beats a stale copy.
    """
    found, seen_dirs, seen_sites = [], set(), set()
    for root in search_roots(cwd):
        for pdir, prof in walk_profiles(root):
            site = prof.get("site")
            if norm(pdir) in seen_dirs or (site and site in seen_sites):
                continue
            seen_dirs.add(norm(pdir))
            if site:
                seen_sites.add(site)
            found.append((pdir, prof))
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


# Words that only introduce the real command: wrappers and shell keywords.
WRAPPERS = ("sudo", "env", "command", "builtin", "npx", "pnpm", "bunx", "dlx", "exec", "nohup",
            "time", "nice", "stdbuf", "then", "do", "else", "elif", "if", "while", "until", "!", "{")
# Wrappers whose options take a value; timeout also takes a duration.
VALUE_OPTS = {"timeout": ("-s", "--signal", "-k", "--kill-after"),
              "xargs": ("-I", "-n", "-P", "-L", "-d", "-s", "-E", "-a", "--max-args",
                        "--max-procs", "--delimiter", "--arg-file", "--replace")}
SHELLS = ("bash", "sh", "zsh", "dash", "ksh")
PWSH = ("powershell", "pwsh")


def prog_name(tok):
    return re.sub(r"\.(exe|cmd)$", "", os.path.basename(tok.replace("\\", "/")).lower())


def strip_prefix(seg):
    """Drop variable assignments, shell keywords and wrappers (timeout 30, xargs -n1, nohup, ...)."""
    i = 0
    while i < len(seg):
        t, base = seg[i], prog_name(seg[i])
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t) or t in WRAPPERS or base in WRAPPERS:
            i += 1
            if base in ("nice", "stdbuf", "env", "sudo"):
                while i < len(seg) and seg[i].startswith("-"):
                    i += 1
            continue
        if base in VALUE_OPTS:
            i += 1
            while i < len(seg) and seg[i].startswith("-"):
                i += 2 if seg[i] in VALUE_OPTS[base] else 1
            if base == "timeout" and i < len(seg):
                i += 1  # the duration
            continue
        break
    return seg[i:]


def inner_script(prog, rest):
    """The command string run by bash -c, sh -c, eval, powershell -Command or cmd /c; else None."""
    if prog in SHELLS:
        for k, a in enumerate(rest):
            if re.match(r"^-[A-Za-z]*c[A-Za-z]*$", a):
                return rest[k + 1] if k + 1 < len(rest) else ""
            if not a.startswith("-"):
                return None
        return None
    if prog == "eval":
        return " ".join(rest)
    if prog in PWSH:
        for k, a in enumerate(rest):
            al = a.lower()
            if al in ("-c", "/c") or (len(al) > 2 and "-command".startswith(al)):
                return " ".join(rest[k + 1:])
        return None
    if prog == "cmd":
        for k, a in enumerate(rest):
            if a.lower() in ("/c", "/k", "/r"):
                return " ".join(rest[k + 1:])
    return None


def positionals(args, value_flags=()):
    pos, k = [], 0
    while k < len(args):
        a = args[k]
        if a in value_flags:
            k += 2
            continue
        if not a.startswith("-"):
            pos.append(a)
        k += 1
    return pos


GH_VALUE_FLAGS = ("-R", "--repo", "--hostname")
GH_API_VALUE_FLAGS = ("-R", "--repo", "-X", "--method", "-f", "-F", "--field", "--raw-field", "-H",
                      "--header", "--input", "-q", "--jq", "-t", "--template", "--hostname",
                      "--cache", "-p", "--preview")
GH_API_BODY = re.compile(r"^(-f|-F|--field|--raw-field|--input)(=.*)?$|^-[fF].")


def gh_api_writes(args):
    """True when a `gh api` call is not a plain read (an explicit non-GET method, or a body)."""
    pos = positionals(args, GH_API_VALUE_FLAGS)
    endpoint = pos[1] if len(pos) > 1 else ""
    method = flag_value(args, "-X", "--method").upper()
    if endpoint == "graphql":
        return "mutation" in " ".join(args).lower()
    if method:
        return method != "GET"
    return any(GH_API_BODY.match(a) for a in args)


def classify(seg, depth=0):
    """Return (kind, args) for a held command, else None."""
    seg = strip_prefix(seg)
    if not seg:
        return None
    prog = prog_name(seg[0])
    rest = seg[1:]
    inner = inner_script(prog, rest)
    if inner is not None:
        if depth >= 3:
            return None
        for s2 in command_segments(inner):
            hit = classify(s2, depth + 1)
            if hit:
                return hit
        return None
    if prog == "git":
        j = 0
        while j < len(rest) and rest[j].startswith("-"):
            j += 2 if rest[j] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
        if j < len(rest) and rest[j] == "push":
            return "git push", rest[j + 1:]
    elif prog == "gh":
        pos = positionals(rest, GH_VALUE_FLAGS)
        if len(pos) >= 2 and pos[0] == "pr" and pos[1] in ("create", "ready", "merge", "close"):
            return "gh pr " + pos[1], rest
        if pos and pos[0] == "api" and gh_api_writes(rest):
            return "gh api write", rest
    elif prog == "vercel":
        pos = [a for a in rest if not a.startswith("-")]
        if ("--prod" in rest or "--production" in rest or (pos and pos[0] == "promote")
                or flag_value(rest, "--target") == "production"):
            return "vercel production deploy", rest
    return None


# Commands that may write a file named among their arguments.
FILE_WRITERS = ("tee", "cp", "mv", "rm", "touch", "install", "truncate", "dd", "ln", "rsync",
                "set-content", "add-content", "out-file", "new-item", "copy-item", "move-item",
                "remove-item", "clear-content", "py", "python", "python3", "node", "perl", "ruby")
REDIRECT_ESTADO = re.compile(r">>?\|?\s*[\"']?[^\s;&|<>]*estado\.json", re.I)


def writes_estado(cmd, depth=0):
    """True when a shell command writes or redirects into an estado.json."""
    if "estado.json" not in cmd.lower():
        return False
    if REDIRECT_ESTADO.search(cmd):
        return True
    for seg in command_segments(cmd):
        seg = strip_prefix(seg)
        if not seg:
            continue
        prog, rest = prog_name(seg[0]), seg[1:]
        inner = inner_script(prog, rest)
        if inner is not None:
            if depth < 3 and writes_estado(inner, depth + 1):
                return True
            continue
        named = any("estado.json" in a.lower() for a in rest)
        if named and prog in FILE_WRITERS:
            return True
        if named and prog == "sed" and any(a.startswith("-i") or a.startswith("--in-place") for a in rest):
            return True
    return False


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
        if not isinstance(g, dict):
            continue
        if slug is None:
            if gate in g or any(gate in s for s in (g.get("seeds") or {}).values() if isinstance(s, dict)):
                return True
        else:
            if os.path.basename(os.path.dirname(f)) == slug and gate in g:
                return True
            if gate in ((g.get("seeds") or {}).get(slug) or {}):
                return True
    return False


def worktree_paths(cwd):
    out = git(cwd, "worktree", "list", "--porcelain")
    return [l[len("worktree "):] for l in out.splitlines() if l.startswith("worktree ")]


def gate_records(profiles, cwd):
    """Every estado.json of every profile, in its own checkout and in each worktree of its repository."""
    seen, files = set(), []
    for pdir, prof in profiles:
        out_rel = prof.get("output_dir", ".")
        bases = [pdir]
        top = git(pdir, "rev-parse", "--show-toplevel")
        if top:
            rel = os.path.relpath(norm(pdir), norm(top))
            for wt in worktree_paths(pdir) + worktree_paths(cwd):
                bases.append(os.path.normpath(os.path.join(wt, rel)))
        for b in bases:
            for f in glob.glob(os.path.join(b, out_rel, "*", "estado.json")):
                if norm(f) not in seen:
                    seen.add(norm(f))
                    files.append(f)
    return files


def missing_gate(kind, args, cwd):
    """A sentence naming the missing gate, or '' when unknown or satisfied."""
    profiles = find_profiles(cwd)
    if not profiles:
        return ""
    files = gate_records(profiles, cwd)
    where = "any estado.json of the site profiles or their worktrees (%d checked)" % len(files)
    branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    for pdir, prof in profiles:
        prefix = prof.get("branch_prefix", "sau/")
        prod = prof.get("production_branch", "")
        targets_prod = bool(prod) and (kind == "vercel production deploy" or prod in args
                                       or flag_value(args, "--base", "-B") == prod)
        if targets_prod:
            if not has_gate(files, "P3"):
                return "gate P3 is not recorded in %s; a release into %s needs it." % (where, prod)
            continue
        needs_p2 = kind in ("gh pr ready", "gh pr merge") or (
            kind == "gh pr create" and not any(a in ("--draft", "-d") for a in args))
        if needs_p2 and branch.startswith(prefix) and len(branch) > len(prefix):
            slug = branch[len(prefix):]
            if not has_gate(files, "P2", slug):
                return "gate P2 is not recorded for unit '%s' in %s; this action needs it." % (slug, where)
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
    if data.get("agent_type") == "sau:sau-step" and writes_estado(cmd):
        answer("ask", "sau gate: this command writes estado.json from a sau-step agent; only the orchestrator records gates, after the person's answer.")


# ----------------------------------------------------------- forbidden

FILE_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")


def written_text(tool, ti):
    if tool == "Write":
        return ti.get("content") or ""
    if tool == "Edit":
        return ti.get("new_string") or ""
    if tool == "NotebookEdit":
        return ti.get("new_source") or ""
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
    if tool not in FILE_TOOLS:
        return
    ti = data.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("notebook_path") or ""
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
