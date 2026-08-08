"""Build torq's percentile tables from the OpenPowerlifting CSV dump.

Usage (from the repo root):
    curl -sL -o opl.zip \
      https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip
    python3 scripts/build-percentiles.py > src/data/percentiles.json

The dump is ~168 MB zipped / ~800 MB of CSV and is NOT committed; only the
2 KB result is. Re-run it when the numbers should be refreshed, then bump
the "built" field.

Distributions are over DOTS POINTS, not kilos: DOTS already normalizes sex
and bodyweight, which is exactly what the rank engine scores on, so one
curve per (sex, lift) covers every weight class.

Dedup: best result per LIFTER, so someone who competes ten times a year
doesn't count ten times.
"""
import csv, io, json, zipfile, sys

ZIP = "opl.zip"
DOTS_M = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
DOTS_F = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]

def dots(kg, bw, sex):
    c = DOTS_F if sex == "F" else DOTS_M
    bw = min(max(bw, 40.0), 150.0 if sex == "F" else 210.0)
    d = c[0] + c[1]*bw + c[2]*bw**2 + c[3]*bw**3 + c[4]*bw**4
    return kg * 500.0 / d

z = zipfile.ZipFile(ZIP)
name = [x for x in z.namelist() if x.endswith(".csv")][0]

LIFTS = [("squat", "Best3SquatKg"), ("bench", "Best3BenchKg"), ("deadlift", "Best3DeadliftKg")]
# (sex, lift) -> {lifter: best dots}
best = {(s, l): {} for s in ("M", "F") for l, _ in LIFTS}

rows = kept = 0
with z.open(name) as fh:
    for r in csv.DictReader(io.TextIOWrapper(fh, "utf-8", errors="replace")):
        rows += 1
        if rows % 1_000_000 == 0:
            print(f"  {rows:,} rows…", file=sys.stderr, flush=True)
        # Raw (classic) only — equipped lifts are a different sport, and the
        # app's users are lifting raw.
        if r["Equipment"] != "Raw":
            continue
        sex = r["Sex"]
        if sex not in ("M", "F"):
            continue
        try:
            bw = float(r["BodyweightKg"] or 0)
        except ValueError:
            continue
        if not (30 <= bw <= 250):
            continue
        who = r["Name"]
        for lift, col in LIFTS:
            v = r[col]
            if not v:
                continue
            try:
                kg = float(v)
            except ValueError:
                continue
            if kg <= 0:          # negatives are failed/no-lift markers
                continue
            p = dots(kg, bw, sex)
            if p <= 0 or p > 300:  # data-entry garbage
                continue
            d = best[(sex, lift)]
            if p > d.get(who, 0):
                d[who] = p
                kept += 1

QUANTILES = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]

def quantiles(vals):
    vals.sort()
    n = len(vals)
    out = {}
    for q in QUANTILES:
        i = min(n - 1, max(0, round(q / 100 * (n - 1))))
        out[str(q)] = round(vals[i], 1)
    return out

table = {}
for (sex, lift), d in best.items():
    key = ("male" if sex == "M" else "female")
    table.setdefault(key, {})[lift] = {
        "n": len(d),
        "q": quantiles(list(d.values())),
    }

meta = {"source": name.split("/")[0], "rows": rows}
print(json.dumps({"meta": meta, "table": table}, indent=1))
print(f"rows={rows:,} samples={kept:,}", file=sys.stderr)
