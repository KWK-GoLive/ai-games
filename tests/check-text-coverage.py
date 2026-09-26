"""
Text coverage check for the v3 visual pass: every teaching sentence (8+ words) in the student-facing
files of the baseline copy must still appear somewhere in the new site (visible, or inside a "More" fold).
  python3 tests/check-text-coverage.py <baseline-dir> [new-dir]
Prints every sentence that disappeared, so each one can be checked by hand.
"""
import os, re, sys, glob, json
base = sys.argv[1]; new = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERNS = ["index.html", "*/index.html", "shared/arena.js", "be-the-*/js/*.js", "be-the-*/js/levels/*.js", "*-arena/js/stages.js", "*-arena/js/items.js", "*-arena/data/*.js", "be-the-*/data/*.js"]
def files(root):
    out = []
    for p in PATTERNS: out += glob.glob(os.path.join(root, p))
    return sorted(set(out))
def strings(text):
    text = text.encode().decode("unicode_escape", errors="ignore") if False else text
    lits = re.findall(r'"((?:[^"\\\n]|\\.)*)"', text) + re.findall(r">([^<>]{20,})<", text)
    out = []
    for s in lits:
        s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s).replace('\\"', '"').replace("\\n", " ")
        for sent in re.split(r"(?<=[.!?:])\s+", s):
            if len(sent.split()) >= 8: out.append(" ".join(sent.split()))
    return out
def norm(s): return re.sub(r"\s+", " ", re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)).replace('\\"', '"')
corpus = norm("\n".join(open(f, encoding="utf8").read() for f in files(new) + glob.glob(os.path.join(new, "shared/*.js"))))
missing, total = [], 0
for f in files(base):
    for s in strings(open(f, encoding="utf8").read()):
        total += 1
        if s not in corpus: missing.append((os.path.relpath(f, base), s))
print(f"{total} sentences checked, {len(missing)} no longer found word for word:")
for f, s in missing: print(f"  {f}: {s}")
