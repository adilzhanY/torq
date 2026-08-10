#!/usr/bin/env python3
"""Split the ExerciseDB snapshot into a small core file and a lazy one.

Why: the full snapshot is ~1.14 MB minified, and materialising it cost
~270 ms of every COLD START, before the first frame. Measured, not guessed.
Of that, `instructions` alone is 786 KB (69%) and is needed on exactly one
screen (the exercise About tab), while `gifUrl` (89 KB) is pure duplication
of a template around `exerciseId`.

So: the core file keeps only what browsing and searching need, and the
instructions live in a second file that is required on demand.

Usage, refreshing the catalog:
    curl 'https://oss.exercisedb.dev/api/v1/exercises?limit=25&after=<cursor>' ...
    # assemble the full dump as full-dump.json, then:
    python3 scripts/split-catalog.py full-dump.json
"""
import json
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "src/data/exercisedb.json")
CORE = Path("src/data/exercisedb.json")
INSTR = Path("src/data/exercisedb-instructions.json")

rows = json.loads(SRC.read_text())

core = [
    {
        "exerciseId": r["exerciseId"],
        "name": r["name"],
        "bodyParts": r["bodyParts"],
        "equipments": r["equipments"],
        "targetMuscles": r["targetMuscles"],
        "secondaryMuscles": r["secondaryMuscles"],
    }
    for r in rows
]
# id -> steps. An object, not an array: the only access pattern is by id.
instructions = {r["exerciseId"]: r.get("instructions", []) for r in rows}

# Minified: this is generated data nobody reads by hand, and every byte is
# parsed on the device.
CORE.write_text(json.dumps(core, separators=(",", ":")))
INSTR.write_text(json.dumps(instructions, separators=(",", ":")))

kb = lambda p: p.stat().st_size / 1024
print(f"{len(rows)} exercises")
print(f"  core         {CORE}  {kb(CORE):.0f} KB   (loaded at startup)")
print(f"  instructions {INSTR}  {kb(INSTR):.0f} KB   (loaded on demand)")
