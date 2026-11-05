#!/usr/bin/env python3
"""
Cross a keyword map with a Google Search Console export. Standard library only.

Usage:
    py ${CLAUDE_PLUGIN_ROOT}/skills/keyword-fanout-map/scripts/gsc_merge.py <gsc_export.zip|dir> <keyword-map.csv> <out.json>
        [--topic REGEX] [--target-page PATH] [--country NAME] [--min-impressions N]
        [--ctr-min-impressions N] [--ctr-max PCT] [--ctr-max-position P]

The GSC export is the "Performance on Search" download (Queries.csv, Pages.csv,
Chart.csv, Countries.csv, Filters.csv). Matching is exact on the query text,
ignoring case and accents.

out.json holds:
- "keywords": {keyword: {gsc_impressions, gsc_clicks, gsc_position}} for every
  map keyword found in Queries.csv. Keywords not found are left out.
- "gsc_only": topic queries with at least N impressions that are not in the map.
  These are candidates: look up their volume in DataForSEO before adding them.
- "pages": topic pages from Pages.csv, plus the target page flag.
- "monthly": clicks, impressions and weighted position per month.
- "coverage": export window, country share and how many clicks the query table
  explains. Report these limits in DATA_NOTES.
- "ctr_opportunities": pages of the whole site (not only the topic) with at least
  N impressions, a position of P or better and a CTR under PCT. Their title and
  meta description are the cheapest fix. CTR is computed from clicks/impressions.

The script never invents values. Missing numbers stay missing.
"""

import argparse
import collections
import csv
import io
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path


def norm(text):
    text = unicodedata.normalize("NFD", text.lower())
    return " ".join("".join(c for c in text if unicodedata.category(c) != "Mn").split())


def load_tables(src):
    src = Path(src)
    tables = {}
    if src.is_file() and src.suffix == ".zip":
        with zipfile.ZipFile(src) as z:
            for name in z.namelist():
                if name.endswith(".csv"):
                    tables[Path(name).stem] = list(csv.DictReader(io.TextIOWrapper(z.open(name), "utf-8-sig")))
    else:
        for f in src.glob("*.csv"):
            tables[f.stem] = list(csv.DictReader(open(f, encoding="utf-8-sig")))
    for need in ("Queries", "Pages"):
        if need not in tables:
            sys.exit(f"error: {need}.csv not found in {src}")
    return tables


