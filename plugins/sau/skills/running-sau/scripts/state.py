#!/usr/bin/env python3
"""SAU state: derive each unit's position from its files and its estado.json.

Standard library only. Read-only: it never writes a file.

  state.py [--profile PATH | --root DIR] [--site SITE] [--unit NAME] [--format table|json]
      Every unit of the profile: last step with evidence, next step or gate,
      gate status (recorded, pending, stale) and warnings.
  state.py hash --dir UNIT_DIR FILE [FILE ...]
      The `evidence` map to store in a gate record: {relative path: sha256}.

Rules (plugins/sau/docs/states-and-gates.md): files prove steps, estado.json
proves gates. A gate is stale only when the current hash of one of the files in
its `evidence` differs from the recorded one (or the file is gone). Hashes are
sha256 of the file's bytes with CRLF turned into LF, so a checkout with other
line endings does not make a gate stale. No dates and no git history are used
for staleness; git is used only, when available, to find a tanda's worktree
and a code branch (step C).
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

SKIP_DIRS = {".git", ".claude", "node_modules"}
MAX_DEPTH = 4
KNOWN_TOP = {"schema_version", "site", "mode", "unit", "gates"}
KNOWN_GATES = {"P1", "P2", "P3", "P4", "close", "seeds"}
KNOWN_SEED = {"P2", "P3", "history"}
TANDA_RE = re.compile(r"^tanda-\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------- helpers

def sha256_file(path):
    with open(path, "rb") as fh:
        data = fh.read()
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()


def has(path):
    """Evidence counts only if the file exists and is not empty."""
    try:
        return os.path.isfile(path) and os.path.getsize(path) > 0
    except OSError:
        return False


def read_text(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def git(cwd, *args):
    try:
        out = subprocess.run(["git", "-C", cwd, *args], capture_output=True,
                             text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout.strip() if out.returncode == 0 else None


def find_profiles(root):
    found = []
    root = os.path.abspath(root)
    base_depth = root.rstrip(os.sep).count(os.sep)
    for cur, dirs, files in os.walk(root):
        depth = cur.rstrip(os.sep).count(os.sep) - base_depth
        dirs[:] = [] if depth >= MAX_DEPTH else [d for d in dirs if d not in SKIP_DIRS]
        if os.path.basename(cur) == ".sau" and "site.json" in files:
            found.append(os.path.join(cur, "site.json"))
    return sorted(found)


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh), None
    except FileNotFoundError:
        return None, None
    except (OSError, ValueError) as exc:
        return None, str(exc)


# ---------------------------------------------------------------- gates

def gate_status(record, unit_dir):
    """recorded | pending | stale, plus the evidence files that changed."""
    if not isinstance(record, dict):
        return {"status": "pending"}
    out = {"status": "recorded", "at": record.get("at"), "by": record.get("by")}
    evidence = record.get("evidence")
    if not isinstance(evidence, dict) or not evidence:
        out["evidence"] = "none"
        return out
    changed = []
    for rel, digest in sorted(evidence.items()):
        path = os.path.join(unit_dir, rel)
        if not os.path.isfile(path):
            changed.append(rel + " (missing)")
        elif sha256_file(path) != digest:
            changed.append(rel)
    if changed:
        out["status"] = "stale"
        out["changed"] = changed
    return out


def unknown_keys(estado):
    keys = []
    if not isinstance(estado, dict):
        return keys
    keys += [k for k in estado if k not in KNOWN_TOP]
    gates = estado.get("gates") or {}
    if isinstance(gates, dict):
        keys += ["gates." + k for k in gates if k not in KNOWN_GATES]
        seeds = gates.get("seeds") or {}
        if isinstance(seeds, dict):
            for slug, rec in seeds.items():
                if isinstance(rec, dict):
                    keys += ["gates.seeds.%s.%s" % (slug, k) for k in rec if k not in KNOWN_SEED]
    return keys


# ---------------------------------------------------------------- steps

def history_has_month(out_dir):
    month = datetime.date.today().strftime("%Y-%m")
    return month in read_text(os.path.join(out_dir, "05-history.csv"))


def legal_files(d):
    try:
        return [f for f in os.listdir(d) if f.startswith("revision-legal") and f.endswith(".md")
                and has(os.path.join(d, f))]
    except OSError:
        return []


def code_branch(ctx, slug):
    """done | missing | unknown: branch <prefix><slug> ahead of origin/<base>."""
    repo = ctx["code_repo_path"]
    if not repo or not os.path.isdir(repo):
        return "unknown"
    branch = ctx["profile"].get("branch_prefix", "sau/") + slug
    base = "origin/" + ctx["profile"].get("base_branch", "dev")
    if git(repo, "rev-parse", "--verify", "--quiet", branch) is None:
        return "missing"
    count = git(repo, "rev-list", "--count", "%s..%s" % (base, branch))
    if count is None:
        return "unknown"
    return "done" if int(count) > 0 else "missing"


def walk(items):
    """items: [(id, kind, state)] with state in done|missing|pending|stale|unknown|skip.
    Returns (last step done, next item, its state)."""
    last, nxt, nxt_state = None, None, None
    for ident, kind, state in items:
        if state == "skip":
            continue
        if kind == "step" and state == "done":
            last = ident
        if nxt is None and state not in ("done", "recorded"):
            nxt, nxt_state = ident, state
    return last, nxt, nxt_state


def gate_item(name, status):
    return (name, "gate", status["status"])


def page_unit(ctx, name, unit_dir):
    p = ctx["profile"]
    estado_path = os.path.join(unit_dir, "estado.json")
    estado, err = load_json(estado_path)
    warnings = []
    if err:
        warnings.append("estado.json unreadable: " + err)
        estado = None
    gates = (estado or {}).get("gates") or {}
    if not isinstance(gates, dict):
        warnings.append("estado.json: gates is not an object")
        gates = {}
    uk = unknown_keys(estado)
    if uk:
        warnings.append("estado.json unknown keys: " + ", ".join(uk))
    if name == "(root)":
        warnings.append("legacy layout at the root of output_dir (read-only)")

    g = {k: gate_status(gates.get(k), unit_dir) for k in ("P1", "P2", "P3", "P4", "close")}
    p1 = gates.get("P1") if isinstance(gates.get("P1"), dict) else {}
    j = lambda f: os.path.join(unit_dir, f)
    draft = j("draft.md")

    motion = p1.get("motion") is True
    legal = p1.get("legal") is True and p.get("legal_review", "off") != "off"
    st = lambda ok: "done" if ok else "missing"
    c = "done" if g["P3"]["status"] == "recorded" else code_branch(ctx, name)
    items = [
        ("0", "step", st(has(ctx["brief"]))),
        ("1", "step", st(has(j("01-keyword-map.csv")) and has(j("01-keyword-map.html")))),
        gate_item("P1", g["P1"]),
        ("2", "step", st(has(draft) and has(j("02-content-package.html")))),
        ("2b", "step", st(has(j("02b-motion-plan.html")) and re.search(r"(?m)^\s*motion\s*:", read_text(draft)) is not None) if motion else "skip"),
        ("3", "step", st(has(j("03-onpage-report.html")))),
        ("L", "step", st(bool(legal_files(unit_dir))) if legal else "skip"),
        gate_item("P2", g["P2"]),
        ("C", "step", c),
        gate_item("P3", g["P3"]),
        ("4", "step", st(has(j("04-internal-links.html")))),
        ("5", "step", st(has(j("05-ai-visibility.html")) and history_has_month(ctx["out"]))),
        gate_item("P4", g["P4"]),
        gate_item("close", g["close"]),
    ]
    last, nxt, nxt_state = walk(items)
    for k, v in g.items():
        if v["status"] == "stale":
            warnings.append("%s stale: %s" % (k, ", ".join(v["changed"])))
    return {
        "unit": name, "mode": "page", "dir": unit_dir,
        "last_done": last, "next": nxt, "next_state": nxt_state,
        "pending_gate": next((k for k, kind, s in items if kind == "gate" and s in ("pending", "stale")), None),
        "gates": g, "warnings": warnings,
    }


def read_reparto(path):
    rows = []
    try:
        with open(path, encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                if row.get("slug"):
                    rows.append({k: (v or "").strip() for k, v in row.items() if k})
    except OSError:
        pass
    return rows


def tanda_unit(ctx, name, t_dir):
    p = ctx["profile"]
    estado, err = load_json(os.path.join(t_dir, "estado.json"))
    warnings = []
    if err:
        warnings.append("estado.json unreadable: " + err)
        estado = None
    gates = (estado or {}).get("gates") or {}
    if not isinstance(gates, dict):
        gates = {}
    uk = unknown_keys(estado)
    if uk:
        warnings.append("estado.json unknown keys: " + ", ".join(uk))
    seed_gates = gates.get("seeds") if isinstance(gates.get("seeds"), dict) else {}
    j = lambda f: os.path.join(t_dir, f)
    st = lambda ok: "done" if ok else "missing"
    g = {k: gate_status(gates.get(k), t_dir) for k in ("P1", "P4", "close")}
    reparto = read_reparto(j("00-reparto.csv"))
    entrega = read_text(j("entrega.md"))

    head = [
        ("0", "step", st(has(ctx["brief"]))),
        ("1", "step", st(has(j("01-keyword-map.csv")) and has(j("01-keyword-map.html")))),
        ("R", "step", st(has(j("00-reparto.csv")))),
        gate_item("P1", g["P1"]),
    ]
    last, nxt, nxt_state = walk(head)
    seeds = []
    order = ["2", "2b", "3", "L", "C", "D", "P2", "P3"]
    for row in reparto:
        slug = row["slug"]
        s_dir = j(slug)
        sg = seed_gates.get(slug) if isinstance(seed_gates.get(slug), dict) else {}
        sp2 = gate_status(sg.get("P2"), t_dir)
        sp3 = gate_status(sg.get("P3"), t_dir)
        verdict = sg.get("P2", {}).get("verdict") if isinstance(sg.get("P2"), dict) else None
        if verdict == "cambiar" and sp2["status"] == "recorded":
            sp2 = dict(sp2, status="pending", note="cambiar: waiting for the re-run")
        motion = row.get("motion", "").lower() == "si"
        legal = row.get("legal", "").lower() == "si" and p.get("legal_review", "off") != "off"
        plan = has(os.path.join(s_dir, "02b-motion-plan.html")) or has(j(os.path.join("motion", slug + "-02b-motion-plan.html")))
        c = "done" if sp3["status"] == "recorded" else code_branch(ctx, slug)
        items = [
            ("2", "step", st(has(os.path.join(s_dir, "draft.md")) and has(os.path.join(s_dir, "02-content-package.html")))),
            ("2b", "step", st(plan) if motion else "skip"),
            ("3", "step", st(has(os.path.join(s_dir, "03-onpage-report.html")))),
            ("L", "step", st(bool(legal_files(s_dir))) if legal else "skip"),
            ("C", "step", c),
            ("D", "step", st(bool(entrega) and re.search(r"\b%s\b" % re.escape(slug), entrega) is not None)),
            gate_item("P2", sp2),
            gate_item("P3", sp3),
        ]
        s_last, s_next, s_state = walk(items)
        if verdict == "descartada":
            s_next, s_state = None, "descartada"
        for k, v in (("P2", sp2), ("P3", sp3)):
            if v["status"] == "stale":
                warnings.append("%s/%s stale: %s" % (slug, k, ", ".join(v["changed"])))
        seeds.append({"slug": slug, "semilla": row.get("semilla"), "last_done": s_last,
                      "next": s_next, "next_state": s_state, "verdict": verdict,
                      "gates": {"P2": sp2, "P3": sp3}})

    if nxt is None:
        active = [s for s in seeds if s["next_state"] != "descartada"]
        behind = [s for s in active if s["next"] is not None]
        if behind:
            worst = min(behind, key=lambda s: order.index(s["next"]))
            nxt, nxt_state = "%s (%s)" % (worst["next"], worst["slug"]), worst["next_state"]
        else:
            tail = [
                ("4", "step", st(has(j("04-internal-links.html")))),
                ("5", "step", st(has(j("05-ai-visibility.html")) and history_has_month(ctx["out"]))),
                gate_item("P4", g["P4"]),
                gate_item("close", g["close"]),
            ]
            t_last, nxt, nxt_state = walk(tail)
            last = t_last or last
    if seeds and last in ("0", "1", "R"):
        done_any = [s["last_done"] for s in seeds if s["last_done"]]
        if done_any:
            last = "seeds: " + ", ".join("%s=%s" % (s["slug"], s["last_done"]) for s in seeds if s["last_done"])
    for k, v in g.items():
        if v["status"] == "stale":
            warnings.append("%s stale: %s" % (k, ", ".join(v["changed"])))
    pending = nxt if nxt and nxt.split(" ")[0] in ("P1", "P2", "P3", "P4", "close") else None
    return {
        "unit": name, "mode": "tanda", "dir": t_dir,
        "last_done": last, "next": nxt, "next_state": nxt_state, "pending_gate": pending,
        "gates": g, "seeds": seeds, "warnings": warnings, "closed": g["close"]["status"] == "recorded",
    }


# ---------------------------------------------------------------- units

def tanda_worktrees(ctx):
    """tanda name -> output dir inside the worktree of its outputs branch."""
    p = ctx["profile"]
    prof_dir = ctx["profile_dir"]
    top = git(prof_dir, "rev-parse", "--show-toplevel")
    if not top:
        return {}
    rel_out = os.path.relpath(ctx["out"], os.path.normpath(top))
    listing = git(prof_dir, "worktree", "list", "--porcelain") or ""
    prefix = "refs/heads/%s%s-" % (p.get("branch_prefix", "sau/"), p.get("site", ""))
    result, path = {}, None
    for line in listing.splitlines():
        if line.startswith("worktree "):
            path = line[len("worktree "):]
        elif line.startswith("branch ") and path:
            ref = line[len("branch "):]
            if ref.startswith(prefix):
                name = ref[len(prefix):]
                if TANDA_RE.match(name):
                    result[name] = os.path.join(os.path.normpath(path), rel_out, name)
    return result


def collect(ctx, only=None):
    out = ctx["out"]
    units, warnings = [], []
    try:
        entries = sorted(os.listdir(out))
    except OSError:
        entries = []
        warnings.append("output_dir does not exist yet: " + out)
    wts = tanda_worktrees(ctx)
    tandas = {e: os.path.join(out, e) for e in entries if TANDA_RE.match(e) and os.path.isdir(os.path.join(out, e))}
    tandas.update({k: v for k, v in wts.items() if os.path.isdir(v)})
    pages = [e for e in entries if os.path.isdir(os.path.join(out, e)) and not TANDA_RE.match(e)
             and not e.startswith((".", "_")) and e != "motion"]
    if has(os.path.join(out, "01-keyword-map.csv")) or has(os.path.join(out, "draft.md")):
        units.append(page_unit(ctx, "(root)", out))
    for e in pages:
        if only and e != only:
            continue
        units.append(page_unit(ctx, e, os.path.join(out, e)))
    for name in sorted(tandas):
        if only and name != only:
            continue
        units.append(tanda_unit(ctx, name, tandas[name]))
    open_tandas = [u["unit"] for u in units if u["mode"] == "tanda" and not u.get("closed")]
    if len(open_tandas) > 1:
        warnings.append("more than one open tanda: " + ", ".join(open_tandas))
    if only:
        units = [u for u in units if u["unit"] == only]
    return units, warnings


def context(profile_path):
    with open(profile_path, encoding="utf-8") as fh:
        profile = json.load(fh)
    prof_dir = os.path.dirname(os.path.dirname(os.path.abspath(profile_path)))
    res = lambda v: v if os.path.isabs(v) else os.path.normpath(os.path.join(prof_dir, v))
    ctx = {
        "profile_path": os.path.abspath(profile_path), "profile": profile, "profile_dir": prof_dir,
        "out": res(profile.get("output_dir", "seo/output")),
        "brief": res(profile.get("brief", "site-brief.md")),
        "code_repo_path": res(profile.get("code_repo_path", ".")),
    }
    return ctx


# ---------------------------------------------------------------- output

def table(report):
    lines = ["Profile: %s (site %s, mode %s)" % (report["profile"], report["site"], report["mode"]), "",
             "| Unit | Mode | Last step with evidence | Next | Pending gate | Warnings |",
             "|---|---|---|---|---|---|"]
    for u in report["units"]:
        nxt = u["next"] or "-"
        if u.get("next_state") == "stale":
            nxt += " (stale)"
        lines.append("| %s | %s | %s | %s | %s | %s |" % (
            u["unit"], u["mode"], u["last_done"] or "-", nxt, u["pending_gate"] or "-",
            "; ".join(u["warnings"]) or "-"))
        for s in u.get("seeds", []):
            nxt = s["next"] or ("-" if s["next_state"] != "descartada" else "descartada")
            if s.get("next_state") == "stale":
                nxt += " (stale)"
            lines.append("| &nbsp;&nbsp;%s | seed | %s | %s | %s | %s |" % (
                s["slug"], s["last_done"] or "-", nxt,
                s["next"] if s["next"] in ("P2", "P3") else "-",
                "P2: " + s["verdict"] if s["verdict"] else "-"))
    if report["warnings"]:
        lines += ["", "Warnings: " + "; ".join(report["warnings"])]
    return "\n".join(lines)


def main(argv):
    if argv and argv[0] == "hash":
        ap = argparse.ArgumentParser(prog="state.py hash")
        ap.add_argument("--dir", required=True, help="unit directory the paths are relative to")
        ap.add_argument("files", nargs="+")
        a = ap.parse_args(argv[1:])
        result = {}
        for f in a.files:
            path = f if os.path.isabs(f) else os.path.join(a.dir, f)
            if not has(path):
                print("missing or empty evidence file: " + f, file=sys.stderr)
                return 2
            rel = os.path.relpath(path, a.dir).replace(os.sep, "/")
            result[rel] = sha256_file(path)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    ap = argparse.ArgumentParser(prog="state.py", description=__doc__.split("\n\n")[0])
    ap.add_argument("--profile", help="path to .sau/site.json")
    ap.add_argument("--root", help="directory to search for .sau/site.json (default: git root or cwd)")
    ap.add_argument("--site", help="profile to use when several are found")
    ap.add_argument("--unit", help="only this unit (slug or tanda-YYYY-MM-DD)")
    ap.add_argument("--format", choices=("table", "json"), default="table")
    a = ap.parse_args(argv)

    if a.profile:
        profile_path = a.profile
    else:
        root = a.root or git(os.getcwd(), "rev-parse", "--show-toplevel") or os.getcwd()
        found = find_profiles(root)
        if a.site:
            sel = []
            for f in found:
                data, _ = load_json(f)
                if isinstance(data, dict) and data.get("site") == a.site:
                    sel.append(f)
            found = sel
        if not found:
            print("no .sau/site.json found under " + root, file=sys.stderr)
            return 2
        if len(found) > 1:
            print("several profiles; pass --site or --profile:\n  " + "\n  ".join(found), file=sys.stderr)
            return 2
        profile_path = found[0]
    try:
        ctx = context(profile_path)
    except (OSError, ValueError) as exc:
        print("profile unreadable: %s: %s" % (profile_path, exc), file=sys.stderr)
        return 2

    units, warnings = collect(ctx, a.unit)
    tf = ctx["profile"].get("forbidden_terms_file")
    if tf and not os.path.isfile(os.path.join(ctx["profile_dir"], tf)):
        warnings.append("forbidden_terms_file is missing: " + tf)
    if ctx["profile"].get("schema_version") != 1:
        warnings.append("profile schema_version is not 1")
    report = {"profile": ctx["profile_path"], "site": ctx["profile"].get("site"),
              "mode": ctx["profile"].get("mode"), "output_dir": ctx["out"],
              "units": units, "warnings": warnings}
    if a.format == "json":
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(table(report))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
