#!/usr/bin/env python3
"""sau plugin hooks: one stdlib-only entry point behind three bash wrappers.

Usage: sau_hooks.py gate | forbidden | no-account-copies   (hook JSON on stdin)
Spec: plugins/sau/docs/states-and-gates.md section 6. Answers use the
hookSpecificOutput format; no output means "no opinion".
"""
import glob
import json
import os
import posixpath
import re
import shlex
import sys

SAU_SKILLS = (
    "site-brief-builder", "keyword-fanout-map", "seo-content-writer",
    "motion-director", "onpage-optimizer", "internal-link-architect",
    "ai-visibility-checker",
)
MARKERS = ("[PRIVADO]", "[OBJETIVO]")
MAX_DEPTH = 3  # a profile's .sau directory sits at most this many levels under a repository root
SKIP_DIRS = {".git", ".claude", "node_modules", ".venv", "venv", ".next", "dist", "build", "out",
             ".cache", ".turbo", "coverage", "AppData", "target", "__pycache__"}


def answer(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}, separators=(",", ":")))


def git(cwd, *args):
    import subprocess
    try:
        r = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def norm(p):
    return os.path.normcase(os.path.realpath(p))


def read_text(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


# ------------------------------------------------------- repositories
# Roots, worktrees and remotes are read from the files git keeps, without starting git.

def existing_ancestor(path):
    d = os.path.abspath(path)
    while d and not os.path.isdir(d):
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return d


def git_root(path):
    """The checkout (or worktree) that contains path, or ''."""
    d = existing_ancestor(path)
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return ""
        d = parent


def git_dir(top):
    g = os.path.join(top, ".git")
    if os.path.isdir(g):
        return g
    line = (read_text(g) or "").strip()
    if line.startswith("gitdir:"):
        return os.path.normpath(os.path.join(top, line[len("gitdir:"):].strip()))
    return ""


def common_dir(top):
    g = git_dir(top)
    if not g:
        return ""
    c = read_text(os.path.join(g, "commondir"))
    return os.path.normpath(os.path.join(g, c.strip())) if c else g


def main_root(top):
    """The main checkout of the repository top belongs to ('' when it is not a plain .git layout)."""
    c = common_dir(top)
    return os.path.dirname(c) if c and os.path.basename(c) == ".git" else ""


def remote_url(top, name="origin"):
    """URL of a remote, from the repository's config; git itself only when the config uses include or insteadOf."""
    text = read_text(os.path.join(common_dir(top) or os.path.join(top, ".git"), "config"))
    if text is None:
        return git(top, "remote", "get-url", name)
    low = text.lower()
    if "insteadof" in low or "[include" in low:
        return git(top, "remote", "get-url", name)
    sec = None
    for line in text.splitlines():
        s = line.strip()
        m = re.match(r'^\[\s*remote\s+"(.*)"\s*\]$', s, re.I)
        if m:
            sec = m.group(1)
            continue
        if s.startswith("["):
            sec = None
            continue
        if sec == name:
            m = re.match(r"^url\s*=\s*(.*)$", s, re.I)
            if m:
                return m.group(1).strip().strip('"')
    return ""


def repo_slug(url):
    m = re.search(r"(?:^|[:/])([^/:\s]+)/([^/\s]+?)(?:\.git)?/?$", (url or "").strip())
    return (m.group(1) + "/" + m.group(2)).lower() if m else ""


def same_repo(a, b):
    """True when two checkouts are the same repository (a worktree and its main checkout count as one)."""
    if not a or not b:
        return False
    ka = norm(main_root(a) or a)
    kb = norm(main_root(b) or b)
    return ka == kb


# ------------------------------------------------------------ profiles

def search_roots(bases):
    """(root, walk) pairs, most authoritative first: CLAUDE_PROJECT_DIR, then cwd, then any target.

    Inside a git repository a base contributes its root and, inside a worktree, the main
    checkout, and both are walked. Outside git only <base>/.sau is read (walk is False).
    """
    roots, seen = [], set()
    for base in bases:
        if not base or not os.path.isdir(base):
            continue
        top = git_root(base)
        cands = [(top, True), (main_root(top), True)] if top else [(os.path.abspath(base), False)]
        for r, walk in cands:
            if r and norm(r) not in seen:
                seen.add(norm(r))
                roots.append((os.path.abspath(r), walk))
    return roots


def read_profile(f):
    try:
        with open(f, encoding="utf-8") as fh:
            prof = json.load(fh)
    except Exception as e:
        return None, (type(e).__name__ + ": " + str(e))[:160]
    if not isinstance(prof, dict):
        return None, "not a JSON object"
    return prof, ""


def walk_profiles(root, walk):
    """(profile dir, site.json path) for every .sau/site.json at most MAX_DEPTH levels under root."""
    if not walk:
        f = os.path.join(root, ".sau", "site.json")
        return [(root, f)] if os.path.isfile(f) else []
    found = []
    for dirpath, dirnames, _ in os.walk(root):
        depth = 0 if dirpath == root else len(os.path.relpath(dirpath, root).split(os.sep))
        if ".sau" in dirnames:
            f = os.path.join(dirpath, ".sau", "site.json")
            if os.path.isfile(f):
                found.append((dirpath, f))
        dirnames[:] = [d for d in dirnames
                       if d != ".sau" and d not in SKIP_DIRS and depth < MAX_DEPTH - 1]
    return found


def find_profiles(bases):
    """(profiles, broken): every readable profile as (dir, dict), and every unreadable one as (path, error).

    When two profiles share a `site`, the one found first wins, so the project
    directory's profile beats a stale copy.
    """
    found, broken, seen_dirs, seen_sites, seen_broken = [], [], set(), set(), set()
    for root, walk in search_roots(bases):
        for pdir, f in walk_profiles(root, walk):
            if norm(pdir) in seen_dirs or norm(f) in seen_broken:
                continue
            prof, err = read_profile(f)
            if prof is None:
                seen_broken.add(norm(f))
                broken.append((f, err))
                continue
            site = prof.get("site")
            if site and site in seen_sites:
                continue
            seen_dirs.add(norm(pdir))
            if site:
                seen_sites.add(site)
            found.append((pdir, prof))
    return found, broken


def profile_repos(prof):
    return {s for s in (repo_slug(str(prof.get("code_repo") or "")),
                        repo_slug(str(prof.get("content_repo") or ""))) if s}


# ---------------------------------------------------------------- gate

SEP = re.compile(r"^[;&|()<>]+$")


def command_parts(cmd):
    """[(tokens, separator after them)] for a shell command line."""
    cmd = cmd.replace("\r", "").replace("\n", " ; ").replace("`", " ; ").replace("$(", " ( ")
    try:
        lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        toks = list(lex)
    except ValueError:
        toks = [t for t in re.split(r"\s+|(?=[;&|])|(?<=[;&|])", cmd) if t]
    parts, cur = [], []
    for t in toks:
        if SEP.match(t):
            parts.append((cur, t))
            cur = []
        else:
            cur.append(t)
    if cur:
        parts.append((cur, ""))
    return [(s, op) for s, op in parts if s]


def command_segments(cmd):
    return [s for s, _ in command_parts(cmd)]


# Words that only introduce the real command: wrappers and shell keywords.
WRAPPERS = ("sudo", "env", "command", "builtin", "dlx", "exec", "nohup", "time", "nice", "stdbuf",
            "then", "do", "else", "elif", "if", "while", "until", "!", "{")
FLAG_WRAPPERS = ("nice", "stdbuf", "env", "sudo", "dlx", "exec")
# Wrappers whose options take a value; timeout also takes a duration. Package runners
# (npx, bunx, pnpm dlx, yarn dlx, npm exec) only introduce the program they run.
VALUE_OPTS = {"timeout": ("-s", "--signal", "-k", "--kill-after"),
              "xargs": ("-I", "-n", "-P", "-L", "-d", "-s", "-E", "-a", "--max-args",
                        "--max-procs", "--delimiter", "--arg-file", "--replace"),
              "npx": ("-p", "--package"),
              "bunx": ("-p", "--package"),
              "pnpm": ("--filter", "-F", "-C", "--dir"),
              "yarn": ("--cwd",),
              "npm": ("-w", "--workspace", "--prefix")}
SHELLS = ("bash", "sh", "zsh", "dash", "ksh")
PWSH = ("powershell", "pwsh")
CD = ("cd", "pushd", "chdir", "set-location", "sl", "push-location")
ECHO = ("echo", "printf", "write-output", "write-host")


def prog_name(tok):
    base = os.path.basename(tok.replace("\\", "/")).lower()
    base = re.sub(r"\.(exe|cmd)$", "", base)
    return re.sub(r"(?<=.)@[^@]*$", "", base)  # vercel@latest -> vercel


def strip_prefix(seg):
    """Drop variable assignments, shell keywords and wrappers (timeout 30, xargs -n1, npx -y, ...)."""
    i = 0
    while i < len(seg):
        t, base = seg[i], prog_name(seg[i])
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t) or t in WRAPPERS or base in WRAPPERS:
            i += 1
            if base in FLAG_WRAPPERS:
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