def num(value, cast=int):
    try:
        return cast(str(value).replace("%", "").replace(",", ""))
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("gsc")
    ap.add_argument("keyword_csv")
    ap.add_argument("out")
    ap.add_argument("--topic", default="", help="regex on normalised query/page text")
    ap.add_argument("--target-page", default="", help="path of the page the map is for, e.g. /es/ejemplo")
    ap.add_argument("--country", default="Spain", help="country name as it appears in Countries.csv (default: Spain, the previous fixed behaviour)")
    ap.add_argument("--min-impressions", type=int, default=20)
    ap.add_argument("--ctr-min-impressions", type=int, default=100)
    ap.add_argument("--ctr-max", type=float, default=1.0, help="CTR threshold in percent")
    ap.add_argument("--ctr-max-position", type=float, default=15.0)
    a = ap.parse_args()

    t = load_tables(a.gsc)
    topic = re.compile(a.topic) if a.topic else None
    queries = t["Queries"]
    qcol = next(k for k in queries[0] if "quer" in k.lower())
    by_q = {norm(r[qcol]): r for r in queries}

    kmap = list(csv.DictReader(open(a.keyword_csv, encoding="utf-8")))
    in_map = {norm(r["keyword"]) for r in kmap}

    keywords = {}
    for r in kmap:
        g = by_q.get(norm(r["keyword"]))
        if g:
            keywords[r["keyword"]] = {
                "gsc_impressions": num(g["Impressions"]),
                "gsc_clicks": num(g["Clicks"]),
                "gsc_position": num(g["Position"], float),
            }

    gsc_only = []
    for r in queries:
        q = norm(r[qcol])
        if q in in_map or (topic and not topic.search(q)):
            continue
        if (num(r["Impressions"]) or 0) >= a.min_impressions:
            gsc_only.append({"query": " ".join(r[qcol].split()), "impressions": num(r["Impressions"]),
                             "clicks": num(r["Clicks"]), "position": num(r["Position"], float)})
    gsc_only.sort(key=lambda x: -x["impressions"])

    pcol = next(k for k in t["Pages"][0] if "page" in k.lower())
    pages = []
    for r in t["Pages"]:
        path = re.sub(r"^https?://[^/]+", "", r[pcol]) or "/"
        if (topic and topic.search(norm(path))) or (a.target_page and path.rstrip("/") == a.target_page.rstrip("/")):
            pages.append({"page": path, "impressions": num(r["Impressions"]), "clicks": num(r["Clicks"]),
                          "ctr": r["CTR"], "position": num(r["Position"], float),
                          "is_target": bool(a.target_page) and path.rstrip("/") == a.target_page.rstrip("/")})
    pages.sort(key=lambda x: -(x["impressions"] or 0))

    ctr_opportunities = []
    for r in t["Pages"]:
        imp, clk, pos = num(r["Impressions"]), num(r["Clicks"]), num(r["Position"], float)
        if not imp or clk is None or pos is None or imp < a.ctr_min_impressions or pos > a.ctr_max_position:
            continue
        ctr = 100.0 * clk / imp
        if ctr < a.ctr_max:
            ctr_opportunities.append({"page": re.sub(r"^https?://[^/]+", "", r[pcol]) or "/",
                                      "impressions": imp, "clicks": clk,
                                      "ctr_pct": round(ctr, 2), "position": pos})
    ctr_opportunities.sort(key=lambda x: -x["impressions"])

    # Daily exports have a "Date" column; monthly ones have "Date range" ("2025-06-12 - 2025-06-30").
    chart = t.get("Chart", [])
    dcol = next((k for k in (chart[0] if chart else {}) if k.startswith("Date")), None)
    monthly = collections.OrderedDict()
    for r in sorted(chart, key=lambda r: r[dcol]) if dcol else []:
        m = monthly.setdefault(r[dcol][:7], {"clicks": 0, "impressions": 0, "_pw": 0.0})
        i = num(r["Impressions"]) or 0
        m["clicks"] += num(r["Clicks"]) or 0
        m["impressions"] += i
        pos = num(r["Position"], float)
        if pos is not None:
            m["_pw"] += pos * i
    for m in monthly.values():
        m["position"] = round(m.pop("_pw") / m["impressions"], 1) if m["impressions"] else None

    total_clicks = sum(num(r["Clicks"]) or 0 for r in t.get("Countries", [])) or None
    country = next((r for r in t.get("Countries", []) if r.get("Country") == a.country), None)
    filters = {r.get("Filter"): r.get("Value") for r in t.get("Filters", [])}
    topic_rows = [r for r in queries if topic and topic.search(norm(r[qcol]))]
    coverage = {
        "window": filters.get("Date"),
        "search_type": filters.get("Search type"),
        "total_clicks": total_clicks,
        "country": a.country,
        "country_clicks": num(country["Clicks"]) if country else None,
        "query_table_clicks": sum(num(r["Clicks"]) or 0 for r in queries),
        "query_rows": len(queries),
        "topic_queries": len(topic_rows),
        "topic_impressions": sum(num(r["Impressions"]) or 0 for r in topic_rows),
        "topic_clicks": sum(num(r["Clicks"]) or 0 for r in topic_rows),
        "target_page_in_export": any(p["is_target"] for p in pages),
    }

    json.dump({"keywords": keywords, "gsc_only": gsc_only, "pages": pages,
               "monthly": monthly, "coverage": coverage,
               "ctr_opportunities": ctr_opportunities},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {a.out}: {len(keywords)} map keywords in GSC, {len(gsc_only)} GSC-only topic queries, "
          f"{len(pages)} topic pages, {len(ctr_opportunities)} CTR opportunities", file=sys.stderr)


if __name__ == "__main__":
    main()
