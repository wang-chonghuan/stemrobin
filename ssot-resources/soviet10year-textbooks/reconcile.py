#!/usr/bin/env python3
"""Account for every line of the printed contents in the transcribed JSON.

validate.py checks a volume's shape; this checks that nothing was dropped while
transcribing it. Every `- ` line of a printed volume's contents must turn up as a
chapter, a lesson or a topic — or fall under one of the deliberate exclusions
(answers, index, appendix, and everything nested beneath them). Anything else is
a hole, and holes are silent: the shape stays valid while the book loses a page.

Run from the repo root:
    python3 ssot-resources/soviet10year-textbooks/reconcile.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT.parent.parent / "resources/soviet10years/toc/苏联十年制学校教材-书名作者目录.md"
EXCLUDE = re.compile(r"答案|索引|附录")

# The printed heading carries an ordinal that the JSON keeps in `number` /
# `source` / `printedNumber` rather than in the title, so strip it before
# comparing text to text. An item number may carry ▼ or * (the series marks
# optional material that way) or a letter suffix where a later edition inserted
# an item without renumbering the rest (9p prints 127a between 127 and 128).
ORDINAL = re.compile(
    r"^(第[一二三四五六七八九十]+章|§\s*\d+[a-z]?[*▼]*\.?|\d+[a-z]?[*▼]*\.)\s*"
)


def norm(s: str) -> str:
    s = re.sub(r"\s*\.{3,}.*$", "", s).replace("**", "").strip()
    s = re.sub(r"<!--.*?-->", "", s)
    while ORDINAL.match(s):
        s = ORDINAL.sub("", s)
    return re.sub(r"[\s　]", "", s)


def source_slices() -> dict[str, list[str]]:
    """Printed contents lines per book id, minus anything under an exclusion.

    An excluded heading takes its subtree with it: `附录` is one line but may
    print nine children, and none of them belong in the outline either.
    """
    out: dict[str, list[str]] = {}
    book, listing, cut_at = None, False, None
    for ln in SRC.read_text(encoding="utf-8").split("\n"):
        if m := re.match(r"^# ([\w\-]+) — ", ln):
            book, listing, cut_at = m.group(1), False, None
            out[book] = []
            continue
        if book is None:
            continue
        if ln.startswith("## 目录"):
            listing = True
            continue
        if not listing or not (m := re.match(r"^(\s*)- (.*)$", ln)):
            continue
        depth, text = len(m.group(1)) // 2, m.group(2)
        if cut_at is not None and depth > cut_at:
            continue  # inside an excluded subtree
        cut_at = depth if EXCLUDE.search(text) else None
        if cut_at is None:
            out[book].append(text)
    return out


def json_titles(d: pathlib.Path) -> list[str]:
    doc = json.loads((d / "zh.json").read_text(encoding="utf-8"))
    out = []
    for c in doc["contents"]:
        out.append(c["title"])
        for l in c.get("lessons", []):
            out.append(l["title"])
            out += [t["title"] for t in l.get("topics", [])]
    return out


def main() -> int:
    slices = source_slices()

    # A printed book may be shelved as more than one volume (6-7p → 6p + 7p), so
    # reconcile per printed book against the union of the volumes cut from it.
    by_book: dict[str, list[pathlib.Path]] = {}
    for d in sorted((ROOT / "toc").iterdir()):
        if not d.is_dir():
            continue
        bid = json.loads((d / "zh.json").read_text(encoding="utf-8"))["source"].get("bookId", d.name)
        by_book.setdefault(bid, []).append(d)

    holes = 0
    print(f"{'printed book':14}{'volumes':>16}{'lines':>7}{'matched':>9}   unaccounted")
    for bid, dirs in sorted(by_book.items()):
        printed = slices.get(bid)
        if printed is None:
            print(f"{bid:14}{'':>16}{'':>7}{'':>9}   no printed slice for this bookId")
            holes += 1
            continue
        have = set()
        for d in dirs:
            have |= {norm(t) for t in json_titles(d)}
        # The grade lines of a split book are consumed by the split itself.
        missing = [
            t
            for t in printed
            if norm(t) not in have and norm(t) not in {"六年级", "七年级"}
        ]
        print(
            f"{bid:14}{'+'.join(d.name for d in dirs):>16}{len(printed):>7}"
            f"{len(printed) - len(missing):>9}   "
            + ("—" if not missing else "; ".join(norm(h) for h in missing)[:60])
        )
        holes += len(missing)

    print()
    print("holes: 0 — every printed line accounted for" if not holes else f"HOLES: {holes}")
    return 1 if holes else 0


if __name__ == "__main__":
    sys.exit(main())