def flag_value(args, *names):
    for k, a in enumerate(args):
        for n in names:
            if a == n and k + 1 < len(args):
                return args[k + 1]
            if a.startswith(n + "="):
                return a.split("=", 1)[1]
            if n == "-X" and a.startswith("-X") and len(a) > 2:  # -XPOST
                return a[2:].lstrip("=")
    return ""


GH_VALUE_FLAGS = ("-R", "--repo", "--hostname")
GH_API_VALUE_FLAGS = ("-R", "--repo", "-X", "--method", "-f", "-F", "--field", "--raw-field", "-H",
                      "--header", "--input", "-q", "--jq", "-t", "--template", "--hostname",
                      "--cache", "-p", "--preview")
GH_API_BODY = re.compile(r"^(-f|-F|--field|--raw-field|--input)(=.*)?$|^-[fF].")
PUSH_VALUE_FLAGS = ("--repo", "-o", "--push-option", "--receive-pack", "--exec")
GIT_VALUE_OPTS = ("-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env",
                  "--exec-path", "--super-prefix")


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


def classify(prog, rest):
    """A held command as a dict (kind, args and where it points), a {'script': ...} to scan, or None."""
    if prog == "git":
        j, dirs, aliases = 0, [], {}
        while j < len(rest) and rest[j].startswith("-"):
            a = rest[j]
            if a in GIT_VALUE_OPTS and j + 1 < len(rest):
                if a == "-C":
                    dirs.append(rest[j + 1])
                elif a == "-c":
                    m = re.match(r"^alias\.([^=]+)=(.*)$", rest[j + 1], re.S | re.I)
                    if m:
                        aliases[m.group(1).lower()] = m.group(2)
                j += 2
            else:
                j += 1
        if j >= len(rest):
            return None
        sub, args = rest[j], rest[j + 1:]
        if sub.lower() in aliases:
            val = aliases[sub.lower()].strip()
            if val.startswith("!"):
                return {"script": val[1:] + " " + " ".join(shlex.quote(a) for a in args), "dirs": dirs}
            try:
                toks = shlex.split(val)
            except ValueError:
                toks = val.split()
            if not toks:
                return None
            sub, args = toks[0], toks[1:] + args
        if sub == "push":
            pos = positionals(args, PUSH_VALUE_FLAGS)
            return {"kind": "git push", "args": args, "dirs": dirs,
                    "remote": pos[0] if pos else "", "refspecs": pos[1:]}
        return None
    if prog == "gh":
        pos = positionals(rest, GH_VALUE_FLAGS)
        repo = flag_value(rest, "-R", "--repo") or None
        hit = None
        if len(pos) >= 2 and pos[0] == "pr" and pos[1] in ("create", "ready", "merge", "close"):
            hit = {"kind": "gh pr " + pos[1], "args": rest}
        elif len(pos) >= 2 and pos[0] == "pr" and pos[1] == "edit" and flag_value(rest, "--base", "-B"):
            hit = {"kind": "gh pr edit --base", "args": rest}
        elif len(pos) >= 2 and pos[0] == "release" and pos[1] == "create":
            hit = {"kind": "gh release create", "args": rest}
        elif pos and pos[0] == "api" and gh_api_writes(rest):
            hit = {"kind": "gh api write", "args": rest}
            ep = positionals(rest, GH_API_VALUE_FLAGS)
            m = re.match(r"^/?repos/([^/{}]+)/([^/{}?]+)", ep[1] if len(ep) > 1 else "")
            if m and not repo:
                repo = m.group(1) + "/" + m.group(2)
        if hit:
            hit["repo"] = repo
        return hit
    if prog == "vercel":
        pos = [a for a in rest if not a.startswith("-")]
        if ("--prod" in rest or "--production" in rest or (pos and pos[0] in ("promote", "rollback"))
                or (pos and pos[0] == "alias" and not (len(pos) > 1 and pos[1] in ("ls", "list", "help")))
                or flag_value(rest, "--target") == "production"):
            return {"kind": "vercel production deploy", "args": rest}
    return None


