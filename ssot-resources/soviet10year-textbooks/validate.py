#!/usr/bin/env python3
"""Check every transcribed volume against the contract in README.md.

Run from the repo root:  python3 ssot-resources/soviet10year-textbooks/validate.py
Exits non-zero on the first failure, so it can gate a commit.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TOC = ROOT / "toc"
SUBJECTS = {"early", "algebra", "analysis", "geometry", "physics"}
KINDS = {"chapter", "exercises", "section"}

errors: list[str] = []


def fail(book: str, msg: str) -> None:
    errors.append(f"{book}: {msg}")


def skeleton(doc: dict) -> list:
    """Everything that must be identical across locales — structure, not words."""
    out = []
    for e in doc["contents"]:
        out.append((e["id"], e["kind"], e.get("number"), e.get("page")))
        if e["kind"] == "chapter":
            for l in e["lessons"]:
                out.append(
                    (
                        l["id"],
                        l["kind"],
                        l.get("number"),
                        l.get("page"),
                        json.dumps(l["source"], ensure_ascii=False, sort_keys=True),
                        tuple((t["id"], t["printedNumber"]) for t in l.get("topics", [])),
                    )
                )
        else:
            out.append((e["id"], "leaf-source", json.dumps(e["source"], ensure_ascii=False, sort_keys=True)))
    return out


def check_book(d: pathlib.Path) -> None:
    book = d.name
    files = {p.stem: p for p in d.glob("*.json")}
    if "zh" not in files:
        return fail(book, "no zh.json — the extracted file is the authority and must exist")
    docs = {}
    for loc, p in files.items():
        try:
            docs[loc] = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            return fail(book, f"{p.name} is not valid JSON: {exc}")

    zh = docs["zh"]
    if zh.get("authority") != "extracted":
        fail(book, 'zh.json must carry "authority": "extracted"')
    if zh.get("book") != book:
        fail(book, f'book field {zh.get("book")!r} does not match its directory')
    if zh.get("subject") not in SUBJECTS:
        fail(book, f'unknown subject {zh.get("subject")!r}')
    if not isinstance(zh.get("grade"), int):
        fail(book, "grade must be an integer (the volume's entry grade)")

    ids: set[str] = set()
    for e in zh["contents"]:
        if e["kind"] not in KINDS:
            fail(book, f'{e["id"]}: unknown kind {e["kind"]!r}')
        entries = e["lessons"] if e["kind"] == "chapter" else [e]
        if e["kind"] == "chapter" and not e["lessons"]:
            fail(book, f'{e["id"]}: a chapter with no lessons — it is a leaf, use its own kind')
        for l in entries:
            if l["id"] in ids:
                fail(book, f'duplicate id {l["id"]}')
            ids.add(l["id"])
            src = l.get("source")
            if not isinstance(src, dict) or not ({"printedSection", "printedName"} & src.keys()):
                fail(book, f'{l["id"]}: source must carry printedSection or printedName')
            if "page" not in l:
                fail(book, f'{l["id"]}: missing page')
            for tp in l.get("topics", []):
                want = f'{l["id"]}-n{tp["printedNumber"]}'
                if tp.get("id") != want:
                    fail(book, f'topic under {l["id"]}: id should be {want}, got {tp.get("id")!r}')
                if tp["id"] in ids:
                    fail(book, f'duplicate id {tp["id"]}')
                ids.add(tp["id"])

    base = skeleton(zh)
    for loc, doc in docs.items():
        if loc == "zh":
            continue
        if doc.get("authority") != "translated":
            fail(book, f'{loc}.json must carry "authority": "translated"')
        if skeleton(doc) != base:
            first = next(
                (f"{a!r} vs {b!r}" for a, b in zip(base, skeleton(doc)) if a != b),
                "length differs",
            )
            fail(book, f"{loc}.json skeleton differs from zh.json — {first}")


def main() -> int:
    books = sorted(p for p in TOC.iterdir() if p.is_dir())
    if not books:
        print("no volumes under toc/", file=sys.stderr)
        return 1
    for d in books:
        check_book(d)
    for e in errors:
        print("FAIL", e, file=sys.stderr)
    if errors:
        return 1
    lessons = 0
    for d in books:
        doc = json.loads((d / "zh.json").read_text(encoding="utf-8"))
        lessons += sum(
            len(e["lessons"]) if e["kind"] == "chapter" else 1 for e in doc["contents"]
        )
    print(f"OK — {len(books)} volumes, {lessons} lessons")
    return 0


if __name__ == "__main__":
    sys.exit(main())
