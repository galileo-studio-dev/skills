#!/usr/bin/env python3
"""Cost and context metrics from a Claude Code `--output-format stream-json` run.

usage: usage.py <stream.jsonl> [--slices N] [--out metrics.json]

Prints total cost, duration, token totals by category, the cache-read share,
cost per slice when --slices is given, and a per-agent table of turns, average
context and context × turns (the quantity an agent loop actually pays for).
Writes the same numbers as JSON with --out.
"""
from __future__ import annotations

import argparse
import collections
import json
import sys


def load(path: str):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("stream")
    ap.add_argument("--slices", type=int, default=0)
    ap.add_argument("--out")
    args = ap.parse_args()

    result = None
    turns: collections.Counter = collections.Counter()
    ctx: dict[str, list[int]] = collections.defaultdict(list)
    reads: collections.Counter = collections.Counter()
    labels: dict[str, str] = {}

    for ev in load(args.stream):
        kind = ev.get("type")
        parent = ev.get("parent_tool_use_id") or "main"
        msg = ev.get("message") or {}
        if kind == "assistant":
            u = msg.get("usage") or {}
            if u:
                turns[parent] += 1
                ctx[parent].append(sum((u.get(k) or 0) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")))
            for c in msg.get("content") or []:
                if c.get("type") == "tool_use" and c.get("name") == "Agent":
                    inp = c.get("input") or {}
                    labels[c["id"]] = f'{inp.get("subagent_type", "?")}: {str(inp.get("description", ""))[:36]}'
        elif kind == "user":
            for c in msg.get("content") or []:
                if c.get("type") == "tool_result":
                    content = c.get("content")
                    reads[parent] += len(content if isinstance(content, str) else json.dumps(content))
        elif kind == "result":
            result = ev

    if result is None:
        print("usage.py: no result event in stream", file=sys.stderr)
        return 1

    per_model = result.get("modelUsage") or {}
    tot = {"input": 0, "output": 0, "cache_read": 0, "cache_create": 0}
    for v in per_model.values():
        tot["input"] += v.get("inputTokens", 0) or 0
        tot["output"] += v.get("outputTokens", 0) or 0
        tot["cache_read"] += v.get("cacheReadInputTokens", 0) or 0
        tot["cache_create"] += v.get("cacheCreationInputTokens", 0) or 0
    if not per_model:
        u = result.get("usage") or {}
        tot = {"input": u.get("input_tokens", 0) or 0, "output": u.get("output_tokens", 0) or 0,
               "cache_read": u.get("cache_read_input_tokens", 0) or 0, "cache_create": u.get("cache_creation_input_tokens", 0) or 0}
    all_input = tot["input"] + tot["cache_read"] + tot["cache_create"]
    cache_share = tot["cache_read"] / all_input if all_input else 0.0
    cost = float(result.get("total_cost_usd") or 0.0)
    duration_s = int((result.get("duration_ms") or 0) / 1000)

    agents = []
    for p in sorted(turns, key=lambda k: -sum(ctx[k])):
        agents.append({
            "agent": "main (Controller)" if p == "main" else labels.get(p, p[:12]),
            "turns": turns[p],
            "avg_context": int(sum(ctx[p]) / len(ctx[p])),
            "context_x_turns": sum(ctx[p]),
            "tool_result_chars": reads[p],
        })

    metrics = {
        "cost_usd": round(cost, 4),
        "duration_s": duration_s,
        "top_level_turns": result.get("num_turns"),
        "models": {m: round(v.get("costUSD", 0) or 0, 4) for m, v in per_model.items()},
        "tokens": tot,
        "cache_read_share": round(cache_share, 4),
        "cost_per_slice_usd": round(cost / args.slices, 4) if args.slices else None,
        "agents": agents,
    }

    print(f"cost ${cost:.2f}  duration {duration_s}s  turns {result.get('num_turns')}  "
          f"cache-read share {cache_share:.1%}" + (f"  cost/slice ${cost / args.slices:.2f}" if args.slices else ""))
    print(f"tokens: cache_read {tot['cache_read']:,}  cache_create {tot['cache_create']:,}  input {tot['input']:,}  output {tot['output']:,}")
    for m, c in metrics["models"].items():
        print(f"  {m}: ${c:.2f}")
    print(f"{'agent':50s} {'turns':>5s} {'avg ctx':>8s} {'ctx×turns':>10s} {'reads':>9s}")
    for a in agents[:12]:
        print(f"{a['agent'][:50]:50s} {a['turns']:5d} {a['avg_context']:8,} {a['context_x_turns']:10,} {a['tool_result_chars']:9,}")
    if cache_share < 0.80:
        print(f"WARN cache-read share {cache_share:.1%} is below 80%: check for mid-run model/effort switches, MCP schema changes, or oversized fresh context", file=sys.stderr)

    if args.out:
        with open(args.out, "w") as f:
            json.dump(metrics, f, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