def resolve_dir(cur, t):
    """cur joined with t; None when either is unknown or t needs the shell to expand it."""
    if cur is None or t is None or t == "-" or re.search(r"[$~%`*?]", t):
        return None
    m = re.match(r"^/([a-zA-Z])(/|$)(.*)", t)
    if m and os.name == "nt":  # /c/x from Git Bash
        t = m.group(1) + ":/" + m.group(3)
    return os.path.normpath(os.path.join(cur, t))


def held(cmd, cur, depth=0):
    """Every held command in a command line, with the directory it runs in (None when unknown)."""
    parts = command_parts(cmd)
    for i, (seg, op) in enumerate(parts):
        s = strip_prefix(seg)
        if not s:
            continue
        prog, rest = prog_name(s[0]), s[1:]
        if prog in CD:
            pos = [a for a in rest if not a.startswith("-")]
            cur = resolve_dir(cur, pos[0] if pos else None)
            continue
        if op in ("|", "|&") and i + 1 < len(parts) and prog in ECHO:
            nxt = strip_prefix(parts[i + 1][0])
            np = prog_name(nxt[0]) if nxt else ""
            if np in SHELLS + PWSH + ("cmd",) and inner_script(np, nxt[1:]) is None:
                text = " ".join(a for a in rest if not re.match(r"^-[neE]+$", a))
                if prog == "printf":
                    text = text.replace("\\n", "\n")
                if depth < 3:
                    yield from held(text, cur, depth + 1)
                continue
        inner = inner_script(prog, rest)
        if inner is not None:
            if depth < 3:
                yield from held(inner, cur, depth + 1)
            continue
        hit = classify(prog, rest)
        if not hit:
            continue
        if "script" in hit:
            d = cur
            for c in hit.get("dirs", ()):
                d = resolve_dir(d, c)
            if depth < 3:
                yield from held(hit["script"], d, depth + 1)
            continue
        hit["cur"] = cur
        yield hit


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


