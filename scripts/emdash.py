#!/usr/bin/env python3
"""TT em dash check. Runs BOTH WAYS, against shipped bytes in GitHub raw or a LOCAL draft.
Usage: python3 emdash.py <repo/path> [<repo/path> ...]
       python3 emdash.py --local <file> [<file> ...]
Exit 0 clean. Exit 1 REAL em dash characters, or a source that could not be read.
Exit 2 no real em dash, but escape TEXT is present and a human decides.
The two are counted separately on purpose: a file that DOCUMENTS the rule has to name
\\u2014, &mdash; and &#8212;, and a checker that calls its own doctrine a violation
trains the reader to ignore it. /bin/sh cannot express U+2014, so this is python only.
"""
import sys, os, urllib.request

RAW = "https://raw.githubusercontent.com/TotalTactiles/tt-dashboard/main/"
EM = "\u2014"
ESCAPES = ["\\u2014", "&mdash;", "&#8212;"]

args = sys.argv[1:]
local = False
if args and args[0] == "--local":
    local = True
    args = args[1:]

if not args:
    print("usage: emdash.py [--local] <path> [<path> ...]")
    sys.exit(1)

def fetch_remote(path):
    with urllib.request.urlopen(RAW + path, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def fetch_local(path):
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    with open(path, "rb") as f:
        return f.read().decode("utf-8", "replace")

mode = "LOCAL" if local else "SHIPPED"
real_total = esc_total = fails = 0
for path in args:
    try:
        text = fetch_local(path) if local else fetch_remote(path)
    except Exception as e:
        print(f"READ FAIL   {path}  {e}")
        fails += 1
        continue
    hits = []
    for n, line in enumerate(text.splitlines(), 1):
        real = line.count(EM)
        esc = sum(line.count(e) for e in ESCAPES)
        if real or esc:
            hits.append((n, real, esc, line.strip()[:70]))
    n_real = sum(h[1] for h in hits)
    n_esc = sum(h[2] for h in hits)
    real_total += n_real
    esc_total += n_esc
    print(f"real {n_real:>3}  esc {n_esc:>3}  {len(text.encode('utf-8')):>7} bytes  {mode}  {path}")
    for n, real, esc, snip in hits:
        print(f"        line {n} real x{real} esc x{esc}: {snip}")
print(f"TOTAL real {real_total}  esc {esc_total}  unreadable {fails}")
if real_total or fails:
    sys.exit(1)
sys.exit(2 if esc_total else 0)