def target(hit):
    """(owner/repo, local checkout, why): the repository a held command acts on; '' and a reason when unknown."""
    cur = hit.get("cur")
    if hit.get("repo") is not None:
        r = hit["repo"]
        s = "" if re.search(r"[$`{}%]", r) else repo_slug(r)
        return s, (git_root(cur) if cur else ""), ("" if s else "the repository '%s' is not owner/repo" % r)
    if cur is None:
        return "", "", "a directory change in the command cannot be resolved"
    d = cur
    for c in hit.get("dirs", ()):
        d = resolve_dir(d, c)
        if d is None:
            return "", "", "git -C %s cannot be resolved" % c
    top = git_root(d)
    if not top:
        return "", "", "%s is not inside a git repository" % d
    rem = hit.get("remote") or ""
    if rem and ("://" in rem or re.match(r"^[^/\s]+@[^:\s]+:", rem)):
        s = repo_slug(rem)
        return s, top, ("" if s else "the push URL '%s' is not owner/repo" % rem)
    url = remote_url(top, rem or "origin")
    if not url:
        return "", top, "the remote '%s' of %s is unknown" % (rem or "origin", top)
    s = repo_slug(url)
    return s, top, ("" if s else "the remote URL '%s' is not owner/repo" % url)


def has_gate(files, gate, unit=None, tanda=False):
    """Whether a gate is recorded: in any record (no unit), in the unit's own record, or for a seed."""
    for f in files:
        g = load_json(f).get("gates", {})
        if not isinstance(g, dict):
            continue
        seeds = g.get("seeds") if isinstance(g.get("seeds"), dict) else {}
        in_seed = any(isinstance(s, dict) and gate in s for s in seeds.values())
        here = os.path.basename(os.path.dirname(f)) == unit
        if not unit:
            if gate in g or in_seed:
                return True
        elif tanda:
            if here and (gate in g or in_seed):
                return True
        else:
            if here and gate in g:
                return True
            s = seeds.get(unit)
            if isinstance(s, dict) and gate in s:
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
        top = git_root(pdir)
        if top:
            rel = os.path.relpath(norm(pdir), norm(top))
            for wt in worktree_paths(pdir) + (worktree_paths(cwd) if cwd else []):
                bases.append(os.path.normpath(os.path.join(wt, rel)))
        for b in bases:
            for f in glob.glob(os.path.join(b, out_rel, "*", "estado.json")):
                if norm(f) not in seen:
                    seen.add(norm(f))
                    files.append(f)
    return files


def unit_of(branch, prefix, site):
    """(unit, is_tanda) for a work branch: <prefix><site>-tanda-<date> is a tanda, <prefix><slug> a page or seed."""
    if not branch or not branch.startswith(prefix) or len(branch) <= len(prefix):
        return "", False
    rest = branch[len(prefix):]
    m = re.fullmatch(re.escape(site) + r"-(tanda-\d{4}-\d{2}-\d{2})", rest) if site else None
    return (m.group(1), True) if m else (rest, False)


def targets_branch(args, branch):
    """True when an argument names branch as a destination: main, refs/heads/main, HEAD:main, +x:main."""
    pat = re.compile(r"^\+?(?:[^:]*:)?(?:refs/heads/)?%s$" % re.escape(branch))
    return any(pat.match(a) for a in args)


def missing_gate(hit, tdir, matching, profiles, cwd):
    """A sentence naming the missing gate, or '' when unknown or satisfied."""
    kind, args = hit["kind"], hit["args"]
    files = gate_records(profiles, tdir or cwd)
    where = "any estado.json of the site profiles or their worktrees (%d checked)" % len(files)
    branch = flag_value(args, "--head", "-H") if kind.startswith("gh pr") else ""
    if not branch and tdir:
        branch = git(tdir, "rev-parse", "--abbrev-ref", "HEAD")
    for pdir, prof in matching:
        prefix = prof.get("branch_prefix", "sau/")
        prod = prof.get("production_branch", "")
        unit, tanda = unit_of(branch, prefix, prof.get("site") or "")
        dest = hit.get("refspecs", args)
        targets_prod = bool(prod) and (kind == "vercel production deploy" or targets_branch(dest, prod)
                                       or flag_value(args, "--base", "-B") == prod)
        if targets_prod:
            if not has_gate(files, "P3", unit or None, tanda):
                return "gate P3 is not recorded%s in %s; a release into %s needs it." % (
                    " for unit '%s'" % unit if unit else "", where, prod)
            continue
        needs_p2 = kind in ("gh pr ready", "gh pr merge") or (
            kind == "gh pr create" and not any(a in ("--draft", "-d") for a in args))
        if needs_p2 and unit and not has_gate(files, "P2", unit, tanda):
            return "gate P2 is not recorded for unit '%s' in %s; this action needs it." % (unit, where)
    return ""


def hook_gate(data):
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return
    cwd = data.get("cwd") or os.getcwd()
    project = os.environ.get("CLAUDE_PROJECT_DIR") or ""
    for hit in held(cmd, cwd):
        kind = hit["kind"]
        slug, tdir, why = target(hit)
        profiles, broken = find_profiles([project, cwd, tdir])
        head = "sau gate: '%s' publishes work or changes shared state" % kind
        if broken:
            f, err = broken[0]
            answer("ask", "%s, and the site profile %s cannot be read (%s), so it cannot tell whether this "
                          "repository belongs to a SAU site. Fix the profile; until then it needs the person's "
                          "explicit approval." % (head, f, err))
            return
        if not profiles:
            continue
        if not slug:
            answer("ask", "%s; a site profile was found but the target repository is unknown (%s). It needs "
                          "the person's explicit approval." % (head, why))
            return
        matching = [p for p in profiles if slug in profile_repos(p[1])]
        if not matching:
            continue
        reason = "%s (%s); it needs the person's explicit approval." % (head, slug)
        try:
            extra = missing_gate(hit, tdir, matching, profiles, cwd)
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
    """True when a repository-relative path is inside one of scan_paths ('.', '' or './' mean everything)."""
    fold = (lambda s: s.lower()) if os.name == "nt" else (lambda s: s)
    rel = fold(posixpath.normpath(rel.replace("\\", "/")))
    if rel == ".." or rel.startswith("../"):
        return False
    for sp in scan_paths:
        sp = fold(posixpath.normpath(str(sp).replace("\\", "/") or "."))
        if sp.startswith("/"):
            sp = sp.lstrip("/") or "."
        if sp == "." or rel == sp or rel.startswith(sp + "/"):
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
    path = path if os.path.isabs(path) else os.path.join(cwd, path)
    # The file's own repository (and its main checkout, in a worktree) counts too, so a session
    # started in another repository still reaches the profile of the site being written.
    fdir = os.path.dirname(os.path.abspath(path))
    while fdir and not os.path.isdir(fdir) and os.path.dirname(fdir) != fdir:
        fdir = os.path.dirname(fdir)
    profiles, broken = find_profiles([os.environ.get("CLAUDE_PROJECT_DIR") or "", cwd, fdir])
    if broken:
        f, err = broken[0]
        answer("ask", "sau gate: the site profile %s cannot be read (%s), so this write cannot be checked "
                      "against its forbidden terms. Fix the profile, or ask the person before writing." % (f, err))
        return
    if not profiles:
        return
    top = git_root(path)
    origin = repo_slug(remote_url(top)) if top else ""
    if not origin:
        for pdir, prof in profiles:
            if (top and same_repo(git_root(pdir), top)) or (
                    not top and norm(path).startswith(norm(pdir) + os.sep)):
                answer("ask", "sau gate: this write is in the repository of site profile '%s', but its origin "
                              "remote cannot be read, so it cannot be matched to code_repo. Ask the person "
                              "before writing." % (prof.get("site") or pdir))
                return
        return
    rel = os.path.relpath(norm(path), norm(top))
    text = written_text(tool, ti)
    for pdir, prof in profiles:
        if repo_slug(str(prof.get("code_repo") or "")) != origin:
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
    if not fn or not isinstance(data, dict):
        return 0
    try:
        fn(data)
    except Exception as e:  # an internal error must not let a write or a push through unseen
        if mode in ("gate", "forbidden"):
            answer("ask", "sau hook: internal error while checking this call (%s: %s); ask the person."
                   % (type(e).__name__, str(e)[:120]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
